import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/rooms';

/**
 * Centralized photo label component for consistent styling across all screens
 */
export default function PhotoLabel({ label, style = {}, textStyle = {} }) {
  return (
    <View style={[styles.label, style]}>
      <Text style={[styles.labelText, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  labelText: {
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: 'bold'
  },
});
