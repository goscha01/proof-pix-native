import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useAdmin } from '../context/AdminContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';

export default function JoinTeamScreen({ navigation }) {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAdmin();
  const insets = useSafeAreaInsets();

  const handleJoinTeam = () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    // Parse invite code - format is "TOKEN|SCRIPTURL"
    const parts = inviteCode.trim().split('|');
    if (parts.length !== 2) {
      Alert.alert('Invalid Code', 'This invite code is not in the correct format. Please check with your admin.');
      return;
    }

    const [token, scriptUrl] = parts;

    if (!token || !scriptUrl) {
      Alert.alert('Invalid Code', 'This invite code is incomplete. Please check with your admin.');
      return;
    }

    // Navigate to Invite screen with the parsed data
    navigation.navigate('Invite', {
      token: token,
      scriptUrl: scriptUrl
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
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top, left: insets.left + 10 }]}
        onPress={handleGoBack}
      >
        <Text style={styles.backButtonText}>&larr; Back</Text>
      </TouchableOpacity>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
    marginTop: 40, // Add margin to avoid overlap with back button
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
    position: 'absolute',
    padding: 10,
    zIndex: 10,
  },
  backButtonText: {
    color: '#000',
    fontSize: 15,
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
