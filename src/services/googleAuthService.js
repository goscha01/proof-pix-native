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
    // Configuration is now done in the specific sign-in methods
  }

  /**
   * Configures and signs in the user for the admin flow.
   * This requests all necessary permissions for team features.
   */
  async signInAsAdmin() {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/script.projects',
        'https://www.googleapis.com/auth/script.deployments',
        'https://www.googleapis.com/auth/script.external_request',
      ],
      offlineAccess: true,
    });

    return this.signIn();
  }

  /**
   * Configures and signs in the user for the individual flow.
   * This requests only the basic permissions for uploading to their own drive.
   */
  async signInAsIndividual() {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file',
      ],
      offlineAccess: true,
    });

    return this.signIn();
  }

  /**
   * Generic sign-in process, called after configuration.
   * @private
   */
  async signIn() {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      console.log('Raw userInfo from Google Sign-In:', JSON.stringify(response, null, 2));

      // The user object is nested inside response.data
      if (response && response.data && response.data.user) {
        const user = response.data.user;
        await this.storeUserInfo(user);
        return { userInfo: user };
      }
      
      // Handle cases where the structure might be different or sign-in was partial
      console.error("User object not found in the expected location in Google Sign-In response.");
      return { error: "Could not retrieve user information from Google." };

    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { error: 'Sign in was cancelled.' };
      } else if (error.code === statusCodes.IN_PROGRESS) {
        return { error: 'Sign in is already in progress.' };
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { error: 'Play services not available or outdated.' };
      } else {
        console.error('Google Sign-In Error:', error);
        return { error: 'Something went wrong during sign in.' };
      }
    }
  }

  /**
   * Check if user is already signed in
   * @returns {Promise<boolean>}
   */
  async isSignedIn() {
    return await GoogleSignin.isSignedIn();
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
   * Signs out the user and revokes all previously granted permissions.
   * This forces the user to re-consent on the next sign-in, which is
   * necessary when scopes have changed.
   */
  async signOut() {
    try {
      // Revoke access to ensure all permissions are cleared from the token
      await GoogleSignin.revokeAccess();
      // Standard sign out to clear the user session
      await GoogleSignin.signOut();
      await this.clearUserInfo();
    } catch (error) {
      console.error('Error during sign out and revoke:', error);
      // It's possible for revokeAccess to fail if the token is already invalid.
      // We can try to sign out anyway as a fallback.
      if (error.code !== '12501') { // 12501 is a common sign-in cancelled error
        try {
          await GoogleSignin.signOut();
          await this.clearUserInfo();
        } catch (signOutError) {
          console.error('Fallback signOut failed:', signOutError);
        }
      }
      throw new Error('Failed to sign out completely.');
    }
  }

  /**
   * Clears the stored user info from AsyncStorage.
   * @private
   */
  async clearUserInfo() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ADMIN_USER_INFO);
    } catch (error) {
      console.error('Failed to clear user info:', error);
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
   * Makes an authenticated API request to a Google API.
   * @param {string} url The URL to request.
   * @param {object} options The options for the fetch request.
   * @returns {Promise<Response>} The response from the request.
   */
  async makeAuthenticatedRequest(url, options = {}) {
    try {
      const { accessToken } = await GoogleSignin.getTokens();

      const headers = new Headers(options.headers || {});
      headers.append('Authorization', `Bearer ${accessToken}`);
      headers.append('Content-Type', 'application/json');

      const response = await fetch(url, {
        ...options,
        headers,
      });

      return response;
    } catch (error) {
      console.error('Error making authenticated request:', error);
      throw new Error('Failed to make authenticated request.');
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
