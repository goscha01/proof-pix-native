import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions,
  ScrollView,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { captureRef } from 'react-native-view-shot';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { savePhotoToDevice } from '../services/storage';
import { COLORS, PHOTO_MODES, TEMPLATE_TYPES } from '../constants/rooms';
import { CroppedThumbnail } from '../components/CroppedThumbnail';

const { width, height } = Dimensions.get('window');

// iPhone zoom system using native camera zoom ratios
// Note: expo-camera zoom prop accepts 0-1, where actual zoom depends on device hardware
const ZOOM_PRESETS = {
  ultraWide: { label: '0.5x', zoom: 0, focalLength: 13, fov: 120 },     // Wide angle (zoom = 0)
  wide: { label: '1x', zoom: 0.2, focalLength: 26, fov: 80 },           // Standard view (zoom = 0.2)
  tele: { label: '2x', zoom: 0.4, focalLength: 52, fov: 48 }            // 2x zoom (zoom = 0.4)
};

export default function CameraScreen({ route, navigation }) {
  const { mode, beforePhoto, room } = route.params || {};
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [zoomLevel, setZoomLevel] = useState('wide'); // 'ultraWide', 'wide', or 'tele'
  const [zoom, setZoom] = useState(ZOOM_PRESETS.wide.zoom); // Camera zoom value (0-1)
  const [aspectRatio, setAspectRatio] = useState('4:3'); // '4:3' or '2:3'
  const [selectedBeforePhoto, setSelectedBeforePhoto] = useState(beforePhoto);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef(null);
  const { addPhoto, getBeforePhotos, getUnpairedBeforePhotos } = usePhotos();
  const { cameraMode } = useSettings();

  // Handle zoom change with haptic feedback
  const handleZoomChange = (level) => {
    // Haptic feedback on iOS/Android
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        // Gentle haptic feedback
        const { impactAsync, ImpactFeedbackStyle } = require('expo-haptics');
        impactAsync(ImpactFeedbackStyle.Light);
      } catch (e) {
        // Haptics not available, silently continue
      }
    }

    setZoomLevel(level);
    setZoom(ZOOM_PRESETS[level].zoom);
  };

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Set aspect ratio to match before photo in after mode
  useEffect(() => {
    if (mode === 'after') {
      const activeBeforePhoto = selectedBeforePhoto || beforePhoto;
      if (activeBeforePhoto && activeBeforePhoto.aspectRatio) {
        setAspectRatio(activeBeforePhoto.aspectRatio);
      }
    }
  }, [mode, selectedBeforePhoto, beforePhoto]);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false
      });

      if (mode === 'before') {
        await handleBeforePhoto(photo.uri);
      } else if (mode === 'after') {
        await handleAfterPhoto(photo.uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleBeforePhoto = async (uri) => {
    try {
      // Generate photo name
      const roomPhotos = getBeforePhotos(room);
      const photoNumber = roomPhotos.length + 1;
      const photoName = `${room.charAt(0).toUpperCase() + room.slice(1)} ${photoNumber}`;

      // Save to device
      const savedUri = await savePhotoToDevice(uri, `${room}_${photoName}_BEFORE_${Date.now()}.jpg`);

      // Add to photos
      const newPhoto = {
        id: Date.now(),
        uri: savedUri,
        room,
        mode: PHOTO_MODES.BEFORE,
        name: photoName,
        timestamp: Date.now(),
        aspectRatio
      };

      await addPhoto(newPhoto);

      // Stay in before mode to allow taking more photos
      // User can close camera to see photos in home grid
    } catch (error) {
      console.error('Error saving before photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    }
  };

  const handleAfterPhoto = async (uri) => {
    try {
      // Use selectedBeforePhoto for split mode, or beforePhoto for overlay mode
      const activeBeforePhoto = selectedBeforePhoto || beforePhoto;

      if (!activeBeforePhoto) {
        Alert.alert('Error', 'Please select a before photo first');
        return;
      }

      const beforePhotoId = activeBeforePhoto.id;
      console.log('Taking after photo for:', activeBeforePhoto.name, 'ID:', beforePhotoId);

      // Save to device
      const savedUri = await savePhotoToDevice(
        uri,
        `${activeBeforePhoto.room}_${activeBeforePhoto.name}_AFTER_${Date.now()}.jpg`
      );

      // Add after photo (use same aspect ratio as before photo)
      const afterPhoto = {
        id: Date.now(),
        uri: savedUri,
        room: activeBeforePhoto.room,
        mode: PHOTO_MODES.AFTER,
        name: activeBeforePhoto.name,
        timestamp: Date.now(),
        beforePhotoId: beforePhotoId,
        aspectRatio: activeBeforePhoto.aspectRatio || '4:3'
      };

      console.log('Adding after photo with beforePhotoId:', beforePhotoId);
      await addPhoto(afterPhoto);

      // Wait a moment for state to update
      setTimeout(() => {
        // Auto-advance to next unpaired photo
        const remainingUnpaired = getUnpairedBeforePhotos(activeBeforePhoto.room);
        console.log('Remaining unpaired photos:', remainingUnpaired.length);

        // Filter out the photo we just paired to ensure we don't count it
        const nextUnpaired = remainingUnpaired.filter(p => p.id !== beforePhotoId);
        console.log('Next unpaired after filtering:', nextUnpaired.length);

        if (nextUnpaired.length > 0) {
          // Select the next unpaired photo
          console.log('Moving to next photo:', nextUnpaired[0].name);
          setSelectedBeforePhoto(nextUnpaired[0]);
        } else {
          // All photos paired, go back to main grid
          Alert.alert(
            'All Photos Taken',
            'All after photos have been captured!',
            [
              {
                text: 'OK',
                onPress: () => navigation.navigate('Home')
              }
            ]
          );
        }
      }, 500);
    } catch (error) {
      console.error('Error saving after photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };


  // Render cropped image preview (shows only the area within aspect ratio bounds)
  const renderCroppedImage = (imageUri, showLabel = false, labelText = '') => {
    const containerWidth = width;
    const containerHeight = cameraMode === 'split' ? height / 2 : height;

    let frameWidth, frameHeight;

    // Always leave margin to show dimmed borders on all sides
    const MARGIN = 20;
    const maxWidth = containerWidth - (MARGIN * 2);
    const maxHeight = containerHeight - (MARGIN * 2);

    if (aspectRatio === '4:3') {
      const widthBasedHeight = (maxWidth / 4) * 3;
      const heightBasedWidth = (maxHeight / 3) * 4;

      if (widthBasedHeight <= maxHeight) {
        frameWidth = maxWidth;
        frameHeight = widthBasedHeight;
      } else {
        frameHeight = maxHeight;
        frameWidth = heightBasedWidth;
      }
    } else {
      const widthBasedHeight = (maxWidth / 2) * 3;
      const heightBasedWidth = (maxHeight / 3) * 2;

      if (widthBasedHeight <= maxHeight) {
        frameWidth = maxWidth;
        frameHeight = widthBasedHeight;
      } else {
        frameHeight = maxHeight;
        frameWidth = heightBasedWidth;
      }
    }

    const verticalOffset = (containerHeight - frameHeight) / 2;
    const horizontalOffset = (containerWidth - frameWidth) / 2;

    return (
      <View style={styles.croppedImageContainer}>
        {/* Background image (blurred/dimmed) */}
        <Image source={{ uri: imageUri }} style={styles.splitBeforeImage} resizeMode="cover" />

        {/* Dark overlay to dim the background */}
        <View style={styles.backgroundDim} />

        {/* Cropped view in the center */}
        <View style={[styles.croppedViewport, {
          width: frameWidth,
          height: frameHeight,
          top: verticalOffset,
          left: horizontalOffset
        }]}>
          <Image source={{ uri: imageUri }} style={styles.croppedImage} resizeMode="cover" />
        </View>

        {showLabel && <Text style={styles.splitPhotoLabel}>{labelText}</Text>}
      </View>
    );
  };

  // Render crop overlay to show aspect ratio bounds
  const renderCropOverlay = () => {
    // Calculate the crop frame dimensions based on aspect ratio
    // Phone is always in portrait orientation
    const containerWidth = width;
    const containerHeight = cameraMode === 'split' ? height / 2 : height;

    let frameWidth, frameHeight;

    // Always leave margin to show dimmed borders on all sides
    const MARGIN = 20; // Fixed margin in pixels
    const maxWidth = containerWidth - (MARGIN * 2);
    const maxHeight = containerHeight - (MARGIN * 2);

    if (aspectRatio === '4:3') {
      // 4:3 means width:height = 4:3 (more horizontal, wider rectangle)
      // Fit to the smaller constraint
      const widthBasedHeight = (maxWidth / 4) * 3;
      const heightBasedWidth = (maxHeight / 3) * 4;

      if (widthBasedHeight <= maxHeight) {
        // Width is the constraint
        frameWidth = maxWidth;
        frameHeight = widthBasedHeight;
      } else {
        // Height is the constraint
        frameHeight = maxHeight;
        frameWidth = heightBasedWidth;
      }
    } else {
      // 2:3 means width:height = 2:3 (more vertical, taller rectangle)
      // Fit to the smaller constraint
      const widthBasedHeight = (maxWidth / 2) * 3;
      const heightBasedWidth = (maxHeight / 3) * 2;

      if (widthBasedHeight <= maxHeight) {
        // Width is the constraint
        frameWidth = maxWidth;
        frameHeight = widthBasedHeight;
      } else {
        // Height is the constraint
        frameHeight = maxHeight;
        frameWidth = heightBasedWidth;
      }
    }

    // Center the frame with remaining space distributed evenly
    const verticalOffset = (containerHeight - frameHeight) / 2;
    const horizontalOffset = (containerWidth - frameWidth) / 2;

    return (
      <View style={styles.cropOverlayContainer} pointerEvents="none">
        {/* Top dark overlay - fills from top to frame, full width */}
        <View style={[styles.darkOverlay, {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: verticalOffset
        }]} />

        {/* Left dark overlay - only the middle section height */}
        <View style={[styles.darkOverlay, {
          position: 'absolute',
          top: verticalOffset,
          height: frameHeight,
          left: 0,
          width: horizontalOffset
        }]} />

        {/* Right dark overlay - only the middle section height */}
        <View style={[styles.darkOverlay, {
          position: 'absolute',
          top: verticalOffset,
          height: frameHeight,
          right: 0,
          width: horizontalOffset
        }]} />

        {/* Bottom dark overlay - fills from frame to bottom, full width */}
        <View style={[styles.darkOverlay, {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: verticalOffset
        }]} />

        {/* Frame area - clear center with border */}
        <View style={[styles.frameArea, {
          position: 'absolute',
          top: verticalOffset,
          left: horizontalOffset,
          width: frameWidth,
          height: frameHeight
        }]}>
          {/* Corner brackets */}
          <View style={[styles.frameCorner, styles.frameTopLeft]} />
          <View style={[styles.frameCorner, styles.frameTopRight]} />
          <View style={[styles.frameCorner, styles.frameBottomLeft]} />
          <View style={[styles.frameCorner, styles.frameBottomRight]} />
        </View>
      </View>
    );
  };

  // Render gallery of before photos for split mode
  const renderBeforeGallery = () => {
    if (mode === 'before') {
      // Show all before photos taken in this session
      const beforePhotos = getBeforePhotos(room);

      return (
        <View style={styles.galleryContainer}>
          <Text style={styles.galleryTitle}>Before Photos Taken ({beforePhotos.length})</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryContent}
          >
            {beforePhotos.length === 0 && (
              <Text style={styles.galleryEmptyText}>Take before photos using the button above</Text>
            )}
            {beforePhotos.map((photo) => (
              <View
                key={photo.id}
                style={styles.galleryItem}
              >
                <CroppedThumbnail imageUri={photo.uri} aspectRatio={photo.aspectRatio || '4:3'} size={120} />
                <Text style={styles.galleryItemName}>{photo.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    } else {
      // Show unpaired before photos for selection in after mode
      const unpairedPhotos = getUnpairedBeforePhotos(room);

      return (
        <View style={styles.galleryContainer}>
          <Text style={styles.galleryTitle}>
            {selectedBeforePhoto ? selectedBeforePhoto.name : 'Select Before Photo'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryContent}
          >
            {unpairedPhotos.length === 0 && (
              <Text style={styles.galleryEmptyText}>All before photos have been paired!</Text>
            )}
            {unpairedPhotos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={[
                  styles.galleryItem,
                  selectedBeforePhoto?.id === photo.id && styles.galleryItemSelected
                ]}
                onPress={() => setSelectedBeforePhoto(photo)}
              >
                <CroppedThumbnail imageUri={photo.uri} aspectRatio={photo.aspectRatio || '4:3'} size={120} />
                <Text style={styles.galleryItemName}>{photo.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }
  };

  // Render overlay mode (current implementation)
  const renderOverlayMode = () => (
    <View style={styles.container}>
      {/* Camera preview with before photo overlay (for after mode) */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          zoom={zoom}
          enableZoomGesture={true}
        />
        {/* Before photo overlay (for after mode) */}
        {mode === 'after' && beforePhoto && (
          <View style={styles.beforePhotoOverlay}>
            <Image
              source={{ uri: beforePhoto.uri }}
              style={styles.beforePhotoImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Aspect ratio cropping overlay */}
        {renderCropOverlay()}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Close button - top right */}
        <TouchableOpacity
          style={styles.closeButtonTopRight}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.bottomControls}>
          {/* Zoom presets - above capture button */}
          <View style={styles.zoomContainer}>
            <View style={styles.zoomButtons}>
              <TouchableOpacity
                style={[styles.zoomPresetButton, zoomLevel === 'ultraWide' && styles.zoomPresetButtonActive]}
                onPress={() => handleZoomChange('ultraWide')}
              >
                <Text style={[styles.zoomPresetText, zoomLevel === 'ultraWide' && styles.zoomPresetTextActive]}>
                  {ZOOM_PRESETS.ultraWide.label}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoomPresetButton, zoomLevel === 'wide' && styles.zoomPresetButtonActive]}
                onPress={() => handleZoomChange('wide')}
              >
                <Text style={[styles.zoomPresetText, zoomLevel === 'wide' && styles.zoomPresetTextActive]}>
                  {ZOOM_PRESETS.wide.label}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoomPresetButton, zoomLevel === 'tele' && styles.zoomPresetButtonActive]}
                onPress={() => handleZoomChange('tele')}
              >
                <Text style={[styles.zoomPresetText, zoomLevel === 'tele' && styles.zoomPresetTextActive]}>
                  {ZOOM_PRESETS.tele.label}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Main control row */}
          <View style={styles.mainControlRow}>
            {/* Aspect ratio selector - left side (absolute positioned) */}
            {mode === 'before' ? (
              <View style={styles.aspectRatioContainer}>
                <TouchableOpacity
                  style={[
                    styles.aspectRatioButton,
                    aspectRatio === '4:3' && styles.aspectRatioButtonActive
                  ]}
                  onPress={() => setAspectRatio('4:3')}
                >
                  <Text
                    style={[
                      styles.aspectRatioText,
                      aspectRatio === '4:3' && styles.aspectRatioTextActive
                    ]}
                  >
                    4:3
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.aspectRatioButton,
                    aspectRatio === '2:3' && styles.aspectRatioButtonActive
                  ]}
                  onPress={() => setAspectRatio('2:3')}
                >
                  <Text
                    style={[
                      styles.aspectRatioText,
                      aspectRatio === '2:3' && styles.aspectRatioTextActive
                    ]}
                  >
                    2:3
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.aspectRatioContainer}>
                <View style={[styles.aspectRatioButton, styles.aspectRatioButtonLocked]}>
                  <Text style={[styles.aspectRatioText, styles.aspectRatioTextActive]}>
                    {aspectRatio}
                  </Text>
                </View>
              </View>
            )}

            {/* Capture button - center (no absolute positioning needed, centered by parent) */}
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            {/* Save button - right side (absolute positioned) */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.saveButtonText}>💾</Text>
              <Text style={styles.saveButtonLabel}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  // Render split screen mode
  const renderSplitMode = () => {
    if (mode === 'before') {
      // Before mode: Camera on top, Gallery on bottom (50/50 split)
      return (
        <View style={styles.container}>
          {/* Close button - top right */}
          <TouchableOpacity
            style={styles.closeButtonTopRight}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.splitHalfContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              zoom={zoom}
              enableZoomGesture={true}
            />
            {/* Aspect ratio cropping overlay */}
            {renderCropOverlay()}
          </View>

          <View style={styles.splitHalfContainer}>
            {renderBeforeGallery()}
          </View>

          {/* Controls at bottom */}
          <View style={styles.splitBottomControls}>
            {/* Zoom presets - above other controls */}
            <View style={styles.zoomContainer}>
              <View style={styles.zoomButtons}>
                <TouchableOpacity style={[styles.zoomPresetButton, zoomLevel === 'ultraWide' && styles.zoomPresetButtonActive]} onPress={() => handleZoomChange('ultraWide')}>
                  <Text style={[styles.zoomPresetText, zoomLevel === 'ultraWide' && styles.zoomPresetTextActive]}>{ZOOM_PRESETS.ultraWide.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.zoomPresetButton, zoomLevel === 'wide' && styles.zoomPresetButtonActive]} onPress={() => handleZoomChange('wide')}>
                  <Text style={[styles.zoomPresetText, zoomLevel === 'wide' && styles.zoomPresetTextActive]}>{ZOOM_PRESETS.wide.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.zoomPresetButton, zoomLevel === 'tele' && styles.zoomPresetButtonActive]} onPress={() => handleZoomChange('tele')}>
                  <Text style={[styles.zoomPresetText, zoomLevel === 'tele' && styles.zoomPresetTextActive]}>{ZOOM_PRESETS.tele.label}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Main control row */}
            <View style={styles.mainControlRow}>
              {/* Aspect ratio on left */}
              <View style={styles.aspectRatioContainer}>
                <TouchableOpacity
                  style={[styles.aspectRatioButton, aspectRatio === '4:3' && styles.aspectRatioButtonActive]}
                  onPress={() => setAspectRatio('4:3')}
                >
                  <Text style={[styles.aspectRatioText, aspectRatio === '4:3' && styles.aspectRatioTextActive]}>4:3</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aspectRatioButton, aspectRatio === '2:3' && styles.aspectRatioButtonActive]}
                  onPress={() => setAspectRatio('2:3')}
                >
                  <Text style={[styles.aspectRatioText, aspectRatio === '2:3' && styles.aspectRatioTextActive]}>2:3</Text>
                </TouchableOpacity>
              </View>

              {/* Capture button in center */}
              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              {/* Save button on right */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => navigation.navigate('Home')}
              >
                <Text style={styles.saveButtonText}>💾</Text>
                <Text style={styles.saveButtonLabel}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    } else {
      // After mode: Camera on top, Selected before photo on bottom (50/50 split)
      return (
        <View style={styles.container}>
          {/* Close button - top right */}
          <TouchableOpacity
            style={styles.closeButtonTopRight}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.splitHalfContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={facing}
              zoom={zoom}
              enableZoomGesture={true}
            />
            {/* Aspect ratio cropping overlay */}
            {renderCropOverlay()}
          </View>

          {selectedBeforePhoto && (
            <View style={styles.splitHalfContainer}>
              {renderCroppedImage(selectedBeforePhoto.uri, true, selectedBeforePhoto.name)}
            </View>
          )}

          {/* Controls at bottom */}
          <View style={styles.splitBottomControls}>
            {/* Zoom presets - above other controls */}
            <View style={styles.zoomContainer}>
              <View style={styles.zoomButtons}>
                <TouchableOpacity style={[styles.zoomPresetButton, zoomLevel === 'ultraWide' && styles.zoomPresetButtonActive]} onPress={() => handleZoomChange('ultraWide')}>
                  <Text style={[styles.zoomPresetText, zoomLevel === 'ultraWide' && styles.zoomPresetTextActive]}>{ZOOM_PRESETS.ultraWide.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.zoomPresetButton, zoomLevel === 'wide' && styles.zoomPresetButtonActive]} onPress={() => handleZoomChange('wide')}>
                  <Text style={[styles.zoomPresetText, zoomLevel === 'wide' && styles.zoomPresetTextActive]}>{ZOOM_PRESETS.wide.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.zoomPresetButton, zoomLevel === 'tele' && styles.zoomPresetButtonActive]} onPress={() => handleZoomChange('tele')}>
                  <Text style={[styles.zoomPresetText, zoomLevel === 'tele' && styles.zoomPresetTextActive]}>{ZOOM_PRESETS.tele.label}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Main control row */}
            <View style={styles.mainControlRow}>
              {/* Show locked aspect ratio (matching before photo) */}
              <View style={styles.aspectRatioContainer}>
                <View style={[styles.aspectRatioButton, styles.aspectRatioButtonLocked]}>
                  <Text style={[styles.aspectRatioText, styles.aspectRatioTextActive]}>{aspectRatio}</Text>
                </View>
              </View>

              {/* Capture button in center */}
              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>

              {/* Save button on right */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => navigation.navigate('Home')}
              >
                <Text style={styles.saveButtonText}>💾</Text>
                <Text style={styles.saveButtonLabel}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }
  };

  return cameraMode === 'split' ? renderSplitMode() : renderOverlayMode();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black'
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
    fontSize: 16
  },
  permissionButton: {
    backgroundColor: COLORS.PRIMARY,
    padding: 16,
    borderRadius: 8,
    margin: 20
  },
  permissionButtonText: {
    color: COLORS.TEXT,
    textAlign: 'center',
    fontWeight: 'bold'
  },
  cameraContainer: {
    flex: 1
  },
  camera: {
    flex: 1
  },
  beforePhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  beforePhotoImage: {
    width: '100%',
    height: '100%'
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end'
  },
  closeButtonTopRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  flipButtonText: {
    fontSize: 24
  },
  bottomControls: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20
  },
  mainControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative'
  },
  modeInfo: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20
  },
  modeText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '600'
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.PRIMARY
  },
  zoomContainer: {
    alignItems: 'center',
    marginBottom: 20
  },
  zoomButtons: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 24,
    backdropFilter: 'blur(10px)'
  },
  saveButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    position: 'absolute',
    right: 10
  },
  saveButtonText: {
    fontSize: 28,
    marginBottom: 2
  },
  saveButtonLabel: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    fontWeight: '600'
  },
  zoomPresetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7
  },
  zoomPresetButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 1,
    transform: [{ scale: 1.1 }]
  },
  zoomPresetText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  zoomPresetTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: '700'
  },
  aspectRatioContainer: {
    flexDirection: 'column',
    gap: 8,
    width: 80,
    position: 'absolute',
    left: 10
  },
  aspectRatioButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center'
  },
  aspectRatioButtonActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY
  },
  aspectRatioButtonLocked: {
    backgroundColor: 'rgba(242, 195, 27, 0.3)',
    borderColor: COLORS.PRIMARY,
    opacity: 0.7
  },
  aspectRatioText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },
  aspectRatioTextActive: {
    color: COLORS.TEXT
  },
  photoFrameGuide: {
    position: 'absolute',
    top: '5%',
    left: '5%',
    right: '5%',
    bottom: '5%',
    borderWidth: 2,
    borderColor: 'rgba(242, 195, 27, 0.6)',
    borderStyle: 'dashed'
  },
  frameCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: COLORS.PRIMARY
  },
  frameTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4
  },
  frameTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4
  },
  frameBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4
  },
  frameBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4
  },
  // Crop overlay styles
  cropOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  darkOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)'
  },
  frameArea: {
    position: 'relative',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY
  },
  // Split mode styles
  splitHalfContainer: {
    flex: 1,
    position: 'relative'
  },
  galleryContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY,
    paddingVertical: 10
  },
  galleryContent: {
    paddingHorizontal: 10,
    gap: 10
  },
  galleryTitle: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 10,
    textAlign: 'left'
  },
  galleryItem: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    marginRight: 10
  },
  galleryItemSelected: {
    borderColor: COLORS.PRIMARY
  },
  galleryImage: {
    width: 120,
    height: 120,
    backgroundColor: '#333'
  },
  galleryItemName: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.7)'
  },
  galleryEmptyText: {
    color: COLORS.GRAY,
    fontSize: 14,
    fontStyle: 'italic',
    padding: 20,
    textAlign: 'center'
  },
  splitBeforeImage: {
    width: '100%',
    height: '100%'
  },
  croppedImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000'
  },
  backgroundDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)'
  },
  croppedViewport: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY
  },
  croppedImage: {
    width: '100%',
    height: '100%'
  },
  thumbnailContainer: {
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden'
  },
  thumbnailBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000'
  },
  thumbnailCropped: {
    position: 'absolute',
    overflow: 'hidden'
  },
  thumbnailImage: {
    width: '100%',
    height: '100%'
  },
  splitPhotoLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: 'bold'
  },
  splitBottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.7)'
  }
});
