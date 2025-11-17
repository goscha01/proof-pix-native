import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { PHOTO_MODES } from '../constants/rooms';

const LABEL_CACHE_METADATA_KEY = 'label-cache-metadata';
const LABEL_CACHE_DIR = '_labeled_cache';

/**
 * Calculate a hash of label settings to determine if cached version is still valid
 */
export const calculateSettingsHash = (settings) => {
  const {
    showLabels,
    beforeLabelPosition,
    afterLabelPosition,
    labelBackgroundColor,
    labelTextColor,
    labelSize,
    labelFontFamily,
    labelMarginVertical,
    labelMarginHorizontal,
  } = settings;

  // Create a string representation of all settings
  const settingsString = JSON.stringify({
    showLabels: showLabels || false,
    beforeLabelPosition: beforeLabelPosition || 'top-left',
    afterLabelPosition: afterLabelPosition || 'top-right',
    labelBackgroundColor: labelBackgroundColor || '#FFD700',
    labelTextColor: labelTextColor || '#000000',
    labelSize: labelSize || 'medium',
    labelFontFamily: labelFontFamily || 'system',
    labelMarginVertical: labelMarginVertical || 10,
    labelMarginHorizontal: labelMarginHorizontal || 10,
  });

  // Simple hash function (djb2 algorithm)
  let hash = 5381;
  for (let i = 0; i < settingsString.length; i++) {
    hash = ((hash << 5) + hash) + settingsString.charCodeAt(i);
  }
  return Math.abs(hash).toString(36).substring(0, 8); // 8 character hash
};

/**
 * Get the cache directory path
 */
export const getCacheDir = () => {
  return `${FileSystem.documentDirectory}${LABEL_CACHE_DIR}/`;
};

/**
 * Ensure cache directory exists
 */
export const ensureCacheDir = async () => {
  const cacheDir = getCacheDir();
  const dirInfo = await FileSystem.getInfoAsync(cacheDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  }
  return cacheDir;
};

/**
 * Get cached labeled photo URI if it exists and is valid
 */
export const getCachedLabeledPhoto = async (photo, settingsHash) => {
  try {
    if (!photo || !photo.uri || !photo.id) {
      console.log('[LABEL_CACHE] Missing photo data:', { hasPhoto: !!photo, hasUri: !!photo?.uri, hasId: !!photo?.id });
      return null;
    }

    // Load metadata
    const metadata = await loadCacheMetadata();
    const cacheKey = `${photo.id}_${photo.mode || 'unknown'}`;
    console.log(`[LABEL_CACHE] Loaded metadata, total entries: ${Object.keys(metadata).length}, looking for key: ${cacheKey}`);
    console.log(`[LABEL_CACHE] Available keys: ${Object.keys(metadata).join(', ')}`);
    const cached = metadata[cacheKey];

    if (!cached) {
      console.log(`[LABEL_CACHE] No cache entry found for key: ${cacheKey}`);
      return null;
    }

    console.log(`[LABEL_CACHE] Found cache entry for ${cacheKey}, cached hash: ${cached.settingsHash}, current hash: ${settingsHash}`);

    // Check if settings hash matches
    if (cached.settingsHash !== settingsHash) {
      // Settings changed, cache is invalid
      console.log(`[LABEL_CACHE] Settings hash mismatch, cache invalid`);
      return null;
    }

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(cached.uri);
    if (!fileInfo.exists) {
      // File was deleted, remove from metadata
      console.log(`[LABEL_CACHE] Cached file does not exist: ${cached.uri}`);
      delete metadata[cacheKey];
      await saveCacheMetadata(metadata);
      return null;
    }

    // Check if original photo still exists (if original was deleted, cache is invalid)
    const originalInfo = await FileSystem.getInfoAsync(photo.uri);
    if (!originalInfo.exists) {
      // Original deleted, remove cache
      console.log(`[LABEL_CACHE] Original photo does not exist: ${photo.uri}`);
      await deleteCachedPhoto(photo);
      return null;
    }

    console.log(`[LABEL_CACHE] ✅ Cache hit! Returning: ${cached.uri}`);
    return cached.uri;
  } catch (error) {
    console.error('[LABEL_CACHE] Error getting cached photo:', error);
    return null;
  }
};

/**
 * Save labeled photo to cache
 */
export const saveCachedLabeledPhoto = async (photo, labeledUri, settingsHash) => {
  try {
    if (!photo || !photo.id || !labeledUri) {
      console.log('[LABEL_CACHE] Cannot save to cache - missing data:', { hasPhoto: !!photo, hasId: !!photo?.id, hasLabeledUri: !!labeledUri });
      return null;
    }

    await ensureCacheDir();

    // Generate cache filename
    const originalFilename = photo.uri.split('/').pop() || `photo_${photo.id}.jpg`;
    const nameWithoutExt = originalFilename.replace(/\.(jpg|jpeg|png)$/i, '');
    const cacheFilename = `${nameWithoutExt}_labeled_${settingsHash}.jpg`;
    const cacheUri = `${getCacheDir()}${cacheFilename}`;

    console.log(`[LABEL_CACHE] Saving to cache: ${cacheFilename}`);
    console.log(`[LABEL_CACHE] From: ${labeledUri}`);
    console.log(`[LABEL_CACHE] To: ${cacheUri}`);

    // Copy labeled photo to cache
    await FileSystem.copyAsync({ from: labeledUri, to: cacheUri });

    // Verify the file was copied
    const cacheInfo = await FileSystem.getInfoAsync(cacheUri);
    if (!cacheInfo.exists) {
      console.error(`[LABEL_CACHE] Failed to copy file to cache: ${cacheUri}`);
      return null;
    }

    // Update metadata
    const metadata = await loadCacheMetadata();
    const cacheKey = `${photo.id}_${photo.mode || 'unknown'}`;
    metadata[cacheKey] = {
      uri: cacheUri,
      settingsHash,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      photoId: photo.id,
      photoMode: photo.mode,
    };

    await saveCacheMetadata(metadata);

    console.log(`[LABEL_CACHE] ✅ Saved labeled photo to cache: ${cacheFilename} (key: ${cacheKey})`);
    return cacheUri;
  } catch (error) {
    console.error('[LABEL_CACHE] Error saving cached photo:', error);
    return null;
  }
};

/**
 * Update last used timestamp for cached photo
 */
export const updateCacheLastUsed = async (photo) => {
  try {
    const metadata = await loadCacheMetadata();
    const cacheKey = `${photo.id}_${photo.mode || 'unknown'}`;
    if (metadata[cacheKey]) {
      metadata[cacheKey].lastUsed = Date.now();
      await saveCacheMetadata(metadata);
    }
  } catch (error) {
    console.error('[LABEL_CACHE] Error updating last used:', error);
  }
};

/**
 * Delete cached photo
 */
export const deleteCachedPhoto = async (photo) => {
  try {
    const metadata = await loadCacheMetadata();
    const cacheKey = `${photo.id}_${photo.mode || 'unknown'}`;
    const cached = metadata[cacheKey];

    if (cached) {
      // Delete file
      try {
        await FileSystem.deleteAsync(cached.uri, { idempotent: true });
      } catch (fileError) {
        // File might already be deleted
      }

      // Remove from metadata
      delete metadata[cacheKey];
      await saveCacheMetadata(metadata);
    }
  } catch (error) {
    console.error('[LABEL_CACHE] Error deleting cached photo:', error);
  }
};

/**
 * Clean up old cached photos (older than 30 days or invalid)
 */
export const cleanupOldCache = async (maxAgeDays = 30) => {
  try {
    const metadata = await loadCacheMetadata();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
    const now = Date.now();
    const toDelete = [];

    for (const [key, cached] of Object.entries(metadata)) {
      const age = now - cached.createdAt;
      
      // Delete if too old
      if (age > maxAge) {
        toDelete.push({ key, uri: cached.uri });
        continue;
      }

      // Check if file still exists
      try {
        const fileInfo = await FileSystem.getInfoAsync(cached.uri);
        if (!fileInfo.exists) {
          toDelete.push({ key });
        }
      } catch (error) {
        // File doesn't exist or error accessing
        toDelete.push({ key });
      }
    }

    // Delete files and remove from metadata
    for (const item of toDelete) {
      if (item.uri) {
        try {
          await FileSystem.deleteAsync(item.uri, { idempotent: true });
        } catch (error) {
          // Ignore deletion errors
        }
      }
      delete metadata[item.key];
    }

    if (toDelete.length > 0) {
      await saveCacheMetadata(metadata);
      console.log(`[LABEL_CACHE] Cleaned up ${toDelete.length} old cached photos`);
    }

    return toDelete.length;
  } catch (error) {
    console.error('[LABEL_CACHE] Error cleaning up cache:', error);
    return 0;
  }
};

/**
 * Invalidate all cache when settings change
 */
export const invalidateCache = async (newSettingsHash) => {
  try {
    const metadata = await loadCacheMetadata();
    const toDelete = [];

    for (const [key, cached] of Object.entries(metadata)) {
      if (cached.settingsHash !== newSettingsHash) {
        toDelete.push({ key, uri: cached.uri });
      }
    }

    // Delete files
    for (const item of toDelete) {
      try {
        await FileSystem.deleteAsync(item.uri, { idempotent: true });
      } catch (error) {
        // Ignore deletion errors
      }
      delete metadata[item.key];
    }

    if (toDelete.length > 0) {
      await saveCacheMetadata(metadata);
      console.log(`[LABEL_CACHE] Invalidated ${toDelete.length} cached photos due to settings change`);
    }

    return toDelete.length;
  } catch (error) {
    console.error('[LABEL_CACHE] Error invalidating cache:', error);
    return 0;
  }
};

/**
 * Load cache metadata from AsyncStorage
 */
const loadCacheMetadata = async () => {
  try {
    const stored = await AsyncStorage.getItem(LABEL_CACHE_METADATA_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('[LABEL_CACHE] Error loading metadata:', error);
    return {};
  }
};

/**
 * Save cache metadata to AsyncStorage
 */
const saveCacheMetadata = async (metadata) => {
  try {
    await AsyncStorage.setItem(LABEL_CACHE_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('[LABEL_CACHE] Error saving metadata:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
  try {
    const metadata = await loadCacheMetadata();
    const cacheDir = getCacheDir();
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    
    let totalSize = 0;
    let fileCount = 0;

    if (dirInfo.exists) {
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      fileCount = files.length;
      
      for (const file of files) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
          if (fileInfo.exists && fileInfo.size) {
            totalSize += fileInfo.size;
          }
        } catch (error) {
          // Ignore errors
        }
      }
    }

    return {
      fileCount,
      totalSize,
      metadataEntries: Object.keys(metadata).length,
    };
  } catch (error) {
    console.error('[LABEL_CACHE] Error getting cache stats:', error);
    return { fileCount: 0, totalSize: 0, metadataEntries: 0 };
  }
};

