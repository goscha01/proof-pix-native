import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import googleAuthService from '../services/googleAuthService';

const STORAGE_KEYS = {
  ADMIN_FOLDER_ID: '@admin_folder_id',
  ADMIN_SCRIPT_URL: '@admin_script_url',
  ADMIN_SCRIPT_ID: '@admin_script_id',
  ADMIN_INVITE_TOKENS: '@admin_invite_tokens',
  ADMIN_PLAN_LIMIT: '@admin_plan_limit',
};

const AdminContext = createContext();

/**
 * Admin Context Provider
 * Manages admin-specific state for Google Drive integration
 */
export function AdminProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [folderId, setFolderId] = useState(null);
  const [scriptUrl, setScriptUrl] = useState(null);
  const [scriptId, setScriptId] = useState(null);
  const [inviteTokens, setInviteTokens] = useState([]);
  const [planLimit, setPlanLimit] = useState(5); // Default plan limit
  const [isLoading, setIsLoading] = useState(true);

  // Load saved admin data on mount
  useEffect(() => {
    loadAdminData();
  }, []);

  /**
   * Load saved admin data from storage
   */
  const loadAdminData = async () => {
    try {
      setIsLoading(true);

      // Check authentication status
      const isSignedIn = await googleAuthService.isSignedIn();
      setIsAuthenticated(isSignedIn);

      if (isSignedIn) {
        // Load user info
        const user = await googleAuthService.getStoredUserInfo();
        setUserInfo(user);

        // Load admin-specific data
        const [
          storedFolderId,
          storedScriptUrl,
          storedScriptId,
          storedTokens,
          storedPlanLimit,
        ] = await AsyncStorage.multiGet([
          STORAGE_KEYS.ADMIN_FOLDER_ID,
          STORAGE_KEYS.ADMIN_SCRIPT_URL,
          STORAGE_KEYS.ADMIN_SCRIPT_ID,
          STORAGE_KEYS.ADMIN_INVITE_TOKENS,
          STORAGE_KEYS.ADMIN_PLAN_LIMIT,
        ]);

        setFolderId(storedFolderId[1]);
        setScriptUrl(storedScriptUrl[1]);
        setScriptId(storedScriptId[1]);
        setInviteTokens(storedTokens[1] ? JSON.parse(storedTokens[1]) : []);
        setPlanLimit(storedPlanLimit[1] ? parseInt(storedPlanLimit[1]) : 5);
      }
    } catch (error) {
      console.error('[AdminContext] Error loading admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in with Google
   */
  const signIn = async () => {
    try {
      const { userInfo: user } = await googleAuthService.signIn();
      setIsAuthenticated(true);
      setUserInfo(user);
      return { success: true };
    } catch (error) {
      console.error('[AdminContext] Sign-in error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      await googleAuthService.signOut();
      await clearAdminData();
      setIsAuthenticated(false);
      setUserInfo(null);
      setFolderId(null);
      setScriptUrl(null);
      setScriptId(null);
      setInviteTokens([]);
      return { success: true };
    } catch (error) {
      console.error('[AdminContext] Sign-out error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Save folder ID
   */
  const saveFolderId = async (id) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_FOLDER_ID, id);
      setFolderId(id);
    } catch (error) {
      console.error('[AdminContext] Error saving folder ID:', error);
      throw error;
    }
  };

  /**
   * Save Apps Script URL and ID
   */
  const saveScriptInfo = async (url, id) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEYS.ADMIN_SCRIPT_URL, url],
        [STORAGE_KEYS.ADMIN_SCRIPT_ID, id],
      ]);
      setScriptUrl(url);
      setScriptId(id);
    } catch (error) {
      console.error('[AdminContext] Error saving script info:', error);
      throw error;
    }
  };

  /**
   * Add a new invite token
   */
  const addInviteToken = async (token) => {
    try {
      const newTokens = [...inviteTokens, token];
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_INVITE_TOKENS, JSON.stringify(newTokens));
      setInviteTokens(newTokens);
      return { success: true };
    } catch (error) {
      console.error('[AdminContext] Error adding invite token:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Remove an invite token
   */
  const removeInviteToken = async (token) => {
    try {
      const newTokens = inviteTokens.filter(t => t !== token);
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_INVITE_TOKENS, JSON.stringify(newTokens));
      setInviteTokens(newTokens);
      return { success: true };
    } catch (error) {
      console.error('[AdminContext] Error removing invite token:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Update plan limit
   */
  const updatePlanLimit = async (limit) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_PLAN_LIMIT, limit.toString());
      setPlanLimit(limit);
    } catch (error) {
      console.error('[AdminContext] Error updating plan limit:', error);
      throw error;
    }
  };

  /**
   * Clear all admin data
   */
  const clearAdminData = async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ADMIN_FOLDER_ID,
        STORAGE_KEYS.ADMIN_SCRIPT_URL,
        STORAGE_KEYS.ADMIN_SCRIPT_ID,
        STORAGE_KEYS.ADMIN_INVITE_TOKENS,
        STORAGE_KEYS.ADMIN_PLAN_LIMIT,
      ]);
    } catch (error) {
      console.error('[AdminContext] Error clearing admin data:', error);
      throw error;
    }
  };

  /**
   * Check if admin setup is complete
   */
  const isSetupComplete = () => {
    return isAuthenticated && folderId && scriptUrl && scriptId;
  };

  /**
   * Check if user can add more invites
   */
  const canAddMoreInvites = () => {
    return inviteTokens.length < planLimit;
  };

  /**
   * Get remaining invite slots
   */
  const getRemainingInvites = () => {
    return Math.max(0, planLimit - inviteTokens.length);
  };

  const value = {
    // State
    isAuthenticated,
    userInfo,
    folderId,
    scriptUrl,
    scriptId,
    inviteTokens,
    planLimit,
    isLoading,

    // Actions
    signIn,
    signOut,
    saveFolderId,
    saveScriptInfo,
    addInviteToken,
    removeInviteToken,
    updatePlanLimit,
    clearAdminData,

    // Helpers
    isSetupComplete,
    canAddMoreInvites,
    getRemainingInvites,

    // Direct access to auth service for API calls
    googleAuthService,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

/**
 * Hook to use admin context
 */
export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
