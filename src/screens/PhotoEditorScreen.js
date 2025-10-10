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
    
    // Use stacked if EITHER phone is landscape OR camera view is landscape (letterbox)
    if (phoneOrientation === 'landscape' || cameraViewMode === 'landscape') {
      // STACKED combined photos (horizontal split)
      return TEMPLATE_TYPES.STACK_PORTRAIT;
    } else {
      // SIDE-BY-SIDE combined photos (vertical split)
      return TEMPLATE_TYPES.SIDE_BY_SIDE_LANDSCAPE;
    }
  };

  const [templateType, setTemplateType] = useState(getDefaultTemplate());
  const [saving, setSaving] = useState(false);
  const combinedRef = useRef(null);
  const { addPhoto, getUnpairedBeforePhotos } = usePhotos();
  const { showLabels } = useSettings();
  const templateTypeRef = useRef(templateType);

  // Update ref when templateType changes
  useEffect(() => {
    templateTypeRef.current = templateType;
  }, [templateType]);

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
          navigation.goBack();
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

  // Filter templates based on PHONE ORIENTATION or CAMERA VIEW MODE
  // Landscape phone position OR landscape camera view → only stacked templates
  // Portrait phone position AND portrait camera view → only side-by-side templates
  const getAvailableTemplates = () => {
    const phoneOrientation = beforePhoto.orientation || 'portrait';
    const cameraViewMode = beforePhoto.cameraViewMode || 'portrait';
    const allTemplates = Object.entries(TEMPLATE_CONFIGS);

    console.log('Filtering templates - Phone:', phoneOrientation, 'Camera view:', cameraViewMode);

    // Use stacked if EITHER phone is landscape OR camera view is landscape (letterbox)
    if (phoneOrientation === 'landscape' || cameraViewMode === 'landscape') {
      // Only STACKED layouts (horizontal split, top/bottom)
      const filtered = allTemplates.filter(([key, config]) => config.layout === 'stack');
      console.log('Landscape mode - filtered templates (stack only):', filtered.map(([k, c]) => c.name));
      return filtered;
    } else {
      // Only SIDE-BY-SIDE layouts (vertical split, left/right)
      const filtered = allTemplates.filter(([key, config]) => config.layout === 'sidebyside');
      console.log('Portrait mode - filtered templates (side-by-side only):', filtered.map(([k, c]) => c.name));
      return filtered;
    }
  };

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
    const config = TEMPLATE_CONFIGS[templateType];
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
          onPress={() => navigation.goBack()}
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
