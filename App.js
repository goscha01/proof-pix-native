import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PhotoProvider } from './src/context/PhotoContext';
import { SettingsProvider } from './src/context/SettingsContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import PhotoEditorScreen from './src/screens/PhotoEditorScreen';
import AllPhotosScreen from './src/screens/AllPhotosScreen';
import PhotoDetailScreen from './src/screens/PhotoDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <PhotoProvider>
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerShown: false
              }}
            >
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
                  contentStyle: { backgroundColor: '#000' }
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
                  presentation: 'modal',
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
          </NavigationContainer>
        </PhotoProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
