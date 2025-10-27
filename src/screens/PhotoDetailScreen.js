import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Share,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { COLORS, PHOTO_MODES } from '../constants/rooms';
import * as FileSystem from 'expo-file-system/legacy';

const { width, height } = Dimensions.get('window');

export default function PhotoDetailScreen({ route, navigation }) {
  const { photo } = route.params;
  const { deletePhoto } = usePhotos();
  const { showLabels } = useSettings();
  const [sharing, setSharing] = useState(false);
  const [containerLayout, setContainerLayout] = useState(null);
  const [imageSize, setImageSize] = useState(null);
  const imageContainerRef = useRef(null);
  const captureViewRef = useRef(null);
  const imageRef = useRef(null);

  // Calculate capture view dimensions maintaining aspect ratio
  const captureDimensions = useMemo(() => {
    if (!imageSize) return null;
    
    const maxDimension = 2000; // Reasonable max size for sharing
    const ratio = imageSize.width / imageSize.height;
    let captureWidth, captureHeight;
    
    if (ratio >= 1) {
      // Landscape or square
      captureWidth = maxDimension;
      captureHeight = maxDimension / ratio;
    } else {
      // Portrait
      captureHeight = maxDimension;
      captureWidth = maxDimension * ratio;
    }
    
    const result = { captureWidth, captureHeight };
    console.log('📏 Capture dimensions calculated:', { imageSize, ratio, result });
    return result;
  }, [imageSize]);

  const handleDelete = async () => {
    await deletePhoto(photo.id);
    navigation.goBack();
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      
      let tempUri;
      
      // If labels are enabled, capture the view (image + label)
      if (showLabels && photo.mode && captureDimensions) {
        try {
          console.log('🖼️ Attempting to capture view with label, dimensions:', captureDimensions);
          
          // Capture the hidden view which has exact image dimensions (no white padding)
          const capturedUri = await captureRef(captureViewRef, {
            format: 'jpg',
            quality: 0.95
          });
          
          // Copy captured image to cache directory to ensure it's temporary
          const tempFileName = `${photo.room}_${photo.name}_${photo.mode}_labeled_${Date.now()}.jpg`;
          tempUri = `${FileSystem.cacheDirectory}${tempFileName}`;
          await FileSystem.copyAsync({ from: capturedUri, to: tempUri });
          console.log('✅ Copied captured image to cache:', tempUri);
        } catch (error) {
          console.error('❌ Error capturing view:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          // Fall back to original image if capture fails
          const tempFileName = `${photo.room}_${photo.name}_${photo.mode}_${Date.now()}.jpg`;
          tempUri = `${FileSystem.cacheDirectory}${tempFileName}`;
          await FileSystem.copyAsync({ from: photo.uri, to: tempUri });
        }
      } else {
        // Share original image without label - copy to cache directory
        const tempFileName = `${photo.room}_${photo.name}_${photo.mode}_${Date.now()}.jpg`;
        tempUri = `${FileSystem.cacheDirectory}${tempFileName}`;
        await FileSystem.copyAsync({ from: photo.uri, to: tempUri });
      }

      // Share the image
      const shareOptions = {
        title: `${photo.mode === 'before' ? 'Before' : 'After'} Photo - ${photo.name}`,
        url: tempUri,
        type: 'image/jpeg'
      };

      const result = await Share.share(shareOptions);
      
      if (result.action === Share.sharedAction) {
        console.log('Photo shared successfully');
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dialog dismissed');
      }
      
      // Clean up temporary file after sharing
      try {
        const fileInfo = await FileSystem.getInfoAsync(tempUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
          console.log('🧹 Cleaned up temporary file');
        }
      } catch (cleanupError) {
        console.warn('Could not clean up temporary file:', cleanupError);
      }
    } catch (error) {
      console.error('Error sharing photo:', error);
      Alert.alert('Error', 'Failed to share photo');
    } finally {
      setSharing(false);
    }
  };

  const getImageDisplayBounds = () => {
    if (!containerLayout || !imageSize) {
      return null;
    }

    const containerWidth = containerLayout.width;
    const containerHeight = containerLayout.height;
    const imageWidth = imageSize.width;
    const imageHeight = imageSize.height;

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
      displayWidth,
      displayHeight,
      offsetX,
      offsetY
    };
  };

  const renderPhoto = () => {
    // Calculate label position based on actual image display area
    const getLabelStyle = () => {
      const bounds = getImageDisplayBounds();
      if (!bounds) {
        return { top: 10, left: 10 };
      }

      // Position label 10px from the top-left of the actual image display area (matching combined photos)
      return {
        top: bounds.offsetY + 10,
        left: bounds.offsetX + 10,
        position: 'absolute'
      };
    };

    // Show all photos as they are - no dimming, no frame
    return (
      <View 
        ref={imageContainerRef}
        style={styles.imageContainer}
        collapsable={false}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setContainerLayout({ width, height });
        }}
      >
        <Image 
          ref={imageRef}
          source={{ uri: photo.uri }} 
          style={styles.image} 
          resizeMode="contain"
          onLoad={(event) => {
            const { width, height } = event.nativeEvent.source;
            console.log('📐 Image loaded with dimensions:', { width, height });
            setImageSize({ width, height });
          }}
        />
        {/* Show label overlay for before/after photos if showLabels is true */}
        {showLabels && photo.mode && (
          <View style={[styles.photoLabel, getLabelStyle()]}>
            <Text style={styles.photoLabelText}>
              {photo.mode.toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>{photo.name}</Text>
          <Text style={[
            styles.mode,
            { color: photo.mode === 'before' ? '#4CAF50' : '#2196F3' }
          ]}>
            {photo.mode.toUpperCase()}
          </Text>
        </View>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {renderPhoto()}

      {/* Hidden capture view - exact image size, no white padding */}
      {showLabels && photo.mode && captureDimensions && (
        <View
          ref={captureViewRef}
          style={{
            position: 'absolute',
            left: -10000,
            top: -10000,
            width: captureDimensions.captureWidth,
            height: captureDimensions.captureHeight,
            backgroundColor: 'black',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          collapsable={false}
        >
          <Image
            source={{ uri: photo.uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          {(() => {
            // Scale the label to match the visual size on screen
            // The capture view is max 2000px, screen is typically ~400px wide
            // Scale factor: capture width / screen width
            const scaleFactor = captureDimensions.captureWidth / width;
            console.log('📏 Label scale factor:', { captureWidth: captureDimensions.captureWidth, screenWidth: width, scaleFactor });
            
            return (
              <View style={{
                position: 'absolute',
                top: 10 * scaleFactor,
                left: 10 * scaleFactor,
                backgroundColor: COLORS.PRIMARY,
                paddingHorizontal: 12 * scaleFactor,
                paddingVertical: 6 * scaleFactor,
                borderRadius: 6 * scaleFactor
              }}>
                <Text style={{ 
                  color: COLORS.TEXT, 
                  fontSize: 14 * scaleFactor, 
                  fontWeight: 'bold' 
                }}>
                  {photo.mode.toUpperCase()}
                </Text>
              </View>
            );
          })()}
        </View>
      )}

      <TouchableOpacity 
        style={styles.shareButton} 
        onPress={handleShare}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.shareButtonText}>Share</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20
  },
  title: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2
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
  },
  backButton: {
    padding: 8
  },
  backButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 18
  },
  deleteButton: {
    padding: 8
  },
  deleteButtonText: {
    fontSize: 24
  },
  image: {
    width: '100%',
    height: '100%'
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    position: 'relative'
  },
  mode: {
    color: COLORS.PRIMARY,
    fontSize: 12,
    fontWeight: '600'
  },
  photoLabel: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  photoLabelText: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: 'bold'
  },
});
