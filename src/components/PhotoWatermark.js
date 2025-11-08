import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS } from '../constants/rooms';

/**
 * Watermark component that displays "Created with ProofPix.com" with a clickable link
 * Positioned at the bottom-right corner of photos
 * Uses same styling as PhotoLabel with 80% opacity
 */
export default function PhotoWatermark({ style = {}, textStyle = {}, onPress }) {
  const watermarkUrl = process.env.EXPO_PUBLIC_WATERMARK_URL || 'https://geos-ai.com/';

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      Linking.openURL(watermarkUrl).catch(err => console.error('Failed to open URL:', err));
    }
  };

  return (
    <View style={[styles.watermark, style]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        <Text style={[styles.watermarkText, textStyle]}>Created with ProofPix.com</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  watermark: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    opacity: 0.5
  },
  watermarkText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold'
  },
});
