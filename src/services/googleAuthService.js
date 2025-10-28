import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Allows the web browser to close properly after authentication
WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEYS = {
  ADMIN_TOKEN: '@admin_google_token',
  ADMIN_USER_INFO: '@admin_user_info',
  ADMIN_REFRESH_TOKEN: '@admin_refresh_token',
  TOKEN_EXPIRY: '@admin_token_expiry',
};

// Google OAuth configuration
const GOOGLE_AUTH_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  scopes: [
    'openid',
    'profile',
    'email',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/script.deployments',
    'https://www.googleapis.com/auth/script.external_request',
  ],
};

/**
 * Google Authentication Service for Admin Setup (Expo AuthSession version)
 * Handles OAuth flow with necessary scopes for Drive API and Apps Script API
 * Works with Expo Go - no native modules required
 */
class GoogleAuthService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    // Static discovery endpoints for Google OAuth
    this.discovery = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };
  }

  /**
   * Get redirect URI for OAuth
   */
  getRedirectUri() {
    // Google requires HTTPS for Drive API scopes
    // Must use Expo's auth proxy for development
    const redirectUri = 'https://auth.expo.io/@goscha01/proof-pix-native';
    return redirectUri;
  }

  /**
   * Build authorization URL manually
   */
  buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: GOOGLE_AUTH_CONFIG.clientId,
      redirect_uri: this.getRedirectUri(),
      response_type: 'code',
      scope: GOOGLE_AUTH_CONFIG.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    return `${this.discovery.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Check if user is already signed in
   * @returns {Promise<boolean>}
   */
  async isSignedIn() {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      const expiry = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

      if (token && expiry) {
        const expiryTime = parseInt(expiry);
        const now = Date.now();

        // If token is still valid (with 5 min buffer)
        if (now < expiryTime - (5 * 60 * 1000)) {
          this.accessToken = token;
          this.tokenExpiry = expiryTime;
          return true;
        }

        // Try to refresh if expired
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_REFRESH_TOKEN);
        if (refreshToken) {
          try {
            await this.refreshAccessToken(refreshToken);
            return true;
          } catch (error) {
            return false;
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Sign in admin user with Google OAuth
   * @returns {Promise<{userInfo, tokens}>}
   */
  async signIn() {
    try {
      // Build the authorization URL manually
      const authUrl = this.buildAuthUrl();
      // Use WebBrowser to open the auth URL
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        this.getRedirectUri()
      );
      if (result.type === 'success' && result.url) {
        // Parse the URL to get the authorization code
        try {
          const url = new URL(result.url);
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            throw new Error(`OAuth error: ${error}`);
          }

          if (!code) {
            throw new Error('No authorization code received');
          }
          // Exchange code for tokens manually
          const tokenResponse = await fetch(this.discovery.tokenEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: GOOGLE_AUTH_CONFIG.clientId,
              code: code,
              redirect_uri: this.getRedirectUri(),
              grant_type: 'authorization_code',
            }).toString(),
          });
          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error('Failed to exchange authorization code for tokens');
          }

          const tokenResult = await tokenResponse.json();
          this.accessToken = tokenResult.access_token;
          this.refreshToken = tokenResult.refresh_token;

          // Calculate token expiry
          const expiryTime = Date.now() + (tokenResult.expires_in || 3600) * 1000;
          this.tokenExpiry = expiryTime;

          // Get user info
          const userInfo = await this.getUserInfo(tokenResult.access_token);
          // Store tokens and user info
          await this.storeAuthData(userInfo, {
            accessToken: tokenResult.access_token,
            refreshToken: tokenResult.refresh_token,
            expiresIn: tokenResult.expires_in,
          });
          return {
            userInfo: {
              user: userInfo,
            },
            tokens: {
              accessToken: tokenResult.access_token,
              idToken: tokenResult.id_token,
            },
          };
        } catch (parseError) {
          throw parseError;
        }
      } else if (result.type === 'cancel') {
        throw new Error('Sign-in was cancelled');
      } else if (result.type === 'dismiss') {
        throw new Error('Sign-in was dismissed');
      } else {
        throw new Error('Sign-in failed: ' + result.type);
      }
    } catch (error) {
      throw new Error('Failed to sign in with Google: ' + error.message);
    }
  }

  /**
   * Get user info from Google
   * @private
   */
  async getUserInfo(accessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get user info');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @private
   */
  async refreshAccessToken(refreshToken) {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_AUTH_CONFIG.clientId,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      this.accessToken = data.access_token;
      const expiryTime = Date.now() + (data.expires_in || 3600) * 1000;
      this.tokenExpiry = expiryTime;

      // Update stored token
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, data.access_token);
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
    } catch (error) {
      throw error;
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    try {
      // Revoke token if available
      if (this.accessToken) {
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
            method: 'POST',
          });
        } catch (error) {
        }
      }

      await this.clearAuthData();
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current user info
   * @returns {Promise<object|null>}
   */
  async getCurrentUser() {
    try {
      const userInfoStr = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_USER_INFO);
      if (userInfoStr) {
        return JSON.parse(userInfoStr);
      }
      return null;
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
      // Check if token is still valid
      if (this.accessToken && this.tokenExpiry) {
        const now = Date.now();
        // If token expires in less than 5 minutes, refresh it
        if (now >= this.tokenExpiry - (5 * 60 * 1000)) {
          const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_REFRESH_TOKEN);
          if (refreshToken) {
            await this.refreshAccessToken(refreshToken);
          } else {
            throw new Error('No refresh token available');
          }
        }
      } else {
        // Try to load from storage
        const token = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        const expiry = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);

        if (token && expiry) {
          this.accessToken = token;
          this.tokenExpiry = parseInt(expiry);

          // Check if we need to refresh
          const now = Date.now();
          if (now >= this.tokenExpiry - (5 * 60 * 1000)) {
            const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_REFRESH_TOKEN);
            if (refreshToken) {
              await this.refreshAccessToken(refreshToken);
            }
          }
        } else {
          throw new Error('No access token available');
        }
      }

      return {
        accessToken: this.accessToken,
        idToken: null, // Not used for API calls
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
  async storeAuthData(userInfo, tokens) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, tokens.accessToken);
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_USER_INFO, JSON.stringify(userInfo));

      if (tokens.refreshToken) {
        await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_REFRESH_TOKEN, tokens.refreshToken);
      }

      // Store token expiry time
      const expiryTime = Date.now() + ((tokens.expiresIn || 3600) * 1000);
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, expiryTime.toString());
    } catch (error) {
    }
  }

  /**
   * Clear stored authentication data
   * @private
   */
  async clearAuthData() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ADMIN_TOKEN,
        STORAGE_KEYS.ADMIN_USER_INFO,
        STORAGE_KEYS.ADMIN_REFRESH_TOKEN,
        STORAGE_KEYS.TOKEN_EXPIRY,
      ]);
    } catch (error) {
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
