import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  PanResponder
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
  const currentRoomRef = useRef(currentRoom);

  // Get circular room order with current room in center
  const getCircularRooms = () => {
    const currentIndex = ROOMS.findIndex(r => r.id === currentRoom);
    const result = [];
    
    // Show 3 items before, current, and 3 items after (total 7 visible)
    for (let i = -3; i <= 3; i++) {
      let index = (currentIndex + i + ROOMS.length) % ROOMS.length;
      result.push({ ...ROOMS[index], offset: i });
    }
    
    return result;
  };

  const circularRooms = getCircularRooms();

  // Update ref when currentRoom changes
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // PanResponder for room switching
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Activate for horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 30;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const swipeThreshold = 50;
        const currentIndex = ROOMS.findIndex(r => r.id === currentRoomRef.current);
        
        if (gestureState.dx > swipeThreshold) {
          // Swipe right - go to previous room (circular)
          const newIndex = currentIndex > 0 ? currentIndex - 1 : ROOMS.length - 1;
          setCurrentRoom(ROOMS[newIndex].id);
        } else if (gestureState.dx < -swipeThreshold) {
          // Swipe left - go to next room (circular)
          const newIndex = currentIndex < ROOMS.length - 1 ? currentIndex + 1 : 0;
          setCurrentRoom(ROOMS[newIndex].id);
        }
      }
    })
  ).current;

  const renderRoomTabs = () => (
    <View style={styles.roomTabsContainer}>
      {circularRooms.map((room, index) => {
        const isActive = room.offset === 0; // Center item is active
        const distance = Math.abs(room.offset);
        const scale = isActive ? 1 : Math.max(0.65, 1 - (distance * 0.15));
        const opacity = isActive ? 1 : Math.max(0.4, 1 - (distance * 0.2));
        
        return (
          <TouchableOpacity
            key={`${room.id}-${index}`}
            style={[
              styles.roomTab,
              isActive && styles.roomTabActive,
              {
                transform: [{ scale }],
                opacity
              }
            ]}
            onPress={() => setCurrentRoom(room.id)}
          >
            <Text style={[styles.roomIcon, { fontSize: isActive ? 28 : 22 }]}>{room.icon}</Text>
            {isActive && (
              <Text
                style={[
                  styles.roomTabText,
                  styles.roomTabTextActive
                ]}
              >
                {room.name}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
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
          // Show the combined image - tap to retake after photo
          gridItems.push(
            <TouchableOpacity
              key={combinedPhoto.id}
              style={styles.photoItem}
              onPress={() =>
                navigation.navigate('Camera', {
                  mode: 'after',
                  beforePhoto,
                  afterPhoto,
                  combinedPhoto,
                  room: currentRoom
                })
              }
            >
              <CroppedThumbnail
                imageUri={combinedPhoto.uri}
                aspectRatio={beforePhoto.aspectRatio || '4:3'}
                orientation={beforePhoto.orientation || 'portrait'}
                size={PHOTO_SIZE}
              />
              <View style={styles.photoOverlay}>
                <Text style={styles.photoName}>{beforePhoto.name}</Text>
              </View>
            </TouchableOpacity>
          );
        } else {
          // Has after photo but no combined yet - show split preview, tap to retake after
          // Landscape (horizontal) = stacked (top/bottom), Portrait (vertical) = side-by-side (left/right)
          const photoOrientation = beforePhoto.orientation || 'portrait';
          const isLandscape = photoOrientation === 'landscape';

          gridItems.push(
            <TouchableOpacity
              key={beforePhoto.id}
              style={styles.photoItem}
              onPress={() =>
                navigation.navigate('Camera', {
                  mode: 'after',
                  beforePhoto,
                  afterPhoto,
                  room: currentRoom
                })
              }
            >
              <View style={[styles.splitPreview, isLandscape ? styles.stackedPreview : styles.sideBySidePreview]}>
                <Image source={{ uri: beforePhoto.uri }} style={styles.halfPreviewImage} resizeMode="cover" />
                <Image source={{ uri: afterPhoto.uri }} style={styles.halfPreviewImage} resizeMode="cover" />
              </View>
              <View style={styles.photoOverlay}>
                <Text style={styles.photoName}>{beforePhoto.name}</Text>
              </View>
            </TouchableOpacity>
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
              orientation={beforePhoto.orientation || 'portrait'}
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

      <View style={styles.content} {...panResponder.panHandlers}>
        <ScrollView>
          {renderPhotoGrid()}
        </ScrollView>
      </View>
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
  roomTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    maxHeight: 80
  },
  roomTab: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: 'white',
    minWidth: 60,
    minHeight: 60
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
    bottom: 8,
    left: 8,
    right: 8
  },
  photoName: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4
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
