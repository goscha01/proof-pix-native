import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';
import { useTranslation } from 'react-i18next';
import PhotoLabel from '../components/PhotoLabel';

const { width } = Dimensions.get('window');

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'be', name: 'Беларуская', flag: '🇧🇾' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
];

export default function LabelLanguageSetupScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { labelLanguage, updateLabelLanguage } = useSettings();
  const [selectedLanguage, setSelectedLanguage] = useState(labelLanguage);
  const labelLanguageScrollViewRef = useRef(null);
  const labelLanguageLayouts = useRef({});

  // Update local state when labelLanguage changes
  useEffect(() => {
    setSelectedLanguage(labelLanguage);
  }, [labelLanguage]);

  // Scroll to selected language when modal opens
  useEffect(() => {
    if (labelLanguageScrollViewRef.current) {
      const currentLanguageCode = selectedLanguage;
      const yOffset = labelLanguageLayouts.current[currentLanguageCode];
      if (yOffset !== undefined) {
        setTimeout(() => {
          labelLanguageScrollViewRef.current?.scrollTo({ y: yOffset, animated: false });
        }, 100);
      }
    }
  }, [selectedLanguage]);

  const handleLanguageSelect = (languageCode) => {
    setSelectedLanguage(languageCode);
    updateLabelLanguage(languageCode);
  };

  const handleContinue = () => {
    navigation.replace('Home');
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  // Dummy photo URI - using a placeholder color as background
  const dummyPhotoWidth = width - 40;
  const dummyPhotoHeight = (dummyPhotoWidth * 3) / 4; // 4:3 aspect ratio

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleGoBack}
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>{t('labelLanguageSetup.title')}</Text>
        <Text style={styles.subtitle}>{t('labelLanguageSetup.subtitle')}</Text>

        {/* Dummy Photo Preview */}
        <View style={styles.photoContainer}>
          <View
            style={[
              styles.dummyPhoto,
              {
                width: dummyPhotoWidth,
                height: dummyPhotoHeight,
              },
            ]}
          >
            {/* Dummy photo background - gradient-like effect */}
            <View style={styles.dummyPhotoBackground}>
              <View style={styles.dummyPhotoTopHalf} />
              <View style={styles.dummyPhotoBottomHalf} />
            </View>

            {/* Before Label */}
            <View style={styles.beforeLabelContainer}>
              <PhotoLabel
                label="common.before"
                position="left-top"
                size="medium"
              />
            </View>

            {/* After Label */}
            <View style={styles.afterLabelContainer}>
              <PhotoLabel
                label="common.after"
                position="left-bottom"
                size="medium"
              />
            </View>
          </View>
          <Text style={styles.photoDescription}>{t('labelLanguageSetup.previewDescription')}</Text>
        </View>

        {/* Language Selection */}
        <View style={styles.languageSection}>
          <Text style={styles.sectionTitle}>{t('settings.labelLanguage')}</Text>
          <ScrollView
            ref={labelLanguageScrollViewRef}
            style={styles.languageScrollView}
            showsVerticalScrollIndicator={true}
          >
            {LANGUAGES.map((language) => (
              <TouchableOpacity
                key={language.code}
                onLayout={(event) => {
                  const layout = event.nativeEvent.layout;
                  labelLanguageLayouts.current[language.code] = layout.y;
                }}
                style={[
                  styles.languageOption,
                  selectedLanguage === language.code && styles.languageOptionActive,
                ]}
                onPress={() => handleLanguageSelect(language.code)}
              >
                <Text style={styles.languageFlag}>{language.flag}</Text>
                <Text
                  style={[
                    styles.languageOptionText,
                    selectedLanguage === language.code && styles.languageOptionTextActive,
                  ]}
                >
                  {language.name}
                </Text>
                {selectedLanguage === language.code && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>{t('common.continue')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    padding: 10,
  },
  backButtonText: {
    color: '#000000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: FONTS.QUICKSAND_BOLD,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  photoContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  dummyPhoto: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dummyPhotoBackground: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  dummyPhotoTopHalf: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#E8E8E8',
  },
  dummyPhotoBottomHalf: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#D0D0D0',
  },
  beforeLabelContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  afterLabelContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  photoDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  languageSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 16,
    fontFamily: FONTS.QUICKSAND_BOLD,
  },
  languageScrollView: {
    maxHeight: 300,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
  },
  languageOptionActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageOptionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.TEXT,
    fontWeight: '500',
  },
  languageOptionTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  checkmark: {
    fontSize: 20,
    color: '#000000',
    fontWeight: 'bold',
  },
  continueButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: FONTS.QUICKSAND_BOLD,
  },
});

