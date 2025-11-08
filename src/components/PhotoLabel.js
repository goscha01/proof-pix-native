import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '../context/SettingsContext';

const FONT_FAMILY_MAP = {
  system: null,
  montserratBold: 'Montserrat_700Bold',
  playfairBold: 'PlayfairDisplay_700Bold',
  robotoMonoBold: 'RobotoMono_700Bold',
  latoBold: 'Lato_700Bold',
  poppinsSemiBold: 'Poppins_600SemiBold',
  oswaldSemiBold: 'Oswald_600SemiBold',
  serif: 'PlayfairDisplay_700Bold',
  monospace: 'RobotoMono_700Bold',
  // legacy fallbacks
  seriflegacy: 'PlayfairDisplay_700Bold',
  monospacelegacy: 'RobotoMono_700Bold',
};

/**
 * Centralized photo label component for consistent styling across all screens
 * Supports custom background color, text color, and font family from settings
 */
export default function PhotoLabel({ label, style = {}, textStyle = {} }) {
  const { labelBackgroundColor, labelTextColor, labelFontFamily } = useSettings();
  const canonicalKey = labelFontFamily || 'system';
  const normalizedKey = canonicalKey.toLowerCase();
  const selectedFontFamily =
    FONT_FAMILY_MAP[canonicalKey] ||
    FONT_FAMILY_MAP[normalizedKey] ||
    FONT_FAMILY_MAP[`${normalizedKey}legacy`] ||
    null;

  return (
    <View style={[styles.label, { backgroundColor: labelBackgroundColor }, style]}>
      <Text
        style={[
          styles.labelText,
          { color: labelTextColor },
          selectedFontFamily ? { fontFamily: selectedFontFamily } : null,
          textStyle,
        ]}
      >
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
    borderRadius: 6,
  },
  labelText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
