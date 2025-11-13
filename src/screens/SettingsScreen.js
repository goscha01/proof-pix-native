import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal as RNModal,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { useAdmin } from '../context/AdminContext';
import { COLORS, getLabelPositions } from '../constants/rooms';
import RoomEditor from '../components/RoomEditor';
import PhotoLabel from '../components/PhotoLabel';
import googleDriveService from '../services/googleDriveService';
import InviteManager from '../components/InviteManager';
import { useNavigation } from '@react-navigation/native';
import proxyService from '../services/proxyService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Modal from 'react-native-modal';
import ColorPicker from 'react-native-wheel-color-picker';

const FONT_OPTIONS = [
  {
    key: 'system',
    label: 'System Default',
    description: 'Matches the device font',
    fontFamily: null,
  },
  {
    key: 'montserratBold',
    label: 'Montserrat Bold',
    description: 'Modern sans-serif',
    fontFamily: 'Montserrat_700Bold',
  },
  {
    key: 'latoBold',
    label: 'Lato Bold',
    description: 'Friendly sans-serif',
    fontFamily: 'Lato_700Bold',
  },
  {
    key: 'playfairBold',
    label: 'Playfair Display',
    description: 'Elegant serif',
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  {
    key: 'poppinsSemiBold',
    label: 'Poppins SemiBold',
    description: 'Rounded modern style',
    fontFamily: 'Poppins_600SemiBold',
  },
  {
    key: 'robotoMonoBold',
    label: 'Roboto Mono',
    description: 'Monospaced tech feel',
    fontFamily: 'RobotoMono_700Bold',
  },
  {
    key: 'oswaldSemiBold',
    label: 'Oswald SemiBold',
    description: 'Condensed headline style',
    fontFamily: 'Oswald_600SemiBold',
  },
];

const LABEL_SIZE_OPTIONS = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Default' },
  { key: 'large', label: 'Large' },
];

const LABEL_SIZE_STYLE_MAP = {
  small: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 70,
  },
  medium: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 88,
  },
  large: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 104,
  },
};

const LABEL_CORNER_OPTIONS = [
  { key: 'rounded', label: 'Rounded' },
  { key: 'square', label: 'Straight' },
];

const DEFAULT_LABEL_BACKGROUND = '#FFD700';
const DEFAULT_LABEL_TEXT = '#000000';
const RGB_COLOR_REGEX = /^RGB\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;

function normalizeHex(value) {
  if (!value) return null;
  let trimmed = String(value).trim().toUpperCase();

  if (/^[0-9A-F]{6}$/.test(trimmed)) {
    trimmed = `#${trimmed}`;
  } else if (/^[0-9A-F]{3}$/.test(trimmed)) {
    trimmed = `#${trimmed}`;
  }

  if (/^#[0-9A-F]{4}$/.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1, 4).split('');
    trimmed = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9A-F]{4}$/.test(trimmed)) {
    const [r, g, b] = trimmed.slice(0, 3).split('');
    trimmed = `#${r}${r}${g}${g}${b}${b}`;
  }

  if (/^#[0-9A-F]{6}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^#[0-9A-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  const rgbMatch = trimmed.match(RGB_COLOR_REGEX);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch.slice(1).map((segment) => {
      const numeric = parseInt(segment, 10);
      return Math.min(255, Math.max(0, numeric));
    });
    return `#${[r, g, b]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`;
  }

  return null;
}

function hsvToHex({ h = 0, s = 0, v = 0 }) {
  const normalizedH = ((h % 360) + 360) % 360;
  const normalizedS = Math.min(Math.max(s, 0), 100) / 100;
  const normalizedV = Math.min(Math.max(v, 0), 100) / 100;

  const c = normalizedV * normalizedS;
  const x = c * (1 - Math.abs(((normalizedH / 60) % 2) - 1));
  const m = normalizedV - c;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (normalizedH < 60) {
    rPrime = c;
    gPrime = x;
  } else if (normalizedH < 120) {
    rPrime = x;
    gPrime = c;
  } else if (normalizedH < 180) {
    gPrime = c;
    bPrime = x;
  } else if (normalizedH < 240) {
    gPrime = x;
    bPrime = c;
  } else if (normalizedH < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  const r = Math.round((rPrime + m) * 255);
  const g = Math.round((gPrime + m) * 255);
  const b = Math.round((bPrime + m) * 255);

  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

export default function SettingsScreen({ navigation }) {
  const {
    showLabels,
    toggleLabels,
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
    beforeLabelPosition,
    afterLabelPosition,
    combinedLabelPosition,
    labelMarginVertical,
    labelMarginHorizontal,
    updateLabelSize,
    updateLabelCornerStyle,
    updateLabelBackgroundColor,
    updateLabelTextColor,
    updateLabelFontFamily,
    updateBeforeLabelPosition,
    updateAfterLabelPosition,
    updateCombinedLabelPosition,
    updateLabelMarginVertical,
    updateLabelMarginHorizontal,
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
    customRooms,
    saveCustomRooms,
    getRooms,
    resetCustomRooms,
    userPlan,
    updateUserPlan
  } = useSettings();
  
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [colorModalType, setColorModalType] = useState(null);
  const [draftColor, setDraftColor] = useState(labelBackgroundColor);
  const [colorInput, setColorInput] = useState(labelBackgroundColor?.toUpperCase() || '');
  const [hexModalVisible, setHexModalVisible] = useState(false);
  const [hexModalValue, setHexModalValue] = useState(labelBackgroundColor?.toUpperCase() || '');
  const [hexModalError, setHexModalError] = useState(null);
  const [fontModalVisible, setFontModalVisible] = useState(false);
  const [colorPickerKey, setColorPickerKey] = useState(0);
  const [watermarkOpacityPreview, setWatermarkOpacityPreview] = useState(
    typeof watermarkOpacity === 'number' ? watermarkOpacity : 0.5
  );

  const watermarkSwatchColor = useMemo(() => {
    const baseColor = customWatermarkEnabled
      ? watermarkColor || labelBackgroundColor
      : labelBackgroundColor;
    return normalizeHex(baseColor) || '#FFFFFF';
  }, [customWatermarkEnabled, watermarkColor, labelBackgroundColor]);

  useEffect(() => {
    if (typeof watermarkOpacity === 'number') {
      setWatermarkOpacityPreview(watermarkOpacity);
    }
  }, [watermarkOpacity]);

  const {
    isAuthenticated,
    userInfo: adminUserInfo,
    signIn,
    signOut,
    signOutFromTeam,
    isSetupComplete,
    folderId: adminFolderId,
    proxySessionId,
    userMode,
    teamInfo,
    saveFolderId,
    addInviteToken,
    removeInviteToken,
    adminSignIn,
    individualSignIn,
    isGoogleSignInAvailable,
    initializeProxySession,
    teamName,
    updateTeamName,
    switchToIndividualMode,
    disconnectAllAccounts,
    connectedAccounts,
    removeConnectedAccount,
  } = useAdmin();
  const isEnterprisePlan = userPlan === 'enterprise';
  const activeEnterpriseAccount = isEnterprisePlan
    ? connectedAccounts?.find((account) => account.isActive)
    : null;
  const otherEnterpriseAccounts = isEnterprisePlan
    ? (connectedAccounts || []).filter((account) => !account.isActive)
    : [];
  const displayedActiveAccount = activeEnterpriseAccount || adminUserInfo;

  const [name, setName] = useState(userName);
  
  // Update name when userName changes (e.g., when switching back from team mode)
  useEffect(() => {
    setName(userName);
  }, [userName]);
  useEffect(() => {
    let isMounted = true;
    const checkStoredIndividual = async () => {
      if (!isTeamMember) {
        if (isMounted) {
          setCanSwitchBack(false);
        }
        return;
      }
      try {
        const [storedPlan, storedMode] = await Promise.all([
          AsyncStorage.getItem('@stored_individual_plan'),
          AsyncStorage.getItem('@stored_individual_mode'),
        ]);
        if (isMounted) {
          setCanSwitchBack(Boolean(storedPlan || storedMode));
        }
      } catch (error) {
        if (isMounted) {
          setCanSwitchBack(false);
        }
      }
    };
    checkStoredIndividual();
    return () => {
      isMounted = false;
    };
  }, [isTeamMember]);
  const [showRoomEditor, setShowRoomEditor] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const [loadingAdminInfo, setLoadingAdminInfo] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState('');

  const isTeamMember = userMode === 'team_member';
  const [canSwitchBack, setCanSwitchBack] = useState(false);

  const currentFontOption = useMemo(() => {
    return (
      FONT_OPTIONS.find((option) => option.key === labelFontFamily) ||
      FONT_OPTIONS[0]
    );
  }, [labelFontFamily]);

  useEffect(() => {
    if (colorModalVisible) {
      let baseColor = labelBackgroundColor;
      if (colorModalType === 'text') {
        baseColor = labelTextColor;
      } else if (colorModalType === 'watermark') {
        baseColor = customWatermarkEnabled
          ? watermarkColor || labelBackgroundColor
          : labelBackgroundColor;
      }
      const normalized = normalizeHex(baseColor) || '#FFFFFF';
      setDraftColor(normalized);
      setColorInput(normalized);
      setHexModalValue(normalized);
      setHexModalError(null);
    }
  }, [
    colorModalVisible,
    colorModalType,
    labelBackgroundColor,
    labelTextColor,
    customWatermarkEnabled,
    watermarkColor,
  ]);

  const handleOpenHexModal = () => {
    // reset preview to persisted value when opening modal
    let persisted = labelBackgroundColor;
    if (colorModalType === 'text') {
      persisted = labelTextColor;
    } else if (colorModalType === 'watermark') {
      persisted = customWatermarkEnabled
        ? watermarkColor || labelBackgroundColor
        : labelBackgroundColor;
    }
    const normalized = normalizeHex(persisted) || '#FFFFFF';
    setDraftColor(normalized);
    setColorInput(normalized);
    setHexModalValue(normalized);
    setHexModalError(null);
    setHexModalVisible(true);
  };

  const handleHexModalChange = (text) => {
    const input = text.toUpperCase();
    setHexModalValue(input);
    if (!input) {
      setHexModalError(null);
      return;
    }
    const normalized = normalizeHex(input);
    if (normalized) {
      setHexModalError(null);
    } else if (input.length >= 4) {
      setHexModalError('Enter #RRGGBB, #RGB, or rgb(r, g, b)');
    } else {
      setHexModalError(null);
    }
  };

  const handleHexModalCancel = () => {
    setHexModalVisible(false);
    setHexModalError(null);
  };

  const handleHexModalApply = () => {
    const normalized = normalizeHex(hexModalValue);
    if (!normalized) {
      setHexModalError('Enter #RRGGBB, #RGB, or rgb(r, g, b)');
      return;
    }
    handleDraftColorChange(normalized, { source: 'complete' });
    setHexModalVisible(false);
  };

  const handleDraftColorChange = (color, arg1 = {}, arg2 = null) => {
    let options = {};
    let hsvMeta = null;

    if (arg1 && typeof arg1 === 'object' && 'source' in arg1) {
      options = arg1;
      hsvMeta = arg2;
    } else {
      hsvMeta = arg1;
      options = arg2 && typeof arg2 === 'object' ? arg2 : {};
    }

    const { source } = options;

    let candidateHex = normalizeHex(color);
    if (hsvMeta && typeof hsvMeta === 'object') {
      const { h = 0, s = 0, v = 0 } = hsvMeta;
      if (colorModalType === 'text' && v <= 1) {
        candidateHex = hsvToHex({ h, s, v: 100 });
      } else {
        candidateHex = hsvToHex({ h, s, v });
      }
    }
    const normalized = normalizeHex(candidateHex);
    if (!normalized) {
      return;
    }
    setDraftColor(normalized);
    setColorInput(normalized);
    setHexModalValue(normalized);
    setHexModalError(null);
  };

  const handleSetupTeam = async () => {
    if (!isAuthenticated || userMode !== 'admin' || isSigningIn) {
      return;
    }

    // Check if already set up - only consider it connected if folderId is also saved (admin setup)
    if (isSetupComplete()) {
      Alert.alert('Already Connected', 'Your team is already connected. You can manage invites below.');
      return;
    }

    try {
      console.log('[SETUP] Running team setup with proxy server...');
      setIsSigningIn(true); // Show a loading indicator

      // Step 1: Find or create the Google Drive folder
      // Note: makeAuthenticatedRequest will handle checking if user is signed in
      const folderId = await googleDriveService.findOrCreateProofPixFolder();
      await saveFolderId(folderId);
      console.log('[SETUP] Admin folder ID saved:', folderId);

      // Step 2: Initialize proxy session (this creates the session and stores refresh token)
      const sessionResult = await initializeProxySession(folderId);
      if (!sessionResult || !sessionResult.sessionId) {
        throw new Error('Failed to initialize proxy session');
      }
      console.log('[SETUP] Proxy session initialized:', sessionResult.sessionId);

      // Step 3: Set default team name to Google profile name if not already set
      if (!teamName && adminUserInfo?.name) {
        await updateTeamName(adminUserInfo.name);
        console.log('[SETUP] Default team name set to:', adminUserInfo.name);
      }

      Alert.alert(
        'Team Connected!', 
        'Your team is now connected. You can now generate invite links for your team members.'
      );

    } catch (error) {
      console.error('[SETUP] Setup failed:', error.message);
      Alert.alert(
        'Setup Failed',
        error.message || 'Failed to connect team. Please try again.',
        [{ text: 'OK', style: 'cancel' }]
      );
    } finally {
      setIsSigningIn(false);
    }
  };


  const handleSaveUserInfo = async () => {
    await updateUserInfo(name, location);
  };

  const handleLeaveTeam = () => {
    Alert.alert(
      'Leave Team',
      'This will disconnect you from the team on this device while keeping your existing projects. Your invite token is shown above—copy it if you plan to rejoin later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Team',
          style: 'destructive',
          onPress: async () => {
            try {
              const signOutResult = await signOutFromTeam();
              if (!signOutResult?.success) {
                Alert.alert('Error', signOutResult?.error || 'Failed to leave the team. Please try again.');
                return;
              }

              const switchResult = await switchToIndividualMode();
              if (switchResult?.success) {
                Alert.alert(
                  'Team Left',
                  'You have been disconnected from the team. You can rejoin later with your invite token.'
                );
              } else if (switchResult?.error) {
                Alert.alert('Notice', 'Left the team, but could not restore your previous mode automatically.');
              }
            } catch (error) {
              console.error('[SETTINGS] Error leaving team:', error);
              Alert.alert('Error', 'Unexpected error occurred while leaving the team.');
            }
          },
        },
      ],
    );
  };

  const handleResetUserData = () => {
    const resetMessage = isTeamMember
      ? 'This will clear your local settings and disconnect you from the team. Make sure you have your invite token if you plan to rejoin. Continue?'
      : 'This will clear your name settings. You will be taken to the setup screen to configure them again. Continue?';

    Alert.alert(
      'Reset User Data',
      resetMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (isTeamMember) {
              try {
                const signOutResult = await signOutFromTeam();
                if (!signOutResult?.success) {
                  Alert.alert('Error', signOutResult?.error || 'Failed to disconnect from the team.');
                  return;
                }
                await switchToIndividualMode();
              } catch (error) {
                console.warn('[SETTINGS] Failed to disconnect team during reset:', error?.message || error);
              }
            } else {
              try {
                await disconnectAllAccounts();
              } catch (error) {
                console.warn('[SETTINGS] Failed to disconnect accounts during reset:', error?.message || error);
              }
            }

            try {
              await resetUserData();
            } finally {
              navigation.reset({
                index: 0,
                routes: [{ name: 'FirstLoad' }],
              });
            }
          }
        }
      ]
    );
  };

  const handleIndividualSignIn = async () => {
    setIsSigningIn(true);
    try {
      await individualSignIn();
    } catch (error) {
      console.error("Error during individual sign in:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleActivateConnectedAccount = (account) => {
    if (!account || account.isActive) {
      return;
    }

    if (!isGoogleSignInAvailable) {
      Alert.alert(
        'Unavailable',
        'Google Sign-In is not available in this build. Please use a development build.'
      );
      return;
    }

    Alert.alert(
      'Switch Google Account',
      `Switch active account to ${account.email}? You will be prompted to sign in again with this account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setIsSigningIn(true);
            try {
              await adminSignIn();
            } catch (error) {
              console.error('[SETTINGS] Error switching connected account:', error);
              Alert.alert('Error', 'Failed to switch accounts. Please try again.');
            } finally {
              setIsSigningIn(false);
            }
          },
        },
      ]
    );
  };

  const handleRemoveConnectedAccount = (account) => {
    if (!account) {
      return;
    }

    if (account.isActive) {
      Alert.alert(
        'Account Active',
        'Switch to another account before removing this one.'
      );
      return;
    }

    Alert.alert(
      'Remove Google Account',
      `Remove ${account.email} from your connected accounts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeConnectedAccount(account.id);
            } catch (error) {
              console.error('[SETTINGS] Failed to remove connected account:', error);
              Alert.alert('Error', 'Failed to remove account. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await adminSignIn();
    } catch (error) {
      console.error("Error during admin sign in:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'This will sign you out and clear all admin setup data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const result = await signOut();
            if (result.success) {
              Alert.alert('Success', 'Signed out successfully');
            } else {
              Alert.alert('Error', result.error || 'Failed to sign out');
            }
          }
        }
      ]
    );
  };

  const openColorModal = (type) => {
    let initialColor = labelBackgroundColor;
    if (type === 'text') {
      initialColor = labelTextColor;
    } else if (type === 'watermark') {
      initialColor = customWatermarkEnabled
        ? watermarkColor || labelBackgroundColor
        : labelBackgroundColor;
    }
    const normalized = normalizeHex(initialColor) || '#FFFFFF';
    setDraftColor(normalized);
    setColorInput(normalized);
    setHexModalValue(normalized);
    setHexModalError(null);
    setColorModalType(type);
    setColorPickerKey((prev) => prev + 1);
    setColorModalVisible(true);
  };

  const handleApplyColor = async () => {
    const normalized = normalizeHex(draftColor);
    if (!normalized) {
      setHexModalError('Please enter a valid color code before applying.');
      return;
    }
    if (colorModalType === 'background') {
      await updateLabelBackgroundColor(normalized);
    } else if (colorModalType === 'text') {
      await updateLabelTextColor(normalized);
    } else if (colorModalType === 'watermark') {
      await updateWatermarkColor(normalized);
    }
    setColorModalVisible(false);
  };

  const handleDefaultColor = async () => {
    let defaultColor =
      colorModalType === 'text'
        ? DEFAULT_LABEL_TEXT
        : DEFAULT_LABEL_BACKGROUND;
    if (colorModalType === 'watermark') {
      defaultColor = normalizeHex(labelBackgroundColor) || DEFAULT_LABEL_BACKGROUND;
      await updateWatermarkColor(defaultColor);
    } else if (colorModalType === 'background') {
      await updateLabelBackgroundColor(defaultColor);
    } else if (colorModalType === 'text') {
      await updateLabelTextColor(defaultColor);
    }
    handleDraftColorChange(defaultColor, { source: 'complete' });
    setColorPickerKey((prev) => prev + 1);
    setColorModalVisible(false);
  };

  const handleCancelColor = () => {
    setColorModalVisible(false);
    setHexModalVisible(false);
    setHexModalError(null);
  };

  const handleSelectFont = async (fontKey) => {
    await updateLabelFontFamily(fontKey);
    setFontModalVisible(false);
  };


  const handleSignOut = async () => {
    // For Business/Enterprise users in admin mode with team setup, sign out from team only
    // This keeps Google authentication but clears team setup, showing "Set Up Team" button again
    if (userMode === 'admin' && isSetupComplete() && (userPlan === 'business' || userPlan === 'enterprise')) {
      Alert.alert(
        'Disconnect Team',
        'This will disconnect your team setup but keep you signed in to Google. You can set up your team again later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              const result = await signOutFromTeam();
              if (result.success) {
                Alert.alert('Success', 'Team disconnected successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to disconnect team');
              }
            }
          }
        ]
      );
    } else {
      // For all other cases, do full sign out
      await signOut();
    }
  };

  // Fetch admin info for team members
  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (userMode === 'team_member' && teamInfo?.sessionId) {
        setLoadingAdminInfo(true);
        try {
          console.log('[SETTINGS] Fetching admin info for session:', teamInfo.sessionId);
          const sessionInfo = await proxyService.getSessionInfo(teamInfo.sessionId);
          console.log('[SETTINGS] Session info received:', sessionInfo);
          if (sessionInfo.success && sessionInfo.adminUserInfo) {
            setAdminInfo(sessionInfo.adminUserInfo);
            console.log('[SETTINGS] Admin info set:', sessionInfo.adminUserInfo);
          } else {
            console.warn('[SETTINGS] No admin info in session response:', sessionInfo);
          }
        } catch (error) {
          console.error('[SETTINGS] Failed to fetch admin info:', error);
          // Set a fallback so user knows they're connected even if we can't get the name
          setAdminInfo({ name: null, email: null });
        } finally {
          setLoadingAdminInfo(false);
        }
      }
    };

    fetchAdminInfo();
  }, [userMode, teamInfo?.sessionId]);

  // Update team name input when teamName changes from context
  useEffect(() => {
    if (!editingTeamName) {
      setTeamNameInput(teamName || '');
    }
  }, [teamName]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Admin Setup Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cloud & Team Sync</Text>
          
          {/* Show current plan above buttons */}
          {userPlan && (
            <TouchableOpacity 
              style={styles.currentPlanBox}
              onPress={() => setShowPlanModal(true)}
            >
              <Text style={styles.currentPlanLabel}>Current Plan:</Text>
              <View style={styles.currentPlanValueContainer}>
                <Text style={styles.currentPlanValue}>
                  {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                </Text>
                <Text style={styles.changePlanText}>Change</Text>
              </View>
            </TouchableOpacity>
          )}
          
          {userMode === 'team_member' ? (
            <>
              {/* Team Member View - Show team connection info (read-only) */}
              <View style={styles.adminInfoBox}>
                <Text style={styles.adminInfoLabel}>Connected to Team:</Text>
                {loadingAdminInfo ? (
                  <ActivityIndicator size="small" color={COLORS.PRIMARY} style={{ marginVertical: 8 }} />
                ) : adminInfo && (adminInfo.name || adminInfo.email) ? (
                  <>
                    <Text style={styles.adminInfoValue}>
                      {adminInfo.name || adminInfo.email || 'Admin'}
                    </Text>
                    {adminInfo.email && adminInfo.name && (
                      <Text style={styles.adminInfoEmail}>
                        {adminInfo.email}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.adminInfoValue}>
                    ✓ Connected to Team
                  </Text>
                )}
              </View>

              {teamInfo?.token && (
                <View style={styles.tokenBox}>
                  <View style={styles.tokenHeader}>
                    <Text style={styles.tokenLabel}>Invite Token</Text>
                    <TouchableOpacity
                      style={styles.tokenCopyButton}
                      onPress={() => {
                        Clipboard.setString(teamInfo.token);
                        Alert.alert('Copied', 'Invite token copied to clipboard.');
                      }}
                    >
                      <Text style={styles.tokenCopyText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.tokenValue} selectable>{teamInfo.token}</Text>
                </View>
              )}

              <Text style={styles.teamWarningText}>
                Remember to save your invite token. You’ll need it to rejoin this team later.
              </Text>

              {canSwitchBack && (
                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={async () => {
                    Alert.alert(
                      'Switch Back',
                      'This will restore your previous mode on this device.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Switch',
                          onPress: async () => {
                            try {
                              const result = await switchToIndividualMode();
                              if (result?.success) {
                                setTimeout(() => {
                                  Alert.alert(
                                    'Switched Back',
                                    `You are now in ${result.mode ? result.mode.charAt(0).toUpperCase() + result.mode.slice(1) : 'individual'} mode.`,
                                    [{ text: 'OK' }]
                                  );
                                }, 100);
                              } else if (result?.error) {
                                Alert.alert('Error', result.error);
                              }
                            } catch (error) {
                              console.error('[SETTINGS] Error switching modes:', error);
                              Alert.alert('Error', 'An unexpected error occurred while switching modes.');
                            }
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={styles.switchModeButtonText}>Switch Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.leaveTeamButton}
                onPress={handleLeaveTeam}
              >
                <Text style={styles.leaveTeamButtonText}>Leave Team</Text>
              </TouchableOpacity>
              
            </>
          ) : isSigningIn ? (
             <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.loadingText}>Connecting to Google...</Text>
             </View>
          ) : !isAuthenticated ? (
            <>
              {showPlanSelection ? (
                <>
                  <TouchableOpacity onPress={() => setShowPlanSelection(false)} style={styles.backLink}>
                    <Text style={styles.backLinkText}>&larr; Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.sectionDescription}>
                    Choose a Plan
                  </Text>
                  
                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'starter' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('starter');
                        setShowPlanSelection(false);
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'starter' && styles.planButtonTextSelected]}>Starter</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>Free forever. Easily manage your first project and create stunning before/after photos ready for social sharing.</Text>
                  </View>

                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'pro' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('pro');
                        setShowPlanSelection(false);
                        navigation.navigate('GoogleSignUp', { plan: 'pro' });
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'pro' && styles.planButtonTextSelected]}>Pro</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>For professionals. Cloud sync + bulk upload.</Text>
                  </View>
                  
                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'business' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('business');
                        setShowPlanSelection(false);
                        navigation.navigate('GoogleSignUp', { plan: 'business' });
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'business' && styles.planButtonTextSelected]}>Business</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>For small teams. Includes team management.</Text>
                  </View>
                  
                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'enterprise' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('enterprise');
                        setShowPlanSelection(false);
                        navigation.navigate('GoogleSignUp', { plan: 'enterprise' });
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'enterprise' && styles.planButtonTextSelected]}>Enterprise</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>For growing organizations. Unlimited members, multi-location support.</Text>
                  </View>
                </>
              ) : (
                <>
                  {/* Show feature buttons with enable/disable based on plan */}
                  <Text style={styles.sectionDescription}>
                    {userPlan ? 
                      `Your ${userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} plan features:` :
                      'Sign in to sync your photos to the cloud and enable team features.'
                    }
                  </Text>
                  
                  {/* Determine which buttons are enabled based on plan */}
                  {(() => {
                    const isStarter = !userPlan || userPlan === 'starter';
                    const isPro = userPlan === 'pro';
                    const isBusiness = userPlan === 'business';
                    const isEnterprise = userPlan === 'enterprise';
                    
                    const canConnectGoogle = isPro || isBusiness || isEnterprise;
                    const canSetupTeam = isBusiness || isEnterprise;
                    
                    return (
                      <>
                        {/* Connect to Google Account Button */}
                        <TouchableOpacity
                          style={[
                            styles.featureButton,
                            (!canConnectGoogle || !isGoogleSignInAvailable || isSigningIn) && styles.buttonDisabled
                          ]}
                          onPress={async () => {
                            if (!canConnectGoogle) {
                              Alert.alert('Feature Unavailable', 'Google Account connection is available for Pro, Business, and Enterprise plans.');
                              return;
                            }
                            setIsSigningIn(true);
                            try {
                              // For Pro, use individual sign-in; for Business/Enterprise, use admin sign-in
                              if (isPro) {
                                await individualSignIn();
                              } else {
                                await adminSignIn();
                              }
                            } catch (error) {
                              console.error("Error during sign in:", error);
                            } finally {
                              setIsSigningIn(false);
                            }
                          }}
                          disabled={!canConnectGoogle || !isGoogleSignInAvailable || isSigningIn}
                        >
                          {isSigningIn && canConnectGoogle ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={[
                              styles.featureButtonText,
                              (!canConnectGoogle || !isGoogleSignInAvailable) && styles.buttonTextDisabled
                            ]}>
                              Connect to Google Account
                            </Text>
                          )}
                        </TouchableOpacity>
                        
                        {/* Set Up Team Button */}
                        <TouchableOpacity
                          style={[
                            styles.featureButton,
                            (!canSetupTeam || isSigningIn) && styles.buttonDisabled
                          ]}
                          onPress={async () => {
                            if (!canSetupTeam) {
                              Alert.alert('Feature Unavailable', 'Team setup is available for Business and Enterprise plans.');
                              return;
                            }
                            if (!isAuthenticated) {
                              Alert.alert('Sign In Required', 'Please connect your Google account first.');
                              return;
                            }
                            await handleSetupTeam();
                          }}
                          disabled={!canSetupTeam || isSigningIn}
                        >
                          <Text style={[
                            styles.featureButtonText,
                            !canSetupTeam && styles.buttonTextDisabled
                          ]}>
                            Set Up Team
                          </Text>
                        </TouchableOpacity>
                        
                        {!isGoogleSignInAvailable && (canConnectGoogle || canSetupTeam) && (
                          <View style={styles.expoGoWarning}>
                            <Text style={styles.expoGoWarningText}>
                              ⚠️ Google Sign-in requires a development build and is not available in Expo Go.
                            </Text>
                            <Text style={styles.expoGoWarningSubtext}>
                              Run: npx expo install expo-dev-client && eas build --profile development
                            </Text>
                          </View>
                        )}
                        
                        {/* Show plan selection option for Starter users */}
                        {isStarter && (
                          <>
                            <TouchableOpacity
                              style={styles.signInButton}
                              onPress={() => setShowPlanSelection(true)}
                            >
                              <Text style={styles.signInButtonText}>
                                Upgrade Plan
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.googleSignInButton}
                              onPress={() => navigation.navigate('JoinTeam')}
                            >
                              <Text style={styles.googleSignInButtonText}>
                                Join a Team
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          ) : (
            <>
              <View style={styles.adminInfoBox}>
                <View style={styles.adminInfoHeader}>
                  <View style={styles.activeAccountContainer}>
                    <Text style={styles.activeAccountLabel}>Active Google Account</Text>
                    <Text style={styles.activeAccountName}>
                      {displayedActiveAccount?.name || 'Unknown Name'}
                    </Text>
                    <Text style={styles.activeAccountEmail}>
                      {displayedActiveAccount?.email || 'Unknown Email'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={handleSignOut}
                  >
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>

                {isEnterprisePlan && otherEnterpriseAccounts.length > 0 && (
                  <View style={styles.connectedAccountsList}>
                    <Text style={styles.connectedAccountsTitle}>Other connected accounts</Text>
                    {otherEnterpriseAccounts.map((account, index) => (
                      <View
                        key={account.id}
                        style={[
                          styles.connectedAccountRow,
                          index === otherEnterpriseAccounts.length - 1 && styles.connectedAccountRowLast,
                        ]}
                      >
                        <View style={styles.connectedAccountHeader}>
                          <View style={styles.connectedAccountInfo}>
                            <Text style={styles.connectedAccountName}>
                              {account.name || account.email}
                            </Text>
                            <Text style={styles.connectedAccountEmail}>
                              {account.email}
                            </Text>
                          </View>
                          <View style={[styles.accountStatusBadge, styles.accountStatusInactive]}>
                            <Text style={[styles.accountStatusText, styles.accountStatusTextInactive]}>
                              Inactive
                            </Text>
                          </View>
                        </View>
                        <View style={styles.connectedAccountActions}>
                          <TouchableOpacity
                            style={[
                              styles.accountActionButton,
                              isSigningIn && styles.accountActionButtonDisabled,
                            ]}
                            onPress={() => handleActivateConnectedAccount(account)}
                            disabled={isSigningIn}
                          >
                            <Text style={styles.accountActionButtonText}>
                              {isSigningIn ? 'Switching…' : 'Make Active'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.accountActionButton, styles.accountRemoveButton]}
                            onPress={() => handleRemoveConnectedAccount(account)}
                          >
                            <Text
                              style={[
                                styles.accountActionButtonText,
                                styles.accountRemoveButtonText,
                              ]}
                            >
                              Remove
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Show all buttons when authenticated, with enable/disable based on plan */}
              {(() => {
                const isPro = userPlan === 'pro';
                const isBusiness = userPlan === 'business';
                const isEnterprise = userPlan === 'enterprise';
                
                const canSetupTeam = isBusiness || isEnterprise;
                const isAdmin = userMode === 'admin';
                const connectButtonDisabled = !isEnterprise || !isGoogleSignInAvailable || isSigningIn;
                
                return (
                  <>
                    {/* Keep Connect button visible even after authentication */}
                    <TouchableOpacity
                      style={[
                        styles.featureButton,
                        connectButtonDisabled && styles.buttonDisabled
                      ]}
                      onPress={async () => {
                        if (connectButtonDisabled) {
                          return;
                        }
                        setIsSigningIn(true);
                        try {
                          if (isAdmin) {
                            await adminSignIn();
                          } else {
                            await individualSignIn();
                          }
                        } catch (error) {
                          console.error('Error reconnecting Google account:', error);
                        } finally {
                          setIsSigningIn(false);
                        }
                      }}
                      disabled={connectButtonDisabled}
                    >
                      {isSigningIn && !connectButtonDisabled ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={[
                          styles.featureButtonText,
                          connectButtonDisabled && styles.buttonTextDisabled
                        ]}>
                          Connect to Google Account
                        </Text>
                      )}
                    </TouchableOpacity>
                    {/* Set Up Team Button - shown for authenticated Business/Enterprise admins who haven't set up yet */}
                    {isAdmin && !isSetupComplete() && canSetupTeam && (
                      <TouchableOpacity
                        style={[
                          styles.featureButton,
                          isSigningIn && styles.buttonDisabled
                        ]}
                        onPress={handleSetupTeam}
                        disabled={isSigningIn}
                      >
                        {isSigningIn ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.featureButtonText}>
                            Set Up Team
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                    
                    {/* Add Location button removed */}
                  </>
                );
              })()}

              {userMode === 'admin' && isSetupComplete() && (
                <>
                  <View style={styles.connectedStatus}>
                    <Text style={styles.connectedText}>✓ Team Connected</Text>
                  </View>
                  
                  {/* Editable Team Name */}
                  <View style={styles.teamNameContainer}>
                    <Text style={styles.teamNameLabel}>Team Name</Text>
                    {editingTeamName ? (
                      <View style={styles.teamNameEditContainer}>
                        <TextInput
                          style={styles.teamNameInput}
                          value={teamNameInput}
                          onChangeText={setTeamNameInput}
                          placeholder="Enter team name"
                          placeholderTextColor={COLORS.GRAY}
                          autoFocus={true}
                        />
                        <View style={styles.teamNameButtons}>
                          <TouchableOpacity
                            style={styles.teamNameButton}
                            onPress={async () => {
                              await updateTeamName(teamNameInput);
                              setEditingTeamName(false);
                            }}
                          >
                            <Text style={styles.teamNameButtonText}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.teamNameButton, styles.teamNameButtonCancel]}
                            onPress={() => {
                              setTeamNameInput(teamName || '');
                              setEditingTeamName(false);
                            }}
                          >
                            <Text style={[styles.teamNameButtonText, styles.teamNameButtonTextCancel]}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.teamNameDisplay}
                        onPress={() => {
                          setTeamNameInput(teamName || '');
                          setEditingTeamName(true);
                        }}
                      >
                        <Text style={[
                          styles.teamNameText,
                          !teamName && styles.teamNameTextPlaceholder
                        ]}>
                          {teamName || 'Tap to add team name'}
                        </Text>
                        <Text style={styles.teamNameEditIcon}>✏️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <InviteManager navigation={navigation} />
                </>
              )}
            </>
          )}
        </View>

        {userMode !== 'team_member' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Display Settings</Text>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Show Labels</Text>
                  <Text style={styles.settingDescription}>
                    Display "BEFORE" and "AFTER" labels on all photos
                  </Text>
                </View>
                <Switch
                  value={showLabels}
                  onValueChange={toggleLabels}
                  trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                  thumbColor="white"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Remove / Customize Watermark</Text>
                  <Text style={styles.settingDescription}>
                    {customWatermarkEnabled
                      ? 'Update watermark text or leave blank to remove it'
                      : 'Use the default ProofPix watermark on exported photos'}
                  </Text>
                </View>
                <Switch
                  value={customWatermarkEnabled}
                  onValueChange={toggleWatermark}
                  trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                  thumbColor="white"
                />
              </View>
              {customWatermarkEnabled && (
                <View style={styles.watermarkCustomization}>
                  <View style={styles.watermarkField}>
                    <Text style={styles.watermarkFieldLabel}>Watermark Text</Text>
                    <TextInput
                      style={styles.watermarkInput}
                      value={watermarkText}
                      onChangeText={updateWatermarkText}
                      placeholder="Leave blank to remove watermark"
                      placeholderTextColor={COLORS.GRAY}
                    />
                  </View>
                  <View style={styles.watermarkField}>
                    <Text style={styles.watermarkFieldLabel}>Click Through Link (optional)</Text>
                    <TextInput
                      style={styles.watermarkInput}
                      value={watermarkLink}
                      onChangeText={updateWatermarkLink}
                      placeholder="https://your-site.com"
                      placeholderTextColor={COLORS.GRAY}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                  </View>
                  <View style={styles.watermarkColorRow}>
                    <View style={styles.watermarkColorInfo}>
                      <Text style={styles.watermarkFieldLabel}>Watermark Color</Text>
                      <Text style={styles.watermarkColorValue}>{watermarkSwatchColor}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.watermarkColorButton}
                      onPress={() => openColorModal('watermark')}
                    >
                      <View
                        style={[
                          styles.colorPreviewSwatch,
                          styles.watermarkColorSwatch,
                          { backgroundColor: watermarkSwatchColor },
                        ]}
                      />
                      <Text style={styles.customSelectorButtonText}>Pick color</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.watermarkOpacityRow}>
                    <Text style={styles.watermarkFieldLabel}>Opacity</Text>
                    <View style={styles.watermarkOpacityControls}>
                      <WatermarkOpacitySlider
                        value={watermarkOpacityPreview}
                        onChange={setWatermarkOpacityPreview}
                        onChangeEnd={updateWatermarkOpacity}
                        fillColor={watermarkSwatchColor}
                      />
                      <Text style={styles.watermarkOpacityValue}>
                        {Math.round(watermarkOpacityPreview * 100)}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.watermarkHelperText}>
                    Leave the text empty to remove the watermark entirely. The link is opened when viewers tap the watermark.
                  </Text>
                </View>
              )}

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Business</Text>
                  <Text style={styles.settingDescription}>
                    Enable business mode features
                  </Text>
                </View>
                <Switch
                  value={isBusiness}
                  onValueChange={toggleBusiness}
                  trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                  thumbColor="white"
                />
              </View>
            </View>

            {/* Label Customization */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Label Customization</Text>
              <Text style={styles.sectionDescription}>
                Customize the appearance of BEFORE and AFTER labels
              </Text>

              {/* Dummy Photo Preview */}
              <View style={styles.labelPreviewSection}>
                <View style={styles.positionPreviewBox}>
                  {/* Left half - BEFORE */}
                  <View style={styles.previewHalfBefore}>
                    <View
                      style={[
                        styles.previewLabel,
                        getLabelPositions(labelMarginVertical, labelMarginHorizontal)[beforeLabelPosition]
                      ]}
                    >
                      <PhotoLabel
                        label="BEFORE"
                        position="left-top"
                        style={{ position: 'relative', top: 0, left: 0 }}
                      />
                    </View>
                  </View>

                  {/* Right half - AFTER */}
                  <View style={styles.previewHalfAfter}>
                    <View
                      style={[
                        styles.previewLabel,
                        getLabelPositions(labelMarginVertical, labelMarginHorizontal)[afterLabelPosition]
                      ]}
                    >
                      <PhotoLabel
                        label="AFTER"
                        position="left-top"
                        style={{ position: 'relative', top: 0, left: 0 }}
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Customize Button */}
              <TouchableOpacity
                style={styles.customizeButton}
                onPress={() => navigation.navigate('LabelCustomization')}
              >
                <Text style={styles.customizeButtonText}>Customize</Text>
              </TouchableOpacity>
            </View>

            {/* Room Customization */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Folder Customization</Text>
              <Text style={styles.sectionDescription}>
                Customize the names and icons of folders in your app
              </Text>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Custom Folders</Text>
                  <Text style={styles.settingDescription}>
                    {customRooms ? `${customRooms.length} custom folders` : 'Using default folders'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.customizeButton}
                  onPress={() => {
                    setShowRoomEditor(true);
                  }}
                >
                  <Text style={styles.customizeButtonText}>Customize</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Upload Structure */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upload Structure</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Use folder structure</Text>
                  <Text style={styles.settingDescription}>
                    If off, all photos go into the project folder
                  </Text>
                </View>
                <Switch
                  value={useFolderStructure}
                  onValueChange={toggleUseFolderStructure}
                  trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                  thumbColor="white"
                />
              </View>

              {useFolderStructure && (
                <>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Before folder</Text>
                      <Text style={styles.settingDescription}>Uploads to "before" subfolder</Text>
                    </View>
                    <Switch
                      value={enabledFolders.before}
                      onValueChange={(v) => updateEnabledFolders({ before: v })}
                      trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                      thumbColor="white"
                    />
                  </View>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>After folder</Text>
                      <Text style={styles.settingDescription}>Uploads to "after" subfolder</Text>
                    </View>
                    <Switch
                      value={enabledFolders.after}
                      onValueChange={(v) => updateEnabledFolders({ after: v })}
                      trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                      thumbColor="white"
                    />
                  </View>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Combined folder</Text>
                      <Text style={styles.settingDescription}>Uploads to "combined"/formats subfolders</Text>
                    </View>
                    <Switch
                      value={enabledFolders.combined}
                      onValueChange={(v) => updateEnabledFolders({ combined: v })}
                      trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                      thumbColor="white"
                    />
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* Account & Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account & Data</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>User name</Text>
            <TextInput
              style={[styles.input, isTeamMember && styles.inputDisabled]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.GRAY}
              onBlur={handleSaveUserInfo}
              editable={!isTeamMember}
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionDescription}>
            {isTeamMember
              ? 'Reset will clear local data and disconnect this device from the team.'
              : 'Reset clears your settings and connected accounts on this device.'}
          </Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetUserData}
          >
            <Text style={styles.resetButtonText}>Reset User Data</Text>
          </TouchableOpacity>
        </View>

        </ScrollView>

        <RoomEditor
          visible={showRoomEditor}
          onClose={() => setShowRoomEditor(false)}
          onSave={(rooms) => {
            saveCustomRooms(rooms);
            // Force a small delay to ensure state updates propagate
            setTimeout(() => {
            }, 100);
          }}
          initialRooms={customRooms}
        />

      <Modal
        isVisible={colorModalVisible}
        onBackdropPress={handleCancelColor}
        onBackButtonPress={handleCancelColor}
        style={styles.bottomModal}
        useNativeDriver
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoiding}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 110 : 0}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.customModalSheet}>
              <View style={styles.customModalHeader}>
                <Text style={styles.customModalTitle}>
                  {colorModalType === 'text'
                    ? 'Text Color'
                    : colorModalType === 'watermark'
                    ? 'Watermark Color'
                    : 'Background Color'}
                </Text>
                <TouchableOpacity
                  onPress={handleCancelColor}
                  style={styles.customModalCloseButton}
                >
                  <Text style={styles.customModalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                bounces={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.customModalScroll}
              >
                <View style={styles.customModalContent}>
                  <View style={styles.colorPreviewRow}>
                    <View
                      style={[
                        styles.colorPreviewSwatchLarge,
                        { backgroundColor: draftColor },
                      ]}
                    />
                    <View style={styles.inlineHexContainer}>
                      <Pressable
                        onPress={handleOpenHexModal}
                        style={({ pressed }) => [
                          styles.inlineHexButton,
                          pressed && styles.inlineHexButtonPressed,
                        ]}
                        hitSlop={8}
                      >
                        <Text style={styles.inlineHexText}>
                          {colorInput || '#FFFFFF'}
                        </Text>
                      </Pressable>
                      <TouchableOpacity
                        style={styles.inlineDefaultButton}
                        onPress={handleDefaultColor}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.inlineDefaultButtonText}>Default</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.colorPicker}>
                    <ColorPicker
                      key={`${colorModalType}-${colorPickerKey}`}
                      color={draftColor}
                      onColorChange={(value, hsv) => handleDraftColorChange(value, hsv)}
                      onColorChangeComplete={(value, hsv) => handleDraftColorChange(value, { source: 'complete' }, hsv)}
                      thumbSize={26}
                      sliderSize={28}
                      sliderHidden={false}
                      swatches={false}
                      shadeWheelThumb
                      shadeSliderThumb
                      gapSize={20}
                      noSnap
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.customApplyButton}
                    onPress={handleApplyColor}
                  >
                    <Text style={styles.customApplyButtonText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
              {hexModalVisible && (
                <View style={styles.inlineOverlay}>
                  <TouchableWithoutFeedback onPress={handleHexModalCancel}>
                    <View style={styles.inlineOverlayBackdrop} />
                  </TouchableWithoutFeedback>
                  <View style={styles.inlineModal}>
                    <Text style={styles.inlineModalTitle}>Enter Color Code</Text>
                    <TextInput
                      style={[
                        styles.inlineModalInput,
                        hexModalError && styles.inlineModalInputError,
                      ]}
                      value={hexModalValue}
                      onChangeText={handleHexModalChange}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      placeholder="#FFFFFF or rgb(255, 255, 255)"
                      placeholderTextColor="#888"
                      returnKeyType="done"
                      autoFocus
                    />
                    {!!hexModalError && (
                      <Text style={styles.inlineModalErrorText}>{hexModalError}</Text>
                    )}
                    <View style={styles.inlineModalActions}>
                      <TouchableOpacity
                        style={[styles.inlineModalButton, styles.inlineModalCancel]}
                        onPress={handleHexModalCancel}
                      >
                        <Text style={styles.inlineModalCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.inlineModalButton, styles.inlineModalApply]}
                        onPress={handleHexModalApply}
                      >
                        <Text style={styles.inlineModalApplyText}>Apply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          isVisible={fontModalVisible}
          onBackdropPress={() => setFontModalVisible(false)}
          onBackButtonPress={() => setFontModalVisible(false)}
          style={styles.bottomModal}
          useNativeDriver
        >
          <View style={styles.customModalSheet}>
            <View style={styles.customModalHeader}>
              <Text style={styles.customModalTitle}>Choose Font</Text>
              <TouchableOpacity
                onPress={() => setFontModalVisible(false)}
                style={styles.customModalCloseButton}
              >
                <Text style={styles.customModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.fontList}>
              {FONT_OPTIONS.map((option) => {
                const isSelected = option.key === labelFontFamily;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.fontOptionRow,
                      isSelected && styles.fontOptionRowSelected,
                    ]}
                    onPress={() => handleSelectFont(option.key)}
                  >
                    <Text
                      style={[
                        styles.fontOptionTitle,
                        option.fontFamily ? { fontFamily: option.fontFamily } : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.fontOptionSubtitle}>{option.description}</Text>
                    <Text
                      style={[
                        styles.fontOptionPreview,
                        option.fontFamily ? { fontFamily: option.fontFamily } : null,
                      ]}
                    >
                      BEFORE / AFTER
                    </Text>
                    {isSelected && <Text style={styles.fontSelectedBadge}>Selected</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>

        {/* hex modal rendered inside color modal */}

        {/* Plan Selection Modal */}
        <RNModal
          visible={showPlanModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPlanModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose a Plan</Text>
                <TouchableOpacity 
                  onPress={() => setShowPlanModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScrollView}>
                <View style={styles.planContainer}>
                  <TouchableOpacity 
                    style={[styles.planButton, userPlan === 'starter' && styles.planButtonSelected]} 
                    onPress={async () => {
                      await updateUserPlan('starter');
                      setShowPlanModal(false);
                    }}
                  >
                    <Text style={[styles.planButtonText, userPlan === 'starter' && styles.planButtonTextSelected]}>Starter</Text>
                  </TouchableOpacity>
                  <Text style={styles.planSubtext}>Free forever. Easily manage your first project and create stunning before/after photos ready for social sharing.</Text>
                </View>

                <View style={styles.planContainer}>
                  <TouchableOpacity 
                    style={[styles.planButton, userPlan === 'pro' && styles.planButtonSelected]} 
                    onPress={async () => {
                      await updateUserPlan('pro');
                      setShowPlanModal(false);
                      if (!isAuthenticated) {
                        navigation.navigate('GoogleSignUp', { plan: 'pro' });
                      }
                    }}
                  >
                    <Text style={[styles.planButtonText, userPlan === 'pro' && styles.planButtonTextSelected]}>Pro</Text>
                  </TouchableOpacity>
                  <Text style={styles.planSubtext}>For professionals. Cloud sync + bulk upload.</Text>
                </View>
                
                <View style={styles.planContainer}>
                  <TouchableOpacity 
                    style={[styles.planButton, userPlan === 'business' && styles.planButtonSelected]} 
                    onPress={async () => {
                      await updateUserPlan('business');
                      setShowPlanModal(false);
                      if (!isAuthenticated) {
                        navigation.navigate('GoogleSignUp', { plan: 'business' });
                      }
                    }}
                  >
                    <Text style={[styles.planButtonText, userPlan === 'business' && styles.planButtonTextSelected]}>Business</Text>
                  </TouchableOpacity>
                  <Text style={styles.planSubtext}>For small teams. Includes team management.</Text>
                </View>
                
                <View style={styles.planContainer}>
                  <TouchableOpacity 
                    style={[styles.planButton, userPlan === 'enterprise' && styles.planButtonSelected]} 
                    onPress={async () => {
                      await updateUserPlan('enterprise');
                      setShowPlanModal(false);
                      if (!isAuthenticated) {
                        navigation.navigate('GoogleSignUp', { plan: 'enterprise' });
                      }
                    }}
                  >
                    <Text style={[styles.planButtonText, userPlan === 'enterprise' && styles.planButtonTextSelected]}>Enterprise</Text>
                  </TouchableOpacity>
                  <Text style={styles.planSubtext}>For growing organizations. Unlimited members, multi-location support.</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </RNModal>
      </SafeAreaView>
    );
  }

function WatermarkOpacitySlider({ value = 0, onChange, onChangeEnd, fillColor = '#FFD700' }) {
  const [trackWidth, setTrackWidth] = useState(0);

  const clamp = (val) => Math.max(0, Math.min(1, val));

  const handleGesture = (event, commit = false) => {
    if (!trackWidth || !event || !event.nativeEvent) {
      if (commit && onChangeEnd) {
        onChangeEnd(clamp(value));
      }
      return;
    }
    const { locationX } = event.nativeEvent;
    const ratio = clamp(locationX / trackWidth);
    if (onChange) {
      onChange(ratio);
    }
    if (commit && onChangeEnd) {
      onChangeEnd(ratio);
    }
  };

  const thumbSize = 20;
  const fillWidth = trackWidth ? clamp(value) * trackWidth : 0;
  const thumbLeft = trackWidth ? clamp(value) * trackWidth - thumbSize / 2 : 0;

  return (
    <View style={sliderStyles.container}>
      <View
        style={sliderStyles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) => handleGesture(event, false)}
        onResponderMove={(event) => handleGesture(event, false)}
        onResponderRelease={(event) => handleGesture(event, true)}
        onResponderTerminationRequest={() => false}
        onResponderTerminate={(event) => handleGesture(event, true)}
      >
        <View
          style={[
            sliderStyles.fill,
            {
              width: fillWidth,
              backgroundColor: fillColor,
            },
          ]}
        />
        <View
          style={[
            sliderStyles.thumb,
            {
              left: Math.max(0, Math.min(trackWidth - thumbSize, thumbLeft)),
              borderColor: fillColor,
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
            },
          ]}
        />
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 4,
    paddingRight: 12,
  },
  track: {
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    height: '100%',
  },
  thumb: {
    position: 'absolute',
    top: -2,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
});

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.BACKGROUND
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingTop: 10,
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: COLORS.BORDER
    },
    backButton: {
      width: 60
    },
    backButtonText: {
      color: COLORS.PRIMARY,
      fontSize: 18
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: COLORS.TEXT
    },
    content: {
      flex: 1
    },
    section: {
      backgroundColor: 'white',
      marginTop: 20,
      paddingVertical: 20,
      paddingHorizontal: 20,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: COLORS.BORDER
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: COLORS.TEXT,
      marginBottom: 16
    },
    inputGroup: {
      marginBottom: 16
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.TEXT,
      marginBottom: 8
    },
    input: {
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      padding: 12,
      borderRadius: 8,
      color: COLORS.TEXT
    },
    inputDisabled: {
      opacity: 0.7,
    },
    divider: {
      height: 1,
      backgroundColor: COLORS.BORDER,
      marginVertical: 16,
    },
    locationPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      padding: 12,
      borderRadius: 8
    },
    locationPickerText: {
      color: COLORS.TEXT,
      fontWeight: '600'
    },
    locationPickerArrow: {
      color: COLORS.GRAY
    },
    locationDropdown: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      borderRadius: 8,
      overflow: 'hidden'
    },
    locationOption: {
      padding: 12,
      backgroundColor: 'white'
    },
    locationOptionSelected: {
      backgroundColor: '#f7f7f7'
    },
    locationOptionText: {
      color: COLORS.TEXT
    },
    locationOptionTextSelected: {
      fontWeight: '700'
    },
    locationOptionCheck: {
      position: 'absolute',
      right: 12,
      top: 12,
      color: COLORS.PRIMARY
    },
    sectionDescription: {
      color: COLORS.GRAY,
      marginBottom: 12
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12
    },
    settingRowStacked: {
      paddingVertical: 12,
      gap: 8,
    },
    settingInfo: {
      flex: 1,
      paddingRight: 16
    },
    settingLabel: {
      color: COLORS.TEXT,
      fontWeight: '600'
    },
    settingDescription: {
      color: COLORS.GRAY,
      fontSize: 12
    },
    optionGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      backgroundColor: 'white',
    },
    optionPillSelected: {
      backgroundColor: COLORS.PRIMARY,
      borderColor: COLORS.PRIMARY,
    },
    optionPillText: {
      color: COLORS.TEXT,
      fontWeight: '600',
    },
    optionPillTextSelected: {
      color: COLORS.TEXT,
    },
    watermarkCustomization: {
      marginTop: 8,
      marginBottom: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      borderRadius: 12,
      backgroundColor: '#f9f9f9',
    },
    watermarkField: {
      marginBottom: 12,
    },
    watermarkFieldLabel: {
      color: COLORS.TEXT,
      fontWeight: '600',
      marginBottom: 6,
    },
    watermarkInput: {
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: COLORS.TEXT,
    },
    watermarkHelperText: {
      color: COLORS.GRAY,
      fontSize: 12,
      lineHeight: 16,
      marginTop: 4,
    },
    watermarkColorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      gap: 12,
    },
    watermarkColorInfo: {
      flex: 1,
    },
    watermarkColorValue: {
      color: COLORS.GRAY,
      fontSize: 12,
    },
    watermarkColorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      backgroundColor: 'white',
      gap: 8,
    },
    watermarkColorSwatch: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    watermarkOpacityRow: {
      marginBottom: 16,
    },
    watermarkOpacityControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    watermarkOpacityValue: {
      minWidth: 48,
      textAlign: 'right',
      color: COLORS.TEXT,
      fontWeight: '600',
    },
    resetButton: {
      backgroundColor: '#FFE6E6',
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginTop: 8
    },
    resetButtonText: {
      color: '#CC0000',
      fontSize: 16,
      fontWeight: '600'
    },
    customizeButton: {
      backgroundColor: COLORS.PRIMARY,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8
    },
    customizeButtonText: {
      color: COLORS.TEXT,
      fontWeight: '600',
      fontSize: 14
    },
    googleSignInButton: {
      backgroundColor: '#4285F4',
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginBottom: 8
    },
    googleSignInButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600'
    },
    buttonDisabled: {
      backgroundColor: '#cccccc',
      opacity: 0.6
    },
    buttonTextDisabled: {
      color: '#666666'
    },
    currentPlanBox: {
      backgroundColor: '#f0f0f0',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    currentPlanLabel: {
      fontSize: 14,
      color: COLORS.GRAY,
      fontWeight: '600'
    },
    currentPlanValueContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    currentPlanValue: {
      fontSize: 16,
      color: COLORS.TEXT,
      fontWeight: 'bold'
    },
    changePlanText: {
      fontSize: 14,
      color: COLORS.PRIMARY,
      fontWeight: '600'
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end'
    },
    modalContent: {
      backgroundColor: 'white',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 20
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.BORDER
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: COLORS.TEXT
    },
    modalCloseButton: {
      width: 30,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center'
    },
    modalCloseText: {
      fontSize: 24,
      color: COLORS.GRAY
    },
    modalScrollView: {
      paddingHorizontal: 20,
      paddingTop: 20
    },
    backLink: {
      marginBottom: 12,
      alignSelf: 'flex-start'
    },
    backLinkText: {
      fontSize: 16,
      color: COLORS.PRIMARY,
      fontWeight: '600'
    },
    planContainer: {
      marginBottom: 20
    },
    planButton: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 20,
      borderWidth: 2,
      borderColor: '#ddd',
      alignItems: 'center'
    },
    planButtonSelected: {
      borderColor: COLORS.PRIMARY,
      backgroundColor: '#f0f7ff'
    },
    planButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333'
    },
    planButtonTextSelected: {
      color: COLORS.PRIMARY
    },
    planSubtext: {
      fontSize: 14,
      color: '#666',
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 10
    },
    expoGoWarning: {
      backgroundColor: '#fff3cd',
      borderWidth: 1,
      borderColor: '#ffc107',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16
    },
    expoGoWarningText: {
      color: '#856404',
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8
    },
    expoGoWarningSubtext: {
      color: '#856404',
      fontSize: 12,
      fontFamily: 'monospace'
    },
    adminNote: {
      color: COLORS.GRAY,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 8
    },
    adminInfoBox: {
      backgroundColor: '#F0F8FF',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12
    },
    adminInfoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    activeAccountContainer: {
      flex: 1,
      paddingRight: 8,
      backgroundColor: '#E6F0FF',
      borderRadius: 8,
      padding: 14,
    },
    activeAccountLabel: {
      color: '#3366CC',
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    activeAccountName: {
      color: COLORS.TEXT,
      fontSize: 16,
      fontWeight: '700',
    },
    activeAccountEmail: {
      color: COLORS.GRAY,
      fontSize: 12,
      marginTop: 4,
    },
    tokenBox: {
      marginTop: 12,
      marginBottom: 12,
      padding: 12,
      borderRadius: 8,
      backgroundColor: '#F8F9FF',
      borderWidth: 1,
      borderColor: '#E0E6F5',
    },
    tokenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    tokenLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.GRAY,
      textTransform: 'uppercase',
    },
    tokenCopyButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: '#E0E7FF',
    },
    tokenCopyText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#3843D0',
    },
    tokenValue: {
      fontSize: 13,
      color: COLORS.TEXT,
      fontFamily: 'monospace',
    },
    teamWarningText: {
      color: COLORS.GRAY,
      fontSize: 12,
      marginBottom: 12,
    },
    leaveTeamButton: {
      backgroundColor: '#FFE6E6',
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 12,
    },
    leaveTeamButtonText: {
      color: '#CC0000',
      fontSize: 14,
      fontWeight: '600',
    },
    connectedAccountsList: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#D8E1F6',
    },
    connectedAccountsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.TEXT,
      marginBottom: 8,
    },
    connectedAccountRow: {
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#E0E6F5',
      padding: 12,
      marginBottom: 8,
    },
    connectedAccountRowLast: {
      marginBottom: 0,
    },
    connectedAccountHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    connectedAccountInfo: {
      flex: 1,
      paddingRight: 12,
    },
    connectedAccountName: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.TEXT,
      marginBottom: 2,
    },
    connectedAccountEmail: {
      fontSize: 12,
      color: COLORS.GRAY,
    },
    accountStatusBadge: {
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    accountStatusActive: {
      backgroundColor: '#E8F5E9',
    },
    accountStatusInactive: {
      backgroundColor: '#FFF4E5',
    },
    accountStatusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    accountStatusTextActive: {
      color: '#2E7D32',
    },
    accountStatusTextInactive: {
      color: '#C77800',
    },
    connectedAccountActions: {
      flexDirection: 'row',
      gap: 8,
    },
    accountActionButton: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: COLORS.PRIMARY,
    },
    accountActionButtonDisabled: {
      opacity: 0.6,
    },
    accountActionButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
    accountRemoveButton: {
      backgroundColor: '#FFE6E6',
    },
    accountRemoveButtonText: {
      color: '#CC0000',
    },
    disconnectButton: {
      backgroundColor: '#FFE6E6',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    disconnectButtonText: {
      color: '#CC0000',
      fontSize: 14,
      fontWeight: '600',
    },
    setupStatusBox: {
      backgroundColor: '#E8F5E9',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12
    },
    setupStatusText: {
      color: '#2E7D32',
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8
    },
    setupDetailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4
    },
    setupDetailLabel: {
      color: COLORS.GRAY,
      fontSize: 12
    },
    setupDetailValue: {
      color: COLORS.TEXT,
      fontSize: 12,
      maxWidth: '60%'
    },
    signInButton: {
      backgroundColor: '#34A853',
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginBottom: 12,
    },
    signInButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
      backgroundColor: COLORS.BACKGROUND,
    },
    loadingText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: COLORS.TEXT,
      marginTop: 10,
    },
    loadingSubText: {
      fontSize: 14,
      color: COLORS.GRAY,
      marginTop: 5,
      textAlign: 'center',
    },
    infoText: {
      fontSize: 16,
      color: COLORS.GRAY,
      textAlign: 'center',
      marginBottom: 20,
    },
    setupIncompleteText: {
      color: COLORS.GRAY,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 8,
    },
    featureButton: {
      backgroundColor: COLORS.PRIMARY,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 8
    },
    featureButtonText: {
      color: COLORS.TEXT,
      fontSize: 16,
      fontWeight: '600'
    },
    setupTeamButton: {
      backgroundColor: COLORS.PRIMARY,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 8
    },
    setupTeamButtonText: {
      color: COLORS.TEXT,
      fontSize: 16,
      fontWeight: '600'
    },
    connectedStatus: {
      backgroundColor: '#d4edda',
      padding: 12,
      borderRadius: 8,
      marginBottom: 15,
      alignItems: 'center',
    },
    connectedText: {
      color: '#155724',
      fontSize: 14,
      fontWeight: '600',
    },
    teamNameContainer: {
      marginBottom: 15,
    },
    teamNameLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.TEXT,
      marginBottom: 8,
    },
    teamNameDisplay: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      borderRadius: 8,
      padding: 12,
    },
    teamNameText: {
      fontSize: 16,
      color: COLORS.TEXT,
      flex: 1,
    },
    teamNameTextPlaceholder: {
      color: COLORS.GRAY,
      fontStyle: 'italic',
    },
    teamNameEditIcon: {
      fontSize: 18,
      marginLeft: 8,
    },
    teamNameEditContainer: {
      backgroundColor: 'white',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      borderRadius: 8,
      padding: 12,
    },
    teamNameInput: {
      fontSize: 16,
      color: COLORS.TEXT,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      borderRadius: 6,
      padding: 10,
      marginBottom: 8,
    },
    teamNameButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
    },
    teamNameButton: {
      backgroundColor: COLORS.PRIMARY,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
    },
    teamNameButtonCancel: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    teamNameButtonText: {
      color: COLORS.TEXT,
      fontSize: 14,
      fontWeight: '600',
    },
    teamNameButtonTextCancel: {
      color: COLORS.GRAY,
    },
    switchModeButton: {
      backgroundColor: COLORS.PRIMARY,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    switchModeButtonText: {
      color: COLORS.TEXT,
      fontSize: 16,
      fontWeight: '600',
    },
    customSelectorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#f7f7f7',
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    customSelectorButtonText: {
      color: COLORS.TEXT,
      fontWeight: '600',
    },
    colorPreviewSwatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    colorPreviewSwatchLarge: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      marginRight: 12,
    },
    fontSelectorButton: {
      backgroundColor: COLORS.PRIMARY,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    fontSelectorButtonText: {
      color: COLORS.TEXT,
      fontWeight: '600',
    },
    fontOptions: {
      flexDirection: 'row',
      gap: 8,
    },
    fontOption: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      backgroundColor: 'white',
    },
    fontOptionSelected: {
      backgroundColor: COLORS.PRIMARY,
      borderColor: COLORS.PRIMARY,
    },
    fontOptionText: {
      fontSize: 12,
      color: COLORS.TEXT,
      fontWeight: '600',
    },
    fontOptionTextSelected: {
      color: COLORS.TEXT,
    },
    labelPreviewContainer: {
      marginTop: 12,
      alignSelf: 'stretch',
    },
    labelPreview: {
      backgroundColor: '#f0f0f0',
      paddingHorizontal: 6,
      paddingVertical: 9,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    previewLabel: {
      alignItems: 'center',
      minWidth: 0,
    },
    previewLabelText: {
      fontWeight: 'bold',
    },
    previewLabelOption: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
      paddingHorizontal: 2,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'transparent',
      flex: 0,
      flexShrink: 0,
      marginHorizontal: 4,
    },
    cornerControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    cornerOptions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    cornerOption: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      backgroundColor: '#F5F5F5',
      minWidth: 100,
      alignItems: 'center',
    },
    cornerOptionSelected: {
      borderColor: COLORS.PRIMARY,
      backgroundColor: COLORS.PRIMARY,
    },
    cornerOptionText: {
      fontSize: 14,
      color: COLORS.GRAY,
      fontWeight: '600',
    },
    cornerOptionTextSelected: {
      color: '#000000',
    },
    bottomModal: {
      justifyContent: 'flex-end',
      margin: 0,
    },
    customModalSheet: {
      backgroundColor: 'white',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 24,
      paddingTop: 4,
    },
    customModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.BORDER,
      paddingTop: Platform.OS === 'ios' ? 28 : 16,
    },
    customModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.TEXT,
    },
    customModalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f0f0',
    },
    customModalCloseText: {
      fontSize: 16,
      color: COLORS.GRAY,
    },
    customModalContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 24,
      gap: 16,
    },
    keyboardAvoiding: {
      flex: 1,
    },
    bottomSheetContainer: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    customModalScroll: {
      paddingBottom: 12,
    },
    colorPicker: {
      width: '100%',
      minHeight: 260,
      justifyContent: 'center',
    },
    colorPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    inlineHexContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    inlineHexButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 12,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'white',
    },
    inlineHexButtonPressed: {
      backgroundColor: '#EFEFEF',
    },
    inlineHexText: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.TEXT,
    },
    inlineDefaultButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f2f2f2',
    },
    inlineDefaultButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.TEXT,
    },
    inlineOverlay: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    inlineOverlayBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    inlineModal: {
      width: '100%',
      backgroundColor: 'white',
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 24,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    inlineModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.TEXT,
      marginBottom: 12,
      textAlign: 'center',
    },
    inlineModalInput: {
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: COLORS.TEXT,
    },
    inlineModalInputError: {
      borderColor: '#E53935',
    },
    inlineModalErrorText: {
      marginTop: 8,
      color: '#E53935',
      fontSize: 12,
      textAlign: 'center',
    },
    inlineModalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 16,
    },
    inlineModalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    inlineModalCancel: {
      backgroundColor: 'white',
    },
    inlineModalApply: {
      backgroundColor: COLORS.PRIMARY,
      borderColor: COLORS.PRIMARY,
    },
    inlineModalCancelText: {
      color: COLORS.TEXT,
      fontSize: 15,
      fontWeight: '600',
    },
    inlineModalApplyText: {
      color: COLORS.TEXT,
      fontSize: 15,
      fontWeight: '600',
    },
    colorCodeInput: {
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: COLORS.TEXT,
    },
    colorCodeInputError: {
      borderColor: '#E53935',
    },
    colorInputErrorText: {
      marginTop: 8,
      color: '#E53935',
      fontSize: 12,
    },
    customApplyButton: {
      backgroundColor: COLORS.PRIMARY,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 16,
    },
    customApplyButtonText: {
      color: COLORS.TEXT,
      fontSize: 16,
      fontWeight: '600',
    },
    hexModalSheet: {
      backgroundColor: 'white',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 24,
      paddingTop: Platform.OS === 'ios' ? 28 : 16,
    },
    hexModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    hexModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.TEXT,
    },
    hexModalBody: {
      gap: 12,
    },
    hexModalLabel: {
      fontSize: 14,
      color: COLORS.GRAY,
    },
    hexModalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 8,
    },
    hexModalButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    hexModalCancel: {
      backgroundColor: 'white',
    },
    hexModalApply: {
      backgroundColor: COLORS.PRIMARY,
      borderColor: COLORS.PRIMARY,
    },
    hexModalCancelText: {
      color: COLORS.TEXT,
      fontSize: 16,
      fontWeight: '600',
    },
    hexModalApplyText: {
      color: COLORS.TEXT,
      fontSize: 16,
      fontWeight: '600',
    },
    fontList: {
      maxHeight: 320,
    },
    fontOptionRow: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.BORDER,
      backgroundColor: 'white',
    },
    fontOptionRowSelected: {
      backgroundColor: '#f0f7ff',
      borderLeftWidth: 4,
      borderLeftColor: COLORS.PRIMARY,
      paddingLeft: 16,
    },
    fontOptionTitle: {
      fontSize: 16,
      color: COLORS.TEXT,
      fontWeight: '700',
    },
    fontOptionSubtitle: {
      fontSize: 12,
      color: COLORS.GRAY,
      marginTop: 4,
    },
    fontOptionPreview: {
      fontSize: 14,
      color: COLORS.TEXT,
      marginTop: 8,
    },
    fontSelectedBadge: {
      marginTop: 8,
      alignSelf: 'flex-start',
      backgroundColor: COLORS.PRIMARY,
      color: COLORS.TEXT,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      fontSize: 12,
      fontWeight: '600',
    },
    // Grid selector styles
    positionGridContainer: {
      flexDirection: 'row',
      gap: 8,
      marginVertical: 16,
    },
    gridHalf: {
      flex: 1,
      gap: 4,
    },
    gridRow: {
      flexDirection: 'row',
      gap: 4,
    },
    gridCell: {
      flex: 1,
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#E5E5E5',
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#CCC',
    },
    gridCellSelected: {
      backgroundColor: COLORS.PRIMARY,
      borderColor: COLORS.PRIMARY,
    },
    // Dummy photo preview styles
    positionPreviewContainer: {
      marginVertical: 8,
      width: '100%',
    },
    positionPreviewBox: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: '#F5F5F5',
      flexDirection: 'row',
      overflow: 'hidden',
    },
    previewHalfBefore: {
      flex: 1,
      backgroundColor: '#D0D0D0',
      position: 'relative',
    },
    previewHalfAfter: {
      flex: 1,
      backgroundColor: '#A0A0A0',
      position: 'relative',
    },
    previewLabel: {
      position: 'absolute',
    },
    // Label customization preview section
    labelPreviewSection: {
      marginVertical: 16,
    },
    customizeButton: {
      backgroundColor: COLORS.PRIMARY,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 16,
    },
    customizeButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#000000',
    },
    // Margin slider styles
    marginSliderContainer: {
      marginTop: 16,
      marginBottom: 8,
    },
    marginSliderLabel: {
      fontSize: 14,
      color: COLORS.TEXT,
      marginBottom: 8,
    },
  });
