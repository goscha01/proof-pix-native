import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Migration utility to fix ph:// URIs
 */

const PHOTOS_METADATA_KEY = 'cleaning-photos-metadata';

/**
 * Clear all photo metadata (temporary fix for ph:// URI issue)
 * Run this once to reset the app
 */
export const clearAllPhotoData = async () => {
  try {
    await AsyncStorage.removeItem(PHOTOS_METADATA_KEY);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Check if there are any ph:// URIs in storage
 */
export const checkForInvalidURIs = async () => {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_METADATA_KEY);
    if (!data) return { hasInvalid: false, count: 0 };

    const photos = JSON.parse(data);
    const invalidPhotos = photos.filter(p => p.uri && p.uri.startsWith('ph://'));

    return {
      hasInvalid: invalidPhotos.length > 0,
      count: invalidPhotos.length,
      total: photos.length
    };
  } catch (error) {
    return { hasInvalid: false, count: 0 };
  }
};

/**
 * Auto-fix: Remove photos with ph:// URIs
 */
export const removeInvalidPhotos = async () => {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_METADATA_KEY);
    if (!data) return { removed: 0 };

    const photos = JSON.parse(data);
    const validPhotos = photos.filter(p => !p.uri || !p.uri.startsWith('ph://'));

    await AsyncStorage.setItem(PHOTOS_METADATA_KEY, JSON.stringify(validPhotos));

    return {
      removed: photos.length - validPhotos.length,
      remaining: validPhotos.length
    };
  } catch (error) {
    return { removed: 0 };
  }
};
