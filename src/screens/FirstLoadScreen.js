import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';

const { width, height } = Dimensions.get('window');

export default function FirstLoadScreen({ navigation }) {
  const { updateUserInfo } = useSettings();
  const [userName, setUserName] = useState('');

  const handleContinue = async () => {
    if (!userName.trim()) {
      Alert.alert('Required Field', 'Please enter your name to continue.');
      return;
    }

    await updateUserInfo(userName.trim());
    navigation.replace('Home');
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>Welcome! Let's get you set up.</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Your Name</Text>
            <TextInput
              style={styles.textInput}
              value={userName}
              onChangeText={setUserName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2C31B'
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 30,
    paddingTop: 50,
    paddingBottom: 30
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 0
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 0,
    marginRight: 5
  },
  appTitle: {
    fontSize: FONTS.XXXLARGE,
    fontWeight: FONTS.BOLD,
    fontFamily: FONTS.QUICKSAND_BOLD,
    color: '#000000',
    marginBottom: 0
  },
  appSubtitle: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    marginTop: 0
  },
  formContainer: {
    width: '100%'
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 30
  },
  inputContainer: {
    marginBottom: 25
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8
  },
  textInput: {
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: 'white',
    color: COLORS.TEXT
  },
  continueButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold'
  }
});
