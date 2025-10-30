import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer'; // Use buffer to handle binary data

/**
 * Generates a cryptographically secure, URL-safe invite token.
 * @returns {string} A 22-character, URL-safe, base64-encoded token.
 */
export function generateInviteToken() {
  const randomBytes = Crypto.getRandomBytes(16); // 16 bytes = 128 bits
  
  // Convert the bytes to a URL-safe base64 string
  const token = Buffer.from(randomBytes).toString('base64')
    .replace(/\+/g, '-') // Replace + with -
    .replace(/\//g, '_') // Replace / with _
    .replace(/=+$/, ''); // Remove trailing =

  return token;
}


