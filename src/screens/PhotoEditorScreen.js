import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { savePhotoToDevice } from '../services/storage';
import { COLORS, PHOTO_MODES, TEMPLATE_TYPES, TEMPLATE_CONFIGS } from '../constants/rooms';

export default function PhotoEditorScreen({ route, navigation }) {
  const { beforePhoto, afterPhoto } = route.params;

  // Set default template based on aspect ratio
  // 4:3 (horizontal) → stacked (top/bottom), 2:3 (vertical) → side-by-side (left/right)
  const getDefaultTemplate = () => {
    const aspectRatio = beforePhoto.aspectRatio || '4:3';
    if (aspectRatio === '4:3') {
      // Horizontal photos (4:3) create STACKED combined photos (vertical split)
      return TEMPLATE_TYPES.STACK_PORTRAIT;
    } else {
      // Vertical photos (2:3) create SIDE-BY-SIDE combined photos (horizontal split)
      return TEMPLATE_TYPES.SIDE_BY_SIDE_LANDSCAPE;
    }
  };

  const [templateType, setTemplateType] = useState(getDefaultTemplate());
  const [saving, setSaving] = useState(false);
  const combinedRef = useRef(null);
  const { addPhoto, getUnpairedBeforePhotos } = usePhotos();
  const { showLabels } = useSettings();

  // Filter templates based on aspect ratio
  // 4:3 (horizontal) → only stacked templates, 2:3 (vertical) → only side-by-side templates
  const getAvailableTemplates = () => {
    const aspectRatio = beforePhoto.aspectRatio || '4:3';
    const allTemplates = Object.entries(TEMPLATE_CONFIGS);

    console.log('Filtering templates for aspect ratio:', aspectRatio);

    if (aspectRatio === '4:3') {
      // Horizontal photos (4:3): only STACKED layouts (top/bottom split)
      const filtered = allTemplates.filter(([key, config]) => config.layout === 'stack');
      console.log('4:3 (horizontal) filtered templates (stack only):', filtered.map(([k, c]) => c.name));
      return filtered;
    } else {
      // Vertical photos (2:3): only SIDE-BY-SIDE layouts (left/right split)
      const filtered = allTemplates.filter(([key, config]) => config.layout === 'sidebyside');
      console.log('2:3 (vertical) filtered templates (side-by-side only):', filtered.map(([k, c]) => c.name));
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
        templateType
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
    const aspectRatio = config.width / config.height;

    let previewWidth, previewHeight;
    if (aspectRatio > 1) {
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
    <View style={styles.container}>
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
    padding: 20
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
