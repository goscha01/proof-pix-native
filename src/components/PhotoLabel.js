import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/rooms';
import { useSettings } from '../context/SettingsContext';

/**
 * Centralized photo label component for consistent styling across all screens
 * Now supports custom background color, text color, and font family from settings
 */
export default function PhotoLabel({ label, style = {}, textStyle = {} }) {
  const { labelBackgroundColor, labelTextColor, labelFontFamily } = useSettings();

  const getFontFamilyStyle = () => {
    switch (labelFontFamily) {
      case 'Serif':
        return { fontFamily: 'serif' };
      case 'Monospace':
        return { fontFamily: 'monospace' };
      case 'System':
      default:
        return {};
    }
  };

  return (
    <View style={[styles.label, { backgroundColor: labelBackgroundColor }, style]}>
      <Text style={[styles.labelText, { color: labelTextColor }, getFontFamilyStyle(), textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  labelText: {
    fontSize: 14,
    fontWeight: 'bold'
  },
});
