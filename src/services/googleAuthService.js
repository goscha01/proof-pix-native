import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  ADMIN_USER_INFO: '@admin_user_info',
};

/**
 * Google Authentication Service for Admin Setup (Expo AuthSession version)
 * Handles OAuth flow with necessary scopes for Drive API and Apps Script API
 * Works with Expo Go - no native modules required
 */
class GoogleAuthService {
  constructor() {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/script.projects',
        'https://www.googleapis.com/auth/script.deployments',
        'https://www.googleapis.com/auth/script.external_request',
      ],
      offlineAccess: true, // Needed to get a refresh token
    });
  }

  /**
   * Check if user is already signed in
   * @returns {Promise<boolean>}
   */
  async isSignedIn() {
    return await GoogleSignin.isSignedIn();
  }

  /**
   * Sign in admin user with Google OAuth
   * @returns {Promise<{userInfo, tokens}>}
   */
  async signIn() {
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      await this.storeUserInfo(userInfo.user);
      const tokens = await GoogleSignin.getTokens();
      return { userInfo, tokens };
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('Sign-in was cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        throw new Error('Sign-in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Play services not available or outdated');
      } else {
        throw new Error('Failed to sign in with Google: ' + error.message);
      }
    }
  }

  /**
   * Get user info from Google
   * @private
   */
  async getUserInfo() {
    try {
      const currentUser = await GoogleSignin.getCurrentUser();
      return currentUser ? currentUser.user : null;
    } catch (error) {
      throw new Error('Failed to get user info: ' + error.message);
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
      await this.clearAuthData();
    } catch (error) {
      console.error('Sign out error:', error);
      throw new Error('Failed to sign out');
    }
  }

  /**
   * Get current user info
   * @returns {Promise<object|null>}
   */
  async getCurrentUser() {
    try {
      const userInfo = await GoogleSignin.getCurrentUser();
      return userInfo ? userInfo.user : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get fresh access tokens (refresh if needed)
   * @returns {Promise<{accessToken, idToken}>}
   */
  async getTokens() {
    try {
      const tokens = await GoogleSignin.getTokens();
      return {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
      };
    } catch (error) {
      throw new Error('Failed to get access tokens. Please sign in again.');
    }
  }

  /**
   * Make an authenticated API call to Google APIs
   * @param {string} url - API endpoint URL
   * @param {object} options - Fetch options
   * @returns {Promise<Response>}
   */
  async makeAuthenticatedRequest(url, options = {}) {
    try {
      const tokens = await this.getTokens();

      const headers = {
        ...options.headers,
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, {
        ...options,
        headers,
      });

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Store authentication data securely
   * @private
   */
  async storeUserInfo(userInfo) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_USER_INFO, JSON.stringify(userInfo));
    } catch (error) {
      // Error saving data
    }
  }

  /**
   * Clear stored authentication data
   * @private
   */
  async clearAuthData() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ADMIN_USER_INFO);
    } catch (error) {
      // Error removing data
    }
  }

  /**
   * Get stored user info
   * @returns {Promise<object|null>}
   */
  async getStoredUserInfo() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_USER_INFO);
      if (data) {
        const userInfo = JSON.parse(data);
        // Wrap in same format as before for compatibility
        return {
          user: userInfo,
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export default new GoogleAuthService();
