import googleAuthService from './googleAuthService';

const FOLDER_NAME = 'ProofPix-Uploads';
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';

class GoogleDriveService {
  /**
   * Finds or creates a "ProofPix-Uploads" folder in the user's Google Drive.
   * @returns {Promise<string|null>} The ID of the folder, or null if an error occurs.
   */
  async findOrCreateProofPixFolder() {
    try {
      const folderId = await this.findFolder();
      if (folderId) {
        console.log('Found existing ProofPix folder:', folderId);
        return folderId;
      } else {
        console.log('ProofPix folder not found, creating a new one...');
        const newFolderId = await this.createFolder();
        return newFolderId;
      }
    } catch (error) {
      console.error('Error in findOrCreateProofPixFolder:', error);
      throw new Error('Could not find or create the ProofPix folder in Google Drive.');
    }
  }

  /**
   * Searches for a folder with the name "ProofPix-Uploads".
   * @private
   * @returns {Promise<string|null>} The folder ID if found, otherwise null.
   */
  async findFolder() {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`;
    const url = `${DRIVE_API_URL}?q=${encodeURIComponent(query)}&fields=files(id)`;

    const response = await googleAuthService.makeAuthenticatedRequest(url);

    if (!response.ok) {
      throw new Error('Failed to search for folder in Google Drive.');
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    return null;
  }

  /**
   * Creates a new folder named "ProofPix-Uploads".
   * @private
   * @returns {Promise<string>} The ID of the newly created folder.
   */
  async createFolder() {
    const metadata = {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    };

    const response = await googleAuthService.makeAuthenticatedRequest(DRIVE_API_URL, {
      method: 'POST',
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create folder:', errorText);
      throw new Error('Failed to create folder in Google Drive.');
    }

    const data = await response.json();
    return data.id;
  }
}

export default new GoogleDriveService();


