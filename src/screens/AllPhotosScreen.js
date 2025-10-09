import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert
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
    // For combined thumbnail, show split preview based on orientation - tap to retake after
    if (photoType === 'combined' && !photo && photoSet.before && photoSet.after) {
      const photoOrientation = photoSet.before.orientation || 'portrait';
      const isLandscape = photoOrientation === 'landscape';

      return (
        <TouchableOpacity
          key={photoType}
          style={[styles.photoCard, { borderColor }, isLast && styles.photoCardLast]}
          onPress={() => navigation.navigate('Camera', {
            mode: 'after',
            beforePhoto: photoSet.before,
            afterPhoto: photoSet.after,
            room: photoSet.before.room
          })}
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
      if (photoType === 'combined') {
        // Combined column - navigate to camera to retake after photo
        navigation.navigate('Camera', {
          mode: 'after',
          beforePhoto: photoSet.before,
          afterPhoto: photoSet.after,
          combinedPhoto: photo,
          room: photoSet.before.room
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>All Photos</Text>
        {photos.length > 0 && (
          <TouchableOpacity
            style={styles.deleteAllButton}
            onPress={handleDeleteAll}
          >
            <Text style={styles.deleteAllButtonText}>🗑️ Delete All</Text>
          </TouchableOpacity>
        )}
        {photos.length === 0 && <View style={{ width: 60 }} />}
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
  deleteAllButton: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  deleteAllButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
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
  }
});
