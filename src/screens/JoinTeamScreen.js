import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useAdmin } from '../context/AdminContext';

export default function JoinTeamScreen({ navigation }) {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAdmin();

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
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

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
        >
          <Text style={styles.skipButtonText}>Skip - Use Individually</Text>
        </TouchableOpacity>

        <View style={styles.helpBox}>
          <Text style={styles.helpText}>
            Don't have an invite code? Ask your team administrator to generate one in Settings → Team Invites.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  joinButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    padding: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#007bff',
    fontSize: 15,
  },
  helpBox: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  helpText: {
    fontSize: 14,
    color: '#0066cc',
    textAlign: 'center',
    lineHeight: 20,
  },
});
