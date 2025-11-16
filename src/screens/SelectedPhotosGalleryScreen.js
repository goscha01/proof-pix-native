import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  PanResponder,
  ActivityIndicator
} from 'react-native';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { COLORS, PHOTO_MODES } from '../constants/rooms';
import { CroppedThumbnail } from '../components/CroppedThumbnail';
import PhotoLabel from '../components/PhotoLabel';
import { useTranslation } from 'react-i18next';
import { getLabelPositions } from '../constants/rooms';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 60) / 3; // 3 columns with padding
const CONTAINER_PADDING = 16;
const PHOTO_SPACING = 8;

export default function SelectedPhotosGalleryScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { selectedPhotoIds } = route.params || { selectedPhotoIds: [] }; // Get selected photo IDs from route params
  const {
    photos,
    activeProjectId,
  } = usePhotos();
  const {
    labelLanguage,
    showLabels,
    beforeLabelPosition,
    afterLabelPosition,
    combinedLabelPosition,
    labelMarginVertical,
    labelMarginHorizontal,
  } = useSettings();

  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
  const [fullScreenPhotoSet, setFullScreenPhotoSet] = useState(null);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [fullScreenPhotos, setFullScreenPhotos] = useState([]);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const lastTap = useRef(null);
  const tapCount = useRef(0);
  const fullScreenScrollRef = useRef(null);
  const photoBoundsMap = useRef({});

  // Get photos from active project or all photos
  const sourcePhotos = useMemo(() => {
    return activeProjectId 
      ? photos.filter(p => p.projectId === activeProjectId) 
      : photos;
  }, [photos, activeProjectId]);

  // Create photo sets for combined photos
  const photoSets = useMemo(() => {
    const sets = {};
    const beforePhotos = sourcePhotos.filter(p => p.mode === PHOTO_MODES.BEFORE);
    const afterPhotos = sourcePhotos.filter(p => p.mode === PHOTO_MODES.AFTER);

    beforePhotos.forEach(beforePhoto => {
      sets[beforePhoto.id] = {
        before: beforePhoto,
        after: null
      };
    });

    afterPhotos.forEach(afterPhoto => {
      if (afterPhoto.beforePhotoId && sets[afterPhoto.beforePhotoId]) {
        sets[afterPhoto.beforePhotoId].after = afterPhoto;
      }
    });

    return Object.values(sets);
  }, [sourcePhotos]);

  // Create combined photo items
  const combinedPhotos = useMemo(() => {
    return photoSets
      .filter(set => set.before && set.after)
      .map(set => ({
        id: `combined_${set.before.id}`,
        before: set.before,
        after: set.after,
        name: set.before.name,
        room: set.before.room,
        mode: PHOTO_MODES.COMBINED,
        uri: null,
        orientation: set.before.orientation,
        cameraViewMode: set.before.cameraViewMode
      }));
  }, [photoSets]);

  // Filter to only show selected photos
  const selectedPhotos = useMemo(() => {
    const allPhotos = [...sourcePhotos, ...combinedPhotos];
    return allPhotos.filter(p => selectedPhotoIds.includes(p.id));
  }, [sourcePhotos, combinedPhotos, selectedPhotoIds]);

  // Prepare all photos for full-screen navigation
  const prepareFullScreenPhotos = (initialPhoto, initialPhotoSet = null) => {
    const allPhotos = [];
    
    // Add all selected photos in order
    selectedPhotos.forEach(item => {
      if (item.mode === PHOTO_MODES.COMBINED && item.before && item.after) {
        allPhotos.push({
          id: item.id,
          type: 'combined',
          photoSet: { before: item.before, after: item.after, name: item.name, room: item.room }
        });
      } else {
        allPhotos.push({
          id: item.id,
          type: 'single',
          photo: item
        });
      }
    });
    
    // Find initial index
    let initialIndex = 0;
    if (initialPhoto) {
      initialIndex = allPhotos.findIndex(p => p.type === 'single' && p.photo.id === initialPhoto.id);
    } else if (initialPhotoSet && initialPhotoSet.before) {
      const combinedId = `combined_${initialPhotoSet.before.id}`;
      initialIndex = allPhotos.findIndex(p => p.type === 'combined' && p.id === combinedId);
    }
    
    if (initialIndex < 0) initialIndex = 0;
    
    setFullScreenPhotos(allPhotos);
    setFullScreenIndex(initialIndex);
  };

  // Long press handlers for full-screen photo
  const handleLongPressStart = (photo, photoSet = null) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      prepareFullScreenPhotos(photo, photoSet);
      if (photoSet) {
        setFullScreenPhotoSet(photoSet);
        setFullScreenPhoto(null);
      } else if (photo) {
        setFullScreenPhoto(photo);
        setFullScreenPhotoSet(null);
      }
    }, 300);
  };

  const handleLongPressEnd = () => {
    const wasLongPress = longPressTriggered.current;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setFullScreenPhoto(null);
    setFullScreenPhotoSet(null);
    setFullScreenPhotos([]);
    setFullScreenIndex(0);
    
    if (wasLongPress) {
      setTimeout(() => {
        longPressTriggered.current = false;
      }, 100);
    } else {
      longPressTriggered.current = false;
    }
  };

  // Handle double tap
  const handleDoubleTap = (photo, photoSet = null) => {
    tapCount.current = 0;
    lastTap.current = null;
    
    prepareFullScreenPhotos(photo, photoSet);
    if (photoSet) {
      setFullScreenPhotoSet(photoSet);
      setFullScreenPhoto(null);
    } else if (photo) {
      setFullScreenPhoto(photo);
      setFullScreenPhotoSet(null);
    }
  };

  // Scroll to initial index when full-screen opens
  useEffect(() => {
    if (fullScreenScrollRef.current && fullScreenPhotos.length > 0 && fullScreenIndex >= 0) {
      const scrollTimeout = setTimeout(() => {
        fullScreenScrollRef.current?.scrollTo({
          x: fullScreenIndex * Dimensions.get('window').width,
          animated: false
        });
      }, 0);
      
      return () => clearTimeout(scrollTimeout);
    }
  }, [fullScreenPhotos.length]);

  // Handle scroll - only update index when scroll ends
  const handleFullScreenScroll = useCallback((event) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const pageWidth = layoutMeasurement.width;
    const pageIndex = Math.round(contentOffset.x / pageWidth);
    
    if (pageIndex >= 0 && pageIndex < fullScreenPhotos.length && pageIndex !== fullScreenIndex) {
      setFullScreenIndex(pageIndex);
    }
  }, [fullScreenPhotos.length, fullScreenIndex]);

  // Component for single photo full screen
  const FullScreenSinglePhotoItem = React.memo(({ photo, photoBoundsMapRef, showLabels, beforeLabelPosition, afterLabelPosition, labelMarginVertical, labelMarginHorizontal, t }) => {
    const [imageSize, setImageSize] = useState(null);
    const [containerLayout, setContainerLayout] = useState(null);
    const imageContainerRef = useRef(null);
    const imageRef = useRef(null);
    
    const currentLabelPosition = photo.mode === 'before' ? beforeLabelPosition : afterLabelPosition;
    const positions = getLabelPositions(labelMarginVertical, labelMarginHorizontal);
    const positionConfig = positions[currentLabelPosition] || positions['left-top'];

    const calculateBounds = useMemo(() => {
      if (!containerLayout || !imageSize) {
        return null;
      }

      const containerWidth = containerLayout.width;
      const containerHeight = containerLayout.height;
      const imageWidth = imageSize.width;
      const imageHeight = imageSize.height;

      if (!imageWidth || !imageHeight) {
        return null;
      }

      const scaleX = containerWidth / imageWidth;
      const scaleY = containerHeight / imageHeight;
      const scale = Math.min(scaleX, scaleY);

      const displayWidth = imageWidth * scale;
      const displayHeight = imageHeight * scale;
      const offsetX = (containerWidth - displayWidth) / 2;
      const offsetY = (containerHeight - displayHeight) / 2;

      const bounds = {
        width: displayWidth,
        height: displayHeight,
        offsetX,
        offsetY
      };
      
      photoBoundsMapRef.current[photo.id] = bounds;
      
      return bounds;
    }, [containerLayout, imageSize, photo.id, photoBoundsMapRef]);

    const getLabelStyle = useMemo(() => {
      if (!calculateBounds) {
        const { name, horizontalAlign, verticalAlign, ...coordinates } = positionConfig;
        return coordinates;
      }

      const style = {};
      if (positionConfig.top !== undefined) {
        if (typeof positionConfig.top === 'string' && positionConfig.top.includes('%')) {
          style.top = calculateBounds.offsetY + (calculateBounds.height * parseFloat(positionConfig.top) / 100);
        } else {
          style.top = calculateBounds.offsetY + positionConfig.top;
        }
      }
      if (positionConfig.bottom !== undefined) {
        style.bottom = calculateBounds.offsetY + positionConfig.bottom;
      }
      if (positionConfig.left !== undefined) {
        if (typeof positionConfig.left === 'string' && positionConfig.left.includes('%')) {
          style.left = calculateBounds.offsetX + (calculateBounds.width * parseFloat(positionConfig.left) / 100);
        } else {
          style.left = calculateBounds.offsetX + positionConfig.left;
        }
      }
      if (positionConfig.right !== undefined) {
        style.right = calculateBounds.offsetX + positionConfig.right;
      }
      if (positionConfig.transform) {
        style.transform = positionConfig.transform;
      }
      return style;
    }, [calculateBounds, positionConfig]);

    return (
      <View style={styles.fullScreenImageContainer} collapsable={false}>
        <View
          ref={imageContainerRef}
          style={styles.fullScreenImageContainer}
          collapsable={false}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setContainerLayout({ width, height });
          }}
        >
          <Image
            ref={imageRef}
            source={{ uri: photo.uri }}
            style={styles.fullScreenPhoto}
            resizeMode="contain"
            onLoad={(event) => {
              const { width, height } = event.nativeEvent.source;
              setImageSize({ width, height });
            }}
          />
          {showLabels && photo.mode && calculateBounds && (
            <PhotoLabel
              label={
                photo.mode === 'before'
                  ? 'common.before'
                  : photo.mode === 'after'
                  ? 'common.after'
                  : photo.mode.toUpperCase()
              }
              position={currentLabelPosition}
              style={getLabelStyle}
            />
          )}
        </View>
      </View>
    );
  }, (prevProps, nextProps) => {
    return prevProps.photo.id === nextProps.photo.id &&
      prevProps.showLabels === nextProps.showLabels &&
      prevProps.beforeLabelPosition === nextProps.beforeLabelPosition &&
      prevProps.afterLabelPosition === nextProps.afterLabelPosition &&
      prevProps.labelMarginVertical === nextProps.labelMarginVertical &&
      prevProps.labelMarginHorizontal === nextProps.labelMarginHorizontal;
  });

  const renderFullScreenSinglePhoto = useCallback((photo) => {
    return (
      <FullScreenSinglePhotoItem
        photo={photo}
        photoBoundsMapRef={photoBoundsMap}
        showLabels={showLabels}
        beforeLabelPosition={beforeLabelPosition}
        afterLabelPosition={afterLabelPosition}
        labelMarginVertical={labelMarginVertical}
        labelMarginHorizontal={labelMarginHorizontal}
        t={t}
      />
    );
  }, [showLabels, beforeLabelPosition, afterLabelPosition, labelMarginVertical, labelMarginHorizontal, t]);

  // Render combined photo full screen
  const renderFullScreenCombinedPhoto = (photoSet) => {
    const phoneOrientation = photoSet.before.orientation || 'portrait';
    const cameraViewMode = photoSet.before.cameraViewMode || 'portrait';
    const isLetterbox = photoSet.before.templateType === 'letterbox' || (phoneOrientation === 'portrait' && cameraViewMode === 'landscape');

    return (
      <View style={styles.fullScreenPhotoContainer}>
        <View 
          style={[
            styles.fullScreenCombinedPreview,
            isLetterbox ? styles.fullScreenStacked : styles.fullScreenSideBySide
          ]}
        >
          <View style={styles.fullScreenHalf}>
            <Image
              source={{ uri: photoSet.before.uri }}
              style={styles.fullScreenHalfImage}
              resizeMode="cover"
            />
            {showLabels && (
              <PhotoLabel label="common.before" position={combinedLabelPosition} />
            )}
          </View>
          <View style={styles.fullScreenHalf}>
            <Image
              source={{ uri: photoSet.after.uri }}
              style={styles.fullScreenHalfImage}
              resizeMode="cover"
            />
            {showLabels && (
              <PhotoLabel label="common.after" position={combinedLabelPosition} />
            )}
          </View>
        </View>
      </View>
    );
  };

  // PanResponder for swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dy, dx } = gestureState;
        return Math.abs(dy) > Math.abs(dx) * 2 && Math.abs(dy) > 30;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy, dx } = gestureState;
        const threshold = 100;
        
        if (Math.abs(dy) > Math.abs(dx) * 2 && dy > threshold) {
          handleLongPressEnd();
        }
      }
    })
  ).current;

  const renderPhoto = (photo, index) => {
    const borderColor = photo.mode === PHOTO_MODES.BEFORE 
      ? '#4CAF50' 
      : photo.mode === PHOTO_MODES.AFTER 
      ? '#2196F3' 
      : '#FFC107';

    // Render combined photo
    if (photo.mode === PHOTO_MODES.COMBINED && photo.before && photo.after) {
      const phoneOrientation = photo.before.orientation || 'portrait';
      const cameraViewMode = photo.before.cameraViewMode || 'portrait';
      const isLetterbox = photo.before.templateType === 'letterbox' || (phoneOrientation === 'portrait' && cameraViewMode === 'landscape');
      const isTrueLandscape = phoneOrientation === 'landscape';
      const useStackedLayout = isTrueLandscape || isLetterbox;

      const handleCombinedPress = () => {
        if (longPressTriggered.current) return;
        // Single tap - open full screen preview
        handleDoubleTap(null, { before: photo.before, after: photo.after, name: photo.name, room: photo.room });
      };

      return (
        <TouchableOpacity
          key={photo.id}
          style={[styles.photoContainer, { borderColor }]}
          onPress={handleCombinedPress}
          onPressIn={() => handleLongPressStart(null, { before: photo.before, after: photo.after, name: photo.name, room: photo.room })}
          onPressOut={handleLongPressEnd}
        >
          <View style={[styles.combinedThumbnail, useStackedLayout ? styles.stackedThumbnail : styles.sideBySideThumbnail]}>
            <Image 
              source={{ uri: photo.before.uri }} 
              style={styles.halfImage} 
              resizeMode="cover" 
            />
            <Image 
              source={{ uri: photo.after.uri }} 
              style={styles.halfImage} 
              resizeMode="cover" 
            />
          </View>

          {/* Mode label */}
          <View style={[styles.modeLabel, { backgroundColor: borderColor }]}>
            <Text style={styles.modeLabelText}>
              {t('camera.combined', { lng: labelLanguage })}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Render regular photo
    const handleRegularPress = () => {
      if (longPressTriggered.current) return;
      // Single tap - open full screen preview
      handleDoubleTap(photo);
    };

    return (
      <TouchableOpacity
        key={photo.id}
        style={[styles.photoContainer, { borderColor }]}
        onPress={handleRegularPress}
        onPressIn={() => handleLongPressStart(photo)}
        onPressOut={handleLongPressEnd}
      >
        <CroppedThumbnail
          imageUri={photo.uri}
          aspectRatio={photo.aspectRatio || '4:3'}
          orientation={photo.orientation || 'portrait'}
          size={PHOTO_SIZE}
        />

        {/* Mode label */}
        <View style={[styles.modeLabel, { backgroundColor: borderColor }]}>
          <Text style={styles.modeLabelText}>
            {photo.mode === PHOTO_MODES.BEFORE 
              ? t('camera.before', { lng: labelLanguage })
              : photo.mode === PHOTO_MODES.AFTER
              ? t('camera.after', { lng: labelLanguage })
              : t('camera.combined', { lng: labelLanguage })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('gallery.selectedPhotos')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {selectedPhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('gallery.noSelectedPhotos')}</Text>
        </View>
      ) : (
        <>
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.photoGrid}
          >
            {selectedPhotos.map((photo, index) => renderPhoto(photo, index))}
          </ScrollView>
          
          {/* Confirm button */}
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.confirmButtonText}>
                {t('common.confirm')}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Full-screen photo view with swipe navigation */}
      {(fullScreenPhoto || fullScreenPhotoSet) && fullScreenPhotos.length > 0 && (
        <View style={styles.fullScreenPhotoContainer} {...panResponder.panHandlers}>
          <ScrollView
            ref={fullScreenScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={Dimensions.get('window').width}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onMomentumScrollEnd={handleFullScreenScroll}
            directionalLockEnabled={true}
            bounces={false}
            scrollEnabled={true}
          >
            {fullScreenPhotos.map((item, index) => (
              <View key={item.id} style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height }}>
                {item.type === 'single' && item.photo ? (
                  renderFullScreenSinglePhoto(item.photo)
                ) : item.type === 'combined' && item.photoSet ? (
                  renderFullScreenCombinedPhoto(item.photoSet)
                ) : null}
              </View>
            ))}
          </ScrollView>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleLongPressEnd}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Legacy full-screen photo view */}
      {fullScreenPhoto && fullScreenPhotos.length === 0 && (
        <View style={styles.fullScreenPhotoContainer} {...panResponder.panHandlers}>
          {renderFullScreenSinglePhoto(fullScreenPhoto)}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleLongPressEnd}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Legacy full-screen combined photo view */}
      {fullScreenPhotoSet && fullScreenPhotos.length === 0 && (
        <View style={styles.fullScreenPhotoContainer} {...panResponder.panHandlers}>
          {renderFullScreenCombinedPhoto(fullScreenPhotoSet)}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleLongPressEnd}
            activeOpacity={0.7}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingTop: 50
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
    fontSize: 24,
    fontWeight: 'bold'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    flex: 1,
    textAlign: 'center'
  },
  scrollView: {
    flex: 1
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: CONTAINER_PADDING,
    gap: PHOTO_SPACING
  },
  photoContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: 'white',
    position: 'relative',
    marginBottom: PHOTO_SPACING
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
  modeLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  modeLabelText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: 'center'
  },
  actionBar: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20
  },
  confirmButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.PRIMARY,
    minHeight: 48
  },
  confirmButtonText: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: 'bold'
  },
  fullScreenPhotoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  fullScreenImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
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
    flex: 1,
    position: 'relative'
  },
  fullScreenHalfImage: {
    width: '100%',
    height: '100%'
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    elevation: 5
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 24
  }
});

