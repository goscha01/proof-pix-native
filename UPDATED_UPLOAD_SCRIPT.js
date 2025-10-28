function doPost(e) {
  try {
    // Get parameters from the request
    const folderId = e.parameter.folderId;
    const filename = e.parameter.filename;
    const albumName = e.parameter.albumName;
    const room = e.parameter.room;
    const type = e.parameter.type;
    const format = e.parameter.format || 'default';
    const flatMode = e.parameter.flat === 'true'; // when true, skip subfolder creation
    const timestamp = e.parameter.timestamp;
    const location = e.parameter.location;
    const imageData = e.parameter.image;
    const cleanerName = e.parameter.cleanerName;
    // Validate required parameters
    if (!folderId) {
      throw new Error('Missing folderId parameter');
    }
    if (!filename) {
      throw new Error('Missing filename parameter');
    }
    if (!albumName) {
      throw new Error('Missing albumName parameter');
    }
    if (!imageData) {
      throw new Error('Missing image data parameter');
    }
    if (!cleanerName) {
      throw new Error('Missing cleanerName parameter');
    }

    // Get the main location folder
    const mainFolder = DriveApp.getFolderById(folderId);
    // Use lock to prevent race conditions during folder creation
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000); // Wait up to 30 seconds for the lock
    } catch (e) {
    }

    let targetFolder;
    try {
      // Create album folder - FIRST LEVEL (e.g., "John - Tampa - Dec 21, 2024")
      const sanitizedAlbumName = albumName.replace(/[<>:"/\\|?*]/g, '_');
      let albumFolder = getOrCreateFolder(mainFolder, sanitizedAlbumName);

      // Determine folder structure based on photo type and format
      if (!flatMode && format !== 'default') {
        // Create formats folder for multiple formats - SECOND LEVEL
        let formatsFolder = getOrCreateFolder(albumFolder, 'formats');
        
        // Create specific format folder - THIRD LEVEL
        targetFolder = getOrCreateFolder(formatsFolder, format);
      } else if (!flatMode) {
        // For default format, create type folders directly under album - SECOND LEVEL
        const folderName = type === 'mix' ? 'combined' : type;
        targetFolder = getOrCreateFolder(albumFolder, folderName);
      } else {
        // Flat mode: upload directly into the album root
        targetFolder = albumFolder;
      }
    } finally {
      // Always release the lock
      if (lock) {
        try {
          lock.releaseLock();
        } catch (e) {
        }
      }
    }

    // Convert base64 to blob (outside the lock to minimize lock time)
    let base64Data;
    if (imageData.startsWith('data:')) {
      // Remove data URL prefix if present (data:image/jpeg;base64,)
      base64Data = imageData.split(',')[1];
    } else {
      // Assume it's already base64 without prefix
      base64Data = imageData;
    }

    if (!base64Data || base64Data.length === 0) {
      throw new Error('No valid base64 data found in image parameter');
    }
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      'image/jpeg',
      filename
    );
    // Save to Drive
    const file = targetFolder.createFile(blob);
    // Build folder path for response
    let folderPath = `${albumName}/`;
    if (!flatMode) {
      if (format !== 'default') {
        folderPath += `formats/${format}/`;
      } else {
        folderPath += `${type === 'mix' ? 'combined' : type}/`;
      }
    }

    // Return success response
      return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        fileId: file.getId(),
        fileName: filename,
        albumName: albumName,
        room: room,
        type: type,
        format: format,
        location: location,
        cleanerName: cleanerName,
        folderPath: folderPath,
        flatMode: !!flatMode,
        message: 'Photo uploaded successfully'
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        message: 'Upload failed: ' + error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to get or create a folder (reduces duplicate code and race conditions)
function getOrCreateFolder(parentFolder, folderName) {
  const existingFolders = parentFolder.getFoldersByName(folderName);

  if (existingFolders.hasNext()) {
    return existingFolders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}
