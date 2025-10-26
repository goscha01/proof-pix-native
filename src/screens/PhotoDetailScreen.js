import React, { useState } from 'react';
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
import { usePhotos } from '../context/PhotoContext';
import { COLORS, PHOTO_MODES } from '../constants/rooms';
import { savePhotoToDevice } from '../services/storage';

const { width, height } = Dimensions.get('window');

export default function PhotoDetailScreen({ route, navigation }) {
  const { photo } = route.params;
  const { deletePhoto } = usePhotos();
  const [sharing, setSharing] = useState(false);

  const handleDelete = async () => {
    await deletePhoto(photo.id);
    navigation.goBack();
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      
      // Create a temporary file for sharing
      const tempFileName = `${photo.room}_${photo.name}_${photo.mode}_${Date.now()}.jpg`;
      const tempUri = await savePhotoToDevice(photo.uri, tempFileName);

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
    } catch (error) {
      console.error('Error sharing photo:', error);
      Alert.alert('Error', 'Failed to share photo');
    } finally {
      setSharing(false);
    }
  };

  const renderPhoto = () => {
    // Show all photos as they are - no dimming, no frame
    return (
      <View style={styles.imageContainer}>
        <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" />
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
    backgroundColor: 'white'
  },
  mode: {
    color: COLORS.PRIMARY,
    fontSize: 12,
    fontWeight: '600'
  },
});
