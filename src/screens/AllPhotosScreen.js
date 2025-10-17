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
  TextInput
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
import { deletePhotosFromDevice, purgeAllDevicePhotos } from '../services/storage';
// Removed MediaLibrary (unused) and gesture-handler TextInput (use RN TextInput)

const { width } = Dimensions.get('window');
const SET_NAME_WIDTH = 80;
const CONTAINER_PADDING = 32; // 16px on each side
const PHOTO_SPACING = 16; // 8px between each of the 2 gaps
const AVAILABLE_WIDTH = width - SET_NAME_WIDTH - CONTAINER_PADDING - PHOTO_SPACING;
const COLUMN_WIDTH = AVAILABLE_WIDTH / 3;

export default function AllPhotosScreen({ navigation, route }) {
  const { photos, getBeforePhotos, getAfterPhotos, getCombinedPhotos, deleteAllPhotos, createProject, assignPhotosToProject, activeProjectId, deleteProject, setActiveProject, projects } = usePhotos();
  const { userName, location } = useSettings();
  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
  const [fullScreenPhotoSet, setFullScreenPhotoSet] = useState(null); // For combined preview
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [deleteFromStorage, setDeleteFromStorage] = useState(true);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false); // retained but unused to avoid modal
  const [confirmSaveVisible, setConfirmSaveVisible] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedTypes, setSelectedTypes] = useState({ before: true, after: true, combined: false });
  const [selectedFormats, setSelectedFormats] = useState(() => {
    // Default: only square formats enabled by default
    const initial = {};
    Object.keys(TEMPLATE_CONFIGS).forEach((key) => {
      initial[key] = (key === TEMPLATE_TYPES.SQUARE_STACK || key === TEMPLATE_TYPES.SQUARE_SIDE);
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

  const FREE_FORMATS = new Set([TEMPLATE_TYPES.SQUARE_STACK, TEMPLATE_TYPES.SQUARE_SIDE]);
  const handleFormatToggle = (key) => {
    try {
      if (!FREE_FORMATS.has(key)) {
        // Close options first, then show upgrade to avoid modal stacking issues
        setOptionsVisible(false);
        setTimeout(() => setUpgradeVisible(true), 120);
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
    }, 500); // 500ms for long press
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
      // Use active project's exact name if available; otherwise fall back to date-based
      const albumName = (projects?.find?.(p => p.id === activeProjectId)?.name) || createAlbumName(userName, location);
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
        if (!anyFormat) {
          Alert.alert('Select a format', 'Please select at least one combined format.');
          return;
        }

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

        // Calculate total renders needed with per-pair filtering (match preview rules)
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

      const allItems = [...items, ...combinedItems];

      if (allItems.length === 0) {
        Alert.alert('Nothing to Upload', 'Please select at least one photo type with available photos.');
        return;
      }

      setUploading(true);
      setUploadProgress({ current: 0, total: allItems.length });

      const result = await uploadPhotoBatch(allItems, {
        scriptUrl: config.scriptUrl,
        folderId: config.folderId,
        albumName,
        location,
        cleanerName: userName,
        batchSize: 3,
        onProgress: (current, total) => {
          setUploadProgress({ current, total });
        }
      });

      setUploading(false);

      const { successful, failed } = result;
      if (failed.length === 0) {
        Alert.alert(
          'Upload Complete',
          `Successfully uploaded ${successful.length} photo${successful.length > 1 ? 's' : ''} to "${albumName}"`
        );
      } else {
        Alert.alert(
          'Upload Partially Complete',
          `Uploaded ${successful.length} photo${successful.length > 1 ? 's' : ''}, ${failed.length} failed. Please try again.`
        );
      }
    } catch (error) {
      setUploading(false);
      Alert.alert('Upload Failed', error.message || 'An error occurred while uploading');
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
          onPressIn={() => handleLongPressStart(null, photoSet)}
          onPressOut={handleLongPressEnd}
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
        // Before or After column - show individual photo detail
        navigation.navigate('PhotoDetail', { photo });
      }
    };

    return (
      <TouchableOpacity
        key={photoType}
        style={[styles.photoCard, { borderColor }, isLast && styles.photoCardLast]}
        onPress={handlePress}
        onPressIn={() => handleLongPressStart(photo, photoType === 'combined' ? photoSet : null)}
        onPressOut={handleLongPressEnd}
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
        {renderPhotoCard(set.before, '#F2C31B', 'before', set, false)}
        {renderPhotoCard(set.after, '#4A90E2', 'after', set, false)}
        {renderPhotoCard(set.combined, '#52C41A', 'combined', set, true)}
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
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
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
      </View>

      <View style={styles.columnHeaders}>
        <View style={styles.setNamePlaceholder} />
        <Text style={styles.columnHeader}>BEFORE</Text>
        <Text style={styles.columnHeader}>AFTER</Text>
        <Text style={[styles.columnHeader, { marginRight: 0 }]}>COMBINED</Text>
      </View>

      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No photos yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Take some before/after photos to get started
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {ROOMS.map(room => renderRoomSection(room))}
        </ScrollView>
      )}

      {/* Manage Projects button at bottom - only show if photos exist */}
      {photos.length > 0 && (
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

      {/* Confirm Save Modal */}
      <Modal
        visible={confirmSaveVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmSaveVisible(false)}
      >
        <View style={styles.uploadModalContainer}>
          <View style={styles.uploadModalContent}>
            <Text style={styles.uploadModalTitle}>Save Project</Text>
            <Text style={styles.uploadModalProgress}>Edit project name before saving</Text>
            <View style={{ width: '92%', marginTop: 8 }}>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.BORDER,
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16
                }}
                value={projectName}
                onChangeText={setProjectName}
                placeholder="Project name"
                placeholderTextColor={COLORS.GRAY}
              />
            </View>
            <View style={[styles.optionsActionsRow, { width: '92%' }]}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionCancel, styles.actionFlex]} onPress={() => setConfirmSaveVisible(false)}>
                <Text style={styles.actionBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary, styles.actionFlex]}
                onPress={async () => {
                  try {
                    // Ensure unique project name (no overwrite on same day)
                    const existing = projects?.map?.(p => p.name) || [];
                    const base = (projectName || 'Project').replace(/\s+/g, ' ').trim();
                    let finalName = base;
                    if (existing.includes(finalName)) {
                      let i = 2;
                      while (existing.includes(`${i} ${base}`)) i++;
                      finalName = `${i} ${base}`;
                    }
                    const safeName = finalName.replace(/[^a-z0-9_\- ]/gi, '_');
                    const proj = await createProject(safeName);
                    await assignPhotosToProject(proj.id);
                    Alert.alert('Saved', `Project saved as "${safeName}"`);
                  } catch (e) {
                    Alert.alert('Error', e?.message || 'Failed to save project');
                  } finally {
                    setConfirmSaveVisible(false);
                  }
                }}
              >
                <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upgrade Modal */}
      <Modal
        visible={upgradeVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setUpgradeVisible(false)}
      >
        <View style={styles.uploadModalContainer}>
          <View style={styles.uploadModalContent}>
            <Text style={styles.uploadModalTitle}>Upgrade required</Text>
            <Text style={styles.uploadModalProgress}>Unlock more formats with Business</Text>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary, styles.actionFull]}
              onPress={() => setUpgradeVisible(false)}
            >
              <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>Upgrade to Business</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionCancel, styles.actionFull, { marginTop: 8 }]}
              onPress={() => setUpgradeVisible(false)}
            >
              <Text style={styles.actionBtnText}>Not now</Text>
            </TouchableOpacity>
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
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
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
                {/* Default: Square formats at top */}
                <Text style={[styles.optionsSectionLabel, { marginTop: 16 }]}>Square formats</Text>
                <View style={styles.optionsChipsRow}>
                  {[TEMPLATE_TYPES.SQUARE_STACK, TEMPLATE_TYPES.SQUARE_SIDE]
                    .map((key) => (
                      <TouchableOpacity
                        key={key}
                        style={[styles.chip, selectedFormats[key] && styles.chipActive]}
                        onPress={() => handleFormatToggle(key)}
                      >
                        <Text style={[styles.chipText, selectedFormats[key] && styles.chipTextActive]}>
                          {TEMPLATE_CONFIGS[key].name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>

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
                        .filter(([k, cfg]) => cfg.layout === 'stack' && k !== TEMPLATE_TYPES.SQUARE_STACK)
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
                        .filter(([k, cfg]) => cfg.layout === 'sidebyside' && k !== TEMPLATE_TYPES.SQUARE_SIDE)
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
                {/* Load (green) */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide, styles.actionGreen]}
                  onPress={() => {
                    setManageVisible(false);
                    Alert.alert('Load', 'Coming soon');
                  }}
                >
                  <Text style={[styles.actionBtnText, styles.actionPrimaryText]}>📂 Load</Text>
                </TouchableOpacity>

                {/* Save (amber) */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionWide, styles.actionSave]}
                  onPress={() => {
                    setManageVisible(false);
                    const base = createAlbumName(userName, location);
                    const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[^a-z0-9_\- ]/gi, '_');
                    const existing = (projects?.map?.(p => p.name) || []);
                    const existingNorm = new Set(existing.map(normalize));
                    let suggested = base;
                    if (existingNorm.has(normalize(suggested))) {
                      let i = 2;
                      while (existingNorm.has(normalize(`${i} ${base}`))) i++;
                      suggested = `${i} ${base}`;
                    }
                    setProjectName(suggested);
                    setConfirmSaveVisible(true);
                  }}
                >
                  <Text style={[styles.actionBtnText, styles.actionSaveText]}>💾 Save</Text>
                </TouchableOpacity>

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
                    Alert.alert('Share to', 'Coming soon');
                  }}
                >
                  <Text style={[styles.actionBtnText, styles.actionInfoText]}>🔗 Share to</Text>
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

      {/* Confirm Delete Modal removed per user request */}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND
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
    marginTop: -6,
    marginBottom: 6
  },
  projectNameText: {
    fontSize: 12,
    color: COLORS.GRAY
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
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
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
  }
});
