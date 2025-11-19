import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdmin } from '../context/AdminContext';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';
import { useTranslation } from 'react-i18next';
import dropboxAuthService from '../services/dropboxAuthService';
import dropboxService from '../services/dropboxService';

export default function GoogleSignUpScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { individualSignIn, adminSignIn } = useAdmin();
  const { plan } = route.params || {};
  const insets = useSafeAreaInsets();
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [isSigningInDropbox, setIsSigningInDropbox] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    try {
      let result;
      if (plan === 'business' || plan === 'enterprise') {
        result = await adminSignIn();
      } else {
        result = await individualSignIn();
      }
      
      if (result.success) {
        navigation.replace('LabelLanguageSetup');
      } else {
        Alert.alert(t('googleSignUp.signInError'), result.error || t('googleSignUp.unexpectedError'));
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleDropboxSignIn = async () => {
    if (!dropboxAuthService.isConfigured()) {
      Alert.alert(
        t('settings.featureUnavailable'),
        t('settings.dropboxNotConfigured')
      );
      return;
    }

    setIsSigningInDropbox(true);
    try {
      const result = await dropboxAuthService.signIn();
      
      // Find or create ProofPix folder
      try {
        const folderPath = await dropboxService.findOrCreateProofPixFolder();
        console.log('[DROPBOX] Folder ready:', folderPath);
      } catch (folderError) {
        console.error('[DROPBOX] Folder creation error:', folderError);
        // Don't fail the sign-in if folder creation fails
      }

      // Update state - reload tokens to ensure state is accurate
      await dropboxAuthService.loadStoredTokens();
      const isAuth = dropboxAuthService.isAuthenticated();
      const userInfo = dropboxAuthService.getUserInfo();
      
      if (isAuth && userInfo) {
        Alert.alert(
          t('settings.dropboxConnected'),
          t('settings.dropboxConnectedMessage', { email: userInfo?.email || '' }),
          [{ text: t('common.ok'), onPress: () => navigation.replace('LabelLanguageSetup') }]
        );
      } else {
        Alert.alert(t('common.error'), t('settings.dropboxSignInError'));
      }
    } catch (error) {
      console.error('[DROPBOX] Sign-in error:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('settings.dropboxSignInError')
      );
    } finally {
      setIsSigningInDropbox(false);
    }
  };

  const handleSkip = () => {
    navigation.replace('LabelLanguageSetup');
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top, left: insets.left + 10 }]}
        onPress={handleGoBack}
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>
      <View style={styles.content}>
        <Text style={styles.title}>{t('googleSignUp.title')}</Text>
        <Text style={styles.subtitle}>
          {t('googleSignUp.subtitle')}
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogleSignIn}
          disabled={isSigningInGoogle || isSigningInDropbox}
        >
          {isSigningInGoogle ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.buttonText, styles.googleButtonText]}>{t('settings.connectToGoogleAccount')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dropboxButton]}
          onPress={handleDropboxSignIn}
          disabled={isSigningInGoogle || isSigningInDropbox}
        >
          {isSigningInDropbox ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.buttonText, styles.dropboxButtonText]}>{t('settings.connectToDropbox')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.skipButton]}
          onPress={handleSkip}
          disabled={isSigningInGoogle || isSigningInDropbox}
        >
          <Text style={styles.buttonText}>{t('googleSignUp.skipForNow')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY, // Yellow background
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: FONTS.QUICKSAND_BOLD,
    marginTop: 40, // Avoid overlap with back button
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 50,
  },
  googleButton: {
    backgroundColor: '#000000', // Black background
    borderWidth: 1,
    borderColor: '#000000',
  },
  dropboxButton: {
    backgroundColor: '#0061FF', // Dropbox blue
  },
  skipButton: {
    backgroundColor: '#f0f0f0',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flexShrink: 1,
  },
  googleButtonText: {
    color: '#fff',
  },
  dropboxButtonText: {
    color: '#FFFFFF',
  },
  backButton: {
    position: 'absolute',
    padding: 10,
    zIndex: 10,
  },
  backButtonText: {
    color: '#000000', // Black arrow
    fontSize: 24,
    fontWeight: 'bold',
    flexShrink: 1,
  },
});
