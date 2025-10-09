import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export const CroppedThumbnail = ({ imageUri, aspectRatio = '4:3', orientation = 'portrait', size = 120 }) => {
  // Show full photo centered in square container with bars
  return (
    <View style={[styles.thumbnailContainer, { width: size, height: size }]}>
      {/* Full image centered with flexbox */}
      <Image 
        source={{ uri: imageUri }} 
        style={{ width: size, height: size }} 
        resizeMode="contain" 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  thumbnailContainer: {
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden'
  }
});
