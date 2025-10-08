import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePhotos } from '../context/PhotoContext';
import { ROOMS, COLORS, PHOTO_MODES } from '../constants/rooms';
import { CroppedThumbnail } from '../components/CroppedThumbnail';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 60) / 2; // 2 columns with padding

export default function HomeScreen({ navigation }) {
  const {
    currentRoom,
    setCurrentRoom,
    getBeforePhotos,
    getAfterPhotos,
    getCombinedPhotos
  } = usePhotos();

  const beforePhotos = getBeforePhotos(currentRoom);
  const afterPhotos = getAfterPhotos(currentRoom);

  const renderRoomTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.roomTabs}
      contentContainerStyle={styles.roomTabsContent}
    >
      {ROOMS.map((room) => (
        <TouchableOpacity
          key={room.id}
          style={[
            styles.roomTab,
            currentRoom === room.id && styles.roomTabActive
          ]}
          onPress={() => setCurrentRoom(room.id)}
        >
          <Text style={styles.roomIcon}>{room.icon}</Text>
          <Text
            style={[
              styles.roomTabText,
              currentRoom === room.id && styles.roomTabTextActive
            ]}
          >
            {room.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderPhotoGrid = () => {
    const gridItems = [];
    const combinedPhotos = getCombinedPhotos(currentRoom);

    // Add before photos
    beforePhotos.forEach((beforePhoto) => {
      const afterPhoto = afterPhotos.find(
        (p) => p.beforePhotoId === beforePhoto.id
      );

      if (afterPhoto) {
        // Check if combined photo exists
        const combinedPhoto = combinedPhotos.find(
          (p) => p.name === beforePhoto.name
        );

        if (combinedPhoto) {
          // Show the combined image (1:1 aspect ratio)
          gridItems.push(
            <TouchableOpacity
              key={combinedPhoto.id}
              style={styles.photoItem}
              onPress={() =>
                navigation.navigate('PhotoDetail', { photo: combinedPhoto })
              }
            >
              <CroppedThumbnail
                imageUri={combinedPhoto.uri}
                aspectRatio={beforePhoto.aspectRatio || '4:3'}
                size={PHOTO_SIZE}
              />
              <View style={styles.photoOverlay}>
                <Text style={styles.photoName}>{beforePhoto.name}</Text>
              </View>
            </TouchableOpacity>
          );
        } else {
          // Has after photo but no combined yet - show split preview
          // 4:3 (horizontal) = stacked (top/bottom), 2:3 (vertical) = side-by-side (left/right)
          const aspectRatio = beforePhoto.aspectRatio || '4:3';
          const isHorizontal = aspectRatio === '4:3';

          gridItems.push(
            <View
              key={beforePhoto.id}
              style={styles.photoItem}
            >
              <View style={[styles.splitPreview, isHorizontal ? styles.stackedPreview : styles.sideBySidePreview]}>
                <Image source={{ uri: beforePhoto.uri }} style={styles.halfPreviewImage} resizeMode="cover" />
                <Image source={{ uri: afterPhoto.uri }} style={styles.halfPreviewImage} resizeMode="cover" />
              </View>
              <View style={styles.photoOverlay}>
                <Text style={styles.photoName}>{beforePhoto.name}</Text>
              </View>
            </View>
          );
        }
      } else {
        // Show before photo only - waiting for after
        gridItems.push(
          <TouchableOpacity
            key={beforePhoto.id}
            style={[styles.photoItem, styles.photoItemPending]}
            onPress={() =>
              navigation.navigate('Camera', {
                mode: 'after',
                beforePhoto,
                room: currentRoom
              })
            }
          >
            <CroppedThumbnail
              imageUri={beforePhoto.uri}
              aspectRatio={beforePhoto.aspectRatio || '4:3'}
              size={PHOTO_SIZE}
            />
            <View style={styles.photoOverlay}>
              <Text style={styles.photoName}>{beforePhoto.name}</Text>
            </View>
          </TouchableOpacity>
        );
      }
    });

    // Add "Take Photo" card
    gridItems.push(
      <TouchableOpacity
        key="add-photo"
        style={styles.addPhotoItem}
        onPress={() =>
          navigation.navigate('Camera', {
            mode: 'before',
            room: currentRoom
          })
        }
      >
        <Text style={styles.addPhotoIcon}>
          {ROOMS.find((r) => r.id === currentRoom)?.icon || '📷'}
        </Text>
        <Text style={styles.addPhotoText}>Take Photo</Text>
      </TouchableOpacity>
    );

    return <View style={styles.photoGrid}>{gridItems}</View>;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ProofPix</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.allPhotosButton}
            onPress={() => navigation.navigate('AllPhotos')}
          >
            <Text style={styles.allPhotosButtonText}>📷 All Photos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderRoomTabs()}

      <ScrollView style={styles.content}>
        {renderPhotoGrid()}
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: 10
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.TEXT
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  allPhotosButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  allPhotosButtonText: {
    color: COLORS.TEXT,
    fontWeight: '600',
    fontSize: 12
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    justifyContent: 'center',
    alignItems: 'center'
  },
  settingsButtonText: {
    fontSize: 20
  },
  roomTabs: {
    maxHeight: 80
  },
  roomTabsContent: {
    paddingHorizontal: 16
  },
  roomTab: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: 'white',
    minWidth: 80
  },
  roomTabActive: {
    backgroundColor: COLORS.PRIMARY
  },
  roomIcon: {
    fontSize: 24,
    marginBottom: 4
  },
  roomTabText: {
    fontSize: 12,
    color: COLORS.GRAY
  },
  roomTabTextActive: {
    color: COLORS.TEXT,
    fontWeight: '600'
  },
  content: {
    flex: 1,
    padding: 20
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.BORDER
  },
  photoItemPending: {
    borderWidth: 3,
    borderColor: COLORS.PRIMARY
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8
  },
  photoName: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold'
  },
  pendingText: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    marginTop: 4
  },
  retakeButton: {
    marginTop: 6,
    backgroundColor: COLORS.PRIMARY,
    padding: 4,
    borderRadius: 6,
    alignItems: 'center'
  },
  retakeButtonText: {
    color: COLORS.TEXT,
    fontSize: 10,
    fontWeight: 'bold'
  },
  addPhotoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center'
  },
  addPhotoIcon: {
    fontSize: 48,
    marginBottom: 8
  },
  addPhotoText: {
    color: COLORS.GRAY,
    fontSize: 14,
    fontWeight: '600'
  },
  splitPreview: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  stackedPreview: {
    flexDirection: 'column',
    borderTopWidth: 2,
    borderTopColor: COLORS.PRIMARY,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY
  },
  sideBySidePreview: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.PRIMARY,
    borderRightWidth: 2,
    borderRightColor: COLORS.PRIMARY
  },
  halfPreviewImage: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY
  }
});
