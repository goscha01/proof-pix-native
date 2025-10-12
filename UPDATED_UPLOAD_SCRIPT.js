function doPost(e) {
  try {
    console.log('=== UPLOAD REQUEST RECEIVED ===');
    console.log('Parameters:', Object.keys(e.parameter));

    // Get parameters from the request
    const folderId = e.parameter.folderId;
    const filename = e.parameter.filename;
    const albumName = e.parameter.albumName;
    const room = e.parameter.room;
    const type = e.parameter.type;
    const format = e.parameter.format || 'default';
    const timestamp = e.parameter.timestamp;
    const location = e.parameter.location;
    const imageData = e.parameter.image;
    const cleanerName = e.parameter.cleanerName;

    console.log('Folder ID:', folderId);
    console.log('Filename:', filename);
    console.log('Album Name:', albumName);
    console.log('Room:', room);
    console.log('Type:', type);
    console.log('Format:', format);
    console.log('Cleaner Name:', cleanerName);
    console.log('Image data length:', imageData ? imageData.length : 'undefined');

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
    console.log('Getting main folder...');
    const mainFolder = DriveApp.getFolderById(folderId);
    console.log('Main folder found:', mainFolder.getName());

    // Use lock to prevent race conditions during folder creation
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000); // Wait up to 30 seconds for the lock
    } catch (e) {
      console.log('Could not obtain lock, proceeding without lock');
    }

    let targetFolder;
    try {
      // Create album folder - FIRST LEVEL (e.g., "John - Tampa - Dec 21, 2024")
      const sanitizedAlbumName = albumName.replace(/[<>:"/\\|?*]/g, '_');
      console.log('Creating/finding album folder:', sanitizedAlbumName);
      let albumFolder = getOrCreateFolder(mainFolder, sanitizedAlbumName);

      // Determine folder structure based on photo type and format
      if (format !== 'default') {
        // Create formats folder for multiple formats - SECOND LEVEL
        console.log('Creating/finding formats folder...');
        let formatsFolder = getOrCreateFolder(albumFolder, 'formats');
        
        // Create specific format folder - THIRD LEVEL
        console.log('Creating/finding format folder:', format);
        targetFolder = getOrCreateFolder(formatsFolder, format);
      } else {
        // For default format, create type folders directly under album - SECOND LEVEL
        const folderName = type === 'mix' ? 'combined' : type;
        console.log('Creating/finding type folder:', folderName);
        targetFolder = getOrCreateFolder(albumFolder, folderName);
      }

      console.log('Target folder selected:', targetFolder.getName());
      console.log('Photo type received:', type);
      console.log('Format received:', format);

    } finally {
      // Always release the lock
      if (lock) {
        try {
          lock.releaseLock();
        } catch (e) {
          console.log('Lock already released');
        }
      }
    }

    // Convert base64 to blob (outside the lock to minimize lock time)
    console.log('Processing image data...');
    let base64Data;
    if (imageData.startsWith('data:')) {
      // Remove data URL prefix if present (data:image/jpeg;base64,)
      base64Data = imageData.split(',')[1];
      console.log('Removed data URL prefix');
    } else {
      // Assume it's already base64 without prefix
      base64Data = imageData;
      console.log('Using raw base64 data');
    }

    if (!base64Data || base64Data.length === 0) {
      throw new Error('No valid base64 data found in image parameter');
    }

    console.log('Base64 data length:', base64Data.length);

    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      'image/jpeg',
      filename
    );

    console.log('Created blob successfully');

    // Save to Drive
    console.log('Saving file to Drive...');
    const file = targetFolder.createFile(blob);
    console.log('File saved successfully!');
    console.log('File name:', file.getName());
    console.log('File ID:', file.getId());

    // Build folder path for response
    let folderPath = `${albumName}/`;
    if (format !== 'default') {
      folderPath += `formats/${format}/`;
    } else {
      folderPath += `${type === 'mix' ? 'combined' : type}/`;
    }

    // Return success response
    console.log('Returning success response');
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
        message: 'Photo uploaded successfully'
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('=== UPLOAD ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

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
    console.log('Using existing folder:', folderName);
    return existingFolders.next();
  } else {
    console.log('Creating new folder:', folderName);
    return parentFolder.createFolder(folderName);
  }
}
