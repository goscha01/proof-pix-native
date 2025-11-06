import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import googleAuthService from '../services/googleAuthService';
import proxyService from '../services/proxyService';
import { useSettings } from './SettingsContext';

const STORAGE_KEYS = {
  ADMIN_FOLDER_ID: '@admin_folder_id',
  ADMIN_INVITE_TOKENS: '@admin_invite_tokens',
  ADMIN_PLAN_LIMIT: '@admin_plan_limit',
  ADMIN_USER_MODE: '@admin_user_mode',
  TEAM_MEMBER_INFO: '@team_member_info', // For team members
  PROXY_SESSION_ID: '@proxy_session_id', // Proxy server session ID
};

const AdminContext = createContext();

/**
 * Admin Context Provider
 * Manages admin-specific state for Google Drive integration
 */
export function AdminProvider({ children }) {
  const { updateUserPlan } = useSettings();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [folderId, setFolderId] = useState(null);
  const [inviteTokens, setInviteTokens] = useState([]);
  const [planLimit, setPlanLimit] = useState(5); // Default plan limit
  const [isLoading, setIsLoading] = useState(true);
  const [userMode, setUserMode] = useState(null); // 'individual', 'admin', or 'team_member'
  const [teamInfo, setTeamInfo] = useState(null);
  const [proxySessionId, setProxySessionId] = useState(null); // Proxy server session ID
  const [isInitializingProxy, setIsInitializingProxy] = useState(false); // Guard to prevent concurrent initialization

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

      // NEW LOGIC: Trust stored data as the source of truth for session state.
      const storedUser = await googleAuthService.getStoredUserInfo();
      if (storedUser) {
        setUserInfo(storedUser);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      
      // Load user mode
      const storedMode = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_USER_MODE);
      setUserMode(storedMode);

      // Load proxy session ID (for both individual and admin modes)
      const storedProxySessionId = await AsyncStorage.getItem(STORAGE_KEYS.PROXY_SESSION_ID);
      if (storedProxySessionId) {
        setProxySessionId(storedProxySessionId);
      }

      // Load admin-specific data only if in admin mode and authenticated
      if (storedMode === 'admin' && storedUser) {
        const [
          storedFolderId,
          storedTokens,
          storedPlanLimit,
        ] = await AsyncStorage.multiGet([
          STORAGE_KEYS.ADMIN_FOLDER_ID,
          STORAGE_KEYS.ADMIN_INVITE_TOKENS,
          STORAGE_KEYS.ADMIN_PLAN_LIMIT,
        ]);

        setFolderId(storedFolderId[1]);
        setInviteTokens(storedTokens[1] ? JSON.parse(storedTokens[1]) : []);
        setPlanLimit(storedPlanLimit[1] ? parseInt(storedPlanLimit[1]) : 5);
      } else if (storedMode === 'team_member') {
        // Load team member info
        const storedTeamInfo = await AsyncStorage.getItem(STORAGE_KEYS.TEAM_MEMBER_INFO);
        if (storedTeamInfo) {
          setTeamInfo(JSON.parse(storedTeamInfo));
        }
      }
    } catch (error) {
      console.error("Failed to load admin data:", error);
      setIsAuthenticated(false);
      setUserInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in for admin (team) use
   */
  const adminSignIn = async () => {
    try {
      console.log("Admin sign-in process started...");
      const result = await googleAuthService.signInAsAdmin();
      console.log("Received response from Google Sign-In service:", JSON.stringify(result, null, 2));

      if (result && result.error) {
        console.log('Sign-in failed with error:', result.error);
        return { success: false, error: result.error };
      }

      if (result && result.userInfo) {
        console.log("Sign-in successful, user info found.");
        setIsAuthenticated(true);
        setUserInfo(result.userInfo);
        await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_USER_MODE, 'admin');
        setUserMode('admin');
        return { success: true };
      }

      throw new Error("Invalid or unexpected response from googleAuthService");
    } catch (error) {
      console.log("Unexpected error in admin sign-in flow:", error.message);
      setIsAuthenticated(false);
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign in for individual use
   */
  const individualSignIn = async () => {
    try {
      console.log("Individual sign-in process started...");
      const result = await googleAuthService.signInAsIndividual();
      console.log("Received response from Google Sign-In service:", JSON.stringify(result, null, 2));

      if (result && result.error) {
        console.log('Sign-in failed with error:', result.error);
        return { success: false, error: result.error };
      }

      if (result && result.userInfo) {
        console.log("Sign-in successful, user info found.");
        setIsAuthenticated(true);
        setUserInfo(result.userInfo);
        await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_USER_MODE, 'individual');
        setUserMode('individual');
        return { success: true };
      }

      throw new Error("Invalid or unexpected response from googleAuthService");
    } catch (error) {
      console.log("Unexpected error in individual sign-in flow:", error.message);
      setIsAuthenticated(false);
      return { success: false, error: error.message };
    }
  };

  /**
   * Join a team as a member (proxy server only)
   */
  const joinTeam = async (token, sessionId) => {
    try {
      if (!token || !sessionId) {
        throw new Error('Missing token or sessionId');
      }

      const newTeamInfo = { token, sessionId, useProxy: true };
      
      await AsyncStorage.setItem(STORAGE_KEYS.TEAM_MEMBER_INFO, JSON.stringify(newTeamInfo));
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_USER_MODE, 'team_member');
      setTeamInfo(newTeamInfo);
      setUserMode('team_member');
      await updateUserPlan('Team Member');
      // No Google Sign-In for team members, so auth status is not changed
      return { success: true };
    } catch (error) {
      console.error("Error joining team:", error);
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
      setInviteTokens([]);
      setTeamInfo(null);
      setUserMode(null);
      setProxySessionId(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.ADMIN_USER_MODE);
      await AsyncStorage.removeItem(STORAGE_KEYS.TEAM_MEMBER_INFO);
      return { success: true };
    } catch (error) {
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
        STORAGE_KEYS.ADMIN_INVITE_TOKENS,
        STORAGE_KEYS.ADMIN_PLAN_LIMIT,
        STORAGE_KEYS.TEAM_MEMBER_INFO,
        STORAGE_KEYS.PROXY_SESSION_ID,
      ]);
      setProxySessionId(null);
    } catch (error) {
      throw error;
    }
  };

  /**
   * Initialize or retrieve proxy session ID
   * @param {string} folderId - Google Drive folder ID
   * @returns {Promise<string|null>} - Proxy session ID or null if failed
   */
  const initializeProxySession = async (folderId) => {
    // Prevent concurrent initialization calls
      if (isInitializingProxy) {
        console.log('[ADMIN] Proxy session initialization already in progress, waiting...');
        // Wait a bit and check again
        await new Promise(resolve => setTimeout(resolve, 500));
        if (proxySessionId) {
          return { sessionId: proxySessionId, success: true };
        }
        return { success: false, error: 'Initialization in progress' };
      }

    try {
      // If we already have a session ID, return it
      if (proxySessionId) {
        console.log('[ADMIN] Using existing proxy session ID');
        return { sessionId: proxySessionId, success: true };
      }

      // Check storage for existing session
      const storedSessionId = await AsyncStorage.getItem(STORAGE_KEYS.PROXY_SESSION_ID);
      if (storedSessionId) {
        console.log('[ADMIN] Found stored proxy session ID');
        setProxySessionId(storedSessionId);
        return { sessionId: storedSessionId, success: true };
      }

      // Set guard to prevent concurrent calls
      setIsInitializingProxy(true);
      
      // Initialize new session via proxy service
      console.log('[ADMIN] Initializing new proxy session');
      const result = await proxyService.initializeAdminSession(folderId);
      
      if (result && result.sessionId) {
        await AsyncStorage.setItem(STORAGE_KEYS.PROXY_SESSION_ID, result.sessionId);
        setProxySessionId(result.sessionId);
        console.log('[ADMIN] Proxy session initialized successfully');
        setIsInitializingProxy(false);
        return { sessionId: result.sessionId, success: true };
      }

      throw new Error('Failed to initialize proxy session - no sessionId returned');
    } catch (error) {
      console.error('[ADMIN] Error initializing proxy session:', error);
      setIsInitializingProxy(false);
      // Return error object instead of null
      return { success: false, error: error.message };
    }
  };

  /**
   * Check if admin setup is complete (proxy server only)
   */
  const isSetupComplete = () => {
    return isAuthenticated && folderId && proxySessionId;
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
    inviteTokens,
    planLimit,
    isLoading,
    userMode,
    teamInfo,
    proxySessionId,
    isGoogleSignInAvailable: googleAuthService.isAvailable(),

    // Actions
    adminSignIn,
    individualSignIn,
    signOut,
    joinTeam,
    saveFolderId,
    addInviteToken,
    removeInviteToken,
    updatePlanLimit,
    clearAdminData,
    initializeProxySession,

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
