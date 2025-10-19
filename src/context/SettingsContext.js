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
  const [userName, setUserName] = useState('');
  const [location, setLocation] = useState('tampa'); // Default to Tampa
  const [isBusiness, setIsBusiness] = useState(false);
  const [useFolderStructure, setUseFolderStructure] = useState(true);
  const [enabledFolders, setEnabledFolders] = useState({ before: true, after: true, combined: true });
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
        setUserName(settings.userName ?? '');
        setLocation(settings.location ?? 'tampa');
        setIsBusiness(settings.isBusiness ?? false);
        setUseFolderStructure(settings.useFolderStructure ?? true);
        setEnabledFolders(settings.enabledFolders ?? { before: true, after: true, combined: true });
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
        userName,
        location,
        isBusiness,
        useFolderStructure,
        enabledFolders,
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

  const updateUserInfo = async (name, loc) => {
    setUserName(name);
    setLocation(loc);
    await saveSettings({ userName: name, location: loc });
  };

  const toggleBusiness = async () => {
    const newValue = !isBusiness;
    setIsBusiness(newValue);
    await saveSettings({ isBusiness: newValue });
  };

  const toggleUseFolderStructure = async () => {
    const newValue = !useFolderStructure;
    setUseFolderStructure(newValue);
    await saveSettings({ useFolderStructure: newValue });
  };

  const updateEnabledFolders = async (updates) => {
    const next = { ...enabledFolders, ...updates };
    setEnabledFolders(next);
    await saveSettings({ enabledFolders: next });
  };

  const resetUserData = async () => {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
      setUserName('');
      setLocation('tampa');
      setShowLabels(true);
      setIsBusiness(false);
      setUseFolderStructure(true);
      setEnabledFolders({ before: true, after: true, combined: true });
    } catch (error) {
      console.error('Error resetting user data:', error);
    }
  };

  const value = {
    showLabels,
    toggleLabels,
    userName,
    location,
    updateUserInfo,
    isBusiness,
    toggleBusiness,
    useFolderStructure,
    toggleUseFolderStructure,
    enabledFolders,
    updateEnabledFolders,
    resetUserData,
    loading
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
