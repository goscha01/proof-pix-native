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

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {renderPhoto()}

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
    width: '100%',
    height: '100%'
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
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
