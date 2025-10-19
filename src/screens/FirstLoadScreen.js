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
import { LOCATIONS } from '../config/locations';
import { COLORS } from '../constants/rooms';

const { width, height } = Dimensions.get('window');

export default function FirstLoadScreen({ navigation }) {
  const { updateUserInfo } = useSettings();
  const [userName, setUserName] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('tampa');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  const handleContinue = async () => {
    if (!userName.trim()) {
      Alert.alert('Required Field', 'Please enter your name to continue.');
      return;
    }

    await updateUserInfo(userName.trim(), selectedLocation);
    navigation.replace('Home');
  };

  const renderLocationDropdown = () => {
    if (!showLocationDropdown) return null;

    return (
      <View style={styles.dropdownContainer}>
        {LOCATIONS.map((location) => (
          <TouchableOpacity
            key={location.id}
            style={[
              styles.dropdownItem,
              selectedLocation === location.id && styles.dropdownItemSelected
            ]}
            onPress={() => {
              setSelectedLocation(location.id);
              setShowLocationDropdown(false);
            }}
          >
            <Text style={[
              styles.dropdownItemText,
              selectedLocation === location.id && styles.dropdownItemTextSelected
            ]}>
              {location.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>ProofPix</Text>
          <Text style={styles.appSubtitle}>Before & After Photo Management</Text>
        </View>

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

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Location</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowLocationDropdown(!showLocationDropdown)}
            >
              <Text style={styles.dropdownButtonText}>
                {LOCATIONS.find(loc => loc.id === selectedLocation)?.name || 'Select Location'}
              </Text>
              <Text style={styles.dropdownArrow}>
                {showLocationDropdown ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
            {renderLocationDropdown()}
          </View>

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 8
  },
  appSubtitle: {
    fontSize: 16,
    color: COLORS.GRAY,
    textAlign: 'center'
  },
  formContainer: {
    width: '100%'
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 30
  },
  inputContainer: {
    marginBottom: 25
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
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
  dropdownButton: {
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dropdownButtonText: {
    fontSize: 16,
    color: COLORS.TEXT
  },
  dropdownArrow: {
    fontSize: 12,
    color: COLORS.GRAY
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  dropdownItemSelected: {
    backgroundColor: COLORS.PRIMARY + '10'
  },
  dropdownItemText: {
    fontSize: 16,
    color: COLORS.TEXT
  },
  dropdownItemTextSelected: {
    color: COLORS.PRIMARY,
    fontWeight: '600'
  },
  continueButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20
  },
  continueButtonText: {
    color: COLORS.TEXT,
    fontSize: 18,
    fontWeight: 'bold'
  }
});
