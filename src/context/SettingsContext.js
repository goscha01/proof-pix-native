import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'app-settings';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [showLabels, setShowLabels] = useState(true);
  const [cameraMode, setCameraMode] = useState('split'); // 'overlay' or 'split' - default is split
  const [userName, setUserName] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setShowLabels(settings.showLabels ?? true);
        setCameraMode(settings.cameraMode ?? 'split'); // Default to split mode
        setUserName(settings.userName ?? '');
        setLocation(settings.location ?? '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      const settings = {
        showLabels,
        cameraMode,
        userName,
        location,
        ...newSettings
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const toggleLabels = async () => {
    const newValue = !showLabels;
    setShowLabels(newValue);
    await saveSettings({ showLabels: newValue });
  };

  const updateCameraMode = async (mode) => {
    setCameraMode(mode);
    await saveSettings({ cameraMode: mode });
  };

  const updateUserInfo = async (name, loc) => {
    setUserName(name);
    setLocation(loc);
    await saveSettings({ userName: name, location: loc });
  };

  const value = {
    showLabels,
    toggleLabels,
    cameraMode,
    updateCameraMode,
    userName,
    location,
    updateUserInfo,
    loading
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
