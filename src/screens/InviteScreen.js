import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAdmin } from '../context/AdminContext';

export default function InviteScreen({ route, navigation }) {
  const { token, sessionId } = route.params || {};
  const { joinTeam } = useAdmin();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const processInvite = async () => {
      // Validate required parameters
      if (!token || !sessionId) {
        setError('This invite link is invalid or incomplete. Please request a new link from your administrator.');
        setIsLoading(false);
        return;
      }

      try {
        const result = await joinTeam(token, sessionId);
        if (result.success) {
          // Navigate to home screen and reset the stack
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        } else {
          setError(result.error || 'An unknown error occurred while trying to join the team.');
          setIsLoading(false);
        }
      } catch (e) {
        setError('An unexpected error occurred. Please try again.');
        setIsLoading(false);
      }
    };

    processInvite();
  }, [token, sessionId, joinTeam, navigation]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Joining team...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return null; // Should not be reached
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    color: 'red',
  },
});
