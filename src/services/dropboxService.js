import dropboxAuthService from './dropboxAuthService';
import * as FileSystem from 'expo-file-system/legacy';

const FOLDER_NAME = 'ProofPix-Uploads';
const DROPBOX_API_URL = 'https://api.dropboxapi.com/2';

class DropboxService {
  /**
   * Finds or creates a "ProofPix-Uploads" folder in the user's Dropbox.
   * @returns {Promise<string|null>} The path of the folder, or null if an error occurs.
   */
  async findOrCreateProofPixFolder() {
    try {
      const folderPath = await this.findFolder();
      if (folderPath) {
        console.log('Found existing ProofPix folder:', folderPath);
        return folderPath;
      } else {
        console.log('ProofPix folder not found, creating a new one...');
        const newFolderPath = await this.createFolder();
        console.log('Created new ProofPix folder:', newFolderPath);
        return newFolderPath;
      }
    } catch (error) {
      console.error('Error in findOrCreateProofPixFolder:', error);
      throw new Error('Could not find or create the ProofPix folder in Dropbox.');
    }
  }

  /**
   * Searches for a folder with the name "ProofPix-Uploads".
   * @private
   * @returns {Promise<string|null>} The folder path if found, otherwise null.
   */
  async findFolder() {
    try {
      const response = await dropboxAuthService.makeAuthenticatedRequest(
        `${DROPBOX_API_URL}/files/list_folder`,
        {
          method: 'POST',
          body: JSON.stringify({
            path: '',
            recursive: false,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        }
        const errorText = await response.text();
        throw new Error(`Failed to list Dropbox folders (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const folder = data.entries?.find(
        (entry) => entry.name === FOLDER_NAME && entry['.tag'] === 'folder'
      );

      return folder ? folder.path_lower : null;
    } catch (error) {
      console.error('Error finding folder:', error);
      throw error;
    }
  }

  /**
   * Creates a new folder named "ProofPix-Uploads".
   * @private
   * @returns {Promise<string>} The path of the newly created folder.
   */
  async createFolder() {
    try {
      const response = await dropboxAuthService.makeAuthenticatedRequest(
        `${DROPBOX_API_URL}/files/create_folder_v2`,
        {
          method: 'POST',
          body: JSON.stringify({
            path: `/${FOLDER_NAME}`,
            autorename: false,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to create folder:', errorText);
        throw new Error('Failed to create folder in Dropbox.');
      }

      const data = await response.json();
      return data.metadata.path_lower;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
   * Upload a file to Dropbox
   * @param {string} filePath - Path in Dropbox (e.g., "/ProofPix-Uploads/filename.jpg")
   * @param {string} fileUri - File URI (local file path)
   * @param {string} mode - 'add' (default) or 'overwrite'
   * @returns {Promise<object>} Upload result with file metadata
   */
  async uploadFile(filePath, fileUri, mode = 'add') {
    try {
      // Read file as base64
      let fileContent;
      if (fileUri.startsWith('data:')) {
        // Extract base64 from data URL
        const base64Match = fileUri.match(/^data:[^;]+;base64,(.+)$/);
        if (base64Match) {
          fileContent = base64Match[1];
        } else {
          throw new Error('Invalid data URL format');
        }
      } else {
        // Read file from URI as base64
        fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const response = await dropboxAuthService.makeAuthenticatedRequest(
        `${DROPBOX_API_URL}/files/upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': JSON.stringify({
              path: filePath,
              mode: mode === 'overwrite' ? { '.tag': 'overwrite' } : { '.tag': 'add' },
              autorename: true,
              mute: false,
            }),
          },
          body: (() => {
            // Dropbox API requires binary data, not base64 string
            // Convert base64 to binary ArrayBuffer
            try {
              const binaryString = atob(fileContent);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              return bytes.buffer;
            } catch (error) {
              // Fallback: try to send as-is if conversion fails
              console.warn('[DROPBOX] Failed to convert base64 to binary, sending as string:', error);
              return fileContent;
            }
          })(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload file to Dropbox: ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Find or create an album folder within the ProofPix-Uploads folder
   * @param {string} parentFolderPath - Parent folder path (e.g., "/proofpix-uploads")
   * @param {string} albumName - Album folder name
   * @returns {Promise<string>} The path of the album folder
   */
  async findOrCreateAlbumFolder(parentFolderPath, albumName) {
    try {
      const albumPath = `${parentFolderPath}/${albumName}`;

      // Try to find existing folder
      try {
        const response = await dropboxAuthService.makeAuthenticatedRequest(
          `${DROPBOX_API_URL}/files/get_metadata`,
          {
            method: 'POST',
            body: JSON.stringify({
              path: albumPath,
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data['.tag'] === 'folder') {
            return data.path_lower;
          }
        }
      } catch (error) {
        // Folder doesn't exist, create it
      }

      // Create folder
      const response = await dropboxAuthService.makeAuthenticatedRequest(
        `${DROPBOX_API_URL}/files/create_folder_v2`,
        {
          method: 'POST',
          body: JSON.stringify({
            path: albumPath,
            autorename: false,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create album folder: ${errorText}`);
      }

      const data = await response.json();
      return data.metadata.path_lower;
    } catch (error) {
      console.error('Error in findOrCreateAlbumFolder:', error);
      throw error;
    }
  }
}

// Export singleton instance
const dropboxService = new DropboxService();
export default dropboxService;

