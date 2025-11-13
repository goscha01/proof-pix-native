import React from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PhotoProvider } from './src/context/PhotoContext';
import { SettingsProvider } from './src/context/SettingsContext';
import { AdminProvider } from './src/context/AdminContext';
import { useFonts } from 'expo-font';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { RobotoMono_700Bold } from '@expo-google-fonts/roboto-mono';
import { Lato_700Bold } from '@expo-google-fonts/lato';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Oswald_600SemiBold } from '@expo-google-fonts/oswald';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import PhotoEditorScreen from './src/screens/PhotoEditorScreen';
import AllPhotosScreen from './src/screens/AllPhotosScreen';
import PhotoDetailScreen from './src/screens/PhotoDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LabelCustomizationScreen from './src/screens/LabelCustomizationScreen';
import FirstLoadScreen from './src/screens/FirstLoadScreen';
import InviteScreen from './src/screens/InviteScreen';
import JoinTeamScreen from './src/screens/JoinTeamScreen';
import GoogleSignUpScreen from './src/screens/GoogleSignUpScreen';
import AuthLoadingScreen from './src/screens/AuthLoadingScreen';
import VisionCameraTest from './src/screens/VisionCameraTest';

const Stack = createNativeStackNavigator();

// Navigator component that uses settings
function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000' }
      }}
      initialRouteName="AuthLoading"
    >
      <Stack.Screen 
        name="AuthLoading" 
        component={AuthLoadingScreen} 
      />
      <Stack.Screen 
        name="FirstLoad" 
        component={FirstLoadScreen}
        options={{
          animation: 'none'
        }}
      />
      <Stack.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          animation: 'none'
        }}
      />
      <Stack.Screen 
        name="Camera" 
        component={CameraScreen}
        options={{
          presentation: 'card',
          animation: 'slide_from_bottom',
          animationDuration: 300,
          contentStyle: { backgroundColor: '#000' },
          orientation: 'all',
          autoHideHomeIndicator: false
        }}
      />
      <Stack.Screen 
        name="PhotoEditor" 
        component={PhotoEditorScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen 
        name="AllPhotos" 
        component={AllPhotosScreen}
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          animationDuration: 300
        }}
      />
      <Stack.Screen 
        name="PhotoDetail" 
        component={PhotoDetailScreen}
        options={{
          presentation: 'modal',
          animation: 'fade'
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="LabelCustomization"
        component={LabelCustomizationScreen}
        options={{
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="Invite"
        component={InviteScreen}
        options={{
          presentation: 'modal',
          animation: 'fade'
        }}
      />
      <Stack.Screen
        name="JoinTeam"
        component={JoinTeamScreen}
        options={{
          title: 'Join Team',
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="GoogleSignUp"
        component={GoogleSignUpScreen}
        options={{
          animation: 'slide_from_right'
        }}
      />
      <Stack.Screen
        name="VisionCameraTest"
        component={VisionCameraTest}
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: '#000' }
        }}
      />
    </Stack.Navigator>
  );
}

// Linking configuration for deep links (OAuth redirect)
const linking = {
  prefixes: ['proofpix://'],
  config: {
    screens: {
      Invite: 'invite/:token',
    },
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Montserrat_700Bold,
    PlayfairDisplay_700Bold,
    RobotoMono_700Bold,
    Lato_700Bold,
    Poppins_600SemiBold,
    Oswald_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Loading assets…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <AdminProvider>
            <PhotoProvider>
              <NavigationContainer linking={linking} fallback={<Text>Loading...</Text>}>
                <AppNavigator />
              </NavigationContainer>
            </PhotoProvider>
          </AdminProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});