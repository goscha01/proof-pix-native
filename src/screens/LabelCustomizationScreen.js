import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal as RNModal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { COLORS, getLabelPositions } from '../constants/rooms';
import PhotoLabel from '../components/PhotoLabel';
import { ColorPicker, fromHsv } from 'react-native-color-picker';
import { useTranslation } from 'react-i18next';

const getLabelSizeOptions = (t) => [
  { key: 'small', label: t('labelCustomization.small') },
  { key: 'medium', label: t('labelCustomization.medium') },
  { key: 'large', label: t('labelCustomization.large') },
];

const LABEL_SIZE_STYLE_MAP = {
  small: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 72,
  },
  medium: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 96,
  },
  large: {
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 104,
  },
};

const getLabelCornerOptions = (t) => [
  { key: 'rounded', label: t('labelCustomization.cornerOptions.rounded') },
  { key: 'square', label: t('labelCustomization.cornerOptions.straight') },
];

const getFontOptions = (t) => [
  { key: 'system', label: t('labelCustomization.fontModal.systemDefault'), fontFamily: null },
  { key: 'montserratBold', label: t('labelCustomization.fontModal.montserratBold'), fontFamily: 'Montserrat_700Bold' },
  { key: 'robotoBold', label: t('labelCustomization.fontModal.robotoBold'), fontFamily: 'Roboto_700Bold' },
  { key: 'openSansBold', label: t('labelCustomization.fontModal.openSansBold'), fontFamily: 'OpenSans_700Bold' },
  { key: 'latoBlack', label: t('labelCustomization.fontModal.latoBlack'), fontFamily: 'Lato_900Black' },
  { key: 'poppinsBold', label: t('labelCustomization.fontModal.poppinsBold'), fontFamily: 'Poppins_700Bold' },
  { key: 'ralewayBold', label: t('labelCustomization.fontModal.ralewayBold'), fontFamily: 'Raleway_700Bold' },
  { key: 'oswaldBold', label: t('labelCustomization.fontModal.oswaldBold'), fontFamily: 'Oswald_700Bold' },
  { key: 'archivoBlack', label: t('labelCustomization.fontModal.archivoBlack'), fontFamily: 'ArchivoBlack_400Regular' },
];

export default function LabelCustomizationScreen({ navigation }) {
  const { t } = useTranslation();
  const {
    labelBackgroundColor,
    labelTextColor,
    labelFontFamily,
    labelSize,
    labelCornerStyle,
    beforeLabelPosition,
    afterLabelPosition,
    combinedLabelPosition,
    labelMarginVertical,
    labelMarginHorizontal,
    updateLabelBackgroundColor,
    updateLabelTextColor,
    updateLabelFontFamily,
    updateLabelSize,
    updateLabelCornerStyle,
    updateBeforeLabelPosition,
    updateAfterLabelPosition,
    updateCombinedLabelPosition,
    updateLabelMarginVertical,
    updateLabelMarginHorizontal,
  } = useSettings();

  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [colorModalType, setColorModalType] = useState(null);
  const [draftColor, setDraftColor] = useState('#FFD700');
  const [colorInput, setColorInput] = useState('');
  const [hexModalVisible, setHexModalVisible] = useState(false);
  const [hexModalValue, setHexModalValue] = useState('');
  const [hexModalError, setHexModalError] = useState(null);
  const [fontModalVisible, setFontModalVisible] = useState(false);

  const LABEL_SIZE_OPTIONS = useMemo(() => getLabelSizeOptions(t), [t]);
  const LABEL_CORNER_OPTIONS = useMemo(() => getLabelCornerOptions(t), [t]);
  const FONT_OPTIONS = useMemo(() => getFontOptions(t), [t]);

  const currentFontOption = useMemo(() => {
    const normalized = labelFontFamily?.toLowerCase();
    return FONT_OPTIONS.find(
      (opt) => opt.key.toLowerCase() === normalized
    ) || FONT_OPTIONS[0];
  }, [labelFontFamily, FONT_OPTIONS]);

  const normalizeHex = (input) => {
    if (!input) return null;
    let cleaned = input.trim();
    if (cleaned.startsWith('#')) {
      cleaned = cleaned.substring(1);
    }
    if (/^[0-9A-F]{3}$/i.test(cleaned)) {
      cleaned = cleaned
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (/^[0-9A-F]{6}$/i.test(cleaned)) {
      return `#${cleaned.toUpperCase()}`;
    }
    const rgbMatch = cleaned.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1], 10);
      const g = parseInt(rgbMatch[2], 10);
      const b = parseInt(rgbMatch[3], 10);
      if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
        const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
        return `#${hex.toUpperCase()}`;
      }
    }
    return null;
  };

  const hsvToHex = ({ h, s, v }) => {
    const hNorm = h / 360;
    const sNorm = s / 100;
    const vNorm = v / 100;
    const c = vNorm * sNorm;
    const x = c * (1 - Math.abs(((hNorm * 6) % 2) - 1));
    const m = vNorm - c;
    let r = 0,
      g = 0,
      b = 0;
    if (hNorm < 1 / 6) {
      [r, g, b] = [c, x, 0];
    } else if (hNorm < 2 / 6) {
      [r, g, b] = [x, c, 0];
    } else if (hNorm < 3 / 6) {
      [r, g, b] = [0, c, x];
    } else if (hNorm < 4 / 6) {
      [r, g, b] = [0, x, c];
    } else if (hNorm < 5 / 6) {
      [r, g, b] = [x, 0, c];
    } else {
      [r, g, b] = [c, 0, x];
    }
    const rInt = Math.round((r + m) * 255);
    const gInt = Math.round((g + m) * 255);
    const bInt = Math.round((b + m) * 255);
    const hex = ((rInt << 16) | (gInt << 8) | bInt).toString(16).padStart(6, '0');
    return `#${hex.toUpperCase()}`;
  };

  const openColorModal = (type) => {
    const currentColor = type === 'background' ? labelBackgroundColor : labelTextColor;
    setColorModalType(type);
    setDraftColor(currentColor);
    setColorInput(currentColor);
    setColorModalVisible(true);
  };

  const handleColorModalCancel = () => {
    setColorModalVisible(false);
    setColorModalType(null);
  };

  const handleColorModalApply = async () => {
    if (colorModalType === 'background') {
      await updateLabelBackgroundColor(draftColor);
    } else if (colorModalType === 'text') {
      await updateLabelTextColor(draftColor);
    }
    setColorModalVisible(false);
    setColorModalType(null);
  };

  const openHexModal = () => {
    const normalized = normalizeHex(colorInput);
    setDraftColor(normalized);
    setColorInput(normalized);
    setHexModalValue(normalized);
    setHexModalError(null);
    setHexModalVisible(true);
  };

  const handleHexModalChange = (text) => {
    const input = text.toUpperCase();
    setHexModalValue(input);
    if (!input) {
      setHexModalError(null);
      return;
    }
    const normalized = normalizeHex(input);
    if (normalized) {
      setHexModalError(null);
    } else if (input.length >= 4) {
      setHexModalError('Enter #RRGGBB, #RGB, or rgb(r, g, b)');
    } else {
      setHexModalError(null);
    }
  };

  const handleHexModalCancel = () => {
    setHexModalVisible(false);
    setHexModalError(null);
  };

  const handleHexModalApply = () => {
    const normalized = normalizeHex(hexModalValue);
    if (!normalized) {
      setHexModalError('Enter #RRGGBB, #RGB, or rgb(r, g, b)');
      return;
    }
    handleDraftColorChange(normalized, { source: 'complete' });
    setHexModalVisible(false);
  };

  const handleDraftColorChange = (color, arg1 = {}, arg2 = null) => {
    let options = {};
    let hsvMeta = null;

    if (arg1 && typeof arg1 === 'object' && 'source' in arg1) {
      options = arg1;
      hsvMeta = arg2;
    } else {
      hsvMeta = arg1;
      options = arg2 && typeof arg2 === 'object' ? arg2 : {};
    }

    const { source } = options;

    let candidateHex = normalizeHex(color);
    if (hsvMeta && typeof hsvMeta === 'object') {
      const { h = 0, s = 0, v = 0 } = hsvMeta;
      if (colorModalType === 'text' && v <= 1) {
        candidateHex = hsvToHex({ h, s, v: 100 });
      } else {
        candidateHex = hsvToHex({ h, s, v });
      }
    }
    const normalized = normalizeHex(candidateHex);
    if (!normalized) {
      return;
    }
    setDraftColor(normalized);
    setColorInput(normalized);
    setHexModalValue(normalized);
    setHexModalError(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('labelCustomization.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionDescription}>
          {t('labelCustomization.description')}
        </Text>

        {/* Background Color */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>{t('labelCustomization.backgroundColor')}</Text>
            <Text style={styles.settingDescription}>
              {labelBackgroundColor?.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.customSelectorButton}
            onPress={() => openColorModal('background')}
          >
            <View
              style={[
                styles.colorPreviewSwatch,
                { backgroundColor: labelBackgroundColor },
              ]}
            />
            <Text style={styles.customSelectorButtonText}>{t('labelCustomization.pickColor')}</Text>
          </TouchableOpacity>
        </View>

        {/* Text Color */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>{t('labelCustomization.textColor')}</Text>
            <Text style={styles.settingDescription}>
              {labelTextColor?.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.customSelectorButton}
            onPress={() => openColorModal('text')}
          >
            <View
              style={[
                styles.colorPreviewSwatch,
                { backgroundColor: labelTextColor },
              ]}
            />
            <Text style={styles.customSelectorButtonText}>{t('labelCustomization.pickColor')}</Text>
          </TouchableOpacity>
        </View>

        {/* Font Style */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>{t('labelCustomization.fontStyle')}</Text>
            <Text style={styles.settingDescription}>
              {currentFontOption?.label}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.fontSelectorButton}
            onPress={() => setFontModalVisible(true)}
          >
            <Text style={styles.fontSelectorButtonText}>{t('labelCustomization.chooseFont')}</Text>
          </TouchableOpacity>
        </View>

        {/* Corner Style */}
        <View style={styles.settingRowStacked}>
          <View style={styles.cornerControlsRow}>
            <Text style={styles.settingLabel}>{t('labelCustomization.cornerStyle')}</Text>
            <View style={styles.cornerOptions}>
              {LABEL_CORNER_OPTIONS.map((option) => {
                const isSelected = labelCornerStyle === option.key;
                const buttonBorderRadius = option.key === 'square' ? 0 : 8;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.cornerOption,
                      { borderRadius: buttonBorderRadius },
                      isSelected && styles.cornerOptionSelected,
                    ]}
                    onPress={() => updateLabelCornerStyle(option.key)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.cornerOptionText,
                        isSelected && styles.cornerOptionTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Label Size */}
        <Text style={styles.settingLabel}>{t('labelCustomization.labelSize')}</Text>
        <View style={styles.labelPreviewContainer}>
          <View style={styles.labelPreview}>
            {LABEL_SIZE_OPTIONS.map((option) => {
              const sizeStyle =
                LABEL_SIZE_STYLE_MAP[option.key] || LABEL_SIZE_STYLE_MAP.medium;
              const cornerRadius =
                labelCornerStyle === 'square' ? 0 : sizeStyle.borderRadius;
              const isSelected = labelSize === option.key;
              const swatchBackground = isSelected ? labelBackgroundColor : '#E0E0E0';
              const swatchTextColor = isSelected ? labelTextColor : '#666666';
              return (
                <TouchableOpacity
                  key={option.key}
                  style={styles.previewLabelOption}
                  onPress={() => updateLabelSize(option.key)}
                  activeOpacity={0.85}
                >
                  <PhotoLabel
                    label="common.before"
                    position="left-top"
                    style={{
                      position: 'relative',
                      top: 0,
                      left: 0,
                      paddingHorizontal: sizeStyle.paddingHorizontal,
                      paddingVertical: sizeStyle.paddingVertical,
                      minWidth: sizeStyle.minWidth,
                      borderRadius: cornerRadius,
                      borderWidth: 1,
                      borderColor: isSelected ? 'transparent' : '#D0D0D0',
                    }}
                    textStyle={{
                      fontSize: sizeStyle.fontSize,
                    }}
                    backgroundColor={swatchBackground}
                    textColor={swatchTextColor}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Label Position */}
        <View style={styles.settingRowStacked}>
          <Text style={styles.settingLabel}>{t('labelCustomization.labelPosition')}</Text>
          <Text style={styles.settingDescription}>
            {t('labelCustomization.positionDescription')}
          </Text>

          {/* Dummy Photo Preview */}
          <View style={styles.positionPreviewContainer}>
            <View style={styles.positionPreviewBox}>
              {/* Left half - BEFORE */}
              <View style={styles.previewHalfBefore}>
                <View
                  style={[
                    styles.previewLabelPosition,
                    getLabelPositions(labelMarginVertical, labelMarginHorizontal)[beforeLabelPosition]
                  ]}
                >
                  <PhotoLabel
                    label="common.before"
                    position="left-top"
                    style={{ position: 'relative', top: 0, left: 0 }}
                  />
                </View>
              </View>

              {/* Right half - AFTER */}
              <View style={styles.previewHalfAfter}>
                <View
                  style={[
                    styles.previewLabelPosition,
                    getLabelPositions(labelMarginVertical, labelMarginHorizontal)[afterLabelPosition]
                  ]}
                >
                  <PhotoLabel
                    label="common.after"
                    position="left-top"
                    style={{ position: 'relative', top: 0, left: 0 }}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Grid-Based Position Selector */}
          <View style={styles.positionGridContainer}>
            {/* Grid for BEFORE (left side) */}
            <View style={styles.gridHalf}>
              <View style={styles.gridRow}>
                {['left-top', 'center-top', 'right-top'].map((key) => (
                  <TouchableOpacity
                    key={`before-${key}`}
                    style={[
                      styles.gridCell,
                      beforeLabelPosition === key && styles.gridCellSelected
                    ]}
                    onPress={() => {
                      updateBeforeLabelPosition(key);
                      updateCombinedLabelPosition(key);
                    }}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
              <View style={styles.gridRow}>
                {['left-middle', 'center-middle', 'right-middle'].map((key) => (
                  <TouchableOpacity
                    key={`before-${key}`}
                    style={[
                      styles.gridCell,
                      beforeLabelPosition === key && styles.gridCellSelected
                    ]}
                    onPress={() => {
                      updateBeforeLabelPosition(key);
                      updateCombinedLabelPosition(key);
                    }}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
              <View style={styles.gridRow}>
                {['left-bottom', 'center-bottom', 'right-bottom'].map((key) => (
                  <TouchableOpacity
                    key={`before-${key}`}
                    style={[
                      styles.gridCell,
                      beforeLabelPosition === key && styles.gridCellSelected
                    ]}
                    onPress={() => {
                      updateBeforeLabelPosition(key);
                      updateCombinedLabelPosition(key);
                    }}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
            </View>

            {/* Grid for AFTER (right side) */}
            <View style={styles.gridHalf}>
              <View style={styles.gridRow}>
                {['left-top', 'center-top', 'right-top'].map((key) => (
                  <TouchableOpacity
                    key={`after-${key}`}
                    style={[
                      styles.gridCell,
                      afterLabelPosition === key && styles.gridCellSelected
                    ]}
                    onPress={() => {
                      updateAfterLabelPosition(key);
                      updateCombinedLabelPosition(key);
                    }}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
              <View style={styles.gridRow}>
                {['left-middle', 'center-middle', 'right-middle'].map((key) => (
                  <TouchableOpacity
                    key={`after-${key}`}
                    style={[
                      styles.gridCell,
                      afterLabelPosition === key && styles.gridCellSelected
                    ]}
                    onPress={() => {
                      updateAfterLabelPosition(key);
                      updateCombinedLabelPosition(key);
                    }}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
              <View style={styles.gridRow}>
                {['left-bottom', 'center-bottom', 'right-bottom'].map((key) => (
                  <TouchableOpacity
                    key={`after-${key}`}
                    style={[
                      styles.gridCell,
                      afterLabelPosition === key && styles.gridCellSelected
                    ]}
                    onPress={() => {
                      updateAfterLabelPosition(key);
                      updateCombinedLabelPosition(key);
                    }}
                    activeOpacity={0.7}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Label Margins */}
        <View style={styles.settingRowStacked}>
          <Text style={styles.settingLabel}>{t('labelCustomization.labelMargins')}</Text>
          <Text style={styles.settingDescription}>
            {t('labelCustomization.marginsDescription')}
          </Text>

          {/* Vertical Margin Slider */}
          <View style={styles.marginSliderContainer}>
            <Text style={styles.marginSliderLabel}>
              {t('labelCustomization.verticalMargin', { value: labelMarginVertical })}
            </Text>
            <View style={styles.sliderWrapper}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={50}
                step={1}
                value={labelMarginVertical}
                onValueChange={updateLabelMarginVertical}
                minimumTrackTintColor={COLORS.PRIMARY}
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor={COLORS.PRIMARY}
              />
              <View style={styles.sliderDefaultMark} />
            </View>
          </View>

          {/* Horizontal Margin Slider */}
          <View style={styles.marginSliderContainer}>
            <Text style={styles.marginSliderLabel}>
              {t('labelCustomization.horizontalMargin', { value: labelMarginHorizontal })}
            </Text>
            <View style={styles.sliderWrapper}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={50}
                step={1}
                value={labelMarginHorizontal}
                onValueChange={updateLabelMarginHorizontal}
                minimumTrackTintColor={COLORS.PRIMARY}
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor={COLORS.PRIMARY}
              />
              <View style={styles.sliderDefaultMark} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Color Picker Modal */}
      <RNModal visible={colorModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={handleColorModalCancel}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.colorModalContainer}>
            <View style={styles.colorModalHeader}>
              <Text style={styles.colorModalTitle}>
                {colorModalType === 'background'
                  ? t('labelCustomization.colorPicker.backgroundTitle')
                  : t('labelCustomization.colorPicker.textTitle')}
              </Text>
              <TouchableOpacity onPress={openHexModal}>
                <Text style={styles.hexInputLink}>{t('labelCustomization.colorPicker.enterHex')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.colorPickerWrapper}>
              <ColorPicker
                color={draftColor}
                onColorChange={handleDraftColorChange}
                onColorSelected={(color) => {
                  const hex = fromHsv(color);
                  handleDraftColorChange(hex, { source: 'complete' });
                }}
                style={styles.colorPicker}
                hideSliders
              />
            </View>
            <View style={styles.colorPreview}>
              <View style={[styles.colorPreviewBox, { backgroundColor: draftColor }]} />
              <Text style={styles.colorPreviewText}>{draftColor}</Text>
            </View>
            <View style={styles.colorModalActions}>
              <TouchableOpacity
                style={[styles.colorModalButton, styles.cancelButton]}
                onPress={handleColorModalCancel}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.colorModalButton, styles.applyButton]}
                onPress={handleColorModalApply}
              >
                <Text style={styles.applyButtonText}>{t('common.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </RNModal>

      {/* Hex Input Modal */}
      <RNModal visible={hexModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={handleHexModalCancel}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.hexModalContainer}>
            <Text style={styles.hexModalTitle}>{t('labelCustomization.colorPicker.enterColor')}</Text>
            <TextInput
              style={styles.hexInput}
              value={hexModalValue}
              onChangeText={handleHexModalChange}
              placeholder={t('labelCustomization.colorPicker.hexPlaceholder')}
              placeholderTextColor="#999"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {hexModalError ? (
              <Text style={styles.hexModalError}>{hexModalError}</Text>
            ) : null}
            <View style={styles.hexModalActions}>
              <TouchableOpacity
                style={[styles.hexModalButton, styles.cancelButton]}
                onPress={handleHexModalCancel}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.hexModalButton, styles.applyButton]}
                onPress={handleHexModalApply}
              >
                <Text style={styles.applyButtonText}>{t('common.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </RNModal>

      {/* Font Modal */}
      <RNModal visible={fontModalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setFontModalVisible(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.fontModalContainer}>
          <View style={styles.fontModalHeader}>
            <Text style={styles.fontModalTitle}>{t('labelCustomization.fontModal.title')}</Text>
            <TouchableOpacity onPress={() => setFontModalVisible(false)}>
              <Text style={styles.fontModalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.fontList}>
            {FONT_OPTIONS.map((option) => {
              const isSelected = currentFontOption?.key === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.fontOption,
                    isSelected && styles.fontOptionSelected,
                  ]}
                  onPress={() => {
                    updateLabelFontFamily(option.key);
                    setFontModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.fontOptionLabel,
                      option.fontFamily && { fontFamily: option.fontFamily },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {isSelected && (
                    <Text style={styles.fontOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </RNModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  backButton: {
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.PRIMARY,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  settingRowStacked: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  customSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  colorPreviewSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  customSelectorButtonText: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '600',
  },
  fontSelectorButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  fontSelectorButtonText: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '600',
  },
  cornerControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cornerOptions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  cornerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: '#F5F5F5',
    minWidth: 100,
    alignItems: 'center',
  },
  cornerOptionSelected: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY,
  },
  cornerOptionText: {
    fontSize: 14,
    color: COLORS.GRAY,
    fontWeight: '600',
  },
  cornerOptionTextSelected: {
    color: '#000000',
  },
  labelPreviewContainer: {
    marginTop: 16,
  },
  labelPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  previewLabelOption: {
    alignItems: 'center',
  },
  previewLabel: {
    alignItems: 'center',
    minWidth: 0,
  },
  previewLabelText: {
    fontWeight: 'bold',
  },
  marginSliderContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  marginSliderLabel: {
    fontSize: 14,
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  sliderWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderDefaultMark: {
    position: 'absolute',
    left: '22.5%', // Corresponds to 10px, visually adjusted for track padding
    top: '50%',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    zIndex: -1,
  },
  positionGridContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 16,
  },
  gridHalf: {
    flex: 1,
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 4,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CCC',
  },
  gridCellSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  positionPreviewContainer: {
    marginVertical: 8,
    width: '100%',
  },
  positionPreviewBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  previewHalfBefore: {
    flex: 1,
    backgroundColor: '#D0D0D0',
    position: 'relative',
  },
  previewHalfAfter: {
    flex: 1,
    backgroundColor: '#A0A0A0',
    position: 'relative',
  },
  previewLabelPosition: {
    position: 'absolute',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  colorModalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  colorModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  hexInputLink: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  colorPickerWrapper: {
    height: 300,
    marginBottom: 16,
  },
  colorPicker: {
    flex: 1,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  colorPreviewBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  colorPreviewText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  colorModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  colorModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  applyButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  hexModalContainer: {
    width: '80%',
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  hexModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 16,
  },
  hexInput: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  hexModalError: {
    fontSize: 12,
    color: '#FF3B30',
    marginBottom: 16,
  },
  hexModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  hexModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fontModalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  fontModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  fontModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  fontModalClose: {
    fontSize: 24,
    color: COLORS.GRAY,
  },
  fontList: {
    flex: 1,
  },
  fontOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  fontOptionSelected: {
    backgroundColor: '#F9F9F9',
  },
  fontOptionLabel: {
    fontSize: 16,
    color: COLORS.TEXT,
  },
  fontOptionCheck: {
    fontSize: 18,
    color: COLORS.PRIMARY,
    fontWeight: '700',
  },
});
