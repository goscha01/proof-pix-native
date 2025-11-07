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
  TEAM_NAME: '@team_name', // Team name for admin
  STORED_INDIVIDUAL_PLAN: '@stored_individual_plan', // Store individual plan when switching to team mode
  STORED_INDIVIDUAL_MODE: '@stored_individual_mode', // Store individual mode (individual/admin) when switching to team mode
};

const AdminContext = createContext();

/**
 * Admin Context Provider
 * Manages admin-specific state for Google Drive integration
 */
export function AdminProvider({ children }) {
  const settingsContext = useSettings();
  const { updateUserPlan } = settingsContext;
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
  const [teamName, setTeamName] = useState('');

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
          storedTeamName,
        ] = await AsyncStorage.multiGet([
          STORAGE_KEYS.ADMIN_FOLDER_ID,
          STORAGE_KEYS.ADMIN_INVITE_TOKENS,
          STORAGE_KEYS.ADMIN_PLAN_LIMIT,
          STORAGE_KEYS.TEAM_NAME,
        ]);

        setFolderId(storedFolderId[1]);
        setInviteTokens(storedTokens[1] ? JSON.parse(storedTokens[1]) : []);
        setPlanLimit(storedPlanLimit[1] ? parseInt(storedPlanLimit[1]) : 5);
        setTeamName(storedTeamName[1] || '');
      } else if (storedMode === 'team_member') {
        // Load team member info
        const storedTeamInfo = await AsyncStorage.getItem(STORAGE_KEYS.TEAM_MEMBER_INFO);
        if (storedTeamInfo) {
          setTeamInfo(JSON.parse(storedTeamInfo));
        }
        // Note: Individual plan/mode are stored when joining team, so they're preserved
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

      // Store current individual plan, mode, and name before switching to team mode
      const settingsKey = 'app-settings';
      const storedSettings = await AsyncStorage.getItem(settingsKey);
      const settings = storedSettings ? JSON.parse(storedSettings) : {};
      const currentPlan = settings.userPlan || 'starter';
      const currentMode = userMode || 'individual';
      const currentUserName = settings.userName || '';
      
      // Only store if not already in team mode (to preserve original settings)
      const storedPlan = await AsyncStorage.getItem(STORAGE_KEYS.STORED_INDIVIDUAL_PLAN);
      if (!storedPlan && currentMode !== 'team_member') {
        await AsyncStorage.setItem(STORAGE_KEYS.STORED_INDIVIDUAL_PLAN, currentPlan);
        await AsyncStorage.setItem(STORAGE_KEYS.STORED_INDIVIDUAL_MODE, currentMode);
        // Also store the individual user's name to restore later
        if (currentUserName) {
          await AsyncStorage.setItem('@stored_individual_name', currentUserName);
        }
        console.log('[ADMIN] Stored individual plan, mode, and name:', { plan: currentPlan, mode: currentMode, userName: currentUserName });
      }

      // Get team member's name from settings (this should be the name entered in the test modal or join flow)
      const memberName = settings.userName || 'Team Member';
      
      // Ensure the team member name is set in settings (this is the name used for the team member account)
      // Note: The name should already be set from the test modal, but we ensure it's there

      // Register team member join with proxy server
      try {
        await proxyService.registerTeamMemberJoin(sessionId, token, memberName);
        console.log('[ADMIN] Team member registered with proxy server');
      } catch (registerError) {
        console.warn('[ADMIN] Failed to register team member (non-critical):', registerError.message);
        // Continue anyway - the join can still work
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
   * Switch back to individual mode from team mode
   * Restores the stored individual plan, mode, and name
   */
  const switchToIndividualMode = async () => {
    try {
      // Get stored individual plan, mode, and name
      const [storedPlan, storedMode, storedName] = await AsyncStorage.multiGet([
        STORAGE_KEYS.STORED_INDIVIDUAL_PLAN,
        STORAGE_KEYS.STORED_INDIVIDUAL_MODE,
        '@stored_individual_name',
      ]);

      const individualPlan = storedPlan[1] || 'starter';
      const individualMode = storedMode[1] || 'individual';
      const individualName = storedName[1] || '';

      console.log('[ADMIN] Switching back to individual mode:', { plan: individualPlan, mode: individualMode, userName: individualName });

      // Clear team member info
      await AsyncStorage.removeItem(STORAGE_KEYS.TEAM_MEMBER_INFO);
      setTeamInfo(null);

      // Restore individual mode and plan
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_USER_MODE, individualMode);
      setUserMode(individualMode);
      
      // Restore the individual user's plan
      await updateUserPlan(individualPlan);
      
      // Restore the individual user's name if it was stored
      if (individualName) {
        // Use the SettingsContext method to properly update the name and trigger re-renders
        if (settingsContext && settingsContext.updateUserInfo) {
          await settingsContext.updateUserInfo(individualName);
          console.log('[ADMIN] Restored individual user name via SettingsContext:', individualName);
        } else {
          // Fallback: directly update AsyncStorage if SettingsContext is not available
          const settingsKey = 'app-settings';
          const storedSettings = await AsyncStorage.getItem(settingsKey);
          const settings = storedSettings ? JSON.parse(storedSettings) : {};
          await AsyncStorage.setItem(settingsKey, JSON.stringify({
            ...settings,
            userName: individualName
          }));
          console.log('[ADMIN] Restored individual user name directly:', individualName);
        }
      }

      // If the stored mode was 'admin', we need to restore admin state
      // But we don't restore folderId/proxySessionId as those require re-authentication
      if (individualMode === 'admin') {
        // Keep isAuthenticated and userInfo if they exist
        // User will need to reconnect team if they want team features
      }

      return { success: true, plan: individualPlan, mode: individualMode };
    } catch (error) {
      console.error("Error switching to individual mode:", error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign out from team only (keeps Google authentication)
   * For Business/Enterprise users who want to disconnect team but stay signed in to Google
   */
  const signOutFromTeam = async () => {
    try {
      // Clear only team setup data, keep Google authentication
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ADMIN_FOLDER_ID,
        STORAGE_KEYS.ADMIN_INVITE_TOKENS,
        STORAGE_KEYS.ADMIN_PLAN_LIMIT,
        STORAGE_KEYS.PROXY_SESSION_ID,
        STORAGE_KEYS.TEAM_NAME,
      ]);
      setFolderId(null);
      setInviteTokens([]);
      setProxySessionId(null);
      setPlanLimit(5); // Reset to default
      setTeamName(''); // Clear team name
      // Keep isAuthenticated, userInfo, and userMode='admin'
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign out completely (clears Google authentication and all data)
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

  /**
   * Update team name
   */
  const updateTeamName = async (name) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TEAM_NAME, name);
      setTeamName(name);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
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
    teamName,
    isGoogleSignInAvailable: googleAuthService.isAvailable(),

    // Actions
    adminSignIn,
    individualSignIn,
    signOut,
    signOutFromTeam,
    joinTeam,
    switchToIndividualMode,
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
    updateTeamName,

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
