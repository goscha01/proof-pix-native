/**
 * Upload Tracker Service
 * Tracks which photos have been uploaded to prevent duplicates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const UPLOADED_PHOTOS_KEY = 'uploaded-photos-tracker';

/**
 * Get a unique key for a photo based on its properties
 * @param {Object} photo - Photo object
 * @param {string} albumName - Album name
 * @returns {string} - Unique key for the photo
 */
function getPhotoKey(photo, albumName) {
  const { name, room, mode, templateType, format } = photo;
  const type = mode === 'mix' ? 'combined' : mode;
  const formatKey = templateType || format || 'default';
  return `${albumName}_${room}_${name}_${type}_${formatKey}`;
}

/**
 * Load the set of uploaded photo keys
 * @returns {Promise<Set<string>>} - Set of uploaded photo keys
 */
export async function loadUploadedPhotos() {
  try {
    const stored = await AsyncStorage.getItem(UPLOADED_PHOTOS_KEY);
    if (stored) {
      const keys = JSON.parse(stored);
      return new Set(keys);
    }
    return new Set();
  } catch (error) {
    console.error('Error loading uploaded photos:', error);
    return new Set();
  }
}

/**
 * Save the set of uploaded photo keys
 * @param {Set<string>} uploadedPhotos - Set of uploaded photo keys
 */
export async function saveUploadedPhotos(uploadedPhotos) {
  try {
    const keys = Array.from(uploadedPhotos);
    await AsyncStorage.setItem(UPLOADED_PHOTOS_KEY, JSON.stringify(keys));
    console.log('💾 Uploaded photos tracker saved:', keys.length, 'photos');
  } catch (error) {
    console.error('Error saving uploaded photos:', error);
  }
}

/**
 * Mark photos as uploaded
 * @param {Array} photos - Array of photo objects
 * @param {string} albumName - Album name
 * @returns {Promise<void>}
 */
export async function markPhotosAsUploaded(photos, albumName) {
  try {
    const uploadedPhotos = await loadUploadedPhotos();
    
    photos.forEach(photo => {
      const key = getPhotoKey(photo, albumName);
      uploadedPhotos.add(key);
    });
    
    await saveUploadedPhotos(uploadedPhotos);
  } catch (error) {
    console.error('Error marking photos as uploaded:', error);
  }
}

/**
 * Filter out photos that have already been uploaded
 * @param {Array} photos - Array of photo objects to check
 * @param {string} albumName - Album name
 * @returns {Promise<Array>} - Array of photos that haven't been uploaded yet
 */
export async function filterNewPhotos(photos, albumName) {
  try {
    const uploadedPhotos = await loadUploadedPhotos();
    
    const newPhotos = photos.filter(photo => {
      const key = getPhotoKey(photo, albumName);
      const isUploaded = uploadedPhotos.has(key);
      
      if (isUploaded) {
        console.log('📋 Skipping already uploaded photo:', photo.filename || photo.name);
      }
      
      return !isUploaded;
    });
    
    console.log(`📊 Filtered ${photos.length} photos to ${newPhotos.length} new photos`);
    return newPhotos;
  } catch (error) {
    console.error('Error filtering new photos:', error);
    return photos; // Return all photos if filtering fails
  }
}

/**
 * Clear uploaded photos tracker (useful for testing or reset)
 */
export async function clearUploadedPhotos() {
  try {
    await AsyncStorage.removeItem(UPLOADED_PHOTOS_KEY);
    console.log('🗑️ Uploaded photos tracker cleared');
  } catch (error) {
    console.error('Error clearing uploaded photos:', error);
  }
}

/**
 * Get count of uploaded photos
 * @returns {Promise<number>} - Number of uploaded photos
 */
export async function getUploadedPhotosCount() {
  try {
    const uploadedPhotos = await loadUploadedPhotos();
    return uploadedPhotos.size;
  } catch (error) {
    console.error('Error getting uploaded photos count:', error);
    return 0;
  }
}
