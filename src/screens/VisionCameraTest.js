import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Dimensions, Platform } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCameraFormat } from 'react-native-vision-camera';
import { savePhotoToDevice } from '../services/storage';

export default function VisionCameraTest({ navigation }) {
  const camera = useRef(null);
  const [cameraType, setCameraType] = useState('wide-angle-camera'); // 'wide-angle-camera' or 'ultra-wide-angle-camera'
  const device = useCameraDevice('back', {
    physicalDevices: [cameraType]
  });
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  // Calculate target aspect ratio based on screen (matching CameraScreen logic for iOS portrait)
  const targetAspectRatio = useMemo(() => {
    const screenWidth = dimensions.width;
    const screenHeight = dimensions.height;
    const isLandscape = screenWidth > screenHeight;

    // iOS logic: use screen aspect ratio for portrait mode
    const ratio = isLandscape
      ? screenWidth / screenHeight
      : screenHeight / screenWidth;

    console.log(`📱 Screen: ${screenWidth}x${screenHeight}, Target ratio: ${ratio.toFixed(2)}:1`);
    return ratio;
  }, [dimensions]);

  // Select format matching screen aspect ratio with maximum resolution
  const format = useMemo(() => {
    if (!device?.formats) return undefined;

    // Log ALL available formats
    console.log('🎥 ========== AVAILABLE FORMATS ==========');
    device.formats.forEach((f, i) => {
      const ratio = Math.max(f.photoWidth, f.photoHeight) / Math.min(f.photoWidth, f.photoHeight);
      const mp = (f.photoWidth * f.photoHeight / 1000000).toFixed(1);
      console.log(`  ${i}: ${f.photoWidth}x${f.photoHeight} (${mp}MP, ratio: ${ratio.toFixed(2)}:1) - minZoom: ${f.minZoom?.toFixed(2)}, maxZoom: ${f.maxZoom?.toFixed(2)}`);
    });
    console.log('==========================================');

    // Find formats close to target aspect ratio
    const matchingFormats = device.formats.filter(f => {
      const formatRatio = Math.max(f.photoWidth, f.photoHeight) / Math.min(f.photoWidth, f.photoHeight);
      const diff = Math.abs(formatRatio - targetAspectRatio);
      return diff < 0.5; // Increased tolerance to 0.5 (2.17 vs 1.78 = 0.39 diff)
    });

    console.log(`🔍 Found ${matchingFormats.length} formats matching ratio ${targetAspectRatio.toFixed(2)}:1 (±0.5)`);

    let selected;
    if (matchingFormats.length > 0) {
      // Sort by total pixels (highest first)
      const sorted = matchingFormats.sort((a, b) => {
        const aPixels = a.photoWidth * a.photoHeight;
        const bPixels = b.photoWidth * b.photoHeight;
        return bPixels - aPixels;
      });
      selected = sorted[0];
    } else {
      // No match found - find the CLOSEST ratio and pick highest resolution
      console.log('⚠️ No formats within tolerance. Finding closest ratio...');
      const withDiff = device.formats.map(f => {
        const formatRatio = Math.max(f.photoWidth, f.photoHeight) / Math.min(f.photoWidth, f.photoHeight);
        return {
          format: f,
          diff: Math.abs(formatRatio - targetAspectRatio),
          ratio: formatRatio
        };
      });

      // Sort by difference, then by total pixels
      withDiff.sort((a, b) => {
        if (Math.abs(a.diff - b.diff) < 0.01) {
          // Similar difference - pick higher resolution
          const aPixels = a.format.photoWidth * a.format.photoHeight;
          const bPixels = b.format.photoWidth * b.format.photoHeight;
          return bPixels - aPixels;
        }
        return a.diff - b.diff;
      });

      selected = withDiff[0].format;
      console.log(`📍 Closest ratio: ${withDiff[0].ratio.toFixed(2)}:1 (diff: ${withDiff[0].diff.toFixed(2)})`);
    }

    if (selected) {
      const ratio = Math.max(selected.photoWidth, selected.photoHeight) / Math.min(selected.photoWidth, selected.photoHeight);
      console.log(`✅ Selected format: ${selected.photoWidth}x${selected.photoHeight} (${(selected.photoWidth * selected.photoHeight / 1000000).toFixed(1)}MP, ratio: ${ratio.toFixed(2)}:1)`);
    } else {
      console.log('❌ No format found!');
    }

    return selected;
  }, [device, targetAspectRatio]);

  const { hasPermission, requestPermission } = useCameraPermission();
  const [photo, setPhoto] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [zoom, setZoom] = useState(1.0); // 1.0 = normal, 0.5 = zoomed out (ultra-wide)

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  // Log device info
  useEffect(() => {
    if (device) {
      console.log('🔍 Device info:');
      console.log(`  - Camera type: ${cameraType}`);
      console.log(`  - Device ID: ${device.id}`);
      console.log(`  - minZoom: ${device.minZoom}`);
      console.log(`  - maxZoom: ${device.maxZoom}`);
      console.log(`  - neutralZoom: ${device.neutralZoom}`);
    }
  }, [device, cameraType]);

  const minZoom = device?.minZoom ?? 1.0;
  const maxZoom = device?.maxZoom ?? 1.0;

  const handleCameraSwitch = (newType) => {
    console.log(`📷 Switching camera to: ${newType}`);
    setCameraType(newType);
    setZoom(1.0); // Reset zoom when switching cameras
  };

  const takePicture = async () => {
    if (!camera.current) return;

    try {
      console.log('📸 ========== TAKING PHOTO ==========');
      console.log(`  - Camera type: ${cameraType}`);
      console.log(`  - Current zoom level: ${zoom}`);
      console.log(`  - Device minZoom: ${device?.minZoom}, maxZoom: ${device?.maxZoom}`);
      console.log(`  - Format: ${format ? `${format.photoWidth}x${format.photoHeight}` : 'default'}`);

      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'quality', // 'speed', 'balanced', or 'quality'
        flash: 'off',
        enableShutterSound: true
      });

      console.log('📸 Photo taken!');
      console.log(`  - Camera used: ${cameraType}`);
      console.log(`  - Path: ${photo.path}`);
      console.log(`  - Dimensions: ${photo.width}x${photo.height}`);
      console.log(`  - Size: ${(photo.width * photo.height / 1000000).toFixed(1)}MP`);

      // Set photo for preview
      setPhoto(photo);
      setIsActive(false);

      // Save to device
      const savedUri = await savePhotoToDevice(
        `file://${photo.path}`,
        `test_vision_camera_${Date.now()}.jpg`,
        null
      );

      Alert.alert(
        'Photo Captured!',
        `Resolution: ${photo.width}x${photo.height}\n` +
        `Size: ${(photo.width * photo.height / 1000000).toFixed(1)}MP\n\n` +
        `Saved to: ${savedUri}`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', error.message);
    }
  };

  const retake = () => {
    setPhoto(null);
    setIsActive(true);
  };

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No camera permission</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Request Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {photo ? (
        // Show captured photo
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: `file://${photo.path}` }}
            style={styles.preview}
            resizeMode="contain"
          />
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Resolution: {photo.width} x {photo.height}
            </Text>
            <Text style={styles.infoText}>
              Size: {(photo.width * photo.height / 1000000).toFixed(1)} MP
            </Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={retake}>
            <Text style={styles.buttonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>←</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Show camera
        <>
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            format={format}
            isActive={isActive}
            photo={true}
            zoom={zoom}
            enableZoomGesture={false}
            resizeMode="cover"
          />
          {/* Camera type controls */}
          <View style={styles.zoomControls}>
            <Text style={styles.zoomText}>Camera: {cameraType === 'ultra-wide-angle-camera' ? 'Ultra-Wide' : 'Wide'}</Text>
            <View style={styles.zoomButtons}>
              <TouchableOpacity
                style={[styles.zoomButton, cameraType === 'ultra-wide-angle-camera' && styles.zoomButtonActive]}
                onPress={() => handleCameraSwitch('ultra-wide-angle-camera')}
              >
                <Text style={styles.zoomButtonText}>0.5x (UW)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoomButton, cameraType === 'wide-angle-camera' && styles.zoomButtonActive]}
                onPress={() => handleCameraSwitch('wide-angle-camera')}
              >
                <Text style={styles.zoomButtonText}>1x</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoomButton, zoom === 2.0 && styles.zoomButtonActive]}
                onPress={() => setZoom(2.0)}
              >
                <Text style={styles.zoomButtonText}>2x</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#fff',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  zoomControls: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  zoomText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  zoomButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  zoomButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  zoomButtonActive: {
    backgroundColor: '#F2C31B',
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  preview: {
    width: '100%',
    height: '70%',
  },
  infoContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  infoText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#F2C31B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginVertical: 5,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
