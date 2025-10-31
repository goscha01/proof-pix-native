import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdmin } from '../context/AdminContext';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';

export default function GoogleSignUpScreen({ navigation, route }) {
  const { individualSignIn, adminSignIn } = useAdmin();
  const { plan } = route.params || {};
  const insets = useSafeAreaInsets();

  const handleGoogleSignIn = async () => {
    let result;
    if (plan === 'business' || plan === 'enterprise') {
      result = await adminSignIn();
    } else {
      result = await individualSignIn();
    }
    
    if (result.success) {
      navigation.replace('Home');
    } else {
      Alert.alert('Sign-In Error', result.error || 'An unexpected error occurred.');
    }
  };

  const handleSkip = () => {
    navigation.replace('Home');
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
      <View style={styles.content}>
        <Text style={styles.title}>Connect Your Account</Text>
        <Text style={styles.subtitle}>
          Sign up with Google to enable cloud sync, bulk uploads, and team features for Pro and Business plans.
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogleSignIn}
        >
          <Text style={[styles.buttonText, styles.googleButtonText]}>Sign up with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.skipButton]}
          onPress={handleSkip}
        >
          <Text style={styles.buttonText}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  googleButton: {
    backgroundColor: COLORS.PRIMARY,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  skipButton: {
    backgroundColor: '#f0f0f0',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  googleButtonText: {
    color: '#fff',
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
});
