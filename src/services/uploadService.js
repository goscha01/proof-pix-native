/**
 * Upload Service
 * Handles uploading photos to Google Drive via Google Apps Script
 */

import * as FileSystem from 'expo-file-system/legacy';

/**
 * Convert file URI to base64 data URL
 * @param {string} fileUri - The file URI (file://...)
 * @returns {Promise<string>} - Base64 data URL (data:image/jpeg;base64,...)
 */
async function fileUriToBase64(fileUri) {
  try {
    console.log('📸 Reading file:', fileUri);

    // Read the file as base64 (using string encoding type)
    let base64;

    // Build candidate URIs to try reading
    const candidates = [fileUri];
    if (fileUri.startsWith('file:///private/var/')) {
      candidates.push(fileUri.replace('file:///private/var/', 'file:///var/'));
    } else if (fileUri.startsWith('/private/var/')) {
      candidates.push(`file://${fileUri.replace('/private/var/', '/var/')}`);
    }

    let lastError = null;
    for (const candidate of candidates) {
      try {
        if (candidate !== fileUri) {
          console.warn('⚠️ Primary read failed, retrying with fallback URI:', candidate);
        }
        base64 = await FileSystem.readAsStringAsync(candidate, { encoding: 'base64' });
        if (base64) {
          console.log('✅ File converted to base64, length:', base64.length);
          return `data:image/jpeg;base64,${base64}`;
        }
      } catch (err) {
        lastError = err;
      }
    }

    // As a final fallback, try copying the file into cacheDirectory and read from there
    try {
      const source = candidates[0];
      const fileName = (source.split('/').pop() || `tmp_${Date.now()}.jpg`).replace(/\?.*$/, '');
      const dest = `${FileSystem.cacheDirectory}${Date.now()}_${fileName}`;
      console.warn('⚠️ Copying to cache for read:', dest);
      await FileSystem.copyAsync({ from: source, to: dest });
      base64 = await FileSystem.readAsStringAsync(dest, { encoding: 'base64' });
      if (base64) {
        console.log('✅ File converted to base64 from cache, length:', base64.length);
        return `data:image/jpeg;base64,${base64}`;
      }
    } catch (copyErr) {
      lastError = copyErr;
    }

    // If we got here, we failed all attempts
    if (lastError) throw lastError;
    throw new Error('Unknown file read error');
  } catch (error) {
    console.error('❌ Error converting file to base64:', error);
    throw new Error('Failed to read image file');
  }
}

// Normalize any local path/URI into a proper file URI that Expo FS can read
function normalizeFileUri(input) {
  if (!input) return input;
  if (input.startsWith('data:')) return input;
  if (input.startsWith('file://')) return input;
  if (input.startsWith('/')) return `file://${input}`; // iOS absolute path -> file:///...
  return input;
}

/**
 * Upload a single photo to Google Drive
 * @param {Object} params - Upload parameters
 * @param {string} params.imageDataUrl - Base64 data URL of the image
 * @param {string} params.filename - Filename for the uploaded image
 * @param {string} params.albumName - Album name (e.g., "John - Tampa - Dec 21, 2024")
 * @param {string} params.room - Room name (e.g., "kitchen", "bathroom")
 * @param {string} params.type - Photo type ("before", "after", or "mix")
 * @param {string} params.format - Format type (e.g., "default", "portrait", "square")
 * @param {string} params.location - Location/city
 * @param {string} params.cleanerName - Cleaner's name
 * @param {string} params.scriptUrl - Google Apps Script URL
 * @param {string} params.folderId - Google Drive folder ID
 * @param {Function} params.onProgress - Progress callback (optional)
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadPhoto({
  imageDataUrl,
  filename,
  albumName,
  room,
  type,
  format = 'default',
  location,
  cleanerName,
  scriptUrl,
  folderId,
  onProgress,
  abortSignal,
  flat = false
}) {
  try {
    console.log(`📤 Starting upload: ${filename}, type: ${type}, format: ${format}`);
    console.log(`📍 Location: ${location}`);
    console.log(`🔗 Script URL: ${scriptUrl}`);
    console.log(`📁 Folder ID: ${folderId}`);

    if (!scriptUrl || !folderId) {
      throw new Error('Missing Google Drive configuration. Please set Script URL and Folder ID in Settings.');
    }

    if (!imageDataUrl) {
      throw new Error('Missing image data');
    }

    // Convert to base64 if not already a data URL
    let base64DataUrl = imageDataUrl;
    if (!imageDataUrl.startsWith('data:')) {
      const normalized = normalizeFileUri(imageDataUrl);
      console.log('🔄 Converting URI to base64 (normalized):', normalized.substring(0, 60));
      base64DataUrl = await fileUriToBase64(normalized);
    } else {
      console.log('✅ Already a data URL, length:', imageDataUrl.length);
    }

    // Extract just the base64 string (remove data:image/jpeg;base64, prefix if present)
    let base64String = base64DataUrl;
    if (base64DataUrl.includes('base64,')) {
      base64String = base64DataUrl.split('base64,')[1];
    }

    console.log(`📊 Base64 string length: ${base64String.length}`);

    // Prepare form data
    const formData = new FormData();
    formData.append('folderId', folderId);
    formData.append('filename', filename);
    formData.append('albumName', albumName);
    formData.append('room', room || 'general');
    formData.append('type', type);
    formData.append('format', format);
    if (flat || (typeof globalThis.__UPLOAD_FLAT_MODE === 'boolean' && globalThis.__UPLOAD_FLAT_MODE)) {
      formData.append('flat', 'true');
    }
    formData.append('timestamp', Date.now().toString());
    formData.append('location', location);
    formData.append('cleanerName', cleanerName);
    formData.append('image', base64String);

    console.log(`🚀 Uploading to Google Drive...`);

    // Upload to Google Drive (ensure flat flag reaches GAS via URL as well)
    const shouldFlat = flat || (typeof globalThis.__UPLOAD_FLAT_MODE === 'boolean' && globalThis.__UPLOAD_FLAT_MODE);
    const targetUrl = shouldFlat
      ? `${scriptUrl}${scriptUrl.includes('?') ? '&' : '?'}flat=true`
      : scriptUrl;
    
    const response = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
      // Pass abort signal if provided to support cancellation
      ...(abortSignal ? { signal: abortSignal } : {})
    });

    console.log(`📥 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP error! status: ${response.status}, body:`, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log(`📋 Upload result for ${location}:`, result);

    if (result.success) {
      console.log(`✅ Upload successful: ${filename} to ${location}`);
      return result;
    } else {
      console.error(`❌ Upload failed for ${location}: ${result.message}`);
      console.error(`❌ Full error response:`, result);
      throw new Error(result.message || 'Upload failed');
    }
  } catch (error) {
    const name = (error && error.name) || '';
    const message = (error && error.message) || '';
    const isAbort = `${name} ${message}`.toLowerCase().includes('abort');
    if (isAbort) {
      console.warn(`⏹️ Upload aborted: ${filename} for ${location}`);
    } else {
      console.error(`❌ Upload error for ${filename} to ${location}:`, error);
      console.error(`❌ Error details:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        location,
        scriptUrl,
        folderId
      });
    }
    throw error;
  }
}

/**
 * Upload multiple photos in batches
 * @param {Array} photos - Array of photo objects with upload parameters
 * @param {Object} config - Upload configuration
 * @param {string} config.scriptUrl - Google Apps Script URL
 * @param {string} config.folderId - Google Drive folder ID
 * @param {string} config.albumName - Album name
 * @param {string} config.location - Location/city
 * @param {string} config.cleanerName - Cleaner's name
 * @param {number} config.batchSize - Number of concurrent uploads (default: all photos in parallel)
 * @param {Function} config.onProgress - Progress callback (current, total)
 * @param {Function} config.onBatchComplete - Callback after each batch
 * @returns {Promise<Object>} - Upload results { successful: [], failed: [] }
 */
export async function uploadPhotoBatch(photos, config) {
  const {
    scriptUrl,
    folderId,
    albumName,
    location,
    cleanerName,
    batchSize = photos.length, // Upload all photos in parallel by default
    onProgress,
    onBatchComplete,
    getAbortController, // optional callback to retrieve/create AbortController per request
    abortSignal, // optional AbortSignal to stop scheduling further uploads
    flat = false // upload into project root (no subfolders)
  } = config;

  const successful = [];
  const failed = [];
  let completed = 0;
  const total = photos.length;

  // Split photos into batches
  const batches = [];
  for (let i = 0; i < photos.length; i += batchSize) {
    batches.push(photos.slice(i, i + batchSize));
  }

  // Report initial progress
  if (onProgress) {
    onProgress(0, total);
  }

  // Track individual upload progress
  let completedUploads = 0;

  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    if (abortSignal?.aborted) {
      console.warn('🔴 Upload cancelled before starting batch', batchIndex + 1);
      break;
    }
    const batch = batches[batchIndex];

    // Process all photos in the batch concurrently
    const batchPromises = batch.map((photo, index) => {
      if (abortSignal?.aborted) {
        return Promise.reject(new Error('Aborted'));
      }
      // Map photo mode; server expects 'combined' (not 'mix') for combined photos
      const rawType = photo.mode || photo.type || 'mix';
      const isCombined = rawType === 'mix' || rawType === 'combined';
      const typeParam = isCombined ? 'combined' : rawType;

      // Determine the format
      let format = 'default';
      if (isCombined && photo.templateType) {
        format = photo.templateType;
      } else if (photo.format) {
        format = photo.format;
      }

      // Provide an AbortController per upload if supported
      const controller = typeof getAbortController === 'function' ? getAbortController() : null;
      const isFlat = !!(flat || photo.flat === true || photo.flatOverride === true);
      
      // Create a promise that reports progress during upload
      const uploadPromise = uploadPhoto({
        imageDataUrl: photo.uri,
        filename: photo.filename || `${photo.name}_${format !== 'default' ? format : typeParam}.jpg`,
        albumName,
        room: photo.room || 'general',
        type: typeParam,
        format: format,
        location,
        cleanerName,
        scriptUrl,
        folderId,
        abortSignal: controller ? controller.signal : (abortSignal || undefined),
        flat: isFlat,
        // Remove intermediate progress reporting for cleaner parallel upload tracking
      });

      // Add progress tracking for parallel uploads
      return uploadPromise
        .then(result => {
          // Report progress when this upload completes
          if (onProgress) {
            completedUploads++;
            console.log(`📊 Progress update: ${completedUploads}/${total} (${Math.round((completedUploads/total)*100)}%)`);
            onProgress(completedUploads, total);
          }
          return { success: true, result, photo };
        })
        .catch(error => {
          // Still report progress even on failure
          if (onProgress) {
            completedUploads++;
            console.log(`📊 Progress update (error): ${completedUploads}/${total} (${Math.round((completedUploads/total)*100)}%)`);
            onProgress(completedUploads, total);
          }
          return { success: false, error, photo };
        });
    });

    // Wait for batch to complete
    const results = await Promise.allSettled(batchPromises);

    // Process results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        console.log(`✅ Batch upload success: ${result.value.photo?.filename || 'unknown'}`);
        successful.push(result.value);
      } else {
        const isRejected = result.status === 'rejected';
        const errorInfo = isRejected ? { error: result.reason, photo: null } : (result.value || { error: 'Unknown error', photo: null });
        const rawMsg = typeof errorInfo.error === 'string' ? errorInfo.error : (errorInfo.error?.message || '');
        const isAbort = (rawMsg || '').toLowerCase().includes('abort');
        if (isAbort) {
          console.warn(`⏹️ Upload aborted${errorInfo.photo?.filename ? ` for: ${errorInfo.photo.filename}` : ''}`);
          // Do not treat aborted uploads as failures in the results list
        } else {
          console.error(`❌ Batch upload failed:`, {
            filename: errorInfo.photo?.filename,
            error: rawMsg || errorInfo.error
          });
          failed.push(errorInfo);
        }
      }
    });

    // Call batch complete callback
    if (onBatchComplete) {
      onBatchComplete(batchIndex + 1, batches.length);
    }

    // If cancelled, stop scheduling further batches
    if (abortSignal?.aborted) {
      console.warn('🔴 Upload cancelled after batch', batchIndex + 1);
      break;
    }

    // No delay between batches for faster uploads
    // Removed delay to upload all photos in parallel
  }

  return { successful, failed };
}

/**
 * Create an album name from user info and date
 * @param {string} userName - User/cleaner name
 * @param {string} location - Location/city
 * @param {Date} date - Date object (defaults to now)
 * @returns {string} - Album name (e.g., "John - Tampa - Dec 21, 2024")
 */
export function createAlbumName(userName, location, date = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  const formattedLocation = location.charAt(0).toUpperCase() + location.slice(1).replace(/-/g, ' ');

  return `${userName} - ${formattedLocation} - ${month} ${day}, ${year}`;
}

/**
 * Ensure a unique project/album name by suffixing an incrementing number if needed.
 * existingNames: array of strings (project names already present)
 */
export function ensureUniqueProjectName(baseName, existingNames) {
  if (!Array.isArray(existingNames) || existingNames.length === 0) return baseName;
  const set = new Set(existingNames);
  if (!set.has(baseName)) return baseName;
  let i = 2;
  while (set.has(`${baseName} ${i}`)) i++;
  return `${baseName} ${i}`;
}