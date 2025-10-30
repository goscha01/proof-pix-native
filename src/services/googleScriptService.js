import googleAuthService from './googleAuthService';

const SCRIPT_API_URL = 'https://script.googleapis.com/v1/projects';

// The Apps Script code that will be deployed.
const SCRIPT_CODE = `
function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var allowedTokens = JSON.parse(props.getProperty('INVITE_TOKENS') || '[]');
    var folderId = props.getProperty('UPLOAD_FOLDER_ID');
    
    var token = e.parameter.token;
    if (!token || allowedTokens.indexOf(token) === -1) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : null;
    if (body && body.filename && body.contentBase64) {
      var blob = Utilities.newBlob(Utilities.base64Decode(body.contentBase64), '', body.filename);
      var folder = DriveApp.getFolderById(folderId);
      var file = folder.createFile(blob);
      return ContentService.createTextOutput(JSON.stringify({ success: true, fileId: file.getId() })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ error: 'Bad request' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function updateScriptProperties(payload) {
  var props = PropertiesService.getScriptProperties();
  if (payload.folderId) props.setProperty('UPLOAD_FOLDER_ID', payload.folderId);
  if (payload.inviteTokens) props.setProperty('INVITE_TOKENS', JSON.stringify(payload.inviteTokens));
  if (payload.planLimit) props.setProperty('PLAN_LIMIT', payload.planLimit.toString());
  return true;
}
`;

class GoogleScriptService {
  /**
   * Creates a new Apps Script project, updates its content, and deploys it as a web app.
   * @param {string} folderId The ID of the Google Drive folder where uploads will be stored.
   * @returns {Promise<{scriptId: string, scriptUrl: string}>} The ID and URL of the deployed script.
   */
  async createAndDeployScript(folderId) {
    try {
      // Step 1: Create the Apps Script project
      const scriptId = await this.createScriptProject();
      console.log('Created Apps Script project with ID:', scriptId);

      // Step 2: Update the script's content with our code
      await this.updateScriptContent(scriptId);
      console.log('Updated script content.');

      // Step 3: Deploy the script as a web app
      const deploymentId = await this.deployScript(scriptId);
      console.log('Deployed script with deployment ID:', deploymentId);

      // The script URL is constructed from the script ID and deployment ID
      const scriptUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;

      return { scriptId, scriptUrl };
    } catch (error) {
      // The error is re-thrown to be handled by the UI, so no console log is needed here.
      throw error;
    }
  }

  /**
   * Creates a new, empty Apps Script project.
   * @private
   * @returns {Promise<string>} The ID of the new script project.
   */
  async createScriptProject() {
    const response = await googleAuthService.makeAuthenticatedRequest(SCRIPT_API_URL, {
      method: 'POST',
      body: JSON.stringify({ title: 'ProofPix Upload Gateway' }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // No need to console.error here, as this is handled in the UI
      throw new Error(`Failed to create Apps Script project. Status: ${response.status}. Body: ${errorBody}`);
    }

    const data = await response.json();
    return data.scriptId;
  }

  /**
   * Updates the content of an Apps Script project.
   * @private
   * @param {string} scriptId The ID of the script to update.
   */
  async updateScriptContent(scriptId) {
    const url = `${SCRIPT_API_URL}/${scriptId}/content`;
    const payload = {
      files: [{
        name: 'appsscript',
        type: 'JSON',
        source: JSON.stringify({ "runtimeVersion": "V8" })
      }, {
        name: 'Code',
        type: 'SERVER_JS',
        source: SCRIPT_CODE
      }]
    };

    const response = await googleAuthService.makeAuthenticatedRequest(url, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Failed to update script content. Status:', response.status);
      const errorBody = await response.text();
      console.error('Error Body:', errorBody);
      throw new Error('Failed to update script content.');
    }

    const data = await response.json();
    console.log('Successfully updated script content:', data);
    return data;
  }

  /**
   * Creates a new deployment for an Apps Script project.
   * @private
   * @param {string} scriptId The ID of the script to deploy.
   * @returns {Promise<string>} The ID of the new deployment.
   */
  async deployScript(scriptId) {
    // First, we need to create a version of the script to deploy
    const versionUrl = `${SCRIPT_API_URL}/${scriptId}/versions`;
    const versionResponse = await googleAuthService.makeAuthenticatedRequest(versionUrl, {
      method: 'POST',
      body: JSON.stringify({ description: 'Initial version' }),
    });

    if (!versionResponse.ok) {
      throw new Error('Failed to create script version.');
    }
    const versionData = await versionResponse.json();
    const versionNumber = versionData.versionNumber;

    // Now, create the deployment using the new version
    const deploymentUrl = `${SCRIPT_API_URL}/${scriptId}/deployments`;
    const deploymentBody = {
      versionNumber: versionNumber,
      description: 'Live web app deployment',
      manifestFileName: 'appsscript',
    };

    const deploymentResponse = await googleAuthService.makeAuthenticatedRequest(deploymentUrl, {
      method: 'POST',
      body: JSON.stringify(deploymentBody),
    });

    if (!deploymentResponse.ok) {
      throw new Error('Failed to deploy script.');
    }

    const deploymentData = await deploymentResponse.json();
    return deploymentData.deploymentId;
  }

  /**
   * Updates the invite tokens stored in the script's properties.
   * @param {string} scriptId The ID of the script to update.
   * @param {string[]} tokens The new array of invite tokens.
   * @returns {Promise<boolean>} True if the update was successful.
   */
  async updateInviteTokens(scriptId, tokens) {
    const url = `${SCRIPT_API_URL}/${scriptId}:run`;
    const body = {
      function: 'updateScriptProperties',
      parameters: [
        {
          folderId: null, // We are only updating the tokens
          inviteTokens: tokens,
        },
      ],
      devMode: false,
    };

    const response = await googleAuthService.makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to update script properties.');
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.response.result;
  }
}

export default new GoogleScriptService();
