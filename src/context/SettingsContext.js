import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROOMS } from '../constants/rooms';

const SETTINGS_KEY = 'app-settings';
const CUSTOM_ROOMS_KEY = 'custom-rooms';

// Helper function to get project-specific custom rooms key
const getProjectRoomsKey = (projectId) => `custom-rooms-${projectId}`;

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    console.error('useSettings must be used within SettingsProvider');
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  // console.log('SettingsProvider initialized');
  
  const [showLabels, setShowLabels] = useState(true);
  const [userName, setUserName] = useState('');
  const [location, setLocation] = useState('tampa'); // Default to Tampa
  const [isBusiness, setIsBusiness] = useState(false);
  const [useFolderStructure, setUseFolderStructure] = useState(true);
  const [enabledFolders, setEnabledFolders] = useState({ before: true, after: true, combined: true });
  const [customRooms, setCustomRooms] = useState(null); // null means use default rooms
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
      
      // EMERGENCY: Clear all corrupted custom rooms data
      // console.log('EMERGENCY: Clearing all custom rooms data due to corruption');
      await AsyncStorage.removeItem(CUSTOM_ROOMS_KEY);
      setCustomRooms(null);
      
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

  // Custom rooms management (temporarily global for stability)
  const saveCustomRooms = async (rooms) => {
    try {
      // console.log('SettingsContext: Saving custom rooms:', rooms.map(r => r.name));
      // console.log('SettingsContext: Saving custom rooms IDs:', rooms.map(r => r.id));
      if (rooms && rooms.length > 0) {
        await AsyncStorage.setItem(CUSTOM_ROOMS_KEY, JSON.stringify(rooms));
        setCustomRooms(rooms);
        // console.log('SettingsContext: customRooms state updated');
      } else {
        await AsyncStorage.removeItem(CUSTOM_ROOMS_KEY);
        setCustomRooms(null);
        // console.log('SettingsContext: customRooms state cleared');
      }
    } catch (error) {
      console.error('Error saving custom rooms:', error);
    }
  };

  const getRooms = () => {
    const result = customRooms || ROOMS;
    // console.log('SettingsContext: getRooms called, customRooms:', customRooms?.map(r => r.name) || 'null', 'result:', result.map(r => r.name));
    return result;
  };

  const resetCustomRooms = async () => {
    await AsyncStorage.removeItem(CUSTOM_ROOMS_KEY);
    setCustomRooms(null);
  };

  const resetUserData = async () => {
    try {
      await AsyncStorage.removeItem(SETTINGS_KEY);
      await AsyncStorage.removeItem(CUSTOM_ROOMS_KEY);
      setUserName('');
      setLocation('tampa');
      setShowLabels(true);
      setIsBusiness(false);
      setUseFolderStructure(true);
      setEnabledFolders({ before: true, after: true, combined: true });
      setCustomRooms(null);
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
    loading,
    customRooms,
    saveCustomRooms,
    getRooms,
    resetCustomRooms
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
