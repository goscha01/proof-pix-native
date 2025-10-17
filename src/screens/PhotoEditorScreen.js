import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  PanResponder
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { savePhotoToDevice } from '../services/storage';
import { COLORS, PHOTO_MODES, TEMPLATE_TYPES, TEMPLATE_CONFIGS } from '../constants/rooms';

export default function PhotoEditorScreen({ route, navigation }) {
  const { beforePhoto, afterPhoto } = route.params;

  // Set default template based on PHONE ORIENTATION or CAMERA VIEW MODE
  // Landscape phone position OR landscape camera view → stacked (horizontal split)
  // Portrait phone position AND portrait camera view → side-by-side (vertical split)
  const getDefaultTemplate = () => {
    const phoneOrientation = beforePhoto.orientation || 'portrait';
    const cameraViewMode = beforePhoto.cameraViewMode || 'portrait';
    console.log('PhotoEditor - Phone orientation:', phoneOrientation, 'Camera view mode:', cameraViewMode);
    // Prefer original layout first
    if (phoneOrientation === 'landscape' || cameraViewMode === 'landscape') {
      return 'original-stack';
    }
    return 'original-side';
  };

  const [templateType, setTemplateType] = useState(getDefaultTemplate());
  const [saving, setSaving] = useState(false);
  const combinedRef = useRef(null);
  const { addPhoto, getUnpairedBeforePhotos } = usePhotos();
  const { showLabels } = useSettings();
  const templateTypeRef = useRef(templateType);
  const [originalBaseUris, setOriginalBaseUris] = useState({ stack: null, side: null });
  const [originalImageSize, setOriginalImageSize] = useState(null); // { width, height }

  // Update ref when templateType changes
  useEffect(() => {
    templateTypeRef.current = templateType;
  }, [templateType]);

  // Locate saved original base images for this pair (if any)
  useEffect(() => {
    (async () => {
      try {
        const dir = FileSystem.documentDirectory;
        if (!dir) return;
        const safeName = (beforePhoto.name || 'Photo').replace(/\s+/g, '_');
        const prefixStack = `${beforePhoto.room}_${safeName}_COMBINED_BASE_STACK_`;
        const prefixSide = `${beforePhoto.room}_${safeName}_COMBINED_BASE_SIDE_`;
        const entries = await FileSystem.readDirectoryAsync(dir);
        let stack = null;
        let side = null;
        for (const name of entries) {
          if (!stack && name.startsWith(prefixStack)) stack = `${dir}${name}`;
          if (!side && name.startsWith(prefixSide)) side = `${dir}${name}`;
          if (stack && side) break;
        }
        setOriginalBaseUris({ stack, side });
      } catch (e) {
        // ignore
      }
    })();
  }, [beforePhoto]);

  // PanResponder for swipe gestures
  const handleSwipeChangeTemplate = (direction) => {
    const templates = getAvailableTemplates();
    const currentIndex = templates.findIndex(([key]) => key === templateTypeRef.current);
    
    console.log('Swipe detected:', direction, 'Current:', templateTypeRef.current, 'Index:', currentIndex, 'Total:', templates.length);
    
    if (direction === 'left' && currentIndex < templates.length - 1) {
      // Swipe left - next template
      const nextTemplate = templates[currentIndex + 1][0];
      console.log('Setting next template:', nextTemplate);
      setTemplateType(nextTemplate);
    } else if (direction === 'right' && currentIndex > 0) {
      // Swipe right - previous template
      const prevTemplate = templates[currentIndex - 1][0];
      console.log('Setting previous template:', prevTemplate);
      setTemplateType(prevTemplate);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dy, dx } = gestureState;
        // Activate for downward swipes or strong horizontal swipes
        return Math.abs(dy) > 10 || Math.abs(dx) > 10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy, dx } = gestureState;
        
        // Swipe down to close
        if (dy > 100 && Math.abs(dx) < 50) {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Home');
          }
          return;
        }
        
        // Swipe left/right to change template
        if (Math.abs(dx) > 80 && Math.abs(dy) < 50) {
          if (dx < 0) {
            handleSwipeChangeTemplate('left');
          } else if (dx > 0) {
            handleSwipeChangeTemplate('right');
          }
        }
      }
    })
  ).current;

  // Filter templates based on PHONE ORIENTATION and CAMERA VIEW MODE
  // Letterbox mode (landscape camera view) → ALL templates available
  // Landscape phone position → only stacked templates
  // Portrait phone position AND portrait camera view → only side-by-side templates
  const getOriginalTemplateConfigs = () => {
    const phoneOrientation = beforePhoto.orientation || 'portrait';
    const cameraViewMode = beforePhoto.cameraViewMode || 'portrait';
    const isLandscape = phoneOrientation === 'landscape' || cameraViewMode === 'landscape';
    // Base sizes for preview (used only for container sizing when showing original image)
    const portraitW = 1080;
    const portraitH = 1620; // ~2:3
    const landscapeW = 1920;
    const landscapeH = 1080; // 16:9
    const hasStack = !!originalBaseUris.stack;
    const hasSide = !!originalBaseUris.side;
    const showSide = !isLandscape || cameraViewMode === 'landscape'; // portrait: only side; letterbox: side too
    const showStack = isLandscape; // landscape or letterbox: stack
    const configs = {};
    if (showStack && hasStack) configs['original-stack'] = { name: 'Original', width: landscapeW, height: landscapeH, layout: 'stack' };
    if (showSide && hasSide) configs['original-side'] = { name: 'Original', width: portraitW, height: portraitH, layout: 'sidebyside' };
    const preferredKey = isLandscape ? (hasStack ? 'original-stack' : (hasSide ? 'original-side' : null)) : (hasSide ? 'original-side' : (hasStack ? 'original-stack' : null));
    return { ...configs, preferredKey };
  };

  const getTemplateConfig = (key) => {
    const originals = getOriginalTemplateConfigs();
    if (key === 'original-stack' || key === 'original-side') return originals[key];
    return TEMPLATE_CONFIGS[key];
  };

  // Choose a safe default template key based on orientation
  const getFallbackTemplateKey = () => {
    const phoneOrientation = beforePhoto.orientation || 'portrait';
    const cameraViewMode = beforePhoto.cameraViewMode || 'portrait';
    const isLandscape = phoneOrientation === 'landscape' || cameraViewMode === 'landscape';
    return isLandscape ? TEMPLATE_TYPES.STACK_PORTRAIT : TEMPLATE_TYPES.SIDE_BY_SIDE_LANDSCAPE;
  };

  const getAvailableTemplates = () => {
    const phoneOrientation = beforePhoto.orientation || 'portrait';
    const cameraViewMode = beforePhoto.cameraViewMode || 'portrait';
    const allTemplates = Object.entries(TEMPLATE_CONFIGS);
    const originals = getOriginalTemplateConfigs();
    console.log('Filtering templates - Phone:', phoneOrientation, 'Camera view:', cameraViewMode);

    // Build base list filtered by layout
    let filtered;
    if (cameraViewMode === 'landscape') {
      filtered = allTemplates;
    } else if (phoneOrientation === 'landscape') {
      filtered = allTemplates.filter(([key, config]) => config.layout === 'stack');
    } else {
      filtered = allTemplates.filter(([key, config]) => config.layout === 'sidebyside');
    }
    // Prepend available original templates (preferred first)
    const originalEntries = Object.entries(originals).filter(([k]) => k !== 'preferredKey');
    const preferred = originals.preferredKey;
    originalEntries.sort((a, b) => (a[0] === preferred ? -1 : b[0] === preferred ? 1 : 0));
    return [...originalEntries, ...filtered];
  };

  // Normalize selected template when originals aren’t available yet
  useEffect(() => {
    const originals = getOriginalTemplateConfigs();
    const isOriginalKey = templateType === 'original-stack' || templateType === 'original-side';
    if (isOriginalKey && !originals[templateType]) {
      // Prefer preferred original if it exists; otherwise use orientation fallback
      if (originals.preferredKey && originals[originals.preferredKey]) {
        setTemplateType(originals.preferredKey);
      } else {
        setTemplateType(getFallbackTemplateKey());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalBaseUris.stack, originalBaseUris.side, beforePhoto?.id]);

  // Measure selected original image size to preserve exact aspect without cropping
  useEffect(() => {
    const uri = templateType === 'original-stack' ? originalBaseUris.stack : templateType === 'original-side' ? originalBaseUris.side : null;
    if (!uri) {
      setOriginalImageSize(null);
      return;
    }
    Image.getSize(
      uri,
      (w, h) => setOriginalImageSize({ width: w, height: h }),
      () => setOriginalImageSize(null)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateType, originalBaseUris.stack, originalBaseUris.side]);

  const saveCombinedPhoto = async () => {
    try {
      setSaving(true);

      // Capture the combined view as an image
      const uri = await captureRef(combinedRef, {
        format: 'jpg',
        quality: 0.9
      });

      // Save to device
      const savedUri = await savePhotoToDevice(
        uri,
        `${beforePhoto.room}_${beforePhoto.name}_COMBINED_${templateType}_${Date.now()}.jpg`
      );

      // Add combined photo
      const combinedPhoto = {
        id: Date.now(),
        uri: savedUri,
        room: beforePhoto.room,
        mode: PHOTO_MODES.COMBINED,
        name: beforePhoto.name,
        timestamp: Date.now(),
        templateType,
        orientation: beforePhoto.orientation || 'portrait',
        cameraViewMode: beforePhoto.cameraViewMode || 'portrait'
      };

      console.log('Saving combined photo:', combinedPhoto);
      await addPhoto(combinedPhoto);

      // Return to main grid after saving combined photo
      Alert.alert(
        'Success',
        'Combined photo saved!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Home')
          }
        ]
      );
    } catch (error) {
      console.error('Error saving combined photo:', error);
      Alert.alert('Error', 'Failed to save combined photo');
    } finally {
      setSaving(false);
    }
  };

  const renderCombinedPreview = () => {
    let config = getTemplateConfig(templateType);
    if (!config) {
      // Guard against undefined (e.g., original not present yet)
      config = TEMPLATE_CONFIGS[getFallbackTemplateKey()];
    }
    const isStack = config.layout === 'stack';
    const isSideBySide = config.layout === 'sidebyside';

    // Calculate preview dimensions to fit on screen
    const maxWidth = 350;
    const maxHeight = 500;
    const maxSquareSize = 320; // Smaller size for square formats
    const aspectRatio = config.width / config.height;

    let previewWidth, previewHeight;
    if (aspectRatio === 1) {
      // Square format - make it smaller
      previewWidth = maxSquareSize;
      previewHeight = maxSquareSize;
    } else if (aspectRatio > 1) {
      // Landscape
      previewWidth = maxWidth;
      previewHeight = maxWidth / aspectRatio;
    } else {
      // Portrait
      previewHeight = maxHeight;
      previewWidth = maxHeight * aspectRatio;
    }

    // If an original base is selected and available, display the saved image (no cropping)
    if ((templateType === 'original-stack' && originalBaseUris.stack) || (templateType === 'original-side' && originalBaseUris.side)) {
      const uri = templateType === 'original-stack' ? originalBaseUris.stack : originalBaseUris.side;
      // Fit inside max box while preserving original aspect
      const maxW = 350;
      const maxH = 500;
      let ow = originalImageSize?.width || maxW;
      let oh = originalImageSize?.height || maxH;
      let ratio = ow && oh ? ow / oh : 1;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) {
        h = maxH;
        w = h * ratio;
      }
      return (
        <View
          ref={combinedRef}
          style={[styles.combinedPreview, { width: w, height: h }]}
          collapsable={false}
        >
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </View>
      );
    }

    return (
      <View
        ref={combinedRef}
        style={[
          styles.combinedPreview,
          {
            width: previewWidth,
            height: previewHeight,
            flexDirection: isStack ? 'column' : 'row'
          }
        ]}
        collapsable={false}
      >
        <View style={styles.halfContainer}>
          <Image
            source={{ uri: beforePhoto.uri }}
            style={styles.halfImage}
            resizeMode="cover"
          />
          {showLabels && (
            <View style={styles.label}>
              <Text style={styles.labelText}>BEFORE</Text>
            </View>
          )}
        </View>

        <View style={[styles.halfContainer, isStack && styles.topBorder, isSideBySide && styles.leftBorder]}>
          <Image
            source={{ uri: afterPhoto.uri }}
            style={styles.halfImage}
            resizeMode="cover"
          />
          {showLabels && (
            <View style={styles.label}>
              <Text style={styles.labelText}>AFTER</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Swipe down indicator */}
      <View style={styles.swipeIndicator}>
        <View style={styles.swipeHandle} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          }}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Combined Photo</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.previewContainer}>
        {renderCombinedPreview()}
        
        {/* Swipe indicators */}
        <View style={styles.swipeIndicators}>
          <Text style={styles.swipeHint}>← Swipe to change format →</Text>
          {(() => {
            const templates = getAvailableTemplates();
            const currentIndex = templates.findIndex(([key]) => key === templateType);
            return (
              <View style={styles.dotsContainer}>
                {templates.map(([key], index) => (
                  <View
                    key={key}
                    style={[
                      styles.dot,
                      index === currentIndex && styles.dotActive
                    ]}
                  />
                ))}
              </View>
            );
          })()}
        </View>
      </View>

      <View style={styles.templateSelector}>
        <Text style={styles.selectorTitle}>Choose Template:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.templateScrollContent}
        >
          {getAvailableTemplates().map(([key, config]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.templateButton,
                templateType === key && styles.templateButtonActive
              ]}
              onPress={() => setTemplateType(key)}
            >
              <Text
                style={[
                  styles.templateButtonText,
                  templateType === key && styles.templateButtonTextActive
                ]}
              >
                {config.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveCombinedPhoto}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={COLORS.TEXT} />
        ) : (
          <Text style={styles.saveButtonText}>Save Combined Photo</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND
  },
  swipeIndicator: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10
  },
  swipeHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60
  },
  backButton: {
    width: 60
  },
  backButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 18
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    position: 'relative'
  },
  swipeIndicators: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  swipeHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc'
  },
  dotActive: {
    backgroundColor: COLORS.PRIMARY,
    width: 24
  },
  combinedPreview: {
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5
  },
  halfContainer: {
    flex: 1,
    position: 'relative'
  },
  topBorder: {
    borderTopWidth: 2,
    borderTopColor: COLORS.PRIMARY
  },
  leftBorder: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.PRIMARY
  },
  halfImage: {
    width: '100%',
    height: '100%'
  },
  label: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  labelText: {
    color: COLORS.TEXT,
    fontSize: 12,
    fontWeight: 'bold'
  },
  templateSelector: {
    paddingHorizontal: 20,
    paddingBottom: 10
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 12
  },
  templateScrollContent: {
    gap: 10,
    paddingRight: 20
  },
  templateButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    minWidth: 120
  },
  templateButtonActive: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY
  },
  templateButtonText: {
    color: COLORS.GRAY,
    fontWeight: '600'
  },
  templateButtonTextActive: {
    color: COLORS.TEXT
  },
  saveButton: {
    margin: 20,
    backgroundColor: COLORS.PRIMARY,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center'
  },
  saveButtonDisabled: {
    opacity: 0.5
  },
  saveButtonText: {
    color: COLORS.TEXT,
    fontSize: 18,
    fontWeight: 'bold'
  }
});
