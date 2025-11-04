/**
 * Proxy Server Configuration
 *
 * This is the URL of the ProofPix proxy server that handles team member uploads.
 *
 * For development: Use 'http://localhost:3000' if running proxy locally
 * For production: Use your deployed proxy URL (e.g., 'https://proofpix-proxy.vercel.app')
 */

// TODO: Replace this with your deployed proxy server URL
export const PROXY_SERVER_URL = process.env.EXPO_PUBLIC_PROXY_URL || 'https://proofpix-proxy.vercel.app';

export default {
  PROXY_SERVER_URL
};
