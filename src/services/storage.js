import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

const PHOTOS_METADATA_KEY = 'cleaning-photos-metadata';
const USER_PREFS_KEY = 'user-preferences';
const SETTINGS_KEY = 'app-settings';

/**
 * Loads photo metadata from AsyncStorage
 */
export const loadPhotosMetadata = async () => {
  try {
    const saved = await AsyncStorage.getItem(PHOTOS_METADATA_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  } catch (error) {
    console.error('Error loading photos metadata:', error);
    return [];
  }
};

/**
 * Saves photo metadata to AsyncStorage
 */
export const savePhotosMetadata = async (photos) => {
  try {
    // Only save metadata, not full images
    const metadata = photos.map(p => ({
      id: p.id,
      room: p.room,
      mode: p.mode,
      name: p.name,
      timestamp: p.timestamp,
      beforePhotoId: p.beforePhotoId,
      aspectRatio: p.aspectRatio,
      templateType: p.templateType,
      originalWidth: p.originalWidth,
      originalHeight: p.originalHeight,
      uri: p.uri // File URI in device storage
    }));

    await AsyncStorage.setItem(PHOTOS_METADATA_KEY, JSON.stringify(metadata));
    console.log('💾 Metadata saved successfully');
  } catch (error) {
    console.error('Error saving photos metadata:', error);
  }
};

/**
 * Clears all photos from storage
 */
export const clearPhotos = async () => {
  try {
    await AsyncStorage.removeItem(PHOTOS_METADATA_KEY);
  } catch (error) {
    console.error('Error clearing photos:', error);
  }
};

/**
 * Saves a photo to device storage
 */
export const savePhotoToDevice = async (uri, filename) => {
  try {
    console.log('📱 Saving photo to device:', filename);

    // First, copy to app's document directory (for reliable access)
    const fileUri = `${FileSystem.documentDirectory}${filename}`;

    // If the URI is already in our directory, use it directly
    if (uri.startsWith(FileSystem.documentDirectory)) {
      console.log('📱 Photo already in document directory');
    } else {
      // Copy to document directory
      await FileSystem.copyAsync({
        from: uri,
        to: fileUri
      });
      console.log('📱 Photo copied to:', fileUri);
    }

    // Request permission for media library
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === 'granted') {
      try {
        // Also save to media library (device photos)
        const asset = await MediaLibrary.createAssetAsync(uri);

        // Create/add to ProofPix album
        const album = await MediaLibrary.getAlbumAsync('ProofPix');
        if (album == null) {
          await MediaLibrary.createAlbumAsync('ProofPix', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
        console.log('📱 Photo saved to media library');
      } catch (mlError) {
        console.warn('⚠️ Could not save to media library (Expo Go limitation):', mlError.message);
      }
    } else {
      console.warn('⚠️ Media library permission denied, photo saved to app only');
    }

    console.log('📱 Photo saved successfully');
    // Return the file URI (not the ph:// URL from media library)
    return uri.startsWith(FileSystem.documentDirectory) ? uri : fileUri;
  } catch (error) {
    console.error('Error saving photo to device:', error);
    throw error;
  }
};

/**
 * Gets stored user data (cleaner name, location)
 */
export const getStoredUserData = async () => {
  try {
    const stored = await AsyncStorage.getItem(USER_PREFS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {};
  } catch (error) {
    console.error('Error getting user data:', error);
    return {};
  }
};

/**
 * Saves user data
 */
export const saveUserData = async (cleaner, location) => {
  try {
    const userData = {
      cleaner,
      location,
      savedAt: Date.now()
    };
    await AsyncStorage.setItem(USER_PREFS_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('Error saving user data:', error);
  }
};

/**
 * Loads app settings
 */
export const loadSettings = async () => {
  try {
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    return {};
  } catch (error) {
    console.error('Error loading settings:', error);
    return {};
  }
};

/**
 * Saves app settings
 */
export const saveSettings = async (settings) => {
  try {
    const existing = await loadSettings();
    const updated = { ...existing, ...settings };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
};
