import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated
} from 'react-native';
import { COLORS } from '../constants/rooms';

const UploadIndicatorLine = ({ uploadStatus, onPress }) => {
  const { activeUploads, queueLength } = uploadStatus;
  const hasActiveUploads = activeUploads.length > 0;
  const hasQueuedUploads = queueLength > 0;
  const showIndicator = hasActiveUploads || hasQueuedUploads;

  const animatedValue = useRef(new Animated.Value(0)).current;

  const getProgressWidth = () => {
    if (hasActiveUploads) {
      const upload = activeUploads[0];
      const { current, total } = upload.progress;
      const width = total > 0 ? (current / total) * 100 : 0;
      // console.log('🔍 getProgressWidth DETAILED:', {
      //   uploadId: upload.id,
      //   current,
      //   total,
      //   width,
      //   uploadProgress: upload.progress,
      //   hasActiveUploads,
      //   activeUploadsLength: activeUploads.length,
      //   widthString: `${width}%`
      // });
      return width;
    }
    // console.log('🔍 getProgressWidth: No active uploads');
    return 0;
  };

  // Debug logging
  // useEffect(() => {
  //   const progressWidth = getProgressWidth();
  //   console.log('📊 UploadIndicatorLine: Progress update', {
  //     current: hasActiveUploads ? activeUploads[0].progress.current : 0,
  //     total: hasActiveUploads ? activeUploads[0].progress.total : 0,
  //     progressWidth
  //   });
  // }, [hasActiveUploads, activeUploads, uploadStatus]);

  useEffect(() => {
    if (showIndicator) {
      // Start pulsing animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      return () => pulseAnimation.stop();
    } else {
      animatedValue.setValue(0);
    }
  }, [showIndicator, animatedValue]);

  if (!showIndicator) {
    // console.log('📊 UploadIndicatorLine: Not showing indicator');
    return null;
  }

  const getIndicatorColor = () => {
    if (hasActiveUploads) {
      return COLORS.PRIMARY; // Default yellow color
    } else if (hasQueuedUploads) {
      return COLORS.PRIMARY; // Default yellow color
    }
    return COLORS.PRIMARY;
  };

  const getPhotoCountText = () => {
    if (hasActiveUploads) {
      const upload = activeUploads[0];
      const { current, total } = upload.progress;
      const text = `${current}/${total}`; // Shorter text
      // console.log('🔍 getPhotoCountText:', { current, total, text, hasActiveUploads });
      return text;
    } else if (hasQueuedUploads) {
      const text = `${queueLength} queued`; // Shorter text
      // console.log('🔍 getPhotoCountText queued:', { queueLength, text });
      return text;
    }
    // console.log('🔍 getPhotoCountText: No text');
    return '';
  };

  const getTotalPhotos = () => {
    if (hasActiveUploads) {
      const upload = activeUploads[0];
      return upload.items.length;
    } else if (hasQueuedUploads) {
      return queueLength;
    }
    return 0;
  };

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  // console.log('🔍 UploadIndicatorLine: RENDERING DETAILED', {
  //   color: getIndicatorColor(),
  //   progressWidth: getProgressWidth(),
  //   showIndicator,
  //   hasActiveUploads,
  //   hasQueuedUploads,
  //   activeUploadsCount: activeUploads.length,
  //   queueLength,
  //   uploadStatusKeys: Object.keys(uploadStatus),
  //   fullUploadStatus: uploadStatus
  // });

  return (
    <TouchableOpacity 
      key={`upload-indicator-${hasActiveUploads ? activeUploads[0]?.id : 'none'}-${hasActiveUploads ? activeUploads[0]?.progress?.current : 0}`}
      style={styles.container}
      onPress={() => {
        // console.log('📊 UploadIndicatorLine: Pressed');
        onPress && onPress();
      }}
      activeOpacity={0.7}
    >
      <View 
        style={styles.indicatorContainer}
        onLayout={(event) => {
          // console.log('🔍 INDICATOR CONTAINER LAYOUT:', {
          //   layout: event.nativeEvent.layout,
          //   progressWidth: getProgressWidth(),
          //   hasActiveUploads
          // });
        }}
      >
        <View 
          style={[
            styles.progressLineContainer,
            { backgroundColor: '#E0E0E0' } // Ensure background is visible
          ]}
          onLayout={(event) => {
            // console.log('🔍 PROGRESS LINE CONTAINER LAYOUT:', {
            //   layout: event.nativeEvent.layout,
            //   progressWidth: getProgressWidth(),
            //   widthPercent: `${getProgressWidth()}%`
            // });
          }}
        >
          {/* Progress fill */}
          {hasActiveUploads && (
            <View 
              key={`progress-fill-${activeUploads[0]?.progress?.current}-${activeUploads[0]?.progress?.total}`}
              style={[
                styles.progressFill,
                { 
                  backgroundColor: '#F2C31B', // Use the primary color directly
                  height: '100%',
                  width: `${getProgressWidth()}%`,
                  minWidth: getProgressWidth() > 0 ? '2px' : '0px' // Ensure minimum visibility
                }
              ]} 
              onLayout={(event) => {
                // console.log('🔍 PROGRESS FILL LAYOUT:', {
                //   width: `${getProgressWidth()}%`,
                //   backgroundColor: getIndicatorColor(),
                //   layout: event.nativeEvent.layout,
                //   progressWidth: getProgressWidth()
                // });
              }}
            />
          )}
          {/* Debug: Show progress width */}
          {hasActiveUploads && (
            <Text style={{ position: 'absolute', top: -20, left: 0, fontSize: 10, color: 'red', zIndex: 1000 }}>
              {getProgressWidth()}%
            </Text>
          )}
        </View>
        <View style={styles.countContainer}>
          <Text style={styles.countText}>{getPhotoCountText()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
  },
  indicatorContainer: {
    height: 20, // Reduced height for smaller text
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20, // Match project name padding
  },
  progressLineContainer: {
    flex: 0.9, // 90% of screen width
    height: 6, // Increased height for better visibility
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 3,
    opacity: 1.0, // Make it fully visible
  },
  countContainer: {
    flex: 0.1, // 10% of screen width (reduced from 20%)
    alignItems: 'flex-start', // Left align for better readability
    justifyContent: 'center',
    paddingLeft: 8,
  },
  countText: {
    color: '#666666', // Gray color
    fontSize: 13, // 20% smaller than 16px (16 * 0.8 = 12.8, rounded to 13)
    fontWeight: '600',
  },
});

export default UploadIndicatorLine;
