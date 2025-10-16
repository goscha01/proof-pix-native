import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
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

  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
  const [fullScreenPhotoSet, setFullScreenPhotoSet] = useState(null); // For combined preview
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const touchStartPos = useRef(null);
  const isSwiping = useRef(false);
  
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

  // Long press handlers for full-screen photo
  const handleLongPressStart = (photo, beforePhoto = null, afterPhoto = null) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (beforePhoto && afterPhoto) {
        // Show combined preview with both photos
        setFullScreenPhotoSet({ before: beforePhoto, after: afterPhoto });
      } else {
        // Show single photo
        setFullScreenPhoto(photo);
      }
    }, 500); // 500ms for long press
  };

  const handleLongPressEnd = () => {
    const wasLongPress = longPressTriggered.current;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setFullScreenPhoto(null);
    setFullScreenPhotoSet(null);
    
    // Only delay reset if it was actually a long press
    if (wasLongPress) {
      setTimeout(() => {
        longPressTriggered.current = false;
      }, 100);
    } else {
      // Quick tap - reset immediately so onPress can fire
      longPressTriggered.current = false;
    }
  };

  // PanResponder for room switching
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        isSwiping.current = false;
        return false;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Activate for horizontal swipes
        const isHorizontalSwipe = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 30;
        if (isHorizontalSwipe) {
          isSwiping.current = true;
        }
        return isHorizontalSwipe;
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
        
        // Reset swipe flag after a short delay
        setTimeout(() => {
          isSwiping.current = false;
        }, 100);
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
    const hasPhotos = beforePhotos.length > 0;

    // If no photos, show centered take photo button
    if (!hasPhotos) {
      return (
        <View style={styles.emptyStateContainer}>
          <TouchableOpacity
            style={styles.addPhotoItem}
            delayPressIn={100}
            onPress={() => {
              if (!isSwiping.current) {
                navigation.navigate('Camera', {
                  mode: 'before',
                  room: currentRoom
                });
              }
            }}
          >
            <Text style={styles.addPhotoIcon}>
              {ROOMS.find((r) => r.id === currentRoom)?.icon || '📷'}
            </Text>
            <Text style={styles.addPhotoText}>Take Photo</Text>
          </TouchableOpacity>
        </View>
      );
    }

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
              delayPressIn={100}
              onPress={() => {
                if (!longPressTriggered.current && !isSwiping.current) {
                  navigation.navigate('Camera', {
                    mode: 'after',
                    beforePhoto,
                    afterPhoto,
                    combinedPhoto,
                    room: currentRoom
                  });
                }
              }}
              onPressIn={() => handleLongPressStart(combinedPhoto)}
              onPressOut={handleLongPressEnd}
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
          // Landscape phone OR landscape camera view = stacked (top/bottom)
          const phoneOrientation = beforePhoto.orientation || 'portrait';
          const cameraViewMode = beforePhoto.cameraViewMode || 'portrait';
          const isLandscape = phoneOrientation === 'landscape' || cameraViewMode === 'landscape';

          gridItems.push(
            <TouchableOpacity
              key={beforePhoto.id}
              style={styles.photoItem}
              delayPressIn={100}
              onPress={() => {
                if (!longPressTriggered.current && !isSwiping.current) {
                  navigation.navigate('Camera', {
                    mode: 'after',
                    beforePhoto,
                    afterPhoto,
                    room: currentRoom
                  });
                }
              }}
              onPressIn={() => handleLongPressStart(null, beforePhoto, afterPhoto)}
              onPressOut={handleLongPressEnd}
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
            delayPressIn={100}
            onPress={() => {
              if (!longPressTriggered.current && !isSwiping.current) {
                navigation.navigate('Camera', {
                  mode: 'after',
                  beforePhoto,
                  room: currentRoom
                });
              }
            }}
            onPressIn={() => handleLongPressStart(beforePhoto)}
            onPressOut={handleLongPressEnd}
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
        delayPressIn={100}
        onPress={() => {
          if (!isSwiping.current) {
            navigation.navigate('Camera', {
              mode: 'before',
              room: currentRoom
            });
          }
        }}
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
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {renderRoomTabs()}

      <View style={styles.content} {...panResponder.panHandlers}>
        <ScrollView>
          {renderPhotoGrid()}
        </ScrollView>
      </View>

      {/* All Photos button at bottom */}
      <TouchableOpacity
        style={styles.allPhotosButtonBottom}
        onPress={() => navigation.navigate('AllPhotos')}
      >
        <Text style={styles.allPhotosButtonText}>📷 All Photos</Text>
      </TouchableOpacity>

      {/* Manage Projects button under All Photos - always visible */}
      <TouchableOpacity
        style={[styles.allPhotosButtonBottom, { backgroundColor: '#22A45D' }]}
        onPress={() => navigation.navigate('AllPhotos', { openManage: true })}
      >
        <Text style={[styles.allPhotosButtonText, { color: 'white' }]}>🗂️ Manage Projects</Text>
      </TouchableOpacity>

      {/* Full-screen photo view - single photo */}
      {fullScreenPhoto && (
        <TouchableWithoutFeedback onPress={handleLongPressEnd}>
          <View style={styles.fullScreenPhotoContainer}>
            <Image
              source={{ uri: fullScreenPhoto.uri }}
              style={styles.fullScreenPhoto}
              resizeMode="contain"
            />
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Full-screen combined photo view - 1:1 square with before/after */}
      {fullScreenPhotoSet && (
        <TouchableWithoutFeedback onPress={handleLongPressEnd}>
          <View style={styles.fullScreenPhotoContainer}>
            <View style={[
              styles.fullScreenCombinedPreview,
              (fullScreenPhotoSet.before.orientation === 'landscape' || fullScreenPhotoSet.before.cameraViewMode === 'landscape')
                ? styles.fullScreenStacked 
                : styles.fullScreenSideBySide
            ]}>
              <View style={styles.fullScreenHalf}>
                <Image
                  source={{ uri: fullScreenPhotoSet.before.uri }}
                  style={styles.fullScreenHalfImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.fullScreenHalf}>
                <Image
                  source={{ uri: fullScreenPhotoSet.after.uri }}
                  style={styles.fullScreenHalfImage}
                  resizeMode="cover"
                />
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}
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
  allPhotosButtonBottom: {
    backgroundColor: COLORS.PRIMARY,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5
  },
  allPhotosButtonText: {
    color: COLORS.TEXT,
    fontWeight: 'bold',
    fontSize: 16
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: '33%'
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
  },
  fullScreenPhotoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  fullScreenPhoto: {
    width: '100%',
    height: '100%'
  },
  fullScreenCombinedPreview: {
    aspectRatio: 1,
    width: '90%',
    maxWidth: 500,
    maxHeight: 500,
    backgroundColor: 'white',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: COLORS.PRIMARY
  },
  fullScreenStacked: {
    flexDirection: 'column'
  },
  fullScreenSideBySide: {
    flexDirection: 'row'
  },
  fullScreenHalf: {
    flex: 1
  },
  fullScreenHalfImage: {
    width: '100%',
    height: '100%'
  }
});
