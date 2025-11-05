import AsyncStorage from '@react-native-async-storage/async-storage';

// Try to import GoogleSignin, but handle gracefully if not available (Expo Go)
let GoogleSignin = null;
let statusCodes = null;

try {
  const googleSigninModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSigninModule.GoogleSignin;
  statusCodes = googleSigninModule.statusCodes;
} catch (error) {
  // Log the actual error to help diagnose build/linking issues
  console.error('Failed to load @react-native-google-signin/google-signin module:', error);
}

const STORAGE_KEYS = {
  ADMIN_USER_INFO: '@admin_user_info',
};

/**
 * Google Authentication Service for Admin Setup
 * Handles OAuth flow with necessary scopes for Drive API and Apps Script API
 * Gracefully handles Expo Go environment where native modules are not available
 */
class GoogleAuthService {
  /**
   * Check if Google Sign-in is available (native module loaded)
   * @returns {boolean}
   */
  isAvailable() {
    return GoogleSignin !== null;
  }

  /**
   * Throws an error if Google Sign-in is not available
   * @private
   */
  checkAvailability() {
    if (!this.isAvailable()) {
      throw new Error('Google Sign-in is not available. Please ensure you are running a development build and the module is correctly linked.');
    }
  }
  constructor() {
    if (this.isAvailable()) {
      // Configure with default scopes - these will be requested on sign-in
      // For iOS, scopes in configure() ensure the consent screen shows all permissions
      const defaultScopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive', // Include Drive scope here for iOS
      ];
      
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        scopes: defaultScopes, // Set scopes in configure() for iOS to show in consent screen
        offlineAccess: true,
        forceCodeForRefreshToken: true, // Force showing consent screen
      });
    }
  }

  /**
   * Configures and signs in the user for the admin flow.
   * This requests all necessary permissions for team features.
   */
  async signInAsAdmin() {
    this.checkAvailability();
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/script.projects',
        'https://www.googleapis.com/auth/script.deployments',
        'https://www.googleapis.com/auth/script.external_request',
      ];
    return this.signIn(scopes);
  }

  /**
   * Configures and signs in the user for the individual flow.
   * This requests only the basic permissions for uploading to their own drive.
   */
  async signInAsIndividual() {
    this.checkAvailability();
    // Use full 'drive' scope instead of 'drive.file' to ensure we can search and create folders
    // 'drive.file' only works for files created by the app, which might not work for folder operations
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/drive', // Full Drive scope for folder operations
      ];
    console.log('Requesting scopes for individual sign-in:', scopes);
    const result = await this.signIn(scopes);
    
    // After sign-in, verify we have access token
    if (result && result.userInfo) {
      try {
        const tokens = await GoogleSignin.getTokens();
        console.log('Access token obtained after sign-in');
        console.log('Token scopes should include Drive - verify in Google Cloud Console OAuth consent screen');
      } catch (tokenError) {
        console.error('Failed to get tokens after sign-in:', tokenError);
      }
    }
    
    return result;
  }

  /**
   * Generic sign-in process, called after configuration.
   * @private
   */
  async signIn(scopes = []) {
    try {
      await GoogleSignin.hasPlayServices();
      
      // Always revoke access and sign out first to ensure fresh consent screen with all scopes
      // This is critical for getting Drive permissions - Google won't show consent if scopes are already granted
      try {
        // Try to revoke access first - this clears all granted permissions
        try {
          await GoogleSignin.revokeAccess();
          console.log('Access revoked to force fresh consent screen');
        } catch (revokeError) {
          console.log('Could not revoke access (user may not be signed in):', revokeError.message);
        }
        
        // Then sign out
        await GoogleSignin.signOut();
        console.log('Signed out to force fresh consent screen with all scopes');
        // Wait a moment to ensure sign out completes
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (signOutError) {
        // Ignore if sign out fails - user might not be signed in
        console.log('Sign out not needed or failed:', signOutError.message);
      }
      
      // Sign in with all required scopes
      // After revokeAccess and signOut, this should show the consent screen with all requested permissions including Drive
      console.log('=== SIGNING IN WITH SCOPES ===');
      console.log('Scopes requested:', JSON.stringify(scopes, null, 2));
      console.log('Make sure these scopes are configured in Google Cloud Console OAuth consent screen!');
      
      const response = await GoogleSignin.signIn({ scopes });
      console.log('Raw userInfo from Google Sign-In:', JSON.stringify(response, null, 2));

      // The user object can be in `response.user` (native) or `response.data.user` (web/Expo Go)
      const user = response?.user || response?.data?.user;

      if (user) {
        await this.storeUserInfo(user);
        
        // Verify we got the tokens and check scopes
        try {
          const tokens = await GoogleSignin.getTokens();
          console.log('=== TOKEN VERIFICATION ===');
          console.log('Access token obtained:', tokens.accessToken ? 'YES' : 'NO');
          console.log('Token length:', tokens.accessToken?.length || 0);
          
          // Try to decode token to check scopes (JWT format)
          if (tokens.accessToken) {
            try {
              // JWT tokens have 3 parts separated by dots
              const parts = tokens.accessToken.split('.');
              if (parts.length === 3) {
                // Decode the payload (second part)
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                console.log('Token scopes from JWT:', payload.scope || 'Not found in token');
                if (!payload.scope || !payload.scope.includes('drive')) {
                  console.error('⚠️ WARNING: Drive scope NOT found in token!');
                  console.error('Token scopes:', payload.scope);
                  console.error('You need to add Drive scope to Google Cloud Console OAuth consent screen');
                } else {
                  console.log('✅ Drive scope found in token!');
                }
              }
            } catch (decodeError) {
              console.log('Could not decode token (may not be JWT format):', decodeError.message);
            }
          }
        } catch (tokenError) {
          console.warn('Could not get tokens after sign-in:', tokenError);
        }
        
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
    if (!this.isAvailable()) {
      return false;
    }
    return await GoogleSignin.isSignedIn();
  }

  /**
   * Get user info from Google
   * @private
   */
  async getUserInfo() {
    this.checkAvailability();
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
    this.checkAvailability();
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
    if (!this.isAvailable()) {
      return null;
    }
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
    this.checkAvailability();
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
    this.checkAvailability();
    try {
      const { accessToken } = await GoogleSignin.getTokens();
      
      if (!accessToken) {
        throw new Error('No access token available. Please sign in again.');
      }

      const headers = new Headers(options.headers || {});
      headers.append('Authorization', `Bearer ${accessToken}`);
      if (!headers.has('Content-Type')) {
        headers.append('Content-Type', 'application/json');
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      return response;
    } catch (error) {
      console.error('Error making authenticated request:', error);
      if (error.message.includes('access token')) {
        throw error;
      }
      throw new Error('Failed to make authenticated request: ' + error.message);
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
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export default new GoogleAuthService();
