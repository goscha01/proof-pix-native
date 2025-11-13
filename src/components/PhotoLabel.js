import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { LABEL_POSITIONS } from '../constants/rooms';

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
 * Supports custom background color, text color, font family, and position from settings
 * @param {string} label - The text to display (e.g., "BEFORE", "AFTER")
 * @param {string} position - Position key from LABEL_POSITIONS (e.g., "left-top", "center-middle")
 * @param {object} style - Additional custom styles to override
 * @param {object} textStyle - Additional custom text styles
 */
export default function PhotoLabel({ label, position = 'left-top', style = {}, textStyle = {} }) {
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

  // Get position styles from LABEL_POSITIONS constant
  const positionStyle = LABEL_POSITIONS[position] || LABEL_POSITIONS['left-top'];
  const { name, horizontalAlign, verticalAlign, ...positionCoordinates } = positionStyle;

  return (
    <View
      style={[
        styles.label,
        positionCoordinates,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
