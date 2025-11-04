/**
 * Proxy Service
 * Handles communication with the ProofPix proxy server
 */

import { PROXY_SERVER_URL } from '../config/proxy';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

class ProxyService {
  /**
   * Initialize an admin session on the proxy server
   * @param {string} folderId - Google Drive folder ID
   * @returns {Promise<{sessionId: string}>}
   */
  async initializeAdminSession(folderId) {
    try {
      console.log('[PROXY] Initializing admin session with folder ID:', folderId);

      // Get the one-time serverAuthCode from the client to be exchanged on the server
      const { serverAuthCode } = await GoogleSignin.getTokens();
      if (!serverAuthCode) {
        throw new Error('Failed to get serverAuthCode from Google Sign-In.');
      }

      const response = await fetch(`${PROXY_SERVER_URL}/api/admin/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderId,
          serverAuthCode,
        }),
      });

      console.log('[PROXY] Init response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PROXY] Init error:', errorText);
        throw new Error(`Failed to initialize proxy session: ${response.status}`);
      }

      const data = await response.json();
      console.log('[PROXY] Session initialized:', data.sessionId);

      return {
        sessionId: data.sessionId
      };
    } catch (error) {
      console.error('[PROXY] Error initializing session:', error);
      throw error;
    }
  }

  /**
   * Add an invite token to the admin session
   * @param {string} sessionId - Proxy session ID
   * @param {string} token - Invite token
   */
  async addInviteToken(sessionId, token) {
    try {
      console.log('[PROXY] Adding invite token to session:', sessionId);

      const response = await fetch(`${PROXY_SERVER_URL}/api/admin/${sessionId}/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PROXY] Add token error:', errorText);
        throw new Error(`Failed to add invite token: ${response.status}`);
      }

      const data = await response.json();
      console.log('[PROXY] Token added successfully');

      return data;
    } catch (error) {
      console.error('[PROXY] Error adding token:', error);
      throw error;
    }
  }

  /**
   * Remove an invite token from the admin session
   * @param {string} sessionId - Proxy session ID
   * @param {string} token - Invite token
   */
  async removeInviteToken(sessionId, token) {
    try {
      console.log('[PROXY] Removing invite token from session:', sessionId);

      const response = await fetch(`${PROXY_SERVER_URL}/api/admin/${sessionId}/tokens/${encodeURIComponent(token)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PROXY] Remove token error:', errorText);
        throw new Error(`Failed to remove invite token: ${response.status}`);
      }

      const data = await response.json();
      console.log('[PROXY] Token removed successfully');

      return data;
    } catch (error) {
      console.error('[PROXY] Error removing token:', error);
      throw error;
    }
  }

  /**
   * Upload a photo as a team member
   * @param {string} sessionId - Proxy session ID
   * @param {string} token - Invite token
   * @param {string} filename - Filename
   * @param {string} contentBase64 - Base64 encoded image
   */
  async uploadPhoto(sessionId, token, filename, contentBase64) {
    try {
      console.log('[PROXY] Uploading photo:', { sessionId, filename, token: token.substring(0, 10) + '...' });

      const response = await fetch(`${PROXY_SERVER_URL}/api/upload/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          filename,
          contentBase64
        }),
      });

      console.log('[PROXY] Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PROXY] Upload error:', errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('[PROXY] Photo uploaded successfully:', data.fileId);

      return data;
    } catch (error) {
      console.error('[PROXY] Error uploading photo:', error);
      throw error;
    }
  }
}

export default new ProxyService();
