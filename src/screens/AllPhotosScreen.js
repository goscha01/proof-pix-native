import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
  Alert,
  PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePhotos } from '../context/PhotoContext';
import { COLORS, PHOTO_MODES, ROOMS } from '../constants/rooms';
import { CroppedThumbnail } from '../components/CroppedThumbnail';

const { width } = Dimensions.get('window');
const SET_NAME_WIDTH = 80;
const CONTAINER_PADDING = 32; // 16px on each side
const PHOTO_SPACING = 16; // 8px between each of the 2 gaps
const AVAILABLE_WIDTH = width - SET_NAME_WIDTH - CONTAINER_PADDING - PHOTO_SPACING;
const COLUMN_WIDTH = AVAILABLE_WIDTH / 3;

export default function AllPhotosScreen({ navigation }) {
  const { photos, getBeforePhotos, getAfterPhotos, getCombinedPhotos, deleteAllPhotos } = usePhotos();
  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
  const [fullScreenPhotoSet, setFullScreenPhotoSet] = useState(null); // For combined preview
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  // Long press handlers for full-screen photo
  const handleLongPressStart = (photo, photoSet = null) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (photoSet) {
        // Show combined preview with both photos
        setFullScreenPhotoSet(photoSet);
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

  // PanResponder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dy } = gestureState;
        // Detect swipe down
        return dy > 10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy } = gestureState;
        const threshold = 100; // Swipe down at least 100px
        
        if (dy > threshold) {
          console.log('All Photos - swipe down detected, going back');
          navigation.goBack();
        }
      }
    })
  ).current;

  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Photos',
      'Are you sure you want to delete all photos? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await deleteAllPhotos();
            Alert.alert('Success', 'All photos have been deleted');
          }
        }
      ]
    );
  };

  // Group photos by room and create photo sets
  // Combined photos are created dynamically, not saved
  const getPhotoSets = (roomId) => {
    const beforePhotos = getBeforePhotos(roomId);
    const afterPhotos = getAfterPhotos(roomId);

    // Create sets based on before photos first
    const sets = {};

    beforePhotos.forEach(photo => {
      sets[photo.id] = {
        name: photo.name,
        before: photo,
        after: null,
        combined: null // Will be rendered dynamically if both before and after exist
      };
    });

    // Match after photos to before photos using beforePhotoId
    afterPhotos.forEach(photo => {
      if (photo.beforePhotoId && sets[photo.beforePhotoId]) {
        sets[photo.beforePhotoId].after = photo;
      }
    });

    return Object.values(sets);
  };

  const renderDummyCard = (label) => (
    <View style={styles.dummyCard}>
      <Text style={styles.dummyCardText}>{label}</Text>
    </View>
  );

  const renderPhotoCard = (photo, borderColor, photoType, photoSet, isLast = false) => {
    // For combined thumbnail, show split preview based on cameraViewMode - tap to retake after
    if (photoType === 'combined' && !photo && photoSet.before && photoSet.after) {
      const cameraViewMode = photoSet.before.cameraViewMode || 'portrait';
      const isLandscape = cameraViewMode === 'landscape';

      return (
        <TouchableOpacity
          key={photoType}
          style={[styles.photoCard, { borderColor }, isLast && styles.photoCardLast]}
          onPress={() => {
            if (longPressTriggered.current) return;
            navigation.navigate('PhotoEditor', {
              beforePhoto: photoSet.before,
              afterPhoto: photoSet.after
            });
          }}
          onPressIn={() => handleLongPressStart(null, photoSet)}
          onPressOut={handleLongPressEnd}
        >
          <View style={[styles.combinedThumbnail, isLandscape ? styles.stackedThumbnail : styles.sideBySideThumbnail]}>
            <Image source={{ uri: photoSet.before.uri }} style={styles.halfImage} resizeMode="cover" />
            <Image source={{ uri: photoSet.after.uri }} style={styles.halfImage} resizeMode="cover" />
          </View>
        </TouchableOpacity>
      );
    }

    if (!photo) return <View key={photoType} style={[styles.photoCard, isLast && styles.photoCardLast]}>{renderDummyCard('—')}</View>;

    const handlePress = () => {
      if (longPressTriggered.current) return;
      
      if (photoType === 'combined') {
        // Combined column - navigate to PhotoEditor to choose format
        navigation.navigate('PhotoEditor', {
          beforePhoto: photoSet.before,
          afterPhoto: photoSet.after
        });
      } else {
        // Before or After column - show individual photo detail
        navigation.navigate('PhotoDetail', { photo });
      }
    };

    return (
      <TouchableOpacity
        key={photoType}
        style={[styles.photoCard, { borderColor }, isLast && styles.photoCardLast]}
        onPress={handlePress}
        onPressIn={() => handleLongPressStart(photo, photoType === 'combined' ? photoSet : null)}
        onPressOut={handleLongPressEnd}
      >
        <CroppedThumbnail
          imageUri={photo.uri}
          aspectRatio={photo.aspectRatio || photoSet.before?.aspectRatio || '4:3'}
          orientation={photo.orientation || photoSet.before?.orientation || 'portrait'}
          size={COLUMN_WIDTH}
        />
      </TouchableOpacity>
    );
  };

  const renderPhotoSet = (set, index) => (
    <View key={index} style={styles.photoSetRow}>
      <View style={styles.setNameContainer}>
        <Text style={styles.setName}>{set.name}</Text>
      </View>
      <View style={styles.threeColumnRow}>
        {renderPhotoCard(set.before, '#F2C31B', 'before', set, false)}
        {renderPhotoCard(set.after, '#4A90E2', 'after', set, false)}
        {renderPhotoCard(set.combined, '#52C41A', 'combined', set, true)}
      </View>
    </View>
  );

  const renderRoomSection = (room) => {
    const sets = getPhotoSets(room.id);
    if (sets.length === 0) return null;

    return (
      <View key={room.id} style={styles.roomSection}>
        <View style={styles.roomHeader}>
          <Text style={styles.roomIcon}>{room.icon}</Text>
          <Text style={styles.roomName}>{room.name}</Text>
        </View>
        {sets.map((set, index) => renderPhotoSet(set, index))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* Swipe down indicator */}
      <View style={styles.swipeIndicator}>
        <View style={styles.swipeHandle} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>All Photos</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => {
            console.log('Upload button pressed');
            Alert.alert('Upload', 'Upload functionality coming soon!');
          }}
        >
          <Text style={styles.uploadButtonText}>📤</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.columnHeaders}>
        <View style={styles.setNamePlaceholder} />
        <Text style={styles.columnHeader}>BEFORE</Text>
        <Text style={styles.columnHeader}>AFTER</Text>
        <Text style={[styles.columnHeader, { marginRight: 0 }]}>COMBINED</Text>
      </View>

      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No photos yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Take some before/after photos to get started
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {ROOMS.map(room => renderRoomSection(room))}
        </ScrollView>
      )}

      {/* Delete All button at bottom - only show if photos exist */}
      {photos.length > 0 && (
        <TouchableOpacity
          style={styles.deleteAllButtonBottom}
          onPress={handleDeleteAll}
        >
          <Text style={styles.deleteAllButtonBottomText}>🗑️ Delete All Photos</Text>
        </TouchableOpacity>
      )}

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
              (fullScreenPhotoSet.before.cameraViewMode || fullScreenPhotoSet.before.orientation) === 'landscape' 
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
  swipeIndicator: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4
  },
  swipeHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.GRAY,
    borderRadius: 2
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER
  },
  backButton: {
    width: 60
  },
  backButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 18
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT
  },
  uploadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadButtonText: {
    fontSize: 20
  },
  deleteAllButtonBottom: {
    backgroundColor: '#FF4444',
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
  deleteAllButtonBottomText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.BORDER
  },
  setNamePlaceholder: {
    width: 80,
    marginRight: 8
  },
  columnHeader: {
    width: COLUMN_WIDTH,
    marginRight: 8,
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.GRAY,
    textAlign: 'center'
  },
  scrollView: {
    flex: 1
  },
  content: {
    padding: 16
  },
  roomSection: {
    marginBottom: 24
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY
  },
  roomIcon: {
    fontSize: 24,
    marginRight: 8
  },
  roomName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.TEXT
  },
  photoSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  setNameContainer: {
    width: 80,
    marginRight: 8,
    justifyContent: 'center'
  },
  setName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT
  },
  threeColumnRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap'
  },
  photoCard: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    borderRadius: 8,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: 'white',
    marginRight: 8
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  combinedThumbnail: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  stackedThumbnail: {
    flexDirection: 'column',
    borderTopWidth: 2,
    borderTopColor: COLORS.PRIMARY,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY
  },
  sideBySideThumbnail: {
    flexDirection: 'row',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.PRIMARY,
    borderRightWidth: 2,
    borderRightColor: COLORS.PRIMARY
  },
  halfImage: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY
  },
  dummyCard: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderStyle: 'dashed',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center'
  },
  dummyCardText: {
    fontSize: 20,
    color: COLORS.GRAY,
    fontWeight: '300'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: 'center'
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
