import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
  Alert,
  PanResponder,
  Modal,
  ActivityIndicator,
  Switch,
  TextInput,
  Share as RNShare,
  Platform,
  InteractionManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { useAdmin } from '../context/AdminContext'; // Import useAdmin
import { COLORS, PHOTO_MODES, ROOMS, TEMPLATE_CONFIGS, TEMPLATE_TYPES } from '../constants/rooms';
import { CroppedThumbnail } from '../components/CroppedThumbnail';
import PhotoLabel from '../components/PhotoLabel';
import { uploadPhotoBatch, createAlbumName } from '../services/uploadService';
import { getLocationConfig } from '../config/locations';
import googleDriveService from '../services/googleDriveService';
import googleAuthService from '../services/googleAuthService';
import dropboxAuthService from '../services/dropboxAuthService';
import dropboxService from '../services/dropboxService';
import { uploadPhotoBatchToDropbox } from '../services/dropboxUploadService';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import { useBackgroundUpload } from '../hooks/useBackgroundUpload';
import { UploadDetailsModal } from '../components/BackgroundUploadStatus';
import UploadIndicatorLine from '../components/UploadIndicatorLine';
import UploadCompletionModal from '../components/UploadCompletionModal';
import { filterNewPhotos, markPhotosAsUploaded } from '../services/uploadTracker';
import Share from 'react-native-share';
import JSZip from 'jszip';
import { useTranslation } from 'react-i18next';
import {
  calculateSettingsHash,
  getCachedLabeledPhoto,
  saveCachedLabeledPhoto,
  updateCacheLastUsed,
  getCacheDir,
  cleanupOldCache,
  invalidateCache,
} from '../services/labelCacheService';

const { width } = Dimensions.get('window');
const CONTAINER_PADDING = 32; // 16px on each side
const PHOTO_SPACING = 16; // 8px between each of the 2 gaps
const AVAILABLE_WIDTH = width - CONTAINER_PADDING - PHOTO_SPACING;
const COLUMN_WIDTH = AVAILABLE_WIDTH / 3;

export default function GalleryScreen({ navigation, route }) {
  const { t } = useTranslation();
  const {
    photos,
    getBeforePhotos,
    getAfterPhotos,
    getCombinedPhotos,
    deleteAllPhotos,
    createProject,
    assignPhotosToProject,
    activeProjectId,
    deleteProject,
    setActiveProject,
    projects,
  } = usePhotos();
  const {
    userName,
    location,
    useFolderStructure,
    enabledFolders,
    showLabels,
    shouldShowWatermark,
    beforeLabelPosition,
    afterLabelPosition,
    combinedLabelPosition,
    labelMarginVertical,
    labelMarginHorizontal,
    labelBackgroundColor,
    labelTextColor,
    labelSize,
    labelFontFamily,
    userPlan,
    labelLanguage,
    sectionLanguage,
    cleaningServiceEnabled,
  } = useSettings();
  const { userMode, teamInfo, isAuthenticated, folderId, proxySessionId, initializeProxySession } = useAdmin(); // Get userMode, teamInfo, and auth info
  const { uploadStatus, startBackgroundUpload, cancelUpload, cancelAllUploads, clearCompletedUploads } = useBackgroundUpload();
  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
  const [fullScreenPhotoSet, setFullScreenPhotoSet] = useState(null); // For combined preview
  const [sharing, setSharing] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(null); // Photo being captured with label
  const labelCaptureRef = useRef(null); // Ref for label capture view
  const [uploading, setUploading] = useState(false);
  
  // Effect to handle label capture when capturingPhoto state changes
  useEffect(() => {
    if (!capturingPhoto) return;
    
    const { photo, index, width, height, labelPosition, resolve, reject } = capturingPhoto;
    let timeoutId;
    
    // Wait longer for the view to render and ensure ref is attached
    // Use requestAnimationFrame to ensure we're on the next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        timeoutId = setTimeout(async () => {
          try {
            // Check if ref is attached
            if (!labelCaptureRef.current) {
              console.log(`[GALLERY] Ref not ready for photo ${index + 1}, waiting longer...`);
              // Wait a bit more
              setTimeout(async () => {
                if (!labelCaptureRef.current) {
                  console.error(`[GALLERY] Ref still not ready for photo ${index + 1}, using original`);
                  const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
                  const tempUri = FileSystem.cacheDirectory + tempFileName;
                  await FileSystem.copyAsync({ from: photo.uri, to: tempUri });
                  resolve(tempUri);
                  setCapturingPhoto(null);
                  return;
                }
                
                try {
                  const capturedUri = await captureRef(labelCaptureRef, {
                    format: 'jpg',
                    quality: 0.95
                  });
                  
                  const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
                  const tempUri = FileSystem.cacheDirectory + tempFileName;
                  await FileSystem.copyAsync({ from: capturedUri, to: tempUri });
                  
                  console.log(`[GALLERY] Captured photo ${index + 1} with label: ${tempUri}`);
                  resolve(tempUri);
                  setCapturingPhoto(null);
                } catch (error) {
                  console.error(`[GALLERY] Error capturing photo ${index + 1} with label:`, error);
                  // Fall back to original
                  const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
                  const tempUri = FileSystem.cacheDirectory + tempFileName;
                  await FileSystem.copyAsync({ from: photo.uri, to: tempUri });
                  resolve(tempUri);
                  setCapturingPhoto(null);
                }
              }, 500);
              return;
            }
            
            const capturedUri = await captureRef(labelCaptureRef, {
              format: 'jpg',
              quality: 0.95
            });
            
            const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
            const tempUri = FileSystem.cacheDirectory + tempFileName;
            await FileSystem.copyAsync({ from: capturedUri, to: tempUri });
            
            console.log(`[GALLERY] Captured photo ${index + 1} with label: ${tempUri}`);
            resolve(tempUri);
            setCapturingPhoto(null);
          } catch (error) {
            console.error(`[GALLERY] Error capturing photo ${index + 1} with label:`, error);
            // Fall back to original
            const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
            const tempUri = FileSystem.cacheDirectory + tempFileName;
            try {
              await FileSystem.copyAsync({ from: photo.uri, to: tempUri });
              resolve(tempUri);
            } catch (copyError) {
              reject(copyError);
            }
            setCapturingPhoto(null);
          }
        }, 800); // Longer delay to ensure view is fully rendered
      });
    });
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [capturingPhoto]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const uploadControllersRef = useRef([]); // AbortControllers for in-flight requests
  const masterAbortRef = useRef(null); // single signal to stop scheduling
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [shareOptionsVisible, setShareOptionsVisible] = useState(false);

  // Cleanup old cache on screen focus (runs periodically)
  useFocusEffect(
    React.useCallback(() => {
      // Run cleanup in background (non-blocking)
      (async () => {
        try {
          await cleanupOldCache(30); // Clean up files older than 30 days
        } catch (error) {
          console.error('[GALLERY] Error cleaning up cache:', error);
        }
      })();
    }, [])
  );

  // Invalidate cache when label settings change
  useEffect(() => {
    const settingsHash = calculateSettingsHash({
      showLabels,
      beforeLabelPosition,
      afterLabelPosition,
      labelBackgroundColor,
      labelTextColor,
      labelSize,
      labelFontFamily,
      labelMarginVertical,
      labelMarginHorizontal,
    });

    // Check if cache needs invalidation (runs once on mount and when settings change)
    (async () => {
      try {
        await invalidateCache(settingsHash);
      } catch (error) {
        console.error('[GALLERY] Error invalidating cache:', error);
      }
    })();
  }, [showLabels, beforeLabelPosition, afterLabelPosition, labelBackgroundColor, labelTextColor, labelSize, labelFontFamily, labelMarginVertical, labelMarginHorizontal]);
  const [deleteFromStorage, setDeleteFromStorage] = useState(true);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false); // retained but unused to avoid modal
  const [selectedTypes, setSelectedTypes] = useState({ before: true, after: true, combined: true });
  const [selectedShareTypes, setSelectedShareTypes] = useState({ before: true, after: true, combined: true });
  const [shareAsArchive, setShareAsArchive] = useState(false); // Default: share individual photos
  const [shareToSameApp, setShareToSameApp] = useState(true); // Default: reuse same app for all photos
  const [uploadDestinations, setUploadDestinations] = useState({ google: true, dropbox: false }); // Default: Google only
  const [isDropboxConnected, setIsDropboxConnected] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState(() => {
    // Default: only square formats enabled by default
    const initial = {};
    Object.keys(TEMPLATE_CONFIGS).forEach((key) => {
      // All formats disabled by default; selection requires upgrade in advanced section
      initial[key] = false;
    });
    return initial;
  });
  const [upgradeVisible, setUpgradeVisible] = useState(false);
  const [showAdvancedFormats, setShowAdvancedFormats] = useState(false);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const [renderingCombined, setRenderingCombined] = useState(false);
  const [renderingProgress, setRenderingProgress] = useState({ current: 0, total: 0 });
  const [currentRenderPair, setCurrentRenderPair] = useState(null);
  const [currentRenderTemplate, setCurrentRenderTemplate] = useState(null);
  const renderViewRef = useRef(null);
  const combinedCaptureRef = useRef(null);
  const [showUploadDetails, setShowUploadDetails] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // Handle navigation parameter to show upload details
  useEffect(() => {
    if (route?.params?.showUploadDetails) {
      setShowUploadDetails(true);
      // Clear the parameter to prevent showing again on subsequent navigations
      navigation.setParams({ showUploadDetails: undefined });
    }
  }, [route?.params?.showUploadDetails, navigation]);

  // Force re-render when photos change (e.g., after project deletion)
  useEffect(() => {
    // This will trigger a re-render when photos change
  }, [photos]);

  // Show completion modal when uploads are completed
  useEffect(() => {
    if (uploadStatus.completedUploads && uploadStatus.completedUploads.length > 0) {
      setShowCompletionModal(true);
    }
  }, [uploadStatus.completedUploads]);

  // Load Dropbox tokens when options modal opens and set default destinations based on connected accounts
  useEffect(() => {
    if (optionsVisible) {
      dropboxAuthService.loadStoredTokens().then(() => {
        const isDropboxAuth = dropboxAuthService.isAuthenticated();
        setIsDropboxConnected(isDropboxAuth);
        
        // Set default destinations: check all connected accounts
        setUploadDestinations({
          google: isAuthenticated, // Check Google if connected
          dropbox: isDropboxAuth   // Check Dropbox if connected
        });
      }).catch(err => {
        console.error('[GALLERY] Error loading Dropbox tokens:', err);
        setIsDropboxConnected(false);
        // Set defaults based on what we know
        setUploadDestinations({
          google: isAuthenticated,
          dropbox: false
        });
      });
    }
  }, [optionsVisible, isAuthenticated]);

  const FREE_FORMATS = new Set([]);
  const handleFormatToggle = (key) => {
    try {
      setSelectedFormats(prev => ({ ...prev, [key]: !prev[key] }));
    } catch (e) {
    }
  };

  // Long press handlers for full-screen photo
  const handleLongPressStart = (photo, photoSet = null) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (photoSet) {
        // Show combined preview with both photos
        setFullScreenPhotoSet(photoSet);
      } else {
        // Show single photo
        setFullScreenPhoto(photo);
      }
    }, 300);
  };

  const handleLongPressEnd = () => {
    const wasLongPress = longPressTriggered.current;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setFullScreenPhoto(null);
    setFullScreenPhotoSet(null);
    
    // Only delay reset if it was actually a long press
    if (wasLongPress) {
      setTimeout(() => {
        longPressTriggered.current = false;
      }, 100);
    } else {
      // Quick tap - reset immediately so onPress can fire
      longPressTriggered.current = false;
    }
  };

  // PanResponder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dy } = gestureState;
        // Detect swipe down
        return dy > 10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy } = gestureState;
        const threshold = 100; // Swipe down at least 100px
        
        if (dy > threshold) {
          navigation.goBack();
        }
      }
    })
  ).current;

  // Share individual photo (before or after)
  const shareIndividualPhoto = async (photo) => {
    try {
      setSharing(true);
      
      // Create a temporary file in cache directory for sharing (not permanent storage)
      const tempFileName = `${photo.room}_${photo.name}_${photo.mode}_${Date.now()}.jpg`;
      const tempUri = `${FileSystem.cacheDirectory}${tempFileName}`;
      await FileSystem.copyAsync({ from: photo.uri, to: tempUri });

      // Share the image
      const shareOptions = {
        title: `${photo.mode === 'before' ? 'Before' : 'After'} Photo - ${photo.name}`,
        message: `Check out this ${photo.mode} photo from ${photo.room}!`,
        url: tempUri,
        type: 'image/jpeg'
      };

      const result = await RNShare.share(shareOptions);
      
      if (result.action === RNShare.sharedAction) {
      } else if (result.action === RNShare.dismissedAction) {
      }
      
      // Clean up temporary file after sharing
      try {
        const fileInfo = await FileSystem.getInfoAsync(tempUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        }
      } catch (cleanupError) {
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('gallery.sharePhotoError'));
    } finally {
      setSharing(false);
    }
  };

  // Share combined photo (before + after with labels)
  const shareCombinedPhoto = async (photoSet) => {
    try {
      setSharing(true);
      
      // Capture the combined view with labels
      const capturedUri = await captureRef(combinedCaptureRef, {
        format: 'jpg',
        quality: 0.95
      });
      
      // Copy captured image to cache directory to ensure it's temporary
      const tempFileName = `${photoSet.room}_${photoSet.name}_combined_${Date.now()}.jpg`;
      const tempUri = `${FileSystem.cacheDirectory}${tempFileName}`;
      await FileSystem.copyAsync({ from: capturedUri, to: tempUri });

      // Share the image
      const shareOptions = {
        title: `Before/After - ${photoSet.name}`,
        message: `Check out this before/after comparison from ${photoSet.room}!`,
        url: tempUri,
        type: 'image/jpeg'
      };

      const result = await RNShare.share(shareOptions);
      
      if (result.action === RNShare.sharedAction) {
      } else if (result.action === RNShare.dismissedAction) {
      }
      
      // Clean up temporary file after sharing
      try {
        const fileInfo = await FileSystem.getInfoAsync(tempUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        }
      } catch (cleanupError) {
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('gallery.sharePhotoError'));
    } finally {
      setSharing(false);
    }
  };

  const startSharingWithOptions = async () => {
    console.log(`[GALLERY] ========== startSharingWithOptions CALLED ==========`);
    console.log(`[GALLERY] shareAsArchive state: ${shareAsArchive}`);
    console.log(`[GALLERY] showLabels state: ${showLabels}`);
    
    setShareOptionsVisible(false); // Close the modal immediately
    // Don't set sharing to true yet - we'll show it when we start preparing
    
    const sourcePhotos = activeProjectId ? photos.filter(p => p.projectId === activeProjectId) : photos;
    if (sourcePhotos.length === 0) {
        Alert.alert(t('gallery.noPhotosTitle'), t('gallery.noPhotosInProject'));
        setSharing(false);
        return;
    }

    // Filter before and after photos
    const itemsToShare = sourcePhotos.filter(p =>
        (selectedShareTypes.before && p.mode === PHOTO_MODES.BEFORE) ||
        (selectedShareTypes.after && p.mode === PHOTO_MODES.AFTER)
    );
    
    // If combined photos are selected, find them from file system
    let combinedPhotosToShare = [];
    if (selectedShareTypes.combined) {
        try {
            const beforePhotos = sourcePhotos.filter(p => p.mode === PHOTO_MODES.BEFORE);
            const afterPhotos = sourcePhotos.filter(p => p.mode === PHOTO_MODES.AFTER);
            const dir = FileSystem.documentDirectory;
            const entries = await FileSystem.readDirectoryAsync(dir);
            
            for (const beforePhoto of beforePhotos) {
                const afterPhoto = afterPhotos.find(p => p.beforePhotoId === beforePhoto.id);
                if (!afterPhoto) continue;
                
                const safeName = (beforePhoto.name || 'Photo').replace(/\s+/g, '_');
                const projectId = beforePhoto.projectId;
                const projectIdSuffix = projectId ? `_P${projectId}` : '';
                
                const extractTimestamp = (filename) => {
                    const match = filename.match(/_(\d+)(?:_P\d+)?\.(jpg|jpeg|png)$/i);
                    return match ? parseInt(match[1], 10) : 0;
                };
                
                // Prioritize STACK over SIDE variant
                const stackPrefix = `${beforePhoto.room}_${safeName}_COMBINED_BASE_STACK_`;
                const sidePrefix = `${beforePhoto.room}_${safeName}_COMBINED_BASE_SIDE_`;
                
                let newestUri = null;
                let newestTs = -1;
                
                // First, try to find STACK variant
                const stackMatches = entries.filter(name => {
                    if (!name.startsWith(stackPrefix)) return false;
                    if (projectId && !name.includes(projectIdSuffix)) return false;
                    return true;
                });
                
                for (const filename of stackMatches) {
                    const ts = extractTimestamp(filename);
                    if (ts > newestTs) {
                        newestTs = ts;
                        newestUri = `${dir}${filename}`;
                    }
                }
                
                // Only use SIDE if no STACK found
                if (!newestUri) {
                    const sideMatches = entries.filter(name => {
                        if (!name.startsWith(sidePrefix)) return false;
                        if (projectId && !name.includes(projectIdSuffix)) return false;
                        return true;
                    });
                    
                    for (const filename of sideMatches) {
                        const ts = extractTimestamp(filename);
                        if (ts > newestTs) {
                            newestTs = ts;
                            newestUri = `${dir}${filename}`;
                        }
                    }
                }
                
                if (newestUri) {
                    // Create a photo object for the combined photo
                    combinedPhotosToShare.push({
                        uri: newestUri,
                        mode: PHOTO_MODES.COMBINED,
                        name: beforePhoto.name,
                        room: beforePhoto.room,
                        projectId: beforePhoto.projectId,
                        id: `combined_${beforePhoto.id}`, // Unique ID for combined photo
                    });
                }
            }
            
            console.log('[GALLERY] Found combined photos from file system:', combinedPhotosToShare.length);
        } catch (error) {
            console.error('[GALLERY] Error finding combined photos:', error);
        }
    }
    
    // Combine all photos to share
    const allItemsToShare = [...itemsToShare, ...combinedPhotosToShare];
    
    console.log('[GALLERY] Items to share count:', allItemsToShare.length);
    console.log('[GALLERY] Items to share breakdown - Before:', itemsToShare.filter(p => p.mode === PHOTO_MODES.BEFORE).length, 
                'After:', itemsToShare.filter(p => p.mode === PHOTO_MODES.AFTER).length,
                'Combined:', combinedPhotosToShare.length);
    
    if (allItemsToShare.length === 0) {
        Alert.alert(t('gallery.noPhotosSelected'), t('gallery.selectAtLeastOne'));
        setSharing(false);
        return;
    }
    
    const projectName = projects.find(p => p.id === activeProjectId)?.name || 'Shared-Photos';
    const tempFiles = []; // Track temporary files for cleanup
    
    try {
        if (shareAsArchive) {
            // For ZIP, always show loading since we need to copy files
            setSharing(true);
            // Share as ZIP archive
            const zipFileName = `${projectName.replace(/\s+/g, '_')}_${Date.now()}.zip`;
            const zipPath = FileSystem.cacheDirectory + zipFileName;
            const zip = new JSZip();
            
            for (const item of allItemsToShare) {
                // Copy photo to temp location first to ensure it's accessible
                const tempFileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const tempUri = FileSystem.cacheDirectory + tempFileName;
                await FileSystem.copyAsync({ from: item.uri, to: tempUri });
                tempFiles.push(tempUri);
                
                const filename = item.uri.split('/').pop();
                const content = await FileSystem.readAsStringAsync(tempUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                zip.file(filename, content, { base64: true });
            }
            
            const zipBase64 = await zip.generateAsync({ type: 'base64' });
            await FileSystem.writeAsStringAsync(zipPath, zipBase64, {
                encoding: FileSystem.EncodingType.Base64,
            });
            tempFiles.push(zipPath);
            
            // Use react-native-share for ZIP file as well for better compatibility
            console.log('[GALLERY] Starting to share ZIP file:', zipPath);
            try {
                const sharePromise = Share.open({
                    url: zipPath,
                    title: `Share ${projectName} Photos`,
                    message: `Here are the photos from the project: ${projectName}`,
                    type: 'application/zip',
                });
                
                // Add a timeout to detect if Share.open hangs
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error('Share operation timed out after 30 seconds'));
                    }, 30000); // 30 second timeout
                });
                
                const result = await Promise.race([sharePromise, timeoutPromise]);
                console.log('[GALLERY] ZIP share completed successfully:', result);
            } catch (shareError) {
                console.error('[GALLERY] ZIP share error caught:', shareError);
                console.error('[GALLERY] Error message:', shareError?.message);
                
                // User cancelled or error occurred - this is fine, just log it
                if (shareError?.message?.includes('User did not share') || 
                    shareError?.message?.includes('cancelled') ||
                    shareError?.message?.includes('User Cancel')) {
                    // User cancelled - no need to show error
                    console.log('[GALLERY] User cancelled sharing ZIP');
                } else if (shareError?.message?.includes('timed out')) {
                    // Timeout - show error but don't rethrow
                    console.error('[GALLERY] ZIP share operation timed out');
                    Alert.alert(t('common.error'), 'Share operation took too long. Please try again.');
                } else {
                    // Real error - rethrow to be caught by outer catch
                    throw shareError;
                }
            }
        } else {
            // Share multiple photos as individual files using react-native-share
            console.log(`[GALLERY] ========== STARTING SHARING (NOT ARCHIVE) ==========`);
            console.log(`[GALLERY] shareAsArchive: ${shareAsArchive}, allItemsToShare.length: ${allItemsToShare.length}`);
            console.log(`[GALLERY] showLabels: ${showLabels}`);
            
            // Calculate settings hash once for all photos
            const settingsHash = calculateSettingsHash({
                showLabels,
                beforeLabelPosition,
                afterLabelPosition,
                labelBackgroundColor,
                labelTextColor,
                labelSize,
                labelFontFamily,
                labelMarginVertical,
                labelMarginHorizontal,
            });
            
            console.log(`[GALLERY] Settings hash calculated: ${settingsHash}, showLabels: ${showLabels}`);
            
            // Check cache for all photos first to determine if we need to show loading
            // Also store cache results to avoid duplicate checks
            let needsPreparation = false;
            const cachedPhotoUris = new Map(); // Map photo ID to cached URI
            
            if (showLabels) {
                console.log('[GALLERY] Checking cache for all photos before showing loading indicator...');
                for (const item of allItemsToShare) {
                    if (item.mode) {
                        try {
                            const cachedUri = await getCachedLabeledPhoto(item, settingsHash);
                            if (cachedUri) {
                                // Store the cached URI for reuse
                                cachedPhotoUris.set(item.id, cachedUri);
                                console.log(`[GALLERY] Photo ${item.id} (${item.mode}) found in cache`);
                            } else {
                                needsPreparation = true;
                                console.log(`[GALLERY] Photo ${item.id} (${item.mode}) needs preparation`);
                                // Don't break - continue checking all photos to populate cache map
                            }
                        } catch (error) {
                            // If cache check fails, assume preparation is needed
                            needsPreparation = true;
                            console.log(`[GALLERY] Cache check failed for photo ${item.id}, will prepare`);
                        }
                    }
                }
                console.log(`[GALLERY] Cache check complete. Needs preparation: ${needsPreparation}, Cached: ${cachedPhotoUris.size}/${allItemsToShare.length}`);
            }
            
            // Only show loading indicator if preparation is actually needed
            if (needsPreparation) {
                setSharing(true);
            }
            
            // Process all photos to add labels if needed
            const urls = [];

            // Fast path: If all photos are already cached, use them directly without processing
            let allCached = showLabels && cachedPhotoUris.size === allItemsToShare.length && !needsPreparation;
            if (allCached) {
                console.log(`[GALLERY] All ${allItemsToShare.length} photos are cached, using cached URIs directly (fast path)`);
                for (const item of allItemsToShare) {
                    const cachedUri = cachedPhotoUris.get(item.id);
                    if (cachedUri) {
                        // Verify cached file exists
                        const fileInfo = await FileSystem.getInfoAsync(cachedUri);
                        if (fileInfo.exists) {
                            urls.push(cachedUri);
                            await updateCacheLastUsed(item);
                            console.log(`[GALLERY] ✅ Using cached photo ${item.id} (${item.mode}): ${cachedUri.substring(0, 80)}...`);
                        } else {
                            console.error(`[GALLERY] Cached file does not exist: ${cachedUri}`);
                            // Fall through to normal processing for this photo
                            allCached = false;
                            urls.length = 0; // Clear the array
                            break;
                        }
                    } else {
                        console.error(`[GALLERY] No cached URI found for photo ${item.id}`);
                        // Fall through to normal processing for this photo
                        allCached = false;
                        urls.length = 0; // Clear the array
                        break;
                    }
                }
                
                if (allCached && urls.length === allItemsToShare.length) {
                    console.log(`[GALLERY] Successfully prepared ${urls.length} cached photos for sharing (fast path)`);
                    // Skip the processing loop and go directly to sharing
                } else if (!allCached) {
                    // Some photos failed validation, need to process normally
                    console.log(`[GALLERY] Fast path failed, falling back to normal processing`);
                }
            }

            // Helper function to capture a photo with label if showLabels is enabled
            const capturePhotoWithLabel = async (photo, index) => {
                    console.log(`[GALLERY] capturePhotoWithLabel called for photo ${index + 1}, mode: ${photo.mode}, id: ${photo.id}`);
                    
                    // Check if we already have this photo in cache from the initial check
                    if (showLabels && photo.mode && cachedPhotoUris.has(photo.id)) {
                        const cachedUri = cachedPhotoUris.get(photo.id);
                        console.log(`[GALLERY] ✅ Using cached labeled photo ${index + 1} (${photo.mode}) from initial check: ${cachedUri}`);
                        await updateCacheLastUsed(photo);
                        return cachedUri;
                    }
                    
                    // If not in initial cache check, check cache now (for photos that weren't checked initially)
                    if (showLabels && photo.mode) {
                        try {
                            console.log(`[GALLERY] Checking cache for photo ${index + 1} (${photo.mode}), photoId: ${photo.id}, settingsHash: ${settingsHash}`);
                            const cachedUri = await getCachedLabeledPhoto(photo, settingsHash);
                            if (cachedUri) {
                                console.log(`[GALLERY] ✅ Using cached labeled photo ${index + 1} (${photo.mode}): ${cachedUri}`);
                                await updateCacheLastUsed(photo);
                                return cachedUri;
                            } else {
                                console.log(`[GALLERY] ❌ No cache found for photo ${index + 1} (${photo.mode}), will prepare now`);
                            }
                        } catch (cacheError) {
                            console.error(`[GALLERY] Error checking cache for photo ${index + 1}:`, cacheError);
                            // Continue with preparation if cache check fails
                        }
                    }

                    // Handle combined photos specially - need to find before and after photos
                    if (photo.mode === PHOTO_MODES.COMBINED || photo.mode === 'mix' || photo.mode === 'combined') {
                        // Find the corresponding before and after photos
                        const beforePhoto = photos.find(p => 
                            p.mode === PHOTO_MODES.BEFORE && 
                            p.name === photo.name && 
                            p.room === photo.room &&
                            p.projectId === photo.projectId
                        );
                        const afterPhoto = photos.find(p => 
                            p.mode === PHOTO_MODES.AFTER && 
                            p.beforePhotoId === beforePhoto?.id &&
                            p.projectId === photo.projectId
                        );
                        
                        if (beforePhoto && afterPhoto && showLabels) {
                            // Capture combined view with both labels
                            return new Promise((resolve, reject) => {
                                // Get dimensions of both photos
                                Image.getSize(beforePhoto.uri, (beforeWidth, beforeHeight) => {
                                    Image.getSize(afterPhoto.uri, (afterWidth, afterHeight) => {
                                        // Determine layout based on photo orientation
                                        const phoneOrientation = beforePhoto.orientation || 'portrait';
                                        const cameraViewMode = beforePhoto.cameraViewMode || 'portrait';
                                        const isLetterbox = beforePhoto.templateType === 'letterbox' || 
                                                          (phoneOrientation === 'portrait' && cameraViewMode === 'landscape');
                                        
                                        // Use combined photo dimensions if available, otherwise calculate
                                        Image.getSize(photo.uri, (combinedWidth, combinedHeight) => {
                                            // Set the combined photo to capture (triggers useEffect)
                                            setCapturingPhoto({ 
                                                photo: {
                                                    ...photo,
                                                    beforePhoto,
                                                    afterPhoto,
                                                    isCombined: true,
                                                    isLetterbox
                                                }, 
                                                index, 
                                                width: combinedWidth, 
                                                height: combinedHeight, 
                                                labelPosition: null, // Not used for combined
                                                resolve, 
                                                reject 
                                            });
                                        }, (error) => {
                                            // If getSize fails, use before photo dimensions
                                            const totalWidth = beforeWidth * 2; // Side by side
                                            const totalHeight = isLetterbox ? beforeHeight * 2 : beforeHeight; // Stacked or side by side
                                            setCapturingPhoto({ 
                                                photo: {
                                                    ...photo,
                                                    beforePhoto,
                                                    afterPhoto,
                                                    isCombined: true,
                                                    isLetterbox
                                                }, 
                                                index, 
                                                width: totalWidth, 
                                                height: totalHeight, 
                                                labelPosition: null,
                                                resolve, 
                                                reject 
                                            });
                                        });
                                    }, (error) => {
                                        // If getSize fails, just copy original combined photo
                                        const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
                                        const tempUri = FileSystem.cacheDirectory + tempFileName;
                                        FileSystem.copyAsync({ from: photo.uri, to: tempUri }).then(() => {
                                            resolve(tempUri);
                                        }).catch(reject);
                                    });
                                }, (error) => {
                                    // If getSize fails, just copy original combined photo
                                    const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
                                    const tempUri = FileSystem.cacheDirectory + tempFileName;
                                    FileSystem.copyAsync({ from: photo.uri, to: tempUri }).then(() => {
                                        resolve(tempUri);
                                    }).catch(reject);
                                });
                            });
                        } else {
                            // No labels or couldn't find before/after photos, just copy original
                            const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
                            const tempUri = FileSystem.cacheDirectory + tempFileName;
                            await FileSystem.copyAsync({ from: photo.uri, to: tempUri });
                            return tempUri;
                        }
                    }
                    
                    if (!showLabels || !photo.mode) {
                        // No labels needed, just copy the original
                        const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
                        const tempUri = FileSystem.cacheDirectory + tempFileName;
                        await FileSystem.copyAsync({ from: photo.uri, to: tempUri });
                        return tempUri;
                    }
                    
                    // Need to capture with label - use state-based approach with hidden modal
                    return new Promise((resolve, reject) => {
                        // Get image dimensions first
                        Image.getSize(photo.uri, (width, height) => {
                            // Determine label position based on photo mode
                            let labelPosition;
                            if (photo.mode === PHOTO_MODES.BEFORE) {
                                labelPosition = beforeLabelPosition || 'top-left';
                            } else if (photo.mode === PHOTO_MODES.AFTER) {
                                labelPosition = afterLabelPosition || 'top-right';
                            } else {
                                labelPosition = 'top-left'; // Default for combined
                            }
                            
                            // Set the photo to capture (triggers useEffect to render and capture)
                            setCapturingPhoto({ 
                                photo, 
                                index, 
                                width, 
                                height, 
                                labelPosition,
                                resolve, 
                                reject 
                            });
                        }, (error) => {
                            // If getSize fails, just copy original
                            const tempFileName = `temp_${Date.now()}_${index}_${Math.random().toString(36).substring(7)}.jpg`;
                            const tempUri = FileSystem.cacheDirectory + tempFileName;
                            FileSystem.copyAsync({ from: photo.uri, to: tempUri }).then(() => {
                                resolve(tempUri);
                            }).catch(reject);
                        });
                    });
                };
                
                
                // Process all photos sequentially (important for label capture)
                // Skip this loop if we already have all cached photos (fast path)
                if (!allCached || urls.length === 0) {
                    console.log(`[GALLERY] Starting to process ${allItemsToShare.length} photos for sharing...`);
                    for (let i = 0; i < allItemsToShare.length; i++) {
                        const item = allItemsToShare[i];
                        console.log(`[GALLERY] Processing photo ${i + 1}/${allItemsToShare.length}: mode=${item.mode}, id=${item.id}`);
                        try {
                            // Verify source file exists before processing
                            const sourceInfo = await FileSystem.getInfoAsync(item.uri);
                            if (!sourceInfo.exists) {
                                console.error(`[GALLERY] Source file does not exist: ${item.uri}`);
                                continue;
                            }
                            
                            // Process photo (with or without labels)
                            // This will wait for label capture to complete if labels are enabled
                            console.log(`[GALLERY] Calling capturePhotoWithLabel for photo ${i + 1}...`);
                            const tempUri = await capturePhotoWithLabel(item, i);
                            console.log(`[GALLERY] capturePhotoWithLabel returned for photo ${i + 1}: ${tempUri?.substring(0, 100)}...`);
                            
                            // Verify processed file exists
                            const tempInfo = await FileSystem.getInfoAsync(tempUri);
                            if (!tempInfo.exists) {
                                console.error(`[GALLERY] Failed to process file: ${item.uri} to ${tempUri}`);
                                continue;
                            }
                            
                            // Save to cache if it was just prepared (not from cache)
                            // Check if this URI is already in cache by checking if it contains the cache directory
                            const cacheDir = getCacheDir();
                            const isFromCache = tempUri.includes('_labeled_cache/') || tempUri.includes(cacheDir);
                            console.log(`[GALLERY] Photo ${i + 1} - isFromCache: ${isFromCache}, tempUri: ${tempUri.substring(0, 100)}...`);
                            if (showLabels && item.mode && !isFromCache) {
                                // This is a newly prepared photo, save it to cache for future use
                                try {
                                    console.log(`[GALLERY] Saving photo ${i + 1} (${item.mode}, id: ${item.id}) to cache...`);
                                    const cachedUri = await saveCachedLabeledPhoto(item, tempUri, settingsHash);
                                    if (cachedUri) {
                                        console.log(`[GALLERY] ✅ Successfully saved photo ${i + 1} to cache: ${cachedUri}`);
                                    } else {
                                        console.log(`[GALLERY] ⚠️ Failed to save photo ${i + 1} to cache`);
                                    }
                                } catch (cacheError) {
                                    console.error(`[GALLERY] Error saving to cache:`, cacheError);
                                    // Continue even if cache save fails
                                }
                            } else if (isFromCache) {
                                console.log(`[GALLERY] Photo ${i + 1} is already from cache, skipping save`);
                            } else {
                                console.log(`[GALLERY] Photo ${i + 1} - not saving to cache (showLabels: ${showLabels}, mode: ${item.mode})`);
                            }
                            
                            tempFiles.push(tempUri);
                            // Keep full file:// URI for react-native-share
                            urls.push(tempUri);
                            console.log(`[GALLERY] Processed photo ${i + 1} (${item.mode || 'unknown'}): ${tempUri}`);
                            
                            // Longer delay between processing to ensure label capture completes
                            // This is especially important when labels are enabled
                            if (i < allItemsToShare.length - 1) {
                                if (showLabels && item.mode) {
                                    // If labels were applied, wait longer for capture to complete
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                } else {
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                }
                            }
                        } catch (copyError) {
                            console.error(`[GALLERY] Error processing photo ${i + 1}:`, copyError);
                            console.error(`[GALLERY] Source URI: ${item.uri}`);
                            // Continue with next photo
                        }
                    }
                }
                
                if (urls.length === 0) {
                    Alert.alert(t('common.error'), 'No photos could be prepared for sharing');
                    return;
                }
                
                console.log(`[GALLERY] Successfully prepared ${urls.length} photos for sharing`);
                
                // Close loading popup before opening share sheet (if it was shown)
                // This ensures it closes even if Share.open() blocks
                if (needsPreparation) {
                    setSharing(false);
                }
                
                // Share multiple photos using react-native-share
                // Use urls parameter to share all photos at once (same approach that worked for 8 photos)
                console.log('[GALLERY] Starting to share', urls.length, 'photos together');
                console.log('[GALLERY] Share to same app:', shareToSameApp);
                
                // Add a small delay before sharing to ensure UI is ready
                await new Promise(resolve => InteractionManager.runAfterInteractions(resolve));
                await new Promise(resolve => requestAnimationFrame(resolve));
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Share all photos at once using urls parameter
                // Wrap in requestAnimationFrame to ensure it runs on main thread
                try {
                    console.log('[GALLERY] About to call Share.open() with', urls.length, 'photos');
                    console.log('[GALLERY] First photo URI:', urls[0]);
                    console.log('[GALLERY] Last photo URI:', urls[urls.length - 1]);
                    
                    const shareResult = await new Promise((resolve, reject) => {
                        requestAnimationFrame(async () => {
                            try {
                                const result = await Share.open({
                                    urls: urls,
                                    title: `Share ${projectName} Photos`,
                                    message: `Sharing ${urls.length} photos from ${projectName}`,
                                    type: 'image/jpeg',
                                });
                                resolve(result);
                            } catch (error) {
                                reject(error);
                            }
                        });
                    });
                    
                    console.log('[GALLERY] Share result:', shareResult);
                    console.log('[GALLERY] All photos shared successfully');
                } catch (shareError) {
                    // Check if user cancelled before logging as error
                    const isUserCancellation = shareError?.message?.includes('User did not share') || 
                        shareError?.message?.includes('cancelled') ||
                        shareError?.message?.includes('User Cancel') ||
                        shareError?.code === 'E_USER_CANCELLED';
                    
                    if (isUserCancellation) {
                        // User cancelled - this is normal, not an error
                        console.log('[GALLERY] User cancelled sharing - this is normal if share sheet was dismissed');
                        return; // Exit gracefully, no error handling needed
                    }
                    
                    // Real error occurred
                    console.error('[GALLERY] Error sharing photos:', shareError);
                    console.error('[GALLERY] Error message:', shareError?.message);
                    console.error('[GALLERY] Error code:', shareError?.code);
                    console.log('[GALLERY] Batch share failed with error, falling back to one by one...');
                    // Fallback to one by one sharing
                        for (let i = 0; i < urls.length; i++) {
                            try {
                                console.log(`[GALLERY] Sharing photo ${i + 1}/${urls.length}...`);
                                
                                await Share.open({
                                    url: urls[i],
                                    title: `${projectName} Photo ${i + 1}/${urls.length}`,
                                    message: `Photo ${i + 1} of ${urls.length} from ${projectName}`,
                                    type: 'image/jpeg',
                                });
                                
                                console.log(`[GALLERY] Photo ${i + 1} shared successfully`);
                                
                                // Small delay between shares
                                if (i < urls.length - 1) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            } catch (singleShareError) {
                                // Check if user cancelled
                                const isUserCancellation = singleShareError?.message?.includes('User did not share') || 
                                    singleShareError?.message?.includes('cancelled') ||
                                    singleShareError?.message?.includes('User Cancel') ||
                                    singleShareError?.code === 'E_USER_CANCELLED';
                                
                                if (isUserCancellation) {
                                    console.log(`[GALLERY] User cancelled sharing photo ${i + 1} - stopping one-by-one sharing`);
                                    return; // Exit gracefully if user cancels
                                }
                                
                                // Real error - log it but continue with next photo
                                console.error(`[GALLERY] Error sharing photo ${i + 1}:`, singleShareError);
                            }
                        }
                    }
                
            console.log('[GALLERY] Finished sharing all photos');
        }
        
        // analyticsService.logEvent('Project_Shared', { 
        //   projectName, 
        //   photoCount: itemsToShare.length,
        //   sharedTypes: Object.keys(selectedShareTypes).filter(k => selectedShareTypes[k]),
        // });
    } catch (error) {
        console.error('[GALLERY] Share error:', error);
        Alert.alert(t('common.error'), t('gallery.prepareShareError'));
    } finally {
        // Always close the loading popup
        setSharing(false);
        
        // Clean up temporary files after a delay (to allow sharing to complete)
        setTimeout(async () => {
            for (const tempFile of tempFiles) {
                try {
                    const fileInfo = await FileSystem.getInfoAsync(tempFile);
                    if (fileInfo.exists) {
                        await FileSystem.deleteAsync(tempFile, { idempotent: true });
                    }
                } catch (cleanupError) {
                    // Ignore cleanup errors
                }
            }
        }, 5000); // 5 second delay to allow sharing to complete
    }
  };

  const handleShareProject = async () => {
    const sourcePhotos = activeProjectId ? photos.filter(p => p.projectId === activeProjectId) : photos;
    if (sourcePhotos.length === 0) {
      Alert.alert(t('gallery.noPhotosTitle'), t('gallery.noPhotosInProject'));
      return;
    }
    setShareOptionsVisible(true);
  };

  const handleUploadPhotos = async () => {
    // Check if there are photos to upload (always check this first)
    if (photos.length === 0) {
      Alert.alert(t('gallery.noPhotosTitle'), t('gallery.noPhotosToUpload'));
      return;
    }

    // Load Dropbox tokens before checking authentication
    await dropboxAuthService.loadStoredTokens();

    // Check if at least one upload service is available (Google Drive or Dropbox)
    const hasGoogle = isAuthenticated;
    const hasDropbox = dropboxAuthService.isAuthenticated();
    
    if (!hasGoogle && !hasDropbox) {
      Alert.alert(
        t('gallery.noUploadServiceTitle'),
        t('gallery.noUploadServiceMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('gallery.goToSettings'), onPress: () => navigation.navigate('Settings') }
        ]
      );
      return;
    }

    // Check if user info is configured (required for uploads)
    if (!userName) {
      Alert.alert(
        t('gallery.setupRequiredTitle'),
        t('gallery.setupNameMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('gallery.goToSettings'), onPress: () => navigation.navigate('Settings') }
        ]
      );
      return;
    }

    // Handle team member upload
    if (userMode === 'team_member') {
      if (teamInfo && teamInfo.sessionId && teamInfo.token) {
        // Set default destinations based on available services
        setUploadDestinations({
          google: hasGoogle,
          dropbox: hasDropbox && !hasGoogle // Default to Dropbox if Google not available
        });
        setOptionsVisible(true);
      } else {
        Alert.alert(t('common.error'), t('gallery.teamInfoMissing'));
      }
      return;
    }

    // For Pro/Business/Enterprise users (individual mode or authenticated without team)
    const shouldUseDirectDrive = userMode === 'individual' || 
      (isAuthenticated && (userPlan === 'pro' || userPlan === 'business' || userPlan === 'enterprise') && !teamInfo);
    
    if (shouldUseDirectDrive) {
      // If Google is authenticated, try to ensure Google Drive folder exists
      if (hasGoogle) {
        try {
          const userFolderId = await googleDriveService.findOrCreateProofPixFolder();
          if (!userFolderId) {
            // If Google folder creation fails, but Dropbox is available, allow Dropbox only
            if (hasDropbox) {
              setUploadDestinations({
                google: false,
                dropbox: true
              });
              setOptionsVisible(true);
              return;
            }
            Alert.alert(t('common.error'), t('gallery.driveFolderError'));
            return;
          }
        } catch (error) {
          // If Google Drive access fails, but Dropbox is available, allow Dropbox only
          if (hasDropbox) {
            setUploadDestinations({
              google: false,
              dropbox: true
            });
            setOptionsVisible(true);
            return;
          }
          Alert.alert(t('common.error'), t('gallery.driveAccessError'));
          return;
        }
      }

      // Set default destinations based on available services
      setUploadDestinations({
        google: hasGoogle,
        dropbox: hasDropbox && !hasGoogle // Default to Dropbox if Google not available
      });

      // Open options modal
      setOptionsVisible(true);
      return;
    }

    // For admin mode - use configured folder and proxy session
    let config = null;
    if (userMode === 'admin' && folderId && proxySessionId) {
      // Use admin's configured folder and proxy session
      config = { folderId, useDirectDrive: true, sessionId: proxySessionId };
    } else {
      // Fallback to location-based config (folderId only, no scriptUrl)
      const locationConfig = getLocationConfig(location);
      config = { folderId: locationConfig?.folderId, useDirectDrive: false };
    }

    // Check if Google Drive is configured
    // For proxy server uploads, we need folderId and sessionId
    // For location-based uploads, we need folderId (legacy support)
    const hasGoogleConfig = config && config.folderId && (!config.useDirectDrive || config.sessionId);

    // If Google is not configured but Dropbox is available, allow Dropbox only
    if (!hasGoogleConfig && hasDropbox) {
      setUploadDestinations({
        google: false,
        dropbox: true
      });
      setOptionsVisible(true);
      return;
    }

    // If neither Google nor Dropbox is available, show error
    if (!hasGoogleConfig && !hasDropbox) {
      Alert.alert(
        t('gallery.setupRequiredTitle'),
        t('gallery.driveConfigMissing'),
        [
          { text: t('common.ok'), style: 'cancel' }
        ]
      );
      return;
    }

    // Set default destinations based on available services
    setUploadDestinations({
      google: hasGoogleConfig,
      dropbox: hasDropbox && !hasGoogleConfig // Default to Dropbox if Google not configured
    });

    // Open options modal
    setOptionsVisible(true);
  };

  const startUploadWithOptions = async () => {
    try {
      // Check if at least one destination is selected
      if (!uploadDestinations.google && !uploadDestinations.dropbox) {
        Alert.alert(
          t('gallery.noDestinationSelected'),
          t('gallery.selectAtLeastOneDestination')
        );
        return;
      }

      // Check authentication for selected destinations
      if (uploadDestinations.google && !isAuthenticated) {
        Alert.alert(
          t('gallery.googleNotConnected'),
          t('gallery.googleNotConnectedMessage')
        );
        return;
      }

      // Load Dropbox tokens before checking authentication
      await dropboxAuthService.loadStoredTokens();
      
      if (uploadDestinations.dropbox && !dropboxAuthService.isAuthenticated()) {
        Alert.alert(
          t('gallery.dropboxNotConnected'),
          t('gallery.dropboxNotConnectedMessage')
        );
        return;
      }

      if (userMode === 'team_member') {
        // Team Member Upload Logic (same as Pro/Business/Enterprise)
        const sourcePhotos = activeProjectId ? photos.filter(p => p.projectId === activeProjectId) : photos;

        // Build the list based on selected types (before/after)
        const items = sourcePhotos.filter(p =>
          (selectedTypes.before && p.mode === PHOTO_MODES.BEFORE) ||
          (selectedTypes.after && p.mode === PHOTO_MODES.AFTER)
        );

        // If combined is selected, generate them dynamically (same logic as admin/individual)
        const combinedItems = [];
        if (selectedTypes.combined) {
          const anyFormat = Object.keys(selectedFormats).some((k) => selectedFormats[k]);

          // Group photos by room to find pairs
          const byRoom = {};
          sourcePhotos.forEach(p => {
            if (!byRoom[p.room]) byRoom[p.room] = { before: [], after: [] };
            if (p.mode === PHOTO_MODES.BEFORE) byRoom[p.room].before.push(p);
            if (p.mode === PHOTO_MODES.AFTER) byRoom[p.room].after.push(p);
          });

          // Create pairs
          const pairs = [];
          Object.keys(byRoom).forEach(roomId => {
            const beforeList = byRoom[roomId].before;
            const afterList = byRoom[roomId].after;
            afterList.forEach(after => {
              const match = beforeList.find(b => b.id === after.beforePhotoId);
              if (match) pairs.push({ before: match, after, room: roomId });
            });
          });

          if (!anyFormat) {
            // Upload existing ORIGINAL combined images from device storage
            try {
              const dir = FileSystem.documentDirectory;
              const entries = dir ? await FileSystem.readDirectoryAsync(dir) : [];

              let foundCount = 0;
              for (const pair of pairs) {
                const safeName = (pair.before.name || 'Photo').replace(/\s+/g, '_');
                const projectId = pair.before.projectId;
                const projectIdSuffix = projectId ? `_P${projectId}` : '';
                const stackPrefix = `${pair.before.room}_${safeName}_COMBINED_BASE_STACK_`;
                const sidePrefix = `${pair.before.room}_${safeName}_COMBINED_BASE_SIDE_`;

                const pickLatestByPrefix = (prefix) => {
                  let matches = entries.filter(name => name.startsWith(prefix));
                  
                  // Filter by project ID if available
                  if (projectId) {
                    matches = matches.filter(name => name.includes(projectIdSuffix));
                  }
                  
                  if (matches.length === 0) return null;
                  // Filenames end with _<timestamp>[_PprojectId].jpg; pick max timestamp
                  let best = null;
                  let bestTs = -1;
                  for (const name of matches) {
                    // Match timestamp before project ID suffix if present
                    const m = name.match(/_(\d+)(?:_P\d+)?\.(jpg|jpeg|png)$/i);
                    const ts = m ? parseInt(m[1], 10) : 0;
                    if (ts > bestTs) { bestTs = ts; best = name; }
                  }
                  return best || matches[matches.length - 1];
                };

                const stackName = pickLatestByPrefix(stackPrefix);
                const sideName = pickLatestByPrefix(sidePrefix);

                const beforeOrientation = pair.before.orientation || 'portrait';
                const cameraVM = pair.before.cameraViewMode || 'portrait';
                const isLetterbox = (cameraVM === 'landscape' && beforeOrientation === 'portrait');
                const isLandscape = beforeOrientation === 'landscape' || cameraVM === 'landscape';

                const pushItem = (name, tag) => {
                  if (!dir || !name) return;
                  combinedItems.push({
                    uri: `${dir}${name}`,
                    filename: `${pair.before.name}_original-${tag}.jpg`,
                    name: pair.before.name,
                    room: pair.room,
                    mode: PHOTO_MODES.COMBINED,
                    format: `original-${tag}`
                  });
                  foundCount++;
                };

                if (isLetterbox) {
                  // Upload both if both exist
                  if (stackName) pushItem(stackName, 'stack');
                  if (sideName) pushItem(sideName, 'side');
                } else if (isLandscape) {
                  if (stackName) pushItem(stackName, 'stack');
                  else if (sideName) pushItem(sideName, 'side');
                } else {
                  if (sideName) pushItem(sideName, 'side');
                  else if (stackName) pushItem(stackName, 'stack');
                }
              }

            if (foundCount === 0 && pairs.length > 0) {
                Alert.alert(t('gallery.nothingToUploadTitle'), t('gallery.noOriginalCombinedFound'));
                return;
              }
            } catch (e) {
              Alert.alert(t('common.error'), t('gallery.originalCombinedSearchError'));
              return;
            }
          } else {
            // Advanced formats selected: render dynamic combined images
            const selectedTemplateKeys = Object.keys(TEMPLATE_CONFIGS).filter(k => selectedFormats[k]);

            const getAllowedTemplatesForPair = (pair) => {
              const before = pair.before;
              const beforeOrientation = before.orientation || 'portrait';
              const cameraVM = before.cameraViewMode || 'portrait';
              const isLetterbox = (cameraVM === 'landscape' && beforeOrientation === 'portrait');
              const isLandscape = beforeOrientation === 'landscape' || cameraVM === 'landscape';

              return selectedTemplateKeys.filter((key) => {
                const layout = TEMPLATE_CONFIGS[key]?.layout;
                if (isLetterbox) return true; // both stack and side-by-side
                if (isLandscape) return layout === 'stack';
                return layout === 'sidebyside';
              });
            };

            const totalRenders = pairs.reduce((sum, pair) => sum + getAllowedTemplatesForPair(pair).length, 0);

            if (totalRenders === 0) {
              Alert.alert(t('gallery.nothingToUploadTitle'), t('gallery.noPairsForCombined'));
              return;
            }

            setOptionsVisible(false);
            setRenderingCombined(true);
            setRenderingProgress({ current: 0, total: totalRenders });

            // Render each combination
            let renderCount = 0;
            for (const pair of pairs) {
              const allowedKeys = getAllowedTemplatesForPair(pair);
              for (const templateKey of allowedKeys) {
                const cfg = TEMPLATE_CONFIGS[templateKey];

                // Set the current render
                setCurrentRenderPair(pair);
                setCurrentRenderTemplate({ key: templateKey, config: cfg });

                // Wait for render
                await new Promise(resolve => setTimeout(resolve, 800));

                // Capture the view
                try {
                  const uri = await captureRef(renderViewRef, {
                    format: 'jpg',
                    quality: 0.9
                  });
                  if (uri) {
                    combinedItems.push({
                      uri: uri,
                      filename: `${pair.before.name}_${templateKey}.jpg`,
                      name: pair.before.name,
                      room: pair.room,
                      mode: PHOTO_MODES.COMBINED,
                      format: templateKey
                    });
                  }
                } catch (error) {
                  console.error('Error capturing combined image:', error);
                }

                renderCount++;
                setRenderingProgress({ current: renderCount, total: totalRenders });
              }
            }

            setRenderingCombined(false);
            setCurrentRenderPair(null);
            setCurrentRenderTemplate(null);
          }
        }

        // Combine all items (before, after, combined)
        const itemsToUpload = [...items, ...combinedItems];

        if (itemsToUpload.length === 0) {
          Alert.alert(t('gallery.noPhotosSelected'), t('gallery.selectAtLeastOneUpload'));
          return;
        }

        setOptionsVisible(false);
        // Create album name using the same format as Pro/Business/Enterprise tiers
        // This includes a numeric identifier (HHMMSS) to distinguish folders created on the same day
        const teamUserName = userName || 'Team Member';
        const albumName = createAlbumName(teamUserName, new Date());
        
        startBackgroundUpload({
          items: itemsToUpload,
          teamInfo: teamInfo,
          uploadType: 'team',
          albumName: albumName,
          location: location || 'tampa', // Use location from settings
          userName: teamUserName, // Use userName as cleanerName
          flat: !useFolderStructure // Use flat mode if folder structure is disabled
        });
        setShowUploadDetails(true);
        return;
      }

      // Admin/Individual Upload Logic
      let config = null;
      let uploadConfig = null; // Store config for use in proceedWithUpload
      
      // Check if user should use direct Drive API upload
      // Pro, Business, and Enterprise users with individual mode or authenticated admin mode (without team) use direct Drive API
      const shouldUseDirectDrive = userMode === 'individual' || 
        (isAuthenticated && (userPlan === 'pro' || userPlan === 'business' || userPlan === 'enterprise') && !teamInfo);
      
      // For individual/Pro/Business/Enterprise users - use their authenticated Google Drive via proxy
      if (shouldUseDirectDrive) {
        try {
          const userFolderId = await googleDriveService.findOrCreateProofPixFolder();
          if (!userFolderId) {
            Alert.alert('Error', 'Could not access Google Drive folder. Please sign in again.');
            return;
          }
          // Initialize proxy session for uploads
          const sessionResult = await initializeProxySession(userFolderId);
          if (!sessionResult || !sessionResult.success || !sessionResult.sessionId) {
            Alert.alert('Error', 'Failed to initialize proxy session. Please try again.');
            return;
          }
          // Use proxy server upload for Pro, Business, and Enterprise users
          config = { 
            folderId: userFolderId, 
            useDirectDrive: true, // Flag to indicate proxy server upload
            sessionId: sessionResult.sessionId // Extract sessionId string from result object
          };
          uploadConfig = config; // Store for later use
        } catch (error) {
          console.error('Error setting up proxy upload:', error);
          Alert.alert('Error', `Failed to setup proxy upload: ${error.message}`);
          return;
        }
      } else {
        // For admin mode (team management) - use configured folder and proxy session
        // Only set config if NOT individual mode (to avoid overwriting Pro/Business/Enterprise user config)
        if (userMode === 'admin' && folderId && proxySessionId) {
          config = { folderId, useDirectDrive: true, sessionId: proxySessionId };
        } else {
          // Fallback to location-based config (folderId only)
          const locationConfig = getLocationConfig(location);
          config = { folderId: locationConfig?.folderId, useDirectDrive: false };
        }
        uploadConfig = config; // Store for later use
      }

        // Check if Google Drive is configured
        // For proxy server uploads (useDirectDrive), we need folderId and sessionId
        // For location-based uploads, we need folderId (legacy support)
        if (!config || !config.folderId || (config.useDirectDrive && !config.sessionId)) {
          Alert.alert(
            t('gallery.setupRequiredTitle'),
            t('gallery.driveConfigMissing'),
            [{ text: t('common.ok'), style: 'cancel' }]
          );
          return;
        }

      // Generate album name - use project's uploadId if available, otherwise generate new one
      const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null;
      const projectUploadId = activeProject?.uploadId || null;
      const albumName = createAlbumName(userName, new Date(), projectUploadId);
      // Scope uploads to the active project if one is selected
      const sourcePhotos = activeProjectId ? photos.filter(p => p.projectId === activeProjectId) : photos;

      // Build the list based on selected types (before/after)
      const items = sourcePhotos.filter(p =>
        (selectedTypes.before && p.mode === PHOTO_MODES.BEFORE) ||
        (selectedTypes.after && p.mode === PHOTO_MODES.AFTER)
      );

      // If combined is selected, generate them dynamically
      const combinedItems = [];
      if (selectedTypes.combined) {
        const anyFormat = Object.keys(selectedFormats).some((k) => selectedFormats[k]);

        // Group photos by room to find pairs
        const byRoom = {};
        sourcePhotos.forEach(p => {
          if (!byRoom[p.room]) byRoom[p.room] = { before: [], after: [] };
          if (p.mode === PHOTO_MODES.BEFORE) byRoom[p.room].before.push(p);
          if (p.mode === PHOTO_MODES.AFTER) byRoom[p.room].after.push(p);
        });

        // Create pairs
        const pairs = [];
        Object.keys(byRoom).forEach(roomId => {
          const beforeList = byRoom[roomId].before;
          const afterList = byRoom[roomId].after;
          afterList.forEach(after => {
            const match = beforeList.find(b => b.id === after.beforePhotoId);
            if (match) pairs.push({ before: match, after, room: roomId });
          });
        });

        if (!anyFormat) {
          // Upload existing ORIGINAL combined images from device storage
          try {
            const dir = FileSystem.documentDirectory;
            const entries = dir ? await FileSystem.readDirectoryAsync(dir) : [];

            let foundCount = 0;
            for (const pair of pairs) {
              const safeName = (pair.before.name || 'Photo').replace(/\s+/g, '_');
              const projectId = pair.before.projectId;
              const projectIdSuffix = projectId ? `_P${projectId}` : '';
              const stackPrefix = `${pair.before.room}_${safeName}_COMBINED_BASE_STACK_`;
              const sidePrefix = `${pair.before.room}_${safeName}_COMBINED_BASE_SIDE_`;

              const pickLatestByPrefix = (prefix) => {
                let matches = entries.filter(name => name.startsWith(prefix));
                
                // Filter by project ID if available
                if (projectId) {
                  matches = matches.filter(name => name.includes(projectIdSuffix));
                }
                
                if (matches.length === 0) return null;
                // Filenames end with _<timestamp>[_PprojectId].jpg; pick max timestamp
                let best = null;
                let bestTs = -1;
                for (const name of matches) {
                  // Match timestamp before project ID suffix if present
                  const m = name.match(/_(\d+)(?:_P\d+)?\.(jpg|jpeg|png)$/i);
                  const ts = m ? parseInt(m[1], 10) : 0;
                  if (ts > bestTs) { bestTs = ts; best = name; }
                }
                return best || matches[matches.length - 1];
              };

              const stackName = pickLatestByPrefix(stackPrefix);
              const sideName = pickLatestByPrefix(sidePrefix);

              const beforeOrientation = pair.before.orientation || 'portrait';
              const cameraVM = pair.before.cameraViewMode || 'portrait';
              const isLetterbox = (cameraVM === 'landscape' && beforeOrientation === 'portrait');
              const isLandscape = beforeOrientation === 'landscape' || cameraVM === 'landscape';

              const pushItem = (name, tag) => {
                if (!dir || !name) return;
                combinedItems.push({
                  uri: `${dir}${name}`,
                  filename: `${pair.before.name}_original-${tag}.jpg`,
                  name: pair.before.name,
                  room: pair.room,
                  mode: PHOTO_MODES.COMBINED,
                  format: `original-${tag}`
                });
                foundCount++;
              };

              if (isLetterbox) {
                // Upload both if both exist
                if (stackName) pushItem(stackName, 'stack');
                if (sideName) pushItem(sideName, 'side');
              } else if (isLandscape) {
                if (stackName) pushItem(stackName, 'stack');
                else if (sideName) pushItem(sideName, 'side');
              } else {
                if (sideName) pushItem(sideName, 'side');
                else if (stackName) pushItem(stackName, 'stack');
              }
            }

            if (foundCount === 0) {
              Alert.alert(t('gallery.nothingToUploadTitle'), t('gallery.noOriginalCombinedFound'));
              return;
            }
          } catch (e) {
            Alert.alert(t('common.error'), t('gallery.originalCombinedSearchError'));
            return;
          }
        } else {
          // Advanced formats selected: render dynamic combined images
          const selectedTemplateKeys = Object.keys(TEMPLATE_CONFIGS).filter(k => selectedFormats[k]);

          const getAllowedTemplatesForPair = (pair) => {
            const before = pair.before;
            const beforeOrientation = before.orientation || 'portrait';
            const cameraVM = before.cameraViewMode || 'portrait';
            const isLetterbox = (cameraVM === 'landscape' && beforeOrientation === 'portrait');
            const isLandscape = beforeOrientation === 'landscape' || cameraVM === 'landscape';

            return selectedTemplateKeys.filter((key) => {
              const layout = TEMPLATE_CONFIGS[key]?.layout;
              if (isLetterbox) return true; // both stack and side-by-side
              if (isLandscape) return layout === 'stack';
              return layout === 'sidebyside';
            });
          };

          const totalRenders = pairs.reduce((sum, pair) => sum + getAllowedTemplatesForPair(pair).length, 0);

          if (totalRenders === 0) {
            Alert.alert(t('gallery.nothingToUploadTitle'), t('gallery.noPairsForCombined'));
            return;
          }

          setOptionsVisible(false);
          setRenderingCombined(true);
          setRenderingProgress({ current: 0, total: totalRenders });

          // Render each combination
          let renderCount = 0;
          for (const pair of pairs) {
            const allowedKeys = getAllowedTemplatesForPair(pair);
            for (const templateKey of allowedKeys) {
              const cfg = TEMPLATE_CONFIGS[templateKey];

              // Set the current render
              setCurrentRenderPair(pair);
              setCurrentRenderTemplate({ key: templateKey, config: cfg });

              // Wait for render
              await new Promise(resolve => setTimeout(resolve, 800));

              // Capture the view
              try {
                const uri = await captureRef(renderViewRef, {
                  format: 'jpg',
                  quality: 0.9
                });
                if (uri) {
                  combinedItems.push({
                    uri: uri,
                    filename: `${pair.before.name}_${templateKey}.jpg`,
                    name: pair.before.name,
                    room: pair.room,
                    mode: PHOTO_MODES.COMBINED,
                    format: templateKey
                  });
                }
              } catch (error) {
              }

              renderCount++;
              setRenderingProgress({ current: renderCount, total: totalRenders });
            }
          }

          setRenderingCombined(false);
          setCurrentRenderPair(null);
          setCurrentRenderTemplate(null);
        }
      }

      // Apply folder switches: when folder structure ON, allow per-type filtering
      // When folder structure OFF, we still upload all types but the server will place them in the project root
      // If folder structure is on but a folder is disabled, upload those into the main folder by marking flat
      const promoteToFlat = (arr) => arr.map(p => ({ ...p, flat: true }));

      const filteredBefore = useFolderStructure
        ? (enabledFolders.before ? items.filter(i => i.mode === PHOTO_MODES.BEFORE) : promoteToFlat(items.filter(i => i.mode === PHOTO_MODES.BEFORE)))
        : items.filter(i => i.mode === PHOTO_MODES.BEFORE);

      const filteredAfter = useFolderStructure
        ? (enabledFolders.after ? items.filter(i => i.mode === PHOTO_MODES.AFTER) : promoteToFlat(items.filter(i => i.mode === PHOTO_MODES.AFTER)))
        : items.filter(i => i.mode === PHOTO_MODES.AFTER);

      const filteredCombined = useFolderStructure
        ? (enabledFolders.combined ? combinedItems : promoteToFlat(combinedItems))
        : combinedItems;
      const allItems = [...filteredBefore, ...filteredAfter, ...filteredCombined];

      if (allItems.length === 0) {
        Alert.alert(t('gallery.nothingToUploadTitle'), t('gallery.noTypesWithPhotos'));
        return;
      }

      // Filter out photos that have already been uploaded
      const newItems = await filterNewPhotos(allItems, albumName);
      
      if (newItems.length === 0) {
        Alert.alert(
          t('gallery.noNewPhotosTitle'), 
          t('gallery.noNewPhotosMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { 
              text: t('gallery.uploadAgain'), 
              style: 'default',
              onPress: () => {
                // Force re-upload of all photos by using allItems instead of filtered newItems
                proceedWithUpload(allItems, albumName, uploadConfig);
              }
            }
          ]
        );
        return;
      }

      if (newItems.length < allItems.length) {
        const skippedCount = allItems.length - newItems.length;
        Alert.alert(
          t('gallery.somePhotosUploadedTitle'),
          t('gallery.somePhotosUploadedMessage', { skippedCount, newCount: newItems.length }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { 
              text: t('common.confirm'), 
              style: 'default',
              onPress: () => proceedWithUpload(newItems, albumName, uploadConfig) 
            },
            { 
              text: t('gallery.uploadAll'), 
              style: 'default',
              onPress: () => {
                // Force re-upload of all photos including already uploaded ones
                proceedWithUpload(allItems, albumName, uploadConfig);
              }
            }
          ]
        );
        return;
      }

      // All photos are new, proceed with upload
      await proceedWithUpload(newItems, albumName, uploadConfig);
    } catch (error) {
      Alert.alert('Upload Failed', error.message || 'An error occurred while preparing upload');
    }
  };

  const proceedWithUpload = async (items, albumName, configOverride = null) => {
    try {
      // Close upload options and any upgrade overlay before starting background upload
      setOptionsVisible(false);
      setUpgradeVisible(false);

      const uploadPromises = [];

      // Upload to Google Drive if selected
      if (uploadDestinations.google) {
        // Use provided config or fallback to location config (for backward compatibility)
        const config = configOverride || getLocationConfig(location);

        // Check if Google Drive is configured
        if (!config || !config.folderId || (config.useDirectDrive && !config.sessionId)) {
          Alert.alert(
            t('gallery.setupRequiredTitle'),
            t('gallery.driveConfigMissing')
          );
          return;
        }

        // Start background upload to Google Drive
        const googleUploadId = startBackgroundUpload({
          items,
          config,
          albumName,
          location,
          userName,
          flat: !useFolderStructure,
          uploadType: 'standard',
          useDirectDrive: config?.useDirectDrive || false, // Pass the flag for proxy server upload
          sessionId: config?.sessionId || null, // Pass the proxy session ID
        });
        uploadPromises.push({ type: 'google', uploadId: googleUploadId });
      }

      // Upload to Dropbox if selected
      if (uploadDestinations.dropbox) {
        // Load Dropbox tokens before checking authentication
        await dropboxAuthService.loadStoredTokens();
        
        // Check if Dropbox is authenticated
        if (!dropboxAuthService.isAuthenticated()) {
          Alert.alert(
            t('gallery.dropboxNotConnected'),
            t('gallery.dropboxNotConnectedMessage')
          );
          return;
        }

        // Upload to Dropbox directly (without background service for now)
        // We'll do this in parallel with Google Drive upload
        const dropboxUploadPromise = uploadPhotoBatchToDropbox(items, {
          albumName,
          location,
          cleanerName: userName,
          flat: !useFolderStructure,
          batchSize: items.length,
          onProgress: (current, total) => {
            // Update progress for Dropbox upload
            console.log(`[DROPBOX] Upload progress: ${current}/${total}`);
          },
        });

        uploadPromises.push({ type: 'dropbox', promise: dropboxUploadPromise });
      }

      // Show upload modal immediately (if Google Drive upload is in progress)
      if (uploadDestinations.google) {
        setShowUploadDetails(true);
      }

      // Wait for all uploads to complete
      if (uploadDestinations.dropbox) {
        try {
          const dropboxResult = await uploadPromises.find(p => p.type === 'dropbox')?.promise;
          if (dropboxResult) {
            console.log('[DROPBOX] Upload completed:', dropboxResult);
            if (dropboxResult.failed && dropboxResult.failed.length > 0) {
              Alert.alert(
                t('gallery.dropboxUploadPartial'),
                t('gallery.dropboxUploadPartialMessage', {
                  success: dropboxResult.successCount,
                  failed: dropboxResult.failureCount,
                })
              );
            }
          }
        } catch (error) {
          console.error('[DROPBOX] Upload error:', error);
          Alert.alert(
            t('gallery.dropboxUploadError'),
            error.message || t('gallery.dropboxUploadErrorMessage')
          );
        }
      }
    } catch (error) {
      Alert.alert('Upload Failed', error.message || 'An error occurred while preparing upload');
    }
  };

  const handleDeleteAllConfirmed = async () => {
    try {
      if (activeProjectId) {
        // Delete only the active project and its photos
        await deleteProject(activeProjectId, { deleteFromStorage });
        setActiveProject(null);
      } else {
        // No active project: fall back to deleting everything
        if (deleteFromStorage) {
          // Delete known photos and also purge any base/combined images saved by editor/capture
          await deletePhotosFromDevice(photos);
          await purgeAllDevicePhotos();
        }
        await deleteAllPhotos();
      }
    } finally {
      setConfirmDeleteVisible(false);
    }
  };

  // Group photos by room and create photo sets
  // Combined photos are created dynamically, not saved
  const getPhotoSets = (roomId) => {
    const beforePhotos = getBeforePhotos(roomId);
    const afterPhotos = getAfterPhotos(roomId);

    // Create sets based on before photos first
    const sets = {};

    beforePhotos.forEach(photo => {
      sets[photo.id] = {
        name: photo.name,
        before: photo,
        after: null,
        combined: null // Will be rendered dynamically if both before and after exist
      };
    });

    // Match after photos to before photos using beforePhotoId
    afterPhotos.forEach(photo => {
      if (photo.beforePhotoId && sets[photo.beforePhotoId]) {
        sets[photo.beforePhotoId].after = photo;
      }
    });

    return Object.values(sets);
  };

  const renderDummyCard = (label) => (
    <View style={styles.dummyCard}>
      <Text style={styles.dummyCardText}>{label}</Text>
    </View>
  );

  const renderPhotoCard = (photo, borderColor, photoType, photoSet, isLast = false) => {
    // For combined thumbnail, show split preview based on phone orientation OR camera view mode - tap to retake after
    if (photoType === 'combined' && !photo && photoSet.before && photoSet.after) {
      const phoneOrientation = photoSet.before.orientation || 'portrait';
      const cameraViewMode = photoSet.before.cameraViewMode || 'portrait';
      
      const isLetterbox = photoSet.before.templateType === 'letterbox' || (phoneOrientation === 'portrait' && cameraViewMode === 'landscape');
      const isTrueLandscape = phoneOrientation === 'landscape';
      
      // For thumbnails, both should be stacked to fit the square aspect ratio.
      const useStackedLayout = isTrueLandscape || isLetterbox;

      return (
        <TouchableOpacity
          key={photoType}
          style={[styles.photoCard, { borderColor }, isLast && styles.photoCardLast]}
          onPress={() => {
            if (longPressTriggered.current) return;
            navigation.navigate('PhotoEditor', {
              beforePhoto: photoSet.before,
              afterPhoto: photoSet.after
            });
          }}
          onLongPress={() => handleLongPressStart(null, photoSet)}
        >
          <View style={[styles.combinedThumbnail, useStackedLayout ? styles.stackedThumbnail : styles.sideBySideThumbnail]}>
            <Image source={{ uri: photoSet.before.uri }} style={styles.halfImage} resizeMode="cover" />
            <Image source={{ uri: photoSet.after.uri }} style={styles.halfImage} resizeMode="cover" />
          </View>
          
          {/* Mode label */}
          <View style={[styles.modeLabel, { backgroundColor: borderColor }]}>
            <Text style={styles.modeLabelText}>
              {t('camera.combined', { lng: labelLanguage })}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (!photo) return <View key={photoType} style={[styles.photoCard, isLast && styles.photoCardLast]}>{renderDummyCard('—')}</View>;

    const handlePress = () => {
      if (longPressTriggered.current) return;
      
      if (photoType === 'combined') {
        // Combined column - navigate to PhotoEditor to choose format
        navigation.navigate('PhotoEditor', {
          beforePhoto: photoSet.before,
          afterPhoto: photoSet.after
        });
      } else {
        // Before or After column - navigate to PhotoDetailScreen with share button
        navigation.navigate('PhotoDetail', { photo });
      }
    };

    return (
      <TouchableOpacity
        key={photoType}
        style={[styles.photoCard, { borderColor }, isLast && styles.photoCardLast]}
        onPress={handlePress}
        onLongPress={() => handleLongPressStart(photo, photoType === 'combined' ? photoSet : null)}
      >
        <CroppedThumbnail
          imageUri={photo.uri}
          aspectRatio={photo.aspectRatio || photoSet.before?.aspectRatio || '4:3'}
          orientation={photo.orientation || photoSet.before?.orientation || 'portrait'}
          size={COLUMN_WIDTH}
        />
        
        {/* Mode label */}
        <View style={[styles.modeLabel, { backgroundColor: borderColor }]}>
          <Text style={styles.modeLabelText}>
            {photoType === 'before'
              ? t('camera.before', { lng: labelLanguage })
              : photoType === 'after'
              ? t('camera.after', { lng: labelLanguage })
              : t('camera.combined', { lng: labelLanguage })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPhotoSet = (set, index, roomId) => {
    return (
      <View key={index} style={styles.photoSetRow}>
        <View style={styles.threeColumnRow}>
          {renderPhotoCard(set.before, '#4CAF50', 'before', set, false)}
          {renderPhotoCard(set.after, '#2196F3', 'after', set, false)}
          {renderPhotoCard(set.combined, '#FFC107', 'combined', set, true)}
        </View>
      </View>
    );
  };

  const renderRoomSection = (room) => {
    const sets = getPhotoSets(room.id);
    if (sets.length === 0) return null;

    return (
      <View key={room.id} style={styles.roomSection}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomIcon}>{room.icon}</Text>
          <Text style={styles.roomName}>
            {t(`rooms.${room.id}`, { lng: sectionLanguage, defaultValue: room.name })}
          </Text>
        </View>
        {sets.map((set, index) => renderPhotoSet(set, index, room.id))}
      </View>
    );
  };

  // Open Share Project modal only when this screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (route?.params?.openManage) {
        const timer = setTimeout(() => {
          setManageVisible(true);
          navigation.setParams({ openManage: undefined });
        }, 120);
        return () => clearTimeout(timer);
      }
      return undefined;
    }, [route?.params?.openManage])
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Background Upload Status - Removed old indicator */}

      {/* Swipe down indicator */}
      <View style={styles.swipeIndicator}>
        <View style={styles.swipeHandle} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('gallery.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Active project name under the title */}
      <View style={styles.projectNameContainer}>
        <Text style={styles.projectNameText}>
          {(projects?.find?.(p => p.id === activeProjectId)?.name) || t('gallery.noProjectSelected')}
        </Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => navigation.navigate('PhotoSelection')}
        >
          <Text style={styles.selectButtonText}>{t('gallery.selectPhotos')}</Text>
        </TouchableOpacity>
        <UploadIndicatorLine 
          uploadStatus={uploadStatus}
          onPress={() => setShowUploadDetails(true)}
        />
      </View>

      <View style={styles.columnHeaders}>
        <Text style={[styles.columnHeader, { color: '#4CAF50' }]}>
          {t('camera.before', { lng: labelLanguage })}
        </Text>
        <Text style={[styles.columnHeader, { color: '#2196F3' }]}>
          {t('camera.after', { lng: labelLanguage })}
        </Text>
        <Text style={[styles.columnHeader, { color: '#FFC107', marginRight: 0 }]}>
          {t('camera.combined', { lng: labelLanguage })}
        </Text>
      </View>

      {photos.length === 0 || !activeProjectId ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {!activeProjectId ? t('gallery.noProjectSelected') : t('gallery.noPhotosYet')}
          </Text>
          <Text style={styles.emptyStateSubtext}>
            {!activeProjectId 
              ? t('gallery.selectProjectToView')
              : t('gallery.takePhotosToStart')
            }
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {ROOMS.map(room => renderRoomSection(room))}
        </ScrollView>
      )}

      {/* Hidden modal for capturing photos with labels */}
      {capturingPhoto && (
        <Modal
          visible={true}
          transparent={true}
          animationType="none"
          onRequestClose={() => {}}
        >
          <View style={{ 
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'transparent'
          }}>
            <View
              ref={labelCaptureRef}
              collapsable={false}
              style={{
                width: Math.min(capturingPhoto.width, width),
                height: Math.min(capturingPhoto.height, width * (capturingPhoto.height / capturingPhoto.width)),
                backgroundColor: 'white',
                overflow: 'hidden',
                position: 'absolute',
                left: width + 1000, // Off-screen but still rendered
                top: 0,
                flexDirection: capturingPhoto.photo.isCombined && capturingPhoto.photo.isLetterbox ? 'column' : 
                              capturingPhoto.photo.isCombined ? 'row' : undefined
              }}
            >
              {capturingPhoto.photo.isCombined && capturingPhoto.photo.beforePhoto && capturingPhoto.photo.afterPhoto ? (
                // Combined photo - render both before and after with labels
                <>
                  <View style={{ flex: 1 }}>
                    <Image
                      source={{ uri: capturingPhoto.photo.beforePhoto.uri }}
                      style={{
                        width: '100%',
                        height: '100%'
                      }}
                      resizeMode="cover"
                    />
                    {showLabels && (
                      <PhotoLabel
                        label="common.before"
                        position={beforeLabelPosition || 'top-left'}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Image
                      source={{ uri: capturingPhoto.photo.afterPhoto.uri }}
                      style={{
                        width: '100%',
                        height: '100%'
                      }}
                      resizeMode="cover"
                    />
                    {showLabels && (
                      <PhotoLabel
                        label="common.after"
                        position={afterLabelPosition || 'top-right'}
                      />
                    )}
                  </View>
                </>
              ) : (
                // Single photo
                <>
                  <Image
                    source={{ uri: capturingPhoto.photo.uri }}
                    style={{
                      width: '100%',
                      height: '100%'
                    }}
                    resizeMode="cover"
                  />
                  {showLabels && capturingPhoto.photo.mode && (
                    <PhotoLabel
                      label={capturingPhoto.photo.mode === PHOTO_MODES.BEFORE ? 'common.before' : 'common.after'}
                      position={capturingPhoto.labelPosition}
                    />
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Share Project button at bottom - only show if photos exist and project is selected */}
      {photos.length > 0 && activeProjectId && (
        <TouchableOpacity
          style={[styles.deleteAllButtonBottom, { backgroundColor: '#F2C31B' }]}
          onPress={() => setManageVisible(true)}
        >
          <Text style={[styles.deleteAllButtonBottomText, { color: '#000' }]}>
            📤 {t('gallery.shareProject')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Full-screen photo view - single photo */}
      {fullScreenPhoto && (
        <TouchableWithoutFeedback onPress={handleLongPressEnd}>
          <View style={styles.fullScreenPhotoContainer}>
            <Image
              source={{ uri: fullScreenPhoto.uri }}
              style={styles.fullScreenPhoto}
              resizeMode="contain"
            />
            {/* Show label for individual before/after photos if showLabels is true */}
            {showLabels && fullScreenPhoto.mode && (
              <PhotoLabel
                label={
                  fullScreenPhoto.mode === 'before'
                    ? 'common.before'
                    : fullScreenPhoto.mode === 'after'
                    ? 'common.after'
                    : fullScreenPhoto.mode.toUpperCase()
                }
              />
            )}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => shareIndividualPhoto(fullScreenPhoto)}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.shareButtonText}>{t('gallery.share')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Full-screen combined photo view - 1:1 square with before/after */}
      {fullScreenPhotoSet && (
        <TouchableWithoutFeedback onPress={handleLongPressEnd}>
          <View style={styles.fullScreenPhotoContainer}>
            <View 
              ref={combinedCaptureRef}
              collapsable={false}
              style={[
              styles.fullScreenCombinedPreview,
              (() => {
                const phoneOrientation = fullScreenPhotoSet.before.orientation || 'portrait';
                const cameraViewMode = fullScreenPhotoSet.before.cameraViewMode || 'portrait';
                const isLetterbox = fullScreenPhotoSet.before.templateType === 'letterbox' || (phoneOrientation === 'portrait' && cameraViewMode === 'landscape');
                
                // In the enlarged view, only letterbox photos should be stacked.
                // True landscape and portrait photos are better side-by-side.
                return isLetterbox ? styles.fullScreenStacked : styles.fullScreenSideBySide;
              })()
            ]}>
              <View style={styles.fullScreenHalf}>
                <Image
                  source={{ uri: fullScreenPhotoSet.before.uri }}
                  style={styles.fullScreenHalfImage}
                  resizeMode="cover"
                  onError={(error) => {
                  }}
                  onLoad={() => {
                  }}
                />
                {/* Show BEFORE label only if showLabels is true */}
                {showLabels && (
                  <PhotoLabel 
                    label="common.before" 
                    position={beforeLabelPosition || 'top-left'}
                  />
                )}
              </View>
              <View style={styles.fullScreenHalf}>
                <Image
                  source={{ uri: fullScreenPhotoSet.after.uri }}
                  style={styles.fullScreenHalfImage}
                  resizeMode="cover"
                  onError={(error) => {
                  }}
                  onLoad={() => {
                  }}
                />
                {/* Show AFTER label only if showLabels is true */}
                {showLabels && (
                  <PhotoLabel 
                    label="common.after" 
                    position={afterLabelPosition || 'top-right'}
                  />
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => shareCombinedPhoto(fullScreenPhotoSet)}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.shareButtonText}>{t('gallery.share')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Rendering Combined Photos Modal */}
      <Modal
        visible={renderingCombined}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.uploadModalContainer}>
          <View style={styles.uploadModalContent}>
            <Text style={styles.uploadModalTitle}>{t('gallery.generatingCombined')}</Text>
            <Text style={styles.uploadModalProgress}>
              {renderingProgress.current} / {renderingProgress.total}
            </Text>
            <View style={styles.uploadProgressBar}>
              <View
                style={[
                  styles.uploadProgressFill,
                  { width: `${(renderingProgress.current / renderingProgress.total) * 100}%` }
                ]}
              />
            </View>
            {currentRenderPair && currentRenderTemplate && (
              <View
                ref={renderViewRef}
                style={[
                  styles.renderView,
                  {
                    width: currentRenderTemplate.config.width / 2,
                    height: currentRenderTemplate.config.height / 2
                  }
                ]}
              >
                <View style={currentRenderTemplate.config.layout === 'stack' ? styles.renderCol : styles.renderRow}>
                  <View style={styles.renderHalf}>
                    <Image
                      source={{ uri: currentRenderPair.before.uri }}
                      style={styles.renderImage}
                      resizeMode="cover"
                    />
                    {showLabels && (
                      <PhotoLabel label="common.before" />
                    )}
                  </View>
                  <View style={styles.renderHalf}>
                    <Image
                      source={{ uri: currentRenderPair.after.uri }}
                      style={styles.renderImage}
                      resizeMode="cover"
                    />
                    {showLabels && (
                      <PhotoLabel label="common.after" />
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Upgrade overlay is rendered inside the Upload Options modal for correct stacking */}

      {/* Confirm Save Modal removed - Save button was removed from Share Project modal */}

      {/* Upgrade Modal */}
      <Modal
        visible={upgradeVisible && !optionsVisible}
        transparent={true}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setUpgradeVisible(false)}
      >
        <View style={styles.optionsModalOverlay}>
          <View style={styles.optionsModalContent}>
            <Text style={styles.optionsTitle}>{t('gallery.upgradeRequired')}</Text>
            <Text style={[styles.optionsSectionLabel, { marginBottom: 16 }]}>{t('gallery.unlockFormats')}</Text>
            <View style={[styles.optionsActionsRow, { marginTop: 0 }]}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary, styles.actionHalf]}
                onPress={() => setUpgradeVisible(false)}
              >
                <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>{t('gallery.upgrade')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionCancel, styles.actionHalf]}
                onPress={() => setUpgradeVisible(false)}
              >
                <Text style={styles.actionBtnText}>{t('gallery.notNow')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Progress Modal */}
      <Modal
        visible={uploading}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.uploadModalContainer}>
          <View style={styles.uploadModalContent}>
            <ActivityIndicator size="large" />
            <Text style={styles.uploadModalTitle}>{t('gallery.uploadingPhotos')}</Text>
            <Text style={styles.uploadModalProgress}>
              {uploadProgress.current} / {uploadProgress.total}
            </Text>
            <View style={styles.uploadProgressBar}>
              <View
                style={[
                  styles.uploadProgressFill,
                  { width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }
                ]}
              />
            </View>
            <View style={[styles.optionsActionsRow, { marginTop: 16, width: '100%' }]}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionCancel, { paddingVertical: 16, width: '100%' }]}
                onPress={() => {
                  try {
                    // Abort in-flight requests
                    for (const c of uploadControllersRef.current) {
                      try { c.abort(); } catch {}
                    }
                    // Abort scheduling of further batches
                    try { masterAbortRef.current?.abort(); } catch {}
                  } finally {
                    uploadControllersRef.current = [];
                    masterAbortRef.current = null;
                    setUploading(false);
                  }
                }}
              >
                <Text style={[styles.actionBtnText, { textTransform: 'none' }]}>{t('gallery.cancelUpload')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Options Modal */}
      <Modal
        visible={optionsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOptionsVisible(false)}
      >
        <View style={styles.optionsModalOverlay}>
          <View style={styles.optionsModalContent}>
            <Text style={styles.optionsTitle}>{t('gallery.whatToUpload')}</Text>

            {/* Upload Destination Selection */}
            <Text style={styles.optionsSectionLabel}>{t('gallery.uploadDestination')}</Text>
            
            {/* Google Drive Checkbox */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => {
                  if (isAuthenticated) {
                    setUploadDestinations(prev => ({ ...prev, google: !prev.google }));
                  } else {
                    Alert.alert(
                      t('gallery.googleNotConnected'),
                      t('gallery.googleNotConnectedMessage')
                    );
                  }
                }}
                disabled={!isAuthenticated}
              >
                <View style={[
                  styles.checkbox,
                  uploadDestinations.google && styles.checkboxChecked,
                  !isAuthenticated && styles.checkboxDisabled
                ]}>
                  {uploadDestinations.google && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <View style={styles.checkboxLabelContainer}>
                  <Text style={[
                    styles.checkboxLabelText,
                    !isAuthenticated && styles.checkboxLabelDisabled
                  ]}>
                    {t('gallery.googleDrive')}
                  </Text>
                  {isAuthenticated && (
                    <View style={styles.connectedIndicatorInline}>
                      <Text style={styles.connectedCheckmarkInline}>✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Dropbox Checkbox */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={async () => {
                  await dropboxAuthService.loadStoredTokens();
                  const connected = dropboxAuthService.isAuthenticated();
                  setIsDropboxConnected(connected);
                  if (connected) {
                    setUploadDestinations(prev => ({ ...prev, dropbox: !prev.dropbox }));
                  } else {
                    Alert.alert(
                      t('gallery.dropboxNotConnected'),
                      t('gallery.dropboxNotConnectedMessage')
                    );
                  }
                }}
                disabled={!isDropboxConnected}
              >
                <View style={[
                  styles.checkbox,
                  uploadDestinations.dropbox && styles.checkboxCheckedDropbox,
                  !isDropboxConnected && styles.checkboxDisabled
                ]}>
                  {uploadDestinations.dropbox && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <View style={styles.checkboxLabelContainer}>
                  <Text style={[
                    styles.checkboxLabelText,
                    !isDropboxConnected && styles.checkboxLabelDisabled
                  ]}>
                    {t('gallery.dropbox')}
                  </Text>
                  {isDropboxConnected && (
                    <View style={styles.connectedIndicatorInlineDropbox}>
                      <Text style={styles.connectedCheckmarkInline}>✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Warning if no destination selected */}
            {!uploadDestinations.google && !uploadDestinations.dropbox && (
              <Text style={styles.warningText}>{t('gallery.selectAtLeastOneDestination')}</Text>
            )}

            <Text style={[styles.optionsSectionLabel, { marginTop: 16 }]}>{t('gallery.photoTypes')}</Text>
            <View style={styles.optionsChipsRow}>
              <TouchableOpacity
                style={[styles.chip, selectedTypes.before && styles.chipActive]}
                onPress={() => setSelectedTypes(prev => ({ ...prev, before: !prev.before }))}
              >
                <Text style={[styles.chipText, selectedTypes.before && styles.chipTextActive]}>{t('camera.before')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, selectedTypes.after && styles.chipActive]}
                onPress={() => setSelectedTypes(prev => ({ ...prev, after: !prev.after }))}
              >
                <Text style={[styles.chipText, selectedTypes.after && styles.chipTextActive]}>{t('camera.after')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, selectedTypes.combined && styles.chipActive]}
                onPress={() => setSelectedTypes(prev => ({ ...prev, combined: !prev.combined }))}
              >
                <Text style={[styles.chipText, selectedTypes.combined && styles.chipTextActive]}>{t('camera.combined')}</Text>
              </TouchableOpacity>
            </View>

            {selectedTypes.combined && (
              <>
                {/* Advanced toggle */}
                {!showAdvancedFormats && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionCancel, { marginTop: 12 }]}
                    onPress={() => setShowAdvancedFormats(true)}
                  >
                    <Text style={styles.actionBtnText}>{t('gallery.showAdvancedFormats')}</Text>
                  </TouchableOpacity>
                )}

                {showAdvancedFormats && (
                  <>
                    <Text style={[styles.optionsSectionLabel, { marginTop: 16 }]}>{t('gallery.stackedFormats')}</Text>
                    <View style={styles.optionsChipsRow}>
                      {Object.entries(TEMPLATE_CONFIGS)
                        .filter(([k, cfg]) => cfg.layout === 'stack')
                        .map(([key, cfg]) => (
                          <TouchableOpacity
                            key={key}
                            style={[styles.chip, selectedFormats[key] && styles.chipActive]}
                            onPress={() => handleFormatToggle(key)}
                          >
                            <Text style={[styles.chipText, selectedFormats[key] && styles.chipTextActive]}>{cfg.name}</Text>
                          </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={[styles.optionsSectionLabel, { marginTop: 12 }]}>{t('gallery.sideBySideFormats')}</Text>
                    <View style={styles.optionsChipsRow}>
                      {Object.entries(TEMPLATE_CONFIGS)
                        .filter(([k, cfg]) => cfg.layout === 'sidebyside')
                        .map(([key, cfg]) => (
                          <TouchableOpacity
                            key={key}
                            style={[styles.chip, selectedFormats[key] && styles.chipActive]}
                            onPress={() => handleFormatToggle(key)}
                          >
                            <Text style={[styles.chipText, selectedFormats[key] && styles.chipTextActive]}>{cfg.name}</Text>
                          </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionCancel, { marginTop: 12 }]}
                      onPress={() => setShowAdvancedFormats(false)}
                    >
                      <Text style={styles.actionBtnText}>{t('gallery.hideAdvancedFormats')}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            <View style={styles.optionsActionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionCancel, styles.actionFlex]} onPress={() => setOptionsVisible(false)}>
                <Text style={styles.actionBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary, styles.actionFlex]} onPress={startUploadWithOptions}>
                <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>{t('gallery.startUpload')}</Text>
              </TouchableOpacity>
            </View>
            {/* Inline upgrade overlay (absolute) to ensure it's above any content */}
            {upgradeVisible && (
              <View style={styles.inlineOverlay} pointerEvents="auto">
                <View style={styles.inlineOverlayCard}>
                  <Text style={styles.optionsTitle}>Upgrade required</Text>
                  <Text style={[styles.optionsSectionLabel, { marginBottom: 16 }]}>Unlock more formats with Business</Text>
                  <View style={[styles.optionsActionsRow, { marginTop: 0 }]}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionPrimary, styles.actionHalf]}
                      onPress={() => {
                        setUpgradeVisible(false);
                        setOptionsVisible(false);
                        navigation.navigate('Settings');
                      }}
                    >
                      <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>{t('gallery.upgrade')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionCancel, styles.actionHalf]}
                      onPress={() => setUpgradeVisible(false)}
                    >
                      <Text style={styles.actionBtnText}>{t('gallery.notNow')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Share Project Modal */}
      <Modal
        visible={manageVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setManageVisible(false)}
      >
        <View style={styles.optionsModalOverlay}>
          <View style={styles.optionsModalContent}>
            <Text style={styles.optionsTitle}>{t('gallery.shareProject')}</Text>

            <View>
              <View style={{ marginTop: 4 }} />

              <View style={styles.actionsList}>
                {/* Upload All (primary) */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide, styles.actionPrimaryFlat]}
                  onPress={() => {
                    setManageVisible(false);
                    handleUploadPhotos();
                  }}
                >
                  <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>
                    📤 {t('gallery.uploadAll')}
                  </Text>
                </TouchableOpacity>

                {/* Share All (light blue) */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide, styles.actionInfo]}
                  onPress={() => {
                    setManageVisible(false);
                    handleShareProject();
                  }}
                >
                  <Text style={[styles.actionBtnText, styles.actionInfoText]}>
                    🔗 {t('gallery.shareAll')}
                  </Text>
                </TouchableOpacity>

                {/* Delete All (red) */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide, styles.actionDestructive]}
                  onPress={() => {
                    setManageVisible(false);
                    // Delete immediately without confirmation
                    handleDeleteAllConfirmed();
                  }}
                >
                  <Text style={[styles.actionBtnText, styles.actionDestructiveText]}>
                    🗑️ {t('gallery.deleteAll')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Select Photos - separated with gap */}
              <View style={[styles.actionsList, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide, { backgroundColor: '#22A45D' }]}
                  onPress={() => {
                    setManageVisible(false);
                    navigation.navigate('PhotoSelection');
                  }}
                >
                  <Text style={[styles.actionBtnText, { color: 'white' }]}>
                    ☑️ {t('gallery.selectPhotos')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.optionsActionsRowCenter}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionWide, styles.actionCancel]} onPress={() => setManageVisible(false)}>
                  <Text style={styles.actionBtnText}>{t('common.close')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share Loading Modal */}
      <Modal
        visible={sharing}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}} // Prevent closing during sharing
      >
        <View style={styles.modalOverlay}>
          <View style={styles.loadingModal}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>
              {showLabels ? t('gallery.preparingPhotosWithLabels') : t('gallery.preparingPhotosCopying')}
            </Text>
            <Text style={styles.loadingSubtext}>{t('gallery.mayTakeFewSeconds')}</Text>
          </View>
        </View>
      </Modal>

      {/* Share Project Modal */}
      <Modal
        visible={shareOptionsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShareOptionsVisible(false)}
      >
        <View style={styles.optionsModalOverlay}>
          <View style={styles.optionsModalContent}>
            <Text style={styles.optionsTitle}>{t('gallery.whatToShare')}</Text>

            <Text style={styles.optionsSectionLabel}>{t('gallery.photoTypes')}</Text>
            <View style={styles.optionsChipsRow}>
              <TouchableOpacity
                style={[styles.chip, selectedShareTypes.before && styles.chipActive]}
                onPress={() => setSelectedShareTypes(prev => ({ ...prev, before: !prev.before }))}
              >
                <Text style={[styles.chipText, selectedShareTypes.before && styles.chipTextActive]}>{t('camera.before')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, selectedShareTypes.after && styles.chipActive]}
                onPress={() => setSelectedShareTypes(prev => ({ ...prev, after: !prev.after }))}
              >
                <Text style={[styles.chipText, selectedShareTypes.after && styles.chipTextActive]}>{t('camera.after')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, selectedShareTypes.combined && styles.chipActive]}
                onPress={() => setSelectedShareTypes(prev => ({ ...prev, combined: !prev.combined }))}
              >
                <Text style={[styles.chipText, selectedShareTypes.combined && styles.chipTextActive]}>{t('camera.combined')}</Text>
              </TouchableOpacity>
            </View>

            {/* Share as Archive Checkbox */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setShareAsArchive(!shareAsArchive)}
              >
                <View style={[
                  styles.checkbox,
                  shareAsArchive && styles.checkboxChecked
                ]}>
                  {shareAsArchive && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <View style={styles.checkboxLabelContainer}>
                  <Text style={styles.checkboxLabelText}>
                    {t('gallery.shareAsArchive')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Share to Same App Checkbox - only show if not sharing as archive */}
            {!shareAsArchive && (
              <View style={styles.checkboxRow}>
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setShareToSameApp(!shareToSameApp)}
                >
                  <View style={[
                    styles.checkbox,
                    shareToSameApp && styles.checkboxChecked
                  ]}>
                    {shareToSameApp && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <View style={styles.checkboxLabelContainer}>
                    <Text style={styles.checkboxLabelText}>
                      {t('gallery.shareToSameApp')}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.optionsActionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionCancel, styles.actionFlex]} onPress={() => setShareOptionsVisible(false)}>
                <Text style={styles.actionBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary, styles.actionFlex]} onPress={() => {
                  setShareOptionsVisible(false);
                  startSharingWithOptions();
              }}>
                <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>{t('gallery.prepareToShare')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload Completion Modal */}
      <UploadCompletionModal
        visible={showCompletionModal}
        completedUploads={uploadStatus.completedUploads}
        onClose={() => setShowCompletionModal(false)}
        onClearCompleted={clearCompletedUploads}
        onDeleteProject={handleDeleteAllConfirmed}
      />

      {/* Upload Details Modal */}
      <UploadDetailsModal
        visible={showUploadDetails}
        uploadStatus={uploadStatus}
        onClose={() => setShowUploadDetails(false)}
        onCancelUpload={cancelUpload}
        onMinimize={() => setShowUploadDetails(false)}
      />

      {/* Confirm Delete Modal removed per user request */}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingTop: 50 // Add padding to avoid status bar overlap
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4
  },
  swipeHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.GRAY,
    borderRadius: 2
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER
  },
  backButton: {
    width: 60
  },
  backButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 24,
    fontWeight: 'bold'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT
  },
  projectNameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: -6,
    marginBottom: 6,
    backgroundColor: 'white'
  },
  projectNameText: {
    fontSize: 12,
    color: COLORS.TEXT,
    opacity: 0.7,
    fontWeight: '500',
    flex: 1
  },
  selectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.PRIMARY,
    marginLeft: 12
  },
  selectButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
  },
  uploadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadButtonText: {
    fontSize: 20
  },
  deleteAllButtonBottom: {
    backgroundColor: '#FF4444',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5
  },
  deleteAllButtonBottomText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.BORDER
  },
  columnHeader: {
    flex: 1,
    marginRight: 8,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.GRAY,
    textAlign: 'center',
    flexShrink: 1,
    numberOfLines: 1
  },
  scrollView: {
    flex: 1
  },
  content: {
    padding: 16
  },
  roomSection: {
    marginBottom: 24
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY
  },
  roomIcon: {
    fontSize: 24,
    marginRight: 8
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT
  },
  photoSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  threeColumnRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap'
  },
  photoCard: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    borderRadius: 8,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: 'white',
    marginRight: 8,
    position: 'relative'
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  combinedThumbnail: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  stackedThumbnail: {
    flexDirection: 'column',
    borderTopWidth: 2,
    borderTopColor: COLORS.PRIMARY,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY
  },
  sideBySideThumbnail: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.PRIMARY,
    borderRightWidth: 2,
    borderRightColor: COLORS.PRIMARY
  },
  halfImage: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY
  },
  modeLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  modeLabelText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold'
  },
  dummyCard: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderStyle: 'dashed',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center'
  },
  dummyCardText: {
    fontSize: 20,
    color: COLORS.GRAY,
    fontWeight: '300'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8,
    textAlign: 'center',
    flexShrink: 1
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: 'center',
    flexShrink: 1,
    flexWrap: 'wrap'
  },
  fullScreenPhotoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  fullScreenPhoto: {
    width: '100%',
    height: '100%'
  },
  fullScreenCombinedPreview: {
    aspectRatio: 1,
    width: '90%',
    maxWidth: 500,
    maxHeight: 500,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: COLORS.PRIMARY
  },
  fullScreenStacked: {
    flexDirection: 'column'
  },
  fullScreenSideBySide: {
    flexDirection: 'row'
  },
  fullScreenHalf: {
    flex: 1
  },
  fullScreenHalfImage: {
    width: '100%',
    height: '100%'
  },
  fullScreenLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  fullScreenLabelText: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: 'bold'
  },
  fullScreenIndividualLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  fullScreenIndividualLabelText: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: 'bold'
  },
  uploadModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 280
  },
  uploadModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginTop: 16,
    marginBottom: 8
  },
  uploadModalProgress: {
    fontSize: 16,
    color: COLORS.GRAY,
    marginBottom: 16
  },
  uploadProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.BORDER,
    borderRadius: 4,
    overflow: 'hidden'
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 4
  },
  renderView: {
    backgroundColor: 'white',
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden'
  },
  renderRow: {
    flexDirection: 'row',
    flex: 1
  },
  renderCol: {
    flexDirection: 'column',
    flex: 1
  },
  renderHalf: {
    flex: 1,
    position: 'relative'
  },
  renderImage: {
    width: '100%',
    height: '100%'
  },
  // Options modal styles
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  optionsModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '86%',
    maxWidth: 380
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    width: '80%',
    maxWidth: 300
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginTop: 16,
    textAlign: 'center'
  },
  loadingSubtext: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 8,
    textAlign: 'center'
  },
  inlineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  inlineOverlayCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '86%',
    maxWidth: 380
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 12,
    textAlign: 'center'
  },
  optionsSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.GRAY,
    marginBottom: 8
  },
  optionsChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F2F2F2',
    marginRight: 8,
    marginBottom: 8
  },
  chipActive: {
    backgroundColor: '#E8F3FF',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY
  },
  chipActiveDropbox: {
    backgroundColor: '#E6F0FF',
    borderWidth: 1,
    borderColor: '#0061FF'
  },
  chipText: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '500'
  },
  chipTextActive: {
    color: COLORS.PRIMARY
  },
  chipTextActiveDropbox: {
    color: '#0061FF',
    fontWeight: '600'
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  connectedIndicator: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0061FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  connectedIndicatorGoogle: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
    justifyContent: 'center'
  },
  connectedCheckmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold'
  },
  connectedAccountText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textAlign: 'center'
  },
  chipDisabled: {
    backgroundColor: COLORS.BORDER,
    borderColor: COLORS.BORDER,
    opacity: 0.5
  },
  chipTextDisabled: {
    color: COLORS.GRAY
  },
  warningText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
    textAlign: 'center'
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  checkboxChecked: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY
  },
  checkboxCheckedDropbox: {
    backgroundColor: '#0061FF',
    borderColor: '#0061FF'
  },
  checkboxDisabled: {
    opacity: 0.5,
    backgroundColor: COLORS.BORDER
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold'
  },
  checkboxLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  checkboxLabelText: {
    fontSize: 16,
    color: COLORS.TEXT,
    fontWeight: '500',
    flex: 1
  },
  checkboxLabelDisabled: {
    color: COLORS.GRAY,
    opacity: 0.5
  },
  connectedIndicatorInline: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  connectedIndicatorInlineDropbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0061FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  connectedCheckmarkInline: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold'
  },
  optionsActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16
  },
  actionFlex: {
    flex: 1
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12
  },
  actionsList: {
    alignItems: 'center'
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkboxRow: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  checkboxLabel: {
    fontSize: 14,
    color: COLORS.TEXT,
    marginRight: 12
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 6
  },
  actionHalf: {
    width: '48%'
  },
  actionWide: {
    width: '92%'
  },
  optionsActionsRowCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8
  },
  actionCancel: {
    backgroundColor: '#F2F2F2',
    marginRight: 8
  },
  actionPrimary: {
    backgroundColor: COLORS.PRIMARY,
    marginLeft: 8
  },
  actionPrimaryFlat: {
    backgroundColor: COLORS.PRIMARY
  },
  actionFull: {
    alignSelf: 'stretch'
  },
  actionGreen: {
    backgroundColor: '#22A45D'
  },
  actionSave: {
    backgroundColor: '#FFE6B3'
  },
  actionSaveText: {
    color: '#8A5A00'
  },
  actionInfo: {
    backgroundColor: '#D6ECFF'
  },
  actionBtnText: {
    color: COLORS.TEXT,
    fontWeight: '600'
  },
  actionPrimaryText: {
    color: 'white'
  },
  actionInfoText: {
    color: '#0077CC'
  },
  actionDestructive: {
    backgroundColor: '#FFE6E6',
    marginTop: 8
  },
  actionDestructiveText: {
    color: '#CC0000',
    fontWeight: '700'
  },
  shareButton: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: COLORS.PRIMARY,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5
  },
  shareButtonText: {
    color: COLORS.TEXT,
    fontSize: 18,
    fontWeight: 'bold'
  }
});
