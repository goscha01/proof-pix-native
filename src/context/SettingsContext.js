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

    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  // 
  
  const [showLabels, setShowLabels] = useState(true);
  const [userName, setUserName] = useState('');
  const [location, setLocation] = useState('tampa'); // Default to Tampa
  const [isBusiness, setIsBusiness] = useState(false);
  const [useFolderStructure, setUseFolderStructure] = useState(true);
  const [enabledFolders, setEnabledFolders] = useState({ before: true, after: true, combined: true });
  const [customRooms, setCustomRooms] = useState(null); // null means use default rooms
  const [userPlan, setUserPlan] = useState('starter'); // Add userPlan state
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
        setUserPlan(settings.userPlan ?? 'starter'); // Load userPlan
      }
      
      // EMERGENCY: Clear all corrupted custom rooms data
      // 
      await AsyncStorage.removeItem(CUSTOM_ROOMS_KEY);
      setCustomRooms(null);
      
    } catch (error) {

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
        userPlan, // Add userPlan to saved settings
        ...newSettings
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {

    }
  };

  const toggleLabels = async () => {
    const newValue = !showLabels;
    setShowLabels(newValue);
    await saveSettings({ showLabels: newValue });
  };

  const updateUserInfo = async (name) => {
    setUserName(name);
    await saveSettings({ userName: name });
  };

  // Reload settings from AsyncStorage (useful when external changes are made)
  const reloadSettings = async () => {
    await loadSettings();
  };

  const updateUserPlan = async (plan) => {
    setUserPlan(plan);
    await saveSettings({ userPlan: plan });
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
      // );
      // );
      if (rooms && rooms.length > 0) {
        await AsyncStorage.setItem(CUSTOM_ROOMS_KEY, JSON.stringify(rooms));
        setCustomRooms(rooms);
        // 
      } else {
        await AsyncStorage.removeItem(CUSTOM_ROOMS_KEY);
        setCustomRooms(null);
        // 
      }
    } catch (error) {

    }
  };

  const getRooms = () => {
    const result = customRooms || ROOMS;
    //  || 'null', 'result:', result.map(r => r.name));
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
      setUserPlan('starter'); // Reset plan on user data reset
    } catch (error) {

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
    resetCustomRooms,
    userPlan, // Expose userPlan
    updateUserPlan, // Expose updateUserPlan
    reloadSettings, // Expose reloadSettings
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};
