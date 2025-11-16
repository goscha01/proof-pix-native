import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  Share,
  ActivityIndicator,
  TouchableWithoutFeedback,
  PanResponder,
  Modal
} from 'react-native';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { COLORS, PHOTO_MODES, ROOMS, getLabelPositions } from '../constants/rooms';
import { CroppedThumbnail } from '../components/CroppedThumbnail';
import { createAlbumName } from '../services/uploadService';
import { getLocationConfig } from '../config/locations';
import googleDriveService from '../services/googleDriveService';
import { useAdmin } from '../context/AdminContext';
import { useTranslation } from 'react-i18next';
import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
import { useBackgroundUpload } from '../hooks/useBackgroundUpload';
import { captureRef } from 'react-native-view-shot';
import PhotoLabel from '../components/PhotoLabel';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 60) / 3; // 3 columns with padding
const CONTAINER_PADDING = 16;
const PHOTO_SPACING = 8;

export default function PhotoSelectionScreen({ navigation, route }) {
  const { t } = useTranslation();
  const {
    photos,
    activeProjectId,
    projects,
    getBeforePhotos,
    getAfterPhotos,
    deletePhoto
  } = usePhotos();
  const {
    userName,
    location,
    labelLanguage,
    showLabels,
    beforeLabelPosition,
    afterLabelPosition,
    combinedLabelPosition,
    labelMarginVertical,
    labelMarginHorizontal,
  } = useSettings();
  const { userMode, teamInfo, isAuthenticated, folderId, proxySessionId, initializeProxySession } = useAdmin();
  const { startBackgroundUpload } = useBackgroundUpload();
  
  const [selectedPhotos, setSelectedPhotos] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'before', 'after', 'combined'
  const [sharing, setSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
  const [fullScreenPhotoSet, setFullScreenPhotoSet] = useState(null); // For combined photos
  const combinedCaptureRefs = useRef({}); // Store refs for combined photo captures
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const lastTap = useRef(null);
  const tapCount = useRef(0);
  const fullScreenImageContainerRef = useRef(null);
  const fullScreenImageRef = useRef(null);
  const [fullScreenImageSize, setFullScreenImageSize] = useState(null);
  const [fullScreenContainerLayout, setFullScreenContainerLayout] = useState(null);

  // Calculate image display bounds for label positioning
  const getFullScreenImageDisplayBounds = () => {
    if (!fullScreenContainerLayout || !fullScreenImageSize) {
      return null;
    }

    const containerWidth = fullScreenContainerLayout.width;
    const containerHeight = fullScreenContainerLayout.height;
    const imageWidth = fullScreenImageSize.width;
    const imageHeight = fullScreenImageSize.height;

    if (!imageWidth || !imageHeight) {
      return null;
    }

    // Calculate scaling to fit within container while maintaining aspect ratio
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const scale = Math.min(scaleX, scaleY);

    const displayWidth = imageWidth * scale;
    const displayHeight = imageHeight * scale;

    // Calculate centered position
    const offsetX = (containerWidth - displayWidth) / 2;
    const offsetY = (containerHeight - displayHeight) / 2;

    return {
      width: displayWidth,
      height: displayHeight,
      offsetX,
      offsetY
    };
  };

  // Get photos from active project or all photos
  const sourcePhotos = useMemo(() => {
    return activeProjectId 
      ? photos.filter(p => p.projectId === activeProjectId) 
      : photos;
  }, [photos, activeProjectId]);

  // Create photo sets for combined photos
  const photoSets = useMemo(() => {
    const sets = {};
    const beforePhotos = sourcePhotos.filter(p => p.mode === PHOTO_MODES.BEFORE);
    const afterPhotos = sourcePhotos.filter(p => p.mode === PHOTO_MODES.AFTER);

    beforePhotos.forEach(beforePhoto => {
      sets[beforePhoto.id] = {
        before: beforePhoto,
        after: null
      };
    });

    afterPhotos.forEach(afterPhoto => {
      if (afterPhoto.beforePhotoId && sets[afterPhoto.beforePhotoId]) {
        sets[afterPhoto.beforePhotoId].after = afterPhoto;
      }
    });

    return Object.values(sets);
  }, [sourcePhotos]);

  // Create combined photo items
  const combinedPhotos = useMemo(() => {
    return photoSets
      .filter(set => set.before && set.after)
      .map(set => ({
        id: `combined_${set.before.id}`,
        before: set.before,
        after: set.after,
        name: set.before.name,
        room: set.before.room,
        mode: PHOTO_MODES.COMBINED,
        uri: null, // Combined photos don't have URIs, they're rendered dynamically
        orientation: set.before.orientation,
        cameraViewMode: set.before.cameraViewMode
      }));
  }, [photoSets]);

  // Filter photos based on active tab
  const availablePhotos = useMemo(() => {
    switch (activeTab) {
      case 'before':
        return sourcePhotos.filter(p => p.mode === PHOTO_MODES.BEFORE);
      case 'after':
        return sourcePhotos.filter(p => p.mode === PHOTO_MODES.AFTER);
      case 'combined':
        return combinedPhotos;
      case 'all':
      default:
        return [...sourcePhotos, ...combinedPhotos];
    }
  }, [sourcePhotos, combinedPhotos, activeTab]);

  // All available items (for select all)
  const allAvailableItems = useMemo(() => {
    return [...sourcePhotos, ...combinedPhotos];
  }, [sourcePhotos, combinedPhotos]);

  // Long press handlers for full-screen photo
  const handleLongPressStart = (photo, photoSet = null) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (photoSet) {
        // Show combined preview with both photos
        setFullScreenPhotoSet(photoSet);
      } else if (photo) {
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

  // Handle double tap
  const handleDoubleTap = (photo, photoSet = null) => {
    tapCount.current = 0;
    lastTap.current = null;
    if (photoSet) {
      setFullScreenPhotoSet(photoSet);
    } else if (photo) {
      setFullScreenPhoto(photo);
    }
  };

  const togglePhotoSelection = (photoId) => {
    // Don't toggle if long press was triggered
    if (longPressTriggered.current) return;
    
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  // PanResponder for swipe down to close full screen view
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
          setFullScreenPhoto(null);
          setFullScreenPhotoSet(null);
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

      const result = await Share.share(shareOptions);
      
      // Clean up temporary file after sharing
      try {
        const fileInfo = await FileSystem.getInfoAsync(tempUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
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
      
      const photoRef = combinedCaptureRefs.current[`combined_${photoSet.before.id}`];
      if (!photoRef) {
        Alert.alert(t('common.error'), 'Could not capture combined photo');
        return;
      }

      // Capture the combined view with labels
      const capturedUri = await captureRef(photoRef, {
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

      const result = await Share.share(shareOptions);
      
      // Clean up temporary file after sharing
      try {
        const fileInfo = await FileSystem.getInfoAsync(tempUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('gallery.sharePhotoError'));
    } finally {
      setSharing(false);
    }
  };

  const selectAll = () => {
    if (selectedPhotos.size === allAvailableItems.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(allAvailableItems.map(p => p.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPhotos.size === 0) {
      Alert.alert(t('gallery.noPhotosSelected'), 'Please select photos to delete.');
      return;
    }

    Alert.alert(
      t('common.confirmation'),
      `Are you sure you want to delete ${selectedPhotos.size} selected photo(s)? ${t('common.actionCantBeUndone')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('common.delete'), 
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              setConfirmModalVisible(false);
              
              const selectedIds = Array.from(selectedPhotos);
              const photosToDelete = allAvailableItems.filter(p => selectedIds.includes(p.id));
              
              // Delete regular photos
              const regularPhotosToDelete = photosToDelete.filter(p => p.mode !== PHOTO_MODES.COMBINED);
              for (const photo of regularPhotosToDelete) {
                await deletePhoto(photo.id);
              }
              
              // For combined photos, delete the underlying before/after photos
              const combinedPhotosToDelete = photosToDelete.filter(p => p.mode === PHOTO_MODES.COMBINED && p.before && p.after);
              for (const combinedPhoto of combinedPhotosToDelete) {
                if (combinedPhoto.before) {
                  await deletePhoto(combinedPhoto.before.id);
                }
                if (combinedPhoto.after) {
                  await deletePhoto(combinedPhoto.after.id);
                }
              }
              
              setSelectedPhotos(new Set());
              Alert.alert(t('common.success'), 'Selected photos deleted successfully.');
            } catch (error) {
              Alert.alert(t('common.error'), 'Failed to delete photos.');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleDeselectAll = () => {
    setSelectedPhotos(new Set());
    setConfirmModalVisible(false);
  };

  const handleShare = async () => {
    if (selectedPhotos.size === 0) {
      Alert.alert(t('gallery.noPhotosSelected'), t('gallery.selectAtLeastOne'));
      return;
    }

    try {
      setSharing(true);
      
      const selectedIds = Array.from(selectedPhotos);
      const regularPhotosToShare = sourcePhotos.filter(p => selectedIds.includes(p.id));
      const combinedPhotosToShare = combinedPhotos.filter(p => selectedIds.includes(p.id));
      
      const projectName = projects.find(p => p.id === activeProjectId)?.name || 'Shared-Photos';
      const zipFileName = `${projectName.replace(/\s+/g, '_')}_${Date.now()}.zip`;
      const zipPath = FileSystem.cacheDirectory + zipFileName;
      const zip = new JSZip();
      
      // Add regular photos
      for (const photo of regularPhotosToShare) {
        const filename = photo.uri.split('/').pop();
        const content = await FileSystem.readAsStringAsync(photo.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        zip.file(filename, content, { base64: true });
      }

      // Capture and add combined photos
      for (const combinedPhoto of combinedPhotosToShare) {
        const photoRef = combinedCaptureRefs.current[combinedPhoto.id];
        if (photoRef) {
          try {
            const capturedUri = await captureRef(photoRef, {
              format: 'jpg',
              quality: 0.95
            });
            
            const filename = `${combinedPhoto.name}_combined_${Date.now()}.jpg`;
            const content = await FileSystem.readAsStringAsync(capturedUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            zip.file(filename, content, { base64: true });
          } catch (error) {
            console.error('Error capturing combined photo:', error);
          }
        }
      }
      
      const zipBase64 = await zip.generateAsync({ type: 'base64' });
      await FileSystem.writeAsStringAsync(zipPath, zipBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      await Share.share({
        url: zipPath,
        title: `Share ${projectName} Photos`,
        message: `Here are the selected photos from the project: ${projectName}`,
        type: 'application/zip',
      });
    } catch (error) {
      Alert.alert(t('common.error'), t('gallery.prepareShareError'));
    } finally {
      setSharing(false);
    }
  };

  const handleUpload = async () => {
    if (selectedPhotos.size === 0) {
      Alert.alert(t('gallery.noPhotosSelected'), t('gallery.selectAtLeastOneUpload'));
      return;
    }

    try {
      setUploading(true);

      const selectedIds = Array.from(selectedPhotos);
      const regularPhotosToUpload = sourcePhotos.filter(p => selectedIds.includes(p.id));
      const combinedPhotosToUpload = combinedPhotos.filter(p => selectedIds.includes(p.id));
      
      const itemsToUpload = [];

      // Add regular photos
      for (const photo of regularPhotosToUpload) {
        itemsToUpload.push({
          uri: photo.uri,
          filename: `${photo.name}_${photo.mode}.jpg`,
          name: photo.name,
          room: photo.room,
          mode: photo.mode
        });
      }

      // Capture and add combined photos
      for (const combinedPhoto of combinedPhotosToUpload) {
        const photoRef = combinedCaptureRefs.current[combinedPhoto.id];
        if (photoRef) {
          try {
            const capturedUri = await captureRef(photoRef, {
              format: 'jpg',
              quality: 0.9
            });
            
            itemsToUpload.push({
              uri: capturedUri,
              filename: `${combinedPhoto.name}_combined.jpg`,
              name: combinedPhoto.name,
              room: combinedPhoto.room,
              mode: PHOTO_MODES.COMBINED
            });
          } catch (error) {
            console.error('Error capturing combined photo for upload:', error);
          }
        }
      }

      if (itemsToUpload.length === 0) {
        Alert.alert(t('gallery.noPhotosSelected'), t('gallery.selectAtLeastOneUpload'));
        return;
      }

      // Handle team member upload
      if (userMode === 'team_member') {
        if (teamInfo && teamInfo.sessionId && teamInfo.token) {
          const teamUserName = userName || 'Team Member';
          const albumName = createAlbumName(teamUserName, new Date());
          
          // Use background upload service
          startBackgroundUpload({
            items: itemsToUpload,
            teamInfo: teamInfo,
            uploadType: 'team',
            albumName: albumName,
            location: location || 'tampa',
            userName: teamUserName,
            flat: true
          });
          
          Alert.alert(t('common.success'), t('gallery.uploadStarted'));
          navigation.goBack();
          return;
        } else {
          Alert.alert(t('common.error'), t('gallery.teamInfoMissing'));
          return;
        }
      }

      // For individual/Pro/Business/Enterprise users
      const shouldUseDirectDrive = userMode === 'individual' || 
        (isAuthenticated && !teamInfo);
      
      if (shouldUseDirectDrive) {
        if (!isAuthenticated) {
          Alert.alert(
            t('gallery.signInRequiredTitle'),
            t('gallery.signInRequiredMessage'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('gallery.goToSettings'), onPress: () => navigation.navigate('Settings') }
            ]
          );
          return;
        }

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

        try {
          const userFolderId = await googleDriveService.findOrCreateProofPixFolder();
          if (!userFolderId) {
            Alert.alert(t('common.error'), t('gallery.driveFolderError'));
            return;
          }
          
          const sessionResult = await initializeProxySession(userFolderId);
          if (!sessionResult || !sessionResult.success || !sessionResult.sessionId) {
            Alert.alert('Error', 'Failed to initialize proxy session. Please try again.');
            return;
          }

          const albumName = createAlbumName(userName, new Date());
          startBackgroundUpload({
            items: itemsToUpload,
            config: {
              folderId: userFolderId,
              useDirectDrive: true,
              sessionId: sessionResult.sessionId
            },
            uploadType: 'standard',
            albumName: albumName,
            location: location || 'tampa',
            userName: userName,
            flat: true
          });

          Alert.alert(t('common.success'), t('gallery.uploadStarted'));
          navigation.goBack();
          return;
        } catch (error) {
          Alert.alert('Error', `Failed to setup upload: ${error.message}`);
          return;
        }
      }

      // For admin mode
      let config = null;
      if (userMode === 'admin' && folderId && proxySessionId) {
        config = { folderId, useDirectDrive: true, sessionId: proxySessionId };
      } else {
        const locationConfig = getLocationConfig(location);
        config = { folderId: locationConfig?.folderId, useDirectDrive: false };
      }

      if (!config || !config.folderId || (config.useDirectDrive && !config.sessionId)) {
        Alert.alert(
          t('gallery.setupRequiredTitle'),
          t('gallery.driveConfigMissing'),
          [{ text: t('common.ok'), style: 'cancel' }]
        );
        return;
      }

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

      const albumName = createAlbumName(userName, new Date());
      startBackgroundUpload({
        items: itemsToUpload,
        config: config,
        uploadType: 'standard',
        albumName: albumName,
        location: location || 'tampa',
        userName: userName,
        flat: true
      });

      Alert.alert(t('common.success'), t('gallery.uploadStarted'));
      navigation.goBack();
    } catch (error) {
      Alert.alert('Upload Failed', error.message || 'An error occurred while uploading photos');
    } finally {
      setUploading(false);
    }
  };

  const renderPhoto = (photo, index) => {
    const isSelected = selectedPhotos.has(photo.id);
    const borderColor = photo.mode === PHOTO_MODES.BEFORE 
      ? '#4CAF50' 
      : photo.mode === PHOTO_MODES.AFTER 
      ? '#2196F3' 
      : '#FFC107';

    // Render combined photo
    if (photo.mode === PHOTO_MODES.COMBINED && photo.before && photo.after) {
      const phoneOrientation = photo.before.orientation || 'portrait';
      const cameraViewMode = photo.before.cameraViewMode || 'portrait';
      const isLetterbox = photo.before.templateType === 'letterbox' || (phoneOrientation === 'portrait' && cameraViewMode === 'landscape');
      const isTrueLandscape = phoneOrientation === 'landscape';
      const useStackedLayout = isTrueLandscape || isLetterbox;

      const handleCombinedPress = () => {
        if (longPressTriggered.current) return;
        
        // Handle double tap
        const now = Date.now();
        if (tapCount.current === 0) {
          tapCount.current = 1;
          lastTap.current = now;
          setTimeout(() => {
            if (tapCount.current === 1 && lastTap.current === now) {
              // Single tap - toggle selection
              togglePhotoSelection(photo.id);
              tapCount.current = 0;
              lastTap.current = null;
            }
          }, 300);
        } else if (tapCount.current === 1) {
          tapCount.current = 2;
          if (now - lastTap.current < 300) {
            // Double tap - show full screen
            handleDoubleTap(null, { before: photo.before, after: photo.after, name: photo.name, room: photo.room });
          } else {
            // Too slow, treat as new tap
            tapCount.current = 1;
            lastTap.current = now;
          }
        }
      };

      return (
        <TouchableOpacity
          key={photo.id}
          style={[
            styles.photoContainer,
            { borderColor },
            isSelected && styles.photoContainerSelected
          ]}
          onPress={handleCombinedPress}
          onPressIn={() => handleLongPressStart(null, { before: photo.before, after: photo.after, name: photo.name, room: photo.room })}
          onPressOut={handleLongPressEnd}
        >
          <View
            ref={ref => {
              if (ref) {
                combinedCaptureRefs.current[photo.id] = ref;
              }
            }}
            collapsable={false}
            style={[
              styles.combinedThumbnail,
              useStackedLayout ? styles.stackedThumbnail : styles.sideBySideThumbnail
            ]}
          >
            <Image 
              source={{ uri: photo.before.uri }} 
              style={styles.halfImage} 
              resizeMode="cover" 
            />
            <Image 
              source={{ uri: photo.after.uri }} 
              style={styles.halfImage} 
              resizeMode="cover" 
            />
          </View>
          
          {/* Checkbox overlay */}
          <View style={[styles.checkboxContainer, isSelected && styles.checkboxSelected]}>
            {isSelected && (
              <Text style={styles.checkmark}>✓</Text>
            )}
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

    // Render regular photo
    const handleRegularPress = () => {
      if (longPressTriggered.current) return;
      
      // Handle double tap
      const now = Date.now();
      if (tapCount.current === 0) {
        tapCount.current = 1;
        lastTap.current = now;
        setTimeout(() => {
          if (tapCount.current === 1 && lastTap.current === now) {
            // Single tap - toggle selection
            togglePhotoSelection(photo.id);
            tapCount.current = 0;
            lastTap.current = null;
          }
        }, 300);
      } else if (tapCount.current === 1) {
        tapCount.current = 2;
        if (now - lastTap.current < 300) {
          // Double tap - show full screen
          handleDoubleTap(photo);
        } else {
          // Too slow, treat as new tap
          tapCount.current = 1;
          lastTap.current = now;
        }
      }
    };

    return (
      <TouchableOpacity
        key={photo.id}
        style={[
          styles.photoContainer,
          { borderColor },
          isSelected && styles.photoContainerSelected
        ]}
        onPress={handleRegularPress}
        onPressIn={() => handleLongPressStart(photo)}
        onPressOut={handleLongPressEnd}
      >
        <CroppedThumbnail
          imageUri={photo.uri}
          aspectRatio={photo.aspectRatio || '4:3'}
          orientation={photo.orientation || 'portrait'}
          size={PHOTO_SIZE}
        />
        
        {/* Checkbox overlay */}
        <View style={[styles.checkboxContainer, isSelected && styles.checkboxSelected]}>
          {isSelected && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </View>

        {/* Mode label */}
        <View style={[styles.modeLabel, { backgroundColor: borderColor }]}>
          <Text style={styles.modeLabelText}>
            {photo.mode === PHOTO_MODES.BEFORE 
              ? t('camera.before', { lng: labelLanguage })
              : photo.mode === PHOTO_MODES.AFTER
              ? t('camera.after', { lng: labelLanguage })
              : t('camera.combined', { lng: labelLanguage })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('gallery.selectPhotos')}</Text>
        <TouchableOpacity
          style={styles.selectAllButton}
          onPress={selectAll}
        >
          <Text style={styles.selectAllButtonText}>
            {selectedPhotos.size === allAvailableItems.length ? t('common.deselectAll') : t('common.selectAll')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              {t('common.all')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'before' && styles.tabActive]}
            onPress={() => setActiveTab('before')}
          >
            <Text style={[styles.tabText, activeTab === 'before' && styles.tabTextActive]}>
              {t('camera.before', { lng: labelLanguage })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'after' && styles.tabActive]}
            onPress={() => setActiveTab('after')}
          >
            <Text style={[styles.tabText, activeTab === 'after' && styles.tabTextActive]}>
              {t('camera.after', { lng: labelLanguage })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'combined' && styles.tabActive]}
            onPress={() => setActiveTab('combined')}
          >
            <Text style={[styles.tabText, activeTab === 'combined' && styles.tabTextActive]}>
              {t('camera.combined', { lng: labelLanguage })}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {availablePhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('gallery.noPhotosYet')}</Text>
        </View>
      ) : (
        <>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.photoGrid}
          >
            {availablePhotos.map((photo, index) => renderPhoto(photo, index))}
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actionBar}>
            <Text style={styles.selectedCount}>
              {selectedPhotos.size} {t('common.selected')}
            </Text>
            <TouchableOpacity
              style={[styles.confirmButton, selectedPhotos.size === 0 && styles.confirmButtonDisabled]}
              onPress={() => {
                if (selectedPhotos.size === 0) {
                  Alert.alert(t('gallery.noPhotosSelected'), 'Please select at least one photo.');
                  return;
                }
                setConfirmModalVisible(true);
              }}
              disabled={selectedPhotos.size === 0}
            >
              <Text style={styles.confirmButtonText}>
                {t('common.confirm')}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Confirm Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.optionsModalOverlay}>
          <View style={styles.optionsModalContent}>
            <Text style={styles.optionsTitle}>{t('common.confirmation')}</Text>
            <Text style={styles.optionsSubtitle}>
              {selectedPhotos.size} {t('common.selected')} photo(s)
            </Text>

            <View style={styles.actionsList}>
              {/* Upload Selected (primary) */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionWide, styles.actionPrimaryFlat]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  handleUpload();
                }}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>
                    📤 {t('gallery.uploadSelected')}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Share Selected (light blue) */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionWide, styles.actionInfo]}
                onPress={() => {
                  setConfirmModalVisible(false);
                  handleShare();
                }}
                disabled={sharing}
              >
                {sharing ? (
                  <ActivityIndicator color="#0077CC" />
                ) : (
                  <Text style={[styles.actionBtnText, styles.actionInfoText]}>
                    🔗 {t('gallery.shareSelected')}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Delete Selected (red) */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionWide, styles.actionDestructive]}
                onPress={handleDeleteSelected}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#CC0000" />
                ) : (
                  <Text style={[styles.actionBtnText, styles.actionDestructiveText]}>
                    🗑️ {t('gallery.deleteSelected')}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Deselect All */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionWide, styles.actionCancel, { marginTop: 8 }]}
                onPress={handleDeselectAll}
              >
                <Text style={styles.actionBtnText}>
                  ✕ {t('gallery.deselectAll')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.optionsActionsRowCenter}>
              <TouchableOpacity 
                style={[styles.actionBtn, styles.actionWide, styles.actionCancel]} 
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.actionBtnText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen photo view - single photo */}
      {fullScreenPhoto && (() => {
        // Get the appropriate label position based on photo mode
        const currentLabelPosition = fullScreenPhoto.mode === 'before' ? beforeLabelPosition : afterLabelPosition;
        const positions = getLabelPositions(labelMarginVertical, labelMarginHorizontal);
        const positionConfig = positions[currentLabelPosition] || positions['left-top'];

        // Calculate label position based on actual image display area
        const getLabelStyle = () => {
          const bounds = getFullScreenImageDisplayBounds();
          if (!bounds) {
            // Fallback to default position coordinates if bounds not available
            const { name, horizontalAlign, verticalAlign, ...coordinates } = positionConfig;
            return coordinates;
          }

          // Apply position offset based on image display bounds
          const style = {};

          // Handle vertical positioning
          if (positionConfig.top !== undefined) {
            if (typeof positionConfig.top === 'string' && positionConfig.top.includes('%')) {
              style.top = bounds.offsetY + (bounds.height * parseFloat(positionConfig.top) / 100);
            } else {
              style.top = bounds.offsetY + positionConfig.top;
            }
          }
          if (positionConfig.bottom !== undefined) {
            style.bottom = bounds.offsetY + positionConfig.bottom;
          }

          // Handle horizontal positioning
          if (positionConfig.left !== undefined) {
            if (typeof positionConfig.left === 'string' && positionConfig.left.includes('%')) {
              style.left = bounds.offsetX + (bounds.width * parseFloat(positionConfig.left) / 100);
            } else {
              style.left = bounds.offsetX + positionConfig.left;
            }
          }
          if (positionConfig.right !== undefined) {
            style.right = bounds.offsetX + positionConfig.right;
          }

          // Handle transform
          if (positionConfig.transform) {
            style.transform = positionConfig.transform;
          }

          return style;
        };

        return (
          <TouchableWithoutFeedback onPress={handleLongPressEnd}>
            <View style={styles.fullScreenPhotoContainer} {...panResponder.panHandlers}>
              <View
                ref={fullScreenImageContainerRef}
                style={styles.fullScreenImageContainer}
                collapsable={false}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  setFullScreenContainerLayout({ width, height });
                }}
              >
                <Image
                  ref={fullScreenImageRef}
                  source={{ uri: fullScreenPhoto.uri }}
                  style={styles.fullScreenPhoto}
                  resizeMode="contain"
                  onLoad={(event) => {
                    const { width, height } = event.nativeEvent.source;
                    setFullScreenImageSize({ width, height });
                  }}
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
                    position={currentLabelPosition}
                    style={getLabelStyle()}
                  />
                )}
              </View>
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
        );
      })()}

      {/* Full-screen combined photo view */}
      {fullScreenPhotoSet && (
        <TouchableWithoutFeedback onPress={handleLongPressEnd}>
          <View style={styles.fullScreenPhotoContainer} {...panResponder.panHandlers}>
            <View 
              ref={ref => {
                if (ref && fullScreenPhotoSet.before) {
                  combinedCaptureRefs.current[`combined_${fullScreenPhotoSet.before.id}`] = ref;
                }
              }}
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
              ]}
            >
              <View style={styles.fullScreenHalf}>
                <Image
                  source={{ uri: fullScreenPhotoSet.before.uri }}
                  style={styles.fullScreenHalfImage}
                  resizeMode="cover"
                />
                {/* Show BEFORE label only if showLabels is true */}
                {showLabels && (
                  <PhotoLabel label="common.before" position={combinedLabelPosition} />
                )}
              </View>
              <View style={styles.fullScreenHalf}>
                <Image
                  source={{ uri: fullScreenPhotoSet.after.uri }}
                  style={styles.fullScreenHalfImage}
                  resizeMode="cover"
                />
                {/* Show AFTER label only if showLabels is true */}
                {showLabels && (
                  <PhotoLabel label="common.after" position={combinedLabelPosition} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingTop: 50 // Add padding to avoid status bar overlap
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
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    flex: 1,
    textAlign: 'center'
  },
  selectAllButton: {
    width: 80,
    alignItems: 'flex-end'
  },
  selectAllButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '600'
  },
  scrollView: {
    flex: 1
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: CONTAINER_PADDING,
    gap: PHOTO_SPACING
  },
  photoContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: 'white',
    position: 'relative',
    marginBottom: PHOTO_SPACING
  },
  photoContainerSelected: {
    borderWidth: 4,
    opacity: 0.8
  },
  checkboxContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  checkboxSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY
  },
  checkmark: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold'
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: 'center'
  },
  actionBar: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20
  },
  selectedCount: {
    fontSize: 14,
    color: COLORS.TEXT,
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600'
  },
  confirmButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    minHeight: 48
  },
  confirmButtonDisabled: {
    backgroundColor: COLORS.GRAY,
    opacity: 0.5
  },
  confirmButtonText: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: 'bold'
  },
  // Modal styles
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
  optionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 8,
    textAlign: 'center'
  },
  optionsSubtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginBottom: 16,
    textAlign: 'center'
  },
  actionsList: {
    alignItems: 'center'
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 6
  },
  actionWide: {
    width: '92%'
  },
  actionPrimaryFlat: {
    backgroundColor: COLORS.PRIMARY
  },
  actionInfo: {
    backgroundColor: '#D6ECFF'
  },
  actionDestructive: {
    backgroundColor: '#FFE6E6',
    marginTop: 8
  },
  actionCancel: {
    backgroundColor: '#F2F2F2'
  },
  actionBtnText: {
    color: COLORS.TEXT,
    fontWeight: '600',
    fontSize: 16
  },
  actionPrimaryText: {
    color: 'white'
  },
  actionInfoText: {
    color: '#0077CC'
  },
  actionDestructiveText: {
    color: '#CC0000',
    fontWeight: '700'
  },
  optionsActionsRowCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8
  },
  tabsContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F2',
    marginRight: 8
  },
  tabActive: {
    backgroundColor: COLORS.PRIMARY
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT
  },
  tabTextActive: {
    color: COLORS.TEXT
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
  fullScreenImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
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
    flex: 1,
    position: 'relative'
  },
  fullScreenHalfImage: {
    width: '100%',
    height: '100%'
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

