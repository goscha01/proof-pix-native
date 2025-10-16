import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as FS from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

const PHOTOS_METADATA_KEY = 'cleaning-photos-metadata';
const USER_PREFS_KEY = 'user-preferences';
const SETTINGS_KEY = 'app-settings';
const PROJECTS_KEY = 'tracked-projects';
const ACTIVE_PROJECT_ID_KEY = 'active-project-id';
const ASSET_ID_MAP_KEY = 'asset-id-map';

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
      uri: p.uri, // File URI in device storage
      projectId: p.projectId || null
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
    let finalFileUri = fileUri;

    // If the URI is already in our directory, use it directly
    if (uri.startsWith(FileSystem.documentDirectory)) {
      console.log('📱 Photo already in document directory');
      finalFileUri = uri; // keep the original file path
    } else {
      // Copy to document directory
      await FileSystem.copyAsync({
        from: uri,
        to: fileUri
      });
      console.log('📱 Photo copied to:', fileUri);
      finalFileUri = fileUri;
    }

    // Request permission for media library
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status === 'granted') {
      try {
        // Also save to media library (device photos)
        const asset = await MediaLibrary.createAssetAsync(finalFileUri);

        // Create/add to ProofPix album
        const album = await MediaLibrary.getAlbumAsync('ProofPix');
        if (album == null) {
          await MediaLibrary.createAlbumAsync('ProofPix', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
        console.log('📱 Photo saved to media library');

        // Store a mapping from filename -> assetId for reliable deletion later
        try {
          const stored = await AsyncStorage.getItem(ASSET_ID_MAP_KEY);
          const map = stored ? JSON.parse(stored) : {};
          const justName = (finalFileUri.split('/').pop() || '').split('?')[0];
          if (asset?.id && justName) {
            map[justName] = asset.id;
            await AsyncStorage.setItem(ASSET_ID_MAP_KEY, JSON.stringify(map));
            console.log('🔗 Mapped asset ID for deletion', { filename: justName, assetId: asset.id });
          }
        } catch (mapErr) {
          console.warn('⚠️ Failed to store asset map:', mapErr?.message);
        }
      } catch (mlError) {
        console.warn('⚠️ Could not save to media library (Expo Go/permission):', mlError.message);
        // Android fallback: StorageAccessFramework prompt to save into user-selected folder (e.g., Pictures)
        if (Platform.OS === 'android' && FS?.StorageAccessFramework) {
          try {
            const permissions = await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions.granted) {
              const base64 = await FileSystem.readAsStringAsync(finalFileUri, { encoding: FileSystem.EncodingType.Base64 });
              const fileUriSAF = await FS.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                filename,
                'image/jpeg'
              );
              await FileSystem.writeAsStringAsync(fileUriSAF, base64, { encoding: FileSystem.EncodingType.Base64 });
              console.log('📱 Photo saved via SAF to user-selected directory');
            } else {
              console.warn('⚠️ SAF directory permission not granted');
            }
          } catch (safError) {
            console.warn('⚠️ SAF fallback failed:', safError.message);
          }
        }
      }
    } else {
      console.warn('⚠️ Media library permission denied, photo saved to app only');
    }

    console.log('📱 Photo saved successfully');
    // Return the file URI (not the ph:// URL from media library)
    return finalFileUri;
  } catch (error) {
    console.error('Error saving photo to device:', error);
    throw error;
  }
};

/**
 * Delete a saved photo from the app's storage and the device media library
 * Accepts a full photo object (expects at least { uri })
 */
export const deletePhotoFromDevice = async (photo) => {
  try {
    if (!photo) return;
    const uri = photo.uri;
    if (!uri || typeof uri !== 'string') return;

    // Derive a filename for media library lookup
    const filename = (uri.split('/').pop() || '').split('?')[0];
    console.log('🗑️ deletePhotoFromDevice start', { uri, filename });

    // 1) Delete from app documents directory (idempotent)
    try {
      if (uri.startsWith(FileSystem.documentDirectory)) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        console.log('🗑️ Deleted from app storage', { uri });
      } else if (uri.startsWith('file://')) {
        // Try deleting other file:// targets as best-effort
        await FileSystem.deleteAsync(uri, { idempotent: true });
        console.log('🗑️ Deleted file:// path', { uri });
      }
    } catch (fsErr) {
      console.warn('⚠️ Failed deleting file from app storage:', uri, fsErr?.message);
    }

    // 2) Delete from media library (first by stored assetId, then fallbacks)
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('⚠️ Media library permission not granted; skipping library delete');
        return;
      }

      // Try direct assetId from stored mapping
      try {
        const stored = await AsyncStorage.getItem(ASSET_ID_MAP_KEY);
        const map = stored ? JSON.parse(stored) : {};
        const assetId = map[filename];
        if (assetId) {
          try {
            await MediaLibrary.deleteAssetsAsync([assetId]);
            console.log('🗑️ Deleted by assetId', { assetId, filename });
            delete map[filename];
            await AsyncStorage.setItem(ASSET_ID_MAP_KEY, JSON.stringify(map));
            return; // deletion done
          } catch (byIdErr) {
            console.warn('⚠️ Delete by assetId failed, will fallback:', byIdErr?.message);
          }
        }
      } catch (mapDelErr) {
        console.warn('⚠️ Asset ID map read failed:', mapDelErr?.message);
      }

      const findMatch = (assetsArr) => assetsArr.find((a) => {
        if (!a) return false;
        if (a.filename && a.filename === filename) return true;
        if (a.uri && typeof a.uri === 'string' && filename && a.uri.endsWith(filename)) return true;
        return false;
      });

      let match = null;
      const album = await MediaLibrary.getAlbumAsync('ProofPix');
      if (album) {
        const assets = await MediaLibrary.getAssetsAsync({
          album,
          first: 2000,
          mediaType: [MediaLibrary.MediaType.photo]
        });
        match = findMatch(assets.assets);
      }

      // Fallback: global scan if not found in album or album missing
      if (!match) {
        const global = await MediaLibrary.getAssetsAsync({ first: 2000, mediaType: [MediaLibrary.MediaType.photo] });
        match = findMatch(global.assets);
      }

      if (match) {
        try {
          await MediaLibrary.deleteAssetsAsync([match]);
          console.log('🗑️ Deleted from media library', { assetFilename: match.filename, id: match.id });
        } catch (delErr) {
          console.warn('⚠️ Direct delete failed:', delErr?.message);
          if (album) {
            try {
              await MediaLibrary.removeAssetsFromAlbumAsync([match], album, false);
              console.log('🗑️ Removed from album only', { assetFilename: match.filename, id: match.id });
            } catch (remErr) {
              console.warn('⚠️ Album removal also failed:', remErr?.message);
            }
          }
        }
      } else {
        console.log('ℹ️ No matching media asset found for filename', filename);
      }
    } catch (mlErr) {
      console.warn('⚠️ Media library delete failed:', mlErr?.message);
    }
  } catch (error) {
    console.error('Error deleting photo from device:', error);
  }
};

/**
 * Delete multiple photos from device/storage.
 */
export const deletePhotosFromDevice = async (photos) => {
  if (!Array.isArray(photos) || photos.length === 0) return;
  for (const p of photos) {
    await deletePhotoFromDevice(p);
  }
};

/**
 * Purge all images saved by the app from device storage and media library.
 * - Deletes all .jpg/.jpeg/.png files in the app's document directory
 * - Deletes all assets inside the 'ProofPix' album in the media library
 */
export const purgeAllDevicePhotos = async () => {
  // 1) Delete all image files in app documents directory
  try {
    const dir = FileSystem.documentDirectory;
    if (dir) {
      const entries = await FileSystem.readDirectoryAsync(dir);
      for (const name of entries) {
        const lower = name.toLowerCase();
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
          const full = `${dir}${name}`;
          try {
            await FileSystem.deleteAsync(full, { idempotent: true });
          } catch (delErr) {
            console.warn('⚠️ Failed deleting file in app dir:', full, delErr?.message);
          }
        }
      }
    }
  } catch (fsListErr) {
    console.warn('⚠️ Failed listing app directory for purge:', fsListErr?.message);
  }

  // 2) Delete all assets inside the ProofPix album
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('⚠️ Media library permission denied; skipping album purge');
      return;
    }

    const album = await MediaLibrary.getAlbumAsync('ProofPix');
    if (!album) return;

    // Paginate through all assets
    let endCursor = undefined;
    const pageSize = 1000;
    const toDelete = [];
    while (true) {
      const page = await MediaLibrary.getAssetsAsync({
        album,
        first: pageSize,
        after: endCursor,
        mediaType: [MediaLibrary.MediaType.photo]
      });
      toDelete.push(...page.assets);
      if (!page.hasNextPage) break;
      endCursor = page.endCursor;
    }

    if (toDelete.length > 0) {
      try {
        await MediaLibrary.deleteAssetsAsync(toDelete);
      } catch (mlChangeErr) {
        console.warn('⚠️ Bulk delete failed, trying album removal:', mlChangeErr?.message);
        try {
          await MediaLibrary.removeAssetsFromAlbumAsync(toDelete, album, false);
        } catch (remErr) {
          console.warn('⚠️ Album removal failed:', remErr?.message);
        }
      }
    }
  } catch (mlErr) {
    console.warn('⚠️ Media library purge failed:', mlErr?.message);
  }
};

// ===== Projects store =====

/**
 * Load tracked projects
 * Shape: [{ id, name, createdAt }]
 */
export const loadProjects = async () => {
  try {
    const saved = await AsyncStorage.getItem(PROJECTS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Error loading projects:', e);
    return [];
  }
};

/**
 * Save tracked projects
 */
export const saveProjects = async (projects) => {
  try {
    await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Error saving projects:', e);
  }
};

/**
 * Create a new project entry and return it
 */
export const createProject = async (name) => {
  const list = await loadProjects();
  const id = Date.now().toString();
  const project = { id, name, createdAt: Date.now() };
  await saveProjects([project, ...list]);
  return project;
};

/**
 * Delete a project entry (does not delete photos here)
 */
export const deleteProjectEntry = async (projectId) => {
  const list = await loadProjects();
  const filtered = list.filter(p => p.id !== projectId);
  await saveProjects(filtered);
};

// Active project persistence
export const loadActiveProjectId = async () => {
  try {
    return await AsyncStorage.getItem(ACTIVE_PROJECT_ID_KEY);
  } catch (e) {
    return null;
  }
};

export const saveActiveProjectId = async (projectId) => {
  try {
    if (projectId == null) {
      await AsyncStorage.removeItem(ACTIVE_PROJECT_ID_KEY);
    } else {
      await AsyncStorage.setItem(ACTIVE_PROJECT_ID_KEY, projectId);
    }
  } catch (e) {
    // noop
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
