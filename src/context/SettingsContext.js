import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ROOMS } from '../constants/rooms';

const SETTINGS_KEY = 'app-settings';
const CUSTOM_ROOMS_KEY = 'custom-rooms';
const DEFAULT_LABEL_BACKGROUND = '#FFD700';
const DEFAULT_LABEL_TEXT = '#000000';
const DEFAULT_WATERMARK_TEXT = 'Created with ProofPix.com';
const DEFAULT_WATERMARK_LINK = 'https://geos-ai.com/';
const DEFAULT_WATERMARK_OPACITY = 0.5;
const DEFAULT_LABEL_SIZE = 'medium';
const DEFAULT_LABEL_CORNER_STYLE = 'rounded';

// Helper function to get project-specific custom rooms key
const getProjectRoomsKey = (projectId) => `custom-rooms-${projectId}`;

const normalizeFontKey = (value) => {
  if (!value) return 'system';
  const mapped = String(value).toLowerCase();
  switch (mapped) {
    case 'system':
      return 'system';
    case 'serif':
    case 'playfairbold':
    case 'playfairdisplay_700bold':
      return 'playfairBold';
    case 'monospace':
    case 'robotomonobold':
    case 'robotomono_700bold':
      return 'robotoMonoBold';
    case 'montserrat':
    case 'montserratbold':
    case 'montserrat_700bold':
      return 'montserratBold';
    case 'latobold':
    case 'lato_700bold':
      return 'latoBold';
    case 'poppins':
    case 'poppinssemibold':
    case 'poppins_600semibold':
      return 'poppinsSemiBold';
    case 'oswald':
    case 'oswaldsemibold':
    case 'oswald_600semibold':
      return 'oswaldSemiBold';
    default:
      return mapped || 'system';
  }
};

const normalizeColorHex = (value, fallback = null) => {
  if (!value) return fallback;
  const input = String(value).trim();
  if (!input) return fallback;
  if (/^rgb/i.test(input)) {
    return input;
  }
  let normalized = input.startsWith('#') ? input : `#${input}`;
  normalized = normalized.toUpperCase();
  if (/^#[0-9A-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  if (/^#[0-9A-F]{6}$/.test(normalized)) {
    return normalized;
  }
  return fallback ?? normalized;
};

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
  const [showWatermark, setShowWatermark] = useState(true);
  const [customWatermarkEnabled, setCustomWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState(DEFAULT_WATERMARK_TEXT);
  const [watermarkLink, setWatermarkLink] = useState(DEFAULT_WATERMARK_LINK);
  const [watermarkColor, setWatermarkColor] = useState(DEFAULT_LABEL_BACKGROUND);
  const [watermarkOpacity, setWatermarkOpacity] = useState(DEFAULT_WATERMARK_OPACITY);
  const [labelBackgroundColor, setLabelBackgroundColor] = useState(DEFAULT_LABEL_BACKGROUND);
  const [labelTextColor, setLabelTextColor] = useState(DEFAULT_LABEL_TEXT);
  const [labelSize, setLabelSize] = useState(DEFAULT_LABEL_SIZE);
  const [labelCornerStyle, setLabelCornerStyle] = useState(DEFAULT_LABEL_CORNER_STYLE);
  const [labelFontFamily, setLabelFontFamily] = useState('system'); // Default system font
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
        setShowWatermark(settings.showWatermark ?? true);
        setCustomWatermarkEnabled(settings.customWatermarkEnabled ?? false);
        setWatermarkText(settings.watermarkText ?? DEFAULT_WATERMARK_TEXT);
        setWatermarkLink(settings.watermarkLink ?? DEFAULT_WATERMARK_LINK);
        setWatermarkColor(
          normalizeColorHex(settings.watermarkColor, DEFAULT_LABEL_BACKGROUND)
        );
        setWatermarkOpacity(
          typeof settings.watermarkOpacity === 'number'
            ? settings.watermarkOpacity
            : DEFAULT_WATERMARK_OPACITY
        );
        setLabelBackgroundColor(
          normalizeColorHex(settings.labelBackgroundColor, DEFAULT_LABEL_BACKGROUND)
        );
        setLabelTextColor(
          normalizeColorHex(settings.labelTextColor, DEFAULT_LABEL_TEXT)
        );
        setLabelSize(settings.labelSize ?? DEFAULT_LABEL_SIZE);
        setLabelCornerStyle(settings.labelCornerStyle ?? DEFAULT_LABEL_CORNER_STYLE);
        setLabelFontFamily(normalizeFontKey(settings.labelFontFamily));
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
        showWatermark,
        customWatermarkEnabled,
        watermarkText,
        watermarkLink,
        watermarkColor,
        watermarkOpacity,
        labelBackgroundColor,
        labelTextColor,
        labelFontFamily,
        labelSize,
        labelCornerStyle,
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

  const toggleWatermark = async () => {
    const wasEnabled = customWatermarkEnabled;
    const newValue = !wasEnabled;
    setCustomWatermarkEnabled(newValue);
    let nextShowWatermark = showWatermark;
    const normalizedLabelColor = normalizeColorHex(labelBackgroundColor, DEFAULT_LABEL_BACKGROUND);
    const existingColor = normalizeColorHex(watermarkColor, DEFAULT_LABEL_BACKGROUND);
    let nextWatermarkColor = existingColor;
    let nextWatermarkOpacity = typeof watermarkOpacity === 'number'
      ? watermarkOpacity
      : DEFAULT_WATERMARK_OPACITY;
    if (!newValue) {
      nextShowWatermark = true;
      setShowWatermark(true);
    } else if (!watermarkText?.trim()) {
      nextShowWatermark = false;
      setShowWatermark(false);
    }
    if (newValue) {
      nextWatermarkColor =
        !wasEnabled && (!existingColor || existingColor === DEFAULT_LABEL_BACKGROUND)
          ? normalizedLabelColor
          : existingColor || normalizedLabelColor;
      setWatermarkColor(nextWatermarkColor);
      if (typeof watermarkOpacity !== 'number') {
        nextWatermarkOpacity = DEFAULT_WATERMARK_OPACITY;
        setWatermarkOpacity(nextWatermarkOpacity);
      }
    }
    await saveSettings({
      customWatermarkEnabled: newValue,
      showWatermark: nextShowWatermark,
      watermarkColor: newValue ? nextWatermarkColor : existingColor,
      watermarkOpacity: newValue
        ? nextWatermarkOpacity
        : watermarkOpacity,
    });
  };

  const updateWatermarkText = async (text) => {
    setWatermarkText(text);
    if (customWatermarkEnabled) {
      const trimmed = text.trim();
      const shouldShow = trimmed.length > 0;
      setShowWatermark(shouldShow);
      await saveSettings({
        watermarkText: text,
        showWatermark: shouldShow,
      });
    } else {
      await saveSettings({ watermarkText: text });
    }
  };

  const updateWatermarkLink = async (link) => {
    setWatermarkLink(link);
    await saveSettings({ watermarkLink: link });
  };

  const updateWatermarkColor = async (color) => {
    const nextColor = normalizeColorHex(color, DEFAULT_LABEL_BACKGROUND);
    setWatermarkColor(nextColor);
    await saveSettings({ watermarkColor: nextColor });
  };

  const updateWatermarkOpacity = async (value) => {
    const clamped = Math.max(0, Math.min(1, typeof value === 'number' ? value : DEFAULT_WATERMARK_OPACITY));
    setWatermarkOpacity(clamped);
    await saveSettings({ watermarkOpacity: clamped });
  };

  const updateLabelBackgroundColor = async (color) => {
    const normalized = normalizeColorHex(color, DEFAULT_LABEL_BACKGROUND);
    setLabelBackgroundColor(normalized);
    await saveSettings({ labelBackgroundColor: normalized });
  };

  const updateLabelTextColor = async (color) => {
    const normalized = normalizeColorHex(color, DEFAULT_LABEL_TEXT);
    setLabelTextColor(normalized);
    await saveSettings({ labelTextColor: normalized });
  };

  const updateLabelSize = async (size) => {
    const allowed = ['small', 'medium', 'large'];
    const normalized = allowed.includes(size) ? size : DEFAULT_LABEL_SIZE;
    setLabelSize(normalized);
    await saveSettings({ labelSize: normalized });
  };

  const updateLabelCornerStyle = async (style) => {
    const allowed = ['rounded', 'square'];
    const normalized = allowed.includes(style) ? style : DEFAULT_LABEL_CORNER_STYLE;
    setLabelCornerStyle(normalized);
    await saveSettings({ labelCornerStyle: normalized });
  };

  const updateLabelFontFamily = async (font) => {
    const normalized = normalizeFontKey(font);
    setLabelFontFamily(normalized);
    await saveSettings({ labelFontFamily: normalized });
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
      setShowWatermark(true);
      setCustomWatermarkEnabled(false);
      setWatermarkText(DEFAULT_WATERMARK_TEXT);
      setWatermarkLink(DEFAULT_WATERMARK_LINK);
      setWatermarkColor(DEFAULT_LABEL_BACKGROUND);
      setWatermarkOpacity(DEFAULT_WATERMARK_OPACITY);
      setLabelBackgroundColor(DEFAULT_LABEL_BACKGROUND);
      setLabelTextColor(DEFAULT_LABEL_TEXT);
      setLabelSize(DEFAULT_LABEL_SIZE);
      setLabelCornerStyle(DEFAULT_LABEL_CORNER_STYLE);
      setLabelFontFamily('system');
      setIsBusiness(false);
      setUseFolderStructure(true);
      setEnabledFolders({ before: true, after: true, combined: true });
      setCustomRooms(null);
      setUserPlan('starter'); // Reset plan on user data reset
    } catch (error) {

    }
  };

  const shouldShowWatermark = customWatermarkEnabled ? Boolean(watermarkText?.trim()) : showWatermark;

  const value = {
    showLabels,
    toggleLabels,
    showWatermark,
    shouldShowWatermark,
    customWatermarkEnabled,
    watermarkText,
    watermarkLink,
    watermarkColor,
    watermarkOpacity,
    toggleWatermark,
    updateWatermarkText,
    updateWatermarkLink,
    updateWatermarkColor,
    updateWatermarkOpacity,
    labelBackgroundColor,
    labelTextColor,
    labelFontFamily,
    labelSize,
    labelCornerStyle,
    updateLabelBackgroundColor,
    updateLabelTextColor,
    updateLabelFontFamily,
    updateLabelSize,
    updateLabelCornerStyle,
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
