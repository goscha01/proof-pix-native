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

const LABEL_SIZE_MAP = {
  small: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 70,
  },
  medium: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 88,
  },
  large: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 104,
  },
};

/**
 * Centralized photo label component for consistent styling across all screens
 * Supports custom background color, text color, and font family from settings
 */
export default function PhotoLabel({ label, style = {}, textStyle = {} }) {
  const {
    labelBackgroundColor,
    labelTextColor,
    labelFontFamily,
    labelSize,
    labelCornerStyle,
  } = useSettings();
  const canonicalKey = labelFontFamily || 'system';
  const normalizedKey = canonicalKey.toLowerCase();
  const selectedFontFamily =
    FONT_FAMILY_MAP[canonicalKey] ||
    FONT_FAMILY_MAP[normalizedKey] ||
    FONT_FAMILY_MAP[`${normalizedKey}legacy`] ||
    null;

  const sizeKey = labelSize && LABEL_SIZE_MAP[labelSize] ? labelSize : 'medium';
  const sizeStyle = LABEL_SIZE_MAP[sizeKey];
  const cornerRadius = labelCornerStyle === 'square' ? 0 : sizeStyle.borderRadius;

  return (
    <View
      style={[
        styles.label,
        {
          backgroundColor: labelBackgroundColor,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
          borderRadius: cornerRadius,
            minWidth: sizeStyle.minWidth,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.labelText,
          { color: labelTextColor, fontSize: sizeStyle.fontSize },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
