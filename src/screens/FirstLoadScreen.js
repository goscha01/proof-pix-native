import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  ScrollView,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdmin } from '../context/AdminContext';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';

const { width, height } = Dimensions.get('window');

export default function FirstLoadScreen({ navigation }) {
  const { individualSignIn } = useAdmin();
  const { updateUserInfo } = useSettings();
  const [userName, setUserName] = useState('');
  const [selection, setSelection] = useState(null); // 'team' or 'individual'

  const validateName = () => {
    if (!userName.trim()) {
      Alert.alert('Name Required', 'Please enter your name to continue.');
      return false;
    }
    return true;
  };

  const handleSelectTeam = async () => {
    if (!validateName()) return;
    await updateUserInfo(userName.trim());
    navigation.navigate('JoinTeam');
  };

  const handleSelectIndividual = async () => {
    if (!validateName()) return;
    await updateUserInfo(userName.trim());
    setSelection('individual');
  };

  const handleSelectPlan = async (plan) => {
    if (plan === 'starter') {
      // For Starter plan, go home without Google Sign-In
      navigation.replace('Home');
    } else {
      // For Pro, Business, Enterprise, go to the Google Sign-Up screen
      navigation.navigate('GoogleSignUp', { plan });
    }
  };

  const renderInitialSelection = () => (
    <View style={styles.formContainer}>
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

      <View>
        <TouchableOpacity
          style={[styles.selectionButton, styles.teamButton]}
          onPress={handleSelectTeam}
        >
          <Text style={[styles.selectionButtonText, styles.teamButtonText]}>Join a Team</Text>
        </TouchableOpacity>
      </View>

      <View style={{marginTop: 16}}>
        <TouchableOpacity
          style={[styles.selectionButton, styles.individualButton]}
          onPress={handleSelectIndividual}
        >
          <Text style={[styles.selectionButtonText, styles.individualButtonText]}>Use as an Individual</Text>
        </TouchableOpacity>
        <Text style={styles.selectionSubtext}>Manage your own projects, with free and paid plans.</Text>
      </View>
    </View>
  );

  const renderPlanSelection = () => (
    <View style={styles.formContainer}>
      <TouchableOpacity onPress={() => setSelection(null)} style={styles.backLink}>
        <Text style={styles.backLinkText}>&larr; Back</Text>
      </TouchableOpacity>
      <Text style={styles.welcomeText}>Choose a Plan</Text>

      <View style={styles.planContainer}>
        <TouchableOpacity style={[styles.selectionButton, styles.planButton]} onPress={() => handleSelectPlan('starter')}>
          <Text style={[styles.selectionButtonText, styles.planButtonText]}>Starter</Text>
        </TouchableOpacity>
        <Text style={styles.planSubtext}>Free forever. Easily manage your first project and create stunning before/after photos ready for social sharing.</Text>
      </View>

      <View style={styles.planContainer}>
        <TouchableOpacity style={[styles.selectionButton, styles.planButton]} onPress={() => handleSelectPlan('pro')}>
          <Text style={[styles.selectionButtonText, styles.planButtonText]}>Pro</Text>
        </TouchableOpacity>
        <Text style={styles.planSubtext}>For professionals. Cloud sync + bulk upload.</Text>
      </View>
      
      <View style={styles.planContainer}>
        <TouchableOpacity style={[styles.selectionButton, styles.planButton]} onPress={() => handleSelectPlan('business')}>
          <Text style={[styles.selectionButtonText, styles.planButtonText]}>Business</Text>
        </TouchableOpacity>
        <Text style={styles.planSubtext}>For small teams. Includes team management.</Text>
      </View>
      
      <View style={styles.planContainer}>
        <TouchableOpacity style={[styles.selectionButton, styles.planButton]} onPress={() => handleSelectPlan('enterprise')}>
          <Text style={[styles.selectionButtonText, styles.planButtonText]}>Enterprise</Text>
        </TouchableOpacity>
        <Text style={styles.planSubtext}>For growing organizations. Unlimited members, multi-location support.</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {selection !== 'individual' && (
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/PP_logo_app.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appTitle}>ProofPix</Text>
            <Text style={styles.appSubtitle}>Before & After Photo Management</Text>
          </View>
        )}

        {selection === 'individual' ? renderPlanSelection() : renderInitialSelection()}

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
    paddingVertical: 30
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40
  },
  logo: {
    width: 120,
    height: 120,
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
    width: '100%',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 30
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: 'white',
    color: COLORS.TEXT,
  },
  selectionButton: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
  },
  teamButton: {
    backgroundColor: '#007bff',
    borderColor: '#0056b3',
  },
  individualButton: {
    backgroundColor: '#333',
    borderColor: '#000',
  },
  selectionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  teamButtonText: {
    color: '#fff',
  },
  individualButtonText: {
    color: '#fff',
  },
  selectionSubtext: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
  },
  backLink: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  backLinkText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  planContainer: {
    marginBottom: 20,
  },
  planButton: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
  },
  planButtonText: {
    color: '#333',
  },
  planSubtext: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
  },
  planCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.TEXT,
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  }
});
