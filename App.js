import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PhotoProvider } from './src/context/PhotoContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import PhotoEditorScreen from './src/screens/PhotoEditorScreen';
import AllPhotosScreen from './src/screens/AllPhotosScreen';
import PhotoDetailScreen from './src/screens/PhotoDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FirstLoadScreen from './src/screens/FirstLoadScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { userName, loading } = useSettings();

  // Show loading screen while settings are loading
  if (loading) {
    return null; // Or a loading component
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000' }
      }}
      initialRouteName={(!userName || userName.trim() === '') ? 'FirstLoad' : 'Home'}
    >
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
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <PhotoProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </PhotoProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </View>
  );
}