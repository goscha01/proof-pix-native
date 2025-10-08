import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePhotos } from '../context/PhotoContext';
import { COLORS, PHOTO_MODES } from '../constants/rooms';

const { width, height } = Dimensions.get('window');

export default function PhotoDetailScreen({ route, navigation }) {
  const { photo } = route.params;
  const { deletePhoto } = usePhotos();

  const handleDelete = () => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePhoto(photo.id);
            navigation.goBack();
          }
        }
      ]
    );
  };

  const renderCroppedPhoto = () => {
    // Only crop before and after photos, not combined
    if (photo.mode === PHOTO_MODES.COMBINED) {
      return <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" />;
    }

    const aspectRatio = photo.aspectRatio || '4:3';
    const containerWidth = width;
    const containerHeight = height - 200; // Account for header and info

    // Calculate frame dimensions based on aspect ratio
    const MARGIN = 20;
    const maxWidth = containerWidth - (MARGIN * 2);
    const maxHeight = containerHeight - (MARGIN * 2);

    let frameWidth, frameHeight;

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

    // Position frame higher to avoid overlap with info section
    const verticalOffset = Math.max(MARGIN, (containerHeight - frameHeight) / 2 - 40);
    const horizontalOffset = (containerWidth - frameWidth) / 2;

    return (
      <View style={styles.imageContainer}>
        {/* Background image (dimmed) */}
        <Image source={{ uri: photo.uri }} style={styles.backgroundImage} resizeMode="cover" />

        {/* Dark overlay */}
        <View style={styles.backgroundDim} />

        {/* Cropped viewport */}
        <View style={[styles.croppedViewport, {
          width: frameWidth,
          height: frameHeight,
          top: verticalOffset,
          left: horizontalOffset
        }]}>
          <Image source={{ uri: photo.uri }} style={styles.croppedImage} resizeMode="cover" />
        </View>
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

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {renderCroppedPhoto()}

      <View style={styles.info}>
        <Text style={styles.name}>{photo.name}</Text>
        <Text style={styles.mode}>{photo.mode.toUpperCase()}</Text>
        <Text style={styles.room}>
          {photo.room.charAt(0).toUpperCase() + photo.room.slice(1).replace('-', ' ')}
        </Text>
        <Text style={styles.timestamp}>
          {new Date(photo.timestamp).toLocaleString()}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10
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
    flex: 1,
    width: '100%'
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    backgroundColor: 'black'
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute'
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
  info: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.8)'
  },
  name: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8
  },
  mode: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4
  },
  room: {
    color: COLORS.GRAY,
    fontSize: 14,
    marginBottom: 4
  },
  timestamp: {
    color: COLORS.GRAY,
    fontSize: 12
  }
});
