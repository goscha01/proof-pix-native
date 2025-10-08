import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export const CroppedThumbnail = ({ imageUri, aspectRatio = '4:3', size = 120 }) => {
  let frameWidth, frameHeight;

  if (aspectRatio === '4:3') {
    // Horizontal: width is full, height is smaller (bars top/bottom)
    frameWidth = size;
    frameHeight = (size / 4) * 3;
  } else {
    // Vertical: height is full, width is smaller (bars left/right)
    frameHeight = size;
    frameWidth = (size / 3) * 2;
  }

  const verticalOffset = (size - frameHeight) / 2;
  const horizontalOffset = (size - frameWidth) / 2;

  return (
    <View style={[styles.thumbnailContainer, { width: size, height: size }]}>
      {/* Dark background */}
      <View style={styles.thumbnailBackground} />

      {/* Cropped image in center */}
      <View style={[styles.thumbnailCropped, {
        width: frameWidth,
        height: frameHeight,
        top: verticalOffset,
        left: horizontalOffset
      }]}>
        <Image source={{ uri: imageUri }} style={styles.thumbnailImage} resizeMode="cover" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  thumbnailContainer: {
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden'
  },
  thumbnailBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000'
  },
  thumbnailCropped: {
    position: 'absolute',
    overflow: 'hidden'
  },
  thumbnailImage: {
    width: '100%',
    height: '100%'
  }
});
