const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const { Readable } = require('stream');
const { kv } = require('@vercel/kv');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// TTL for sessions in seconds (7 days)
const SESSION_TTL = 7 * 24 * 60 * 60;

/**
 * Admin endpoint: Initialize a new session by exchanging a serverAuthCode for a refresh token.
 * POST /api/admin/init
 * Body: { folderId, serverAuthCode }
 */
app.post('/api/admin/init', async (req, res) => {
  try {
    const { folderId, serverAuthCode } = req.body;

    if (!folderId || !serverAuthCode) {
      return res.status(400).json({ error: 'Missing folderId or serverAuthCode' });
    }

    // Exchange serverAuthCode for tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    const { tokens } = await oauth2Client.getToken(serverAuthCode);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      console.error('Failed to obtain refresh token from Google.');
      return res.status(400).json({ error: 'Failed to obtain refresh token. The user may need to re-grant offline access.' });
    }

    // Generate admin session ID
    const sessionId = generateSessionId();

    // Store the folderId, refreshToken, and an empty invite token list for this session
    const sessionData = {
      folderId,
      refreshToken,
      inviteTokens: [],
    };
    await kv.set(`session:${sessionId}`, sessionData, { ex: SESSION_TTL });

    console.log(`Admin session created in KV with refresh token: ${sessionId}`);

    res.json({
      success: true,
      sessionId,
      message: 'Admin session initialized',
    });
  } catch (error) {
    console.error('Error initializing admin session:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message });
  }
});


/**
 * Admin endpoint: Add an invite token
 * POST /api/admin/:sessionId/tokens
 * Body: { token }
 */
app.post('/api/admin/:sessionId/tokens', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { token } = req.body;

    const session = await kv.get(`session:${sessionId}`);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const inviteTokens = new Set(session.inviteTokens || []);
    inviteTokens.add(token);
    session.inviteTokens = Array.from(inviteTokens);

    await kv.set(`session:${sessionId}`, session, { ex: SESSION_TTL });
    
    console.log(`Token added to session ${sessionId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding token:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin endpoint: Remove an invite token
 * DELETE /api/admin/:sessionId/tokens/:token
 */
app.delete('/api/admin/:sessionId/tokens/:token', async (req, res) => {
  try {
    const { sessionId, token } = req.params;

    const session = await kv.get(`session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const inviteTokens = new Set(session.inviteTokens);
    inviteTokens.delete(token);
    session.inviteTokens = Array.from(inviteTokens);

    await kv.set(`session:${sessionId}`, session, { ex: SESSION_TTL });
    
    console.log(`Token removed from session ${sessionId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing token:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Team member endpoint: Upload a photo
 * POST /api/upload/:sessionId
 * Body: { token, filename, contentBase64 }
 */
app.post('/api/upload/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { token, filename, contentBase64 } = req.body;

    // Validate inputs
    if (!token || !filename || !contentBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get admin session from Vercel KV
    const session = await kv.get(`session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.refreshToken) {
      return res.status(400).json({ error: 'Admin session is missing the required refresh token. Please have the admin re-authenticate.' });
    }
    
    // Validate invite token
    const sessionTokens = new Set(session.inviteTokens);
    if (!sessionTokens.has(token)) {
      console.log(`Unauthorized token attempt: ${token}`);
      return res.status(403).json({ error: 'Invalid invite token' });
    }
    
    // Initialize Google OAuth2 client and set credentials to get a new access token
    const oauth2Client = new google.auth.OAuth2(
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({
      refresh_token: session.refreshToken,
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Convert base64 to buffer and then to a readable stream
    const buffer = Buffer.from(contentBase64, 'base64');
    const stream = Readable.from(buffer);

    // Upload to Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [session.folderId]
      },
      media: {
        mimeType: 'image/jpeg',
        body: stream
      }
    });

    console.log(`File uploaded successfully: ${filename} (${response.data.id})`);

    res.json({
      success: true,
      fileId: response.data.id
    });
  } catch (error) {
    console.error('Error uploading file:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Generate a random session ID
 */
function generateSessionId() {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

app.listen(PORT, () => {
  console.log(`ProofPix proxy server running on port ${PORT}`);
});
