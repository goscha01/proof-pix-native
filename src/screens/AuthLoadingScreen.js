import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useAdmin } from '../context/AdminContext';

export default function AuthLoadingScreen({ navigation }) {
  const { userName, loading: settingsLoading } = useSettings();
  const { isLoading: adminLoading } = useAdmin();

  useEffect(() => {
    const navigate = () => {
      // If userName is set, user has completed initial setup
      if (userName && userName.trim() !== '') {
        navigation.replace('Home');
      } else {
        navigation.replace('FirstLoad');
      }
    };

    // Wait for both settings and admin contexts to finish loading
    if (!settingsLoading && !adminLoading) {
      // Introduce a short delay to ensure the loading screen is visible
      setTimeout(navigate, 500);
    }
  }, [settingsLoading, adminLoading, userName, navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
