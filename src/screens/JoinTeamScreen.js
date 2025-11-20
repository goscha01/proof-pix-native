import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useAdmin } from '../context/AdminContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';
import { useTranslation } from 'react-i18next';

export default function JoinTeamScreen({ navigation, route }) {
  const { t } = useTranslation();
  // Check if invite code came from deep link
  const inviteFromDeepLink = route?.params?.invite || '';
  const [inviteCode, setInviteCode] = useState(inviteFromDeepLink);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAdmin();

  // Auto-fill invite code from deep link (for users who already have the app)
  useEffect(() => {
    if (inviteFromDeepLink) {
      console.log('[JoinTeam] Deep link invite detected:', inviteFromDeepLink);
      setInviteCode(inviteFromDeepLink);
    }
  }, [inviteFromDeepLink]);

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    // Parse invite code - format is "TOKEN|SESSIONID" (proxy server format)
    // Legacy format "TOKEN|SCRIPTURL" is also supported for backward compatibility
    const parts = inviteCode.trim().split('|');
    if (parts.length !== 2) {
      Alert.alert('Invalid Code', 'This invite code is not in the correct format. Please check with your admin.');
      return;
    }

    const [token, sessionIdOrUrl] = parts;

    if (!token || !sessionIdOrUrl) {
      Alert.alert('Invalid Code', 'This invite code is incomplete. Please check with your admin.');
      return;
    }

    // Proxy server format: token|sessionId
    navigation.navigate('Invite', {
      token: token,
      sessionId: sessionIdOrUrl
    });
  };

  const handleSkip = () => {
    navigation.navigate('Home');
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.formContainer}>
            <Text style={styles.title}>Join a Team</Text>
            <Text style={styles.subtitle}>
              Enter the invite code your team admin shared with you
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleJoinTeam}
            />

            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinTeam}
              disabled={isLoading}
            >
              <Text style={styles.joinButtonText}>
                {isLoading ? 'Joining...' : 'Join Team'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/PP_logo_app.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appTitle}>ProofPix</Text>
            <Text style={styles.appSubtitle}>Before & After Photo Management</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2C31B',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 30,
  },
  formContainer: {
    width: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: 'white',
    color: COLORS.TEXT,
    marginBottom: 16,
  },
  joinButton: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 0,
    marginRight: 5,
  },
  appTitle: {
    fontSize: FONTS.XXXLARGE,
    fontWeight: FONTS.BOLD,
    fontFamily: FONTS.QUICKSAND_BOLD,
    color: '#000000',
    marginBottom: 0,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    marginTop: 0,
  },
});
