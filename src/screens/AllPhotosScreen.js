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
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { COLORS, PHOTO_MODES, ROOMS, TEMPLATE_CONFIGS, TEMPLATE_TYPES } from '../constants/rooms';
import { CroppedThumbnail } from '../components/CroppedThumbnail';
import { uploadPhotoBatch, createAlbumName } from '../services/uploadService';
import { getLocationConfig } from '../config/locations';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import { useBackgroundUpload } from '../hooks/useBackgroundUpload';
import { UploadDetailsModal } from '../components/BackgroundUploadStatus';
import UploadIndicatorLine from '../components/UploadIndicatorLine';
import UploadCompletionModal from '../components/UploadCompletionModal';
import { filterNewPhotos, markPhotosAsUploaded } from '../services/uploadTracker';
import JSZip from 'jszip';
import analyticsService from '../services/analyticsService';

const { width } = Dimensions.get('window');
const SET_NAME_WIDTH = 80;
const CONTAINER_PADDING = 32; // 16px on each side
const PHOTO_SPACING = 16; // 8px between each of the 2 gaps
const AVAILABLE_WIDTH = width - SET_NAME_WIDTH - CONTAINER_PADDING - PHOTO_SPACING;
const COLUMN_WIDTH = AVAILABLE_WIDTH / 3;

export default function AllPhotosScreen({ navigation, route }) {
  const { photos, getBeforePhotos, getAfterPhotos, getCombinedPhotos, deleteAllPhotos, createProject, assignPhotosToProject, activeProjectId, deleteProject, setActiveProject, projects } = usePhotos();
  const { userName, location, isBusiness, useFolderStructure, enabledFolders } = useSettings();
  const { uploadStatus, startBackgroundUpload, cancelUpload, cancelAllUploads, clearCompletedUploads } = useBackgroundUpload();
  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
  const [fullScreenPhotoSet, setFullScreenPhotoSet] = useState(null); // For combined preview
  const [sharing, setSharing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const uploadControllersRef = useRef([]); // AbortControllers for in-flight requests
  const masterAbortRef = useRef(null); // single signal to stop scheduling
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [shareOptionsVisible, setShareOptionsVisible] = useState(false);
  const [deleteFromStorage, setDeleteFromStorage] = useState(true);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false); // retained but unused to avoid modal
  const [selectedTypes, setSelectedTypes] = useState({ before: true, after: true, combined: true });
  const [selectedShareTypes, setSelectedShareTypes] = useState({ before: true, after: true, combined: true });
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

  const FREE_FORMATS = new Set([]);
  const handleFormatToggle = (key) => {
    try {
      // Gate advanced formats by business flag
      if (!isBusiness) {
        setUpgradeVisible(true);
        return;
      }
      setSelectedFormats(prev => ({ ...prev, [key]: !prev[key] }));
    } catch (e) {
      console.warn('Format toggle error:', e?.message);
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
          console.log('All Photos - swipe down detected, going back');
          navigation.goBack();
        }
      }
    })
  ).current;

  // Share individual photo (before or after)
  const shareIndividualPhoto = async (photo) => {
    try {
      setSharing(true);
      
      // Create a temporary file for sharing
      const tempFileName = `${photo.room}_${photo.name}_${photo.mode}_${Date.now()}.jpg`;
      const tempUri = await savePhotoToDevice(photo.uri, tempFileName);

      // Share the image
      const shareOptions = {
        title: `${photo.mode === 'before' ? 'Before' : 'After'} Photo - ${photo.name}`,
        message: `Check out this ${photo.mode} photo from ${photo.room}!`,
        url: tempUri,
        type: 'image/jpeg'
      };

      const result = await Share.share(shareOptions);
      
      if (result.action === Share.sharedAction) {
        console.log('Photo shared successfully');
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dialog dismissed');
      }
    } catch (error) {
      console.error('Error sharing photo:', error);
      Alert.alert('Error', 'Failed to share photo');
    } finally {
      setSharing(false);
    }
  };

  const startSharingWithOptions = async () => {
    try {
        console.log('🚀 Starting share process...');
        setSharing(true);
        setShareOptionsVisible(false); // Close the modal immediately
        const sourcePhotos = activeProjectId ? photos.filter(p => p.projectId === activeProjectId) : photos;
        console.log('📸 Source photos:', sourcePhotos.length);

        if (sourcePhotos.length === 0) {
            Alert.alert('No Photos', 'There are no photos in this project to share.');
            return;
        }

        const itemsToShare = sourcePhotos.filter(p =>
            (selectedShareTypes.before && p.mode === PHOTO_MODES.BEFORE) ||
            (selectedShareTypes.after && p.mode === PHOTO_MODES.AFTER)
        );
        console.log('📦 Items to share:', itemsToShare.length, selectedShareTypes);

        if (itemsToShare.length === 0) {
            Alert.alert('No Photos Selected', 'Please select at least one photo type to share.');
            return;
        }
        
        const projectName = projects.find(p => p.id === activeProjectId)?.name || 'Shared-Photos';
        const zipFileName = `${projectName.replace(/\s+/g, '_')}_${Date.now()}.zip`;
        const zipPath = FileSystem.cacheDirectory + zipFileName;
        console.log('📁 Creating ZIP:', zipFileName);

        const zip = new JSZip();
        console.log('📦 JSZip created');

        for (const item of itemsToShare) {
            const filename = item.uri.split('/').pop();
            console.log('📄 Adding file to ZIP:', filename);
            const content = await FileSystem.readAsStringAsync(item.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            zip.file(filename, content, { base64: true });
        }

        console.log('🔄 Generating ZIP...');
        const zipBase64 = await zip.generateAsync({ type: 'base64' });
        console.log('💾 Writing ZIP to file...');

        await FileSystem.writeAsStringAsync(zipPath, zipBase64, {
            encoding: FileSystem.EncodingType.Base64,
        });

        console.log('📤 Sharing ZIP file...');
        await Share.share({
            url: zipPath,
            title: `Share ${projectName} Photos`,
            message: `Here are the photos from the project: ${projectName}`,
            type: 'application/zip',
        });
        
        analyticsService.logEvent('Project_Shared', { 
          projectName, 
          photoCount: itemsToShare.length,
          sharedTypes: Object.keys(selectedShareTypes).filter(k => selectedShareTypes[k]),
        });
        console.log('✅ Share completed successfully');

    } catch (error) {
        console.error('Sharing error:', error);
        Alert.alert('Error', 'Failed to prepare photos for sharing.');
    } finally {
        setSharing(false);
    }
  };

  const handleShareProject = async () => {
    const sourcePhotos = activeProjectId ? photos.filter(p => p.projectId === activeProjectId) : photos;
    if (sourcePhotos.length === 0) {
      Alert.alert('No Photos', 'There are no photos in the active project to share.');
      return;
    }
    setShareOptionsVisible(true);
  };

  const handleUploadPhotos = async () => {
    // Get location-based configuration
    const config = getLocationConfig(location);

    // Check if Google Drive is configured
    if (!config.scriptUrl || !config.folderId) {
      Alert.alert(
        'Setup Required',
        'Google Drive configuration is missing for the selected location. Please check your environment variables or contact support.',
        [
          { text: 'OK', style: 'cancel' }
        ]
      );
      return;
    }

    // Check if user info is configured
    if (!userName || !location) {
      Alert.alert(
        'Setup Required',
        'Please configure your name and location in Settings before uploading.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') }
        ]
      );
      return;
    }

    // Check if there are photos to upload
    if (photos.length === 0) {
      Alert.alert('No Photos', 'There are no photos to upload.');
      return;
    }

    // Open options modal
    setOptionsVisible(true);
  };

  const startUploadWithOptions = async () => {
    try {
      const config = getLocationConfig(location);
      // Always generate album name based on current location, not project's original location
      const albumName = createAlbumName(userName, location);
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

            const pickLatestByPrefix = (prefix) => {
              const matches = entries.filter(name => name.startsWith(prefix));
              if (matches.length === 0) return null;
              // Filenames end with _<timestamp>.jpg; pick max timestamp
              let best = null;
              let bestTs = -1;
              for (const name of matches) {
                const m = name.match(/_(\d+)\.(jpg|jpeg|png)$/i);
                const ts = m ? parseInt(m[1], 10) : 0;
                if (ts > bestTs) { bestTs = ts; best = name; }
              }
              return best || matches[matches.length - 1];
            };

            let foundCount = 0;
            for (const pair of pairs) {
              const safeName = (pair.before.name || 'Photo').replace(/\s+/g, '_');
              const stackPrefix = `${pair.before.room}_${safeName}_COMBINED_BASE_STACK_`;
              const sidePrefix = `${pair.before.room}_${safeName}_COMBINED_BASE_SIDE_`;

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
              Alert.alert('Nothing to Upload', 'No original combined images found.');
              return;
            }
          } catch (e) {
            console.warn('Original combined scan failed:', e?.message);
            Alert.alert('Error', 'Failed to find original combined images');
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
            Alert.alert('Nothing to Upload', 'No before/after pairs available to create combined photos.');
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

                console.log(`📸 Captured ${templateKey} for ${pair.before.name}, URI:`, uri?.substring(0, 60));

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
                console.error(`❌ Failed to capture ${templateKey} for ${pair.before.name}:`, error);
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
        Alert.alert('Nothing to Upload', 'Please select at least one photo type with available photos.');
        return;
      }

      // Filter out photos that have already been uploaded
      const newItems = await filterNewPhotos(allItems, albumName);
      
      if (newItems.length === 0) {
        Alert.alert(
          'No New Photos', 
          'All selected photos have already been uploaded to this album. Would you like to upload them again anyway?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Upload Anyway', 
              style: 'default',
              onPress: () => {
                // Force re-upload of all photos by using allItems instead of filtered newItems
                proceedWithUpload(allItems, albumName);
              }
            }
          ]
        );
        return;
      }

      if (newItems.length < allItems.length) {
        const skippedCount = allItems.length - newItems.length;
        Alert.alert(
          'Some Photos Already Uploaded',
          `${skippedCount} photo(s) were skipped because they were already uploaded to this album. ${newItems.length} new photo(s) will be uploaded.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Upload New Only', 
              style: 'default',
              onPress: () => proceedWithUpload(newItems, albumName) 
            },
            { 
              text: 'Upload All', 
              style: 'default',
              onPress: () => {
                // Force re-upload of all photos including already uploaded ones
                proceedWithUpload(allItems, albumName);
              }
            }
          ]
        );
        return;
      }

      // All photos are new, proceed with upload
      await proceedWithUpload(newItems, albumName);
    } catch (error) {
      Alert.alert('Upload Failed', error.message || 'An error occurred while preparing upload');
    }
  };

  const proceedWithUpload = async (items, albumName) => {
    try {
      const config = getLocationConfig(location);

      // Close upload options and any upgrade overlay before starting background upload
      setOptionsVisible(false);
      setUpgradeVisible(false);

      // Start background upload
      const uploadId = startBackgroundUpload({
        items,
        config,
        albumName,
        location,
        userName,
        flat: !useFolderStructure
      });

      // Show upload modal immediately
      setShowUploadDetails(true);
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
      const isLandscape = phoneOrientation === 'landscape' || cameraViewMode === 'landscape';

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
        >
          <View style={[styles.combinedThumbnail, isLandscape ? styles.stackedThumbnail : styles.sideBySideThumbnail]}>
            <Image source={{ uri: photoSet.before.uri }} style={styles.halfImage} resizeMode="cover" />
            <Image source={{ uri: photoSet.after.uri }} style={styles.halfImage} resizeMode="cover" />
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
      >
        <CroppedThumbnail
          imageUri={photo.uri}
          aspectRatio={photo.aspectRatio || photoSet.before?.aspectRatio || '4:3'}
          orientation={photo.orientation || photoSet.before?.orientation || 'portrait'}
          size={COLUMN_WIDTH}
        />
      </TouchableOpacity>
    );
  };

  const renderPhotoSet = (set, index) => (
    <View key={index} style={styles.photoSetRow}>
      <View style={styles.setNameContainer}>
        <Text style={styles.setName}>{set.name}</Text>
      </View>
      <View style={styles.threeColumnRow}>
        {renderPhotoCard(set.before, '#4CAF50', 'before', set, false)}
        {renderPhotoCard(set.after, '#2196F3', 'after', set, false)}
        {renderPhotoCard(set.combined, '#FFC107', 'combined', set, true)}
      </View>
    </View>
  );

  const renderRoomSection = (room) => {
    const sets = getPhotoSets(room.id);
    if (sets.length === 0) return null;

    return (
      <View key={room.id} style={styles.roomSection}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomIcon}>{room.icon}</Text>
          <Text style={styles.roomName}>{room.name}</Text>
        </View>
        {sets.map((set, index) => renderPhotoSet(set, index))}
      </View>
    );
  };

  // Open Manage Projects modal only when this screen is focused
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
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>All Photos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Active project name under the title */}
      <View style={styles.projectNameContainer}>
        <Text style={styles.projectNameText}>
          {(projects?.find?.(p => p.id === activeProjectId)?.name) || 'No project selected'}
        </Text>
        <UploadIndicatorLine 
          uploadStatus={uploadStatus}
          onPress={() => setShowUploadDetails(true)}
        />
      </View>

      <View style={styles.columnHeaders}>
        <View style={styles.setNamePlaceholder} />
        <Text style={[styles.columnHeader, { color: '#4CAF50' }]}>BEFORE</Text>
        <Text style={[styles.columnHeader, { color: '#2196F3' }]}>AFTER</Text>
        <Text style={[styles.columnHeader, { color: '#FFC107', marginRight: 0 }]}>COMBINED</Text>
      </View>

      {photos.length === 0 || !activeProjectId ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {!activeProjectId ? 'No project selected' : 'No photos yet'}
          </Text>
          <Text style={styles.emptyStateSubtext}>
            {!activeProjectId 
              ? 'Select a project to view photos' 
              : 'Take some before/after photos to get started'
            }
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {ROOMS.map(room => renderRoomSection(room))}
        </ScrollView>
      )}

      {/* Manage Projects button at bottom - only show if photos exist and project is selected */}
      {photos.length > 0 && activeProjectId && (
        <TouchableOpacity
          style={[styles.deleteAllButtonBottom, { backgroundColor: '#22A45D' }]}
          onPress={() => setManageVisible(true)}
        >
          <Text style={styles.deleteAllButtonBottomText}>🗂️ Manage Projects</Text>
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
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => shareIndividualPhoto(fullScreenPhoto)}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.shareButtonText}>Share</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Full-screen combined photo view - 1:1 square with before/after */}
      {fullScreenPhotoSet && (
        <TouchableWithoutFeedback onPress={handleLongPressEnd}>
          <View style={styles.fullScreenPhotoContainer}>
            <View style={[
              styles.fullScreenCombinedPreview,
              (fullScreenPhotoSet.before.orientation === 'landscape' || fullScreenPhotoSet.before.cameraViewMode === 'landscape')
                ? styles.fullScreenStacked
                : styles.fullScreenSideBySide
            ]}>
              <View style={styles.fullScreenHalf}>
                <Image
                  source={{ uri: fullScreenPhotoSet.before.uri }}
                  style={styles.fullScreenHalfImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.fullScreenHalf}>
                <Image
                  source={{ uri: fullScreenPhotoSet.after.uri }}
                  style={styles.fullScreenHalfImage}
                  resizeMode="cover"
                />
              </View>
            </View>
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
            <Text style={styles.uploadModalTitle}>Generating Combined Photos</Text>
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
                  </View>
                  <View style={styles.renderHalf}>
                    <Image
                      source={{ uri: currentRenderPair.after.uri }}
                      style={styles.renderImage}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Upgrade overlay is rendered inside the Upload Options modal for correct stacking */}

      {/* Confirm Save Modal removed - Save button was removed from Manage Projects modal */}

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
            <Text style={styles.optionsTitle}>Upgrade required</Text>
            <Text style={[styles.optionsSectionLabel, { marginBottom: 16 }]}>Unlock more formats with Business</Text>
            <View style={[styles.optionsActionsRow, { marginTop: 0 }]}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary, styles.actionHalf]}
                onPress={() => setUpgradeVisible(false)}
              >
                <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>Upgrade</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionCancel, styles.actionHalf]}
                onPress={() => setUpgradeVisible(false)}
              >
                <Text style={styles.actionBtnText}>Not now</Text>
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
            <Text style={styles.uploadModalTitle}>Uploading Photos</Text>
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
                <Text style={[styles.actionBtnText, { textTransform: 'none' }]}>Cancel upload</Text>
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
            <Text style={styles.optionsTitle}>What would you like to upload?</Text>

            <Text style={styles.optionsSectionLabel}>Photo types</Text>
            <View style={styles.optionsChipsRow}>
              <TouchableOpacity
                style={[styles.chip, selectedTypes.before && styles.chipActive]}
                onPress={() => setSelectedTypes(prev => ({ ...prev, before: !prev.before }))}
              >
                <Text style={[styles.chipText, selectedTypes.before && styles.chipTextActive]}>Before</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, selectedTypes.after && styles.chipActive]}
                onPress={() => setSelectedTypes(prev => ({ ...prev, after: !prev.after }))}
              >
                <Text style={[styles.chipText, selectedTypes.after && styles.chipTextActive]}>After</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, selectedTypes.combined && styles.chipActive]}
                onPress={() => setSelectedTypes(prev => ({ ...prev, combined: !prev.combined }))}
              >
                <Text style={[styles.chipText, selectedTypes.combined && styles.chipTextActive]}>Combined</Text>
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
                    <Text style={styles.actionBtnText}>Show advanced formats</Text>
                  </TouchableOpacity>
                )}

                {showAdvancedFormats && (
                  <>
                    <Text style={[styles.optionsSectionLabel, { marginTop: 16 }]}>Stacked formats</Text>
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

                    <Text style={[styles.optionsSectionLabel, { marginTop: 12 }]}>Side-by-side formats</Text>
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
                      <Text style={styles.actionBtnText}>Hide advanced formats</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            <View style={styles.optionsActionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionCancel, styles.actionFlex]} onPress={() => setOptionsVisible(false)}>
                <Text style={styles.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary, styles.actionFlex]} onPress={startUploadWithOptions}>
                <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>Start Upload</Text>
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
                      <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>Upgrade</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionCancel, styles.actionHalf]}
                      onPress={() => setUpgradeVisible(false)}
                    >
                      <Text style={styles.actionBtnText}>Not now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Manage Projects Modal */}
      <Modal
        visible={manageVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setManageVisible(false)}
      >
        <View style={styles.optionsModalOverlay}>
          <View style={styles.optionsModalContent}>
            <Text style={styles.optionsTitle}>Manage Projects</Text>

            <View>
              <View style={{ marginTop: 4 }} />

              <View style={styles.actionsList}>
                {/* Upload (primary) */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide, styles.actionPrimaryFlat]}
                  onPress={() => {
                    setManageVisible(false);
                    handleUploadPhotos();
                  }}
                >
                  <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>📤 Upload</Text>
                </TouchableOpacity>

                {/* Share to (light blue) */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide, styles.actionInfo]}
                  onPress={() => {
                    setManageVisible(false);
                    handleShareProject();
                  }}
                >
                  <Text style={[styles.actionBtnText, styles.actionInfoText]}>🔗 Share</Text>
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
                  <Text style={[styles.actionBtnText, styles.actionDestructiveText]}>🗑️ Delete All</Text>
                </TouchableOpacity>
              </View>

              {/* Switch moved to confirmation dialog */}

              <View style={styles.optionsActionsRowCenter}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionWide, styles.actionCancel]} onPress={() => setManageVisible(false)}>
                  <Text style={styles.actionBtnText}>Close</Text>
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
            <Text style={styles.loadingText}>Preparing photos for sharing...</Text>
            <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
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
            <Text style={styles.optionsTitle}>What would you like to share?</Text>

            <Text style={styles.optionsSectionLabel}>Photo types</Text>
            <View style={styles.optionsChipsRow}>
              <TouchableOpacity
                style={[styles.chip, selectedShareTypes.before && styles.chipActive]}
                onPress={() => setSelectedShareTypes(prev => ({ ...prev, before: !prev.before }))}
              >
                <Text style={[styles.chipText, selectedShareTypes.before && styles.chipTextActive]}>Before</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, selectedShareTypes.after && styles.chipActive]}
                onPress={() => setSelectedShareTypes(prev => ({ ...prev, after: !prev.after }))}
              >
                <Text style={[styles.chipText, selectedShareTypes.after && styles.chipTextActive]}>After</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, selectedShareTypes.combined && styles.chipActive]}
                onPress={() => setSelectedShareTypes(prev => ({ ...prev, combined: !prev.combined }))}
              >
                <Text style={[styles.chipText, selectedShareTypes.combined && styles.chipTextActive]}>Combined</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.optionsActionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionCancel, styles.actionFlex]} onPress={() => setShareOptionsVisible(false)}>
                <Text style={styles.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary, styles.actionFlex]} onPress={() => {
                  setShareOptionsVisible(false);
                  startSharingWithOptions();
              }}>
                <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>Prepare to Share</Text>
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
    fontSize: 18
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT
  },
  projectNameContainer: {
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
    fontWeight: '500'
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
  setNamePlaceholder: {
    width: 80,
    marginRight: 8
  },
  columnHeader: {
    width: COLUMN_WIDTH,
    marginRight: 8,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.GRAY,
    textAlign: 'center'
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
  setNameContainer: {
    width: 80,
    marginRight: 8,
    justifyContent: 'center'
  },
  setName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT
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
    marginRight: 8
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
    marginBottom: 8
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: 'center'
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
    flex: 1
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
  chipText: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: '500'
  },
  chipTextActive: {
    color: COLORS.PRIMARY
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
