import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Random from 'expo-random';

const REFERRAL_STORAGE_KEY = '@user_referral_info';
const REFERRAL_CODE_KEY = '@user_referral_code';
const REFERRAL_ACCEPTED_KEY = '@referral_accepted';

/**
 * Referral Service
 * Manages user referral codes, tracking, and rewards
 */

/**
 * Generate a unique ID
 * @returns {Promise<string>} Unique ID
 */
const generateUniqueId = async () => {
  try {
    const bytes = await Random.getRandomBytesAsync(16);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  } catch (error) {
    // Fallback
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
};

/**
 * Generate or retrieve user's unique referral code
 * @returns {Promise<string>} Referral code
 */
export const getOrCreateReferralCode = async () => {
  try {
    let code = await AsyncStorage.getItem(REFERRAL_CODE_KEY);
    if (!code) {
      // Generate a unique code (8 characters)
      const uniqueId = await generateUniqueId();
      code = uniqueId.substring(0, 8).toUpperCase();
      await AsyncStorage.setItem(REFERRAL_CODE_KEY, code);
      console.log('[ReferralService] Generated new referral code:', code);
    }
    return code;
  } catch (error) {
    console.error('[ReferralService] Error getting referral code:', error);
    // Fallback code
    return 'REF' + Date.now().toString(36).toUpperCase().substring(0, 5);
  }
};

/**
 * Get referral information (invites sent, rewards earned)
 * @returns {Promise<Object>} Referral info
 */
export const getReferralInfo = async () => {
  try {
    const stored = await AsyncStorage.getItem(REFERRAL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      invitesSent: [],
      rewardsEarned: 0,
      totalMonthsEarned: 0,
    };
  } catch (error) {
    console.error('[ReferralService] Error getting referral info:', error);
    return {
      invitesSent: [],
      rewardsEarned: 0,
      totalMonthsEarned: 0,
    };
  }
};

/**
 * Add a referral invite (when user shares)
 * @param {string} method - Sharing method (whatsapp, email, sms, etc.)
 * @returns {Promise<void>}
 */
export const addReferralInvite = async (method = 'unknown') => {
  try {
    const info = await getReferralInfo();
    const uniqueId = await generateUniqueId();
    const invite = {
      id: uniqueId,
      method,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    info.invitesSent.push(invite);
    await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(info));
    console.log('[ReferralService] Added referral invite:', invite);
  } catch (error) {
    console.error('[ReferralService] Error adding referral invite:', error);
  }
};

/**
 * Check if user signed up via referral
 * @returns {Promise<Object|null>} Referral code if found, null otherwise
 */
export const getAcceptedReferral = async () => {
  try {
    const stored = await AsyncStorage.getItem(REFERRAL_ACCEPTED_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('[ReferralService] Error getting accepted referral:', error);
    return null;
  }
};

/**
 * Mark referral as accepted (called when new user completes setup)
 * @param {string} referralCode - The referral code used
 * @returns {Promise<void>}
 */
export const acceptReferral = async (referralCode) => {
  try {
    const referralData = {
      code: referralCode,
      acceptedAt: new Date().toISOString(),
      setupCompleted: true,
    };
    await AsyncStorage.setItem(REFERRAL_ACCEPTED_KEY, JSON.stringify(referralData));
    console.log('[ReferralService] Referral accepted:', referralCode);
  } catch (error) {
    console.error('[ReferralService] Error accepting referral:', error);
  }
};

/**
 * Process referral reward (when friend completes setup)
 * This would typically be called by a backend service, but for now we'll track locally
 * @param {string} referralCode - The referral code that was used
 * @returns {Promise<number>} Number of months earned (1-3 based on total referrals)
 */
export const processReferralReward = async (referralCode) => {
  try {
    // In a real implementation, this would be handled by a backend
    // For now, we'll simulate it locally
    const info = await getReferralInfo();
    
    // Find the invite that matches this code (if we tracked it)
    // For now, we'll just increment rewards
    const completedCount = info.invitesSent.filter(inv => inv.status === 'completed').length;
    const newCompletedCount = completedCount + 1;
    
    // Calculate months earned (1 friend = 1 month, 2 friends = 2 months, 3+ = 3 months)
    let monthsEarned = 0;
    if (newCompletedCount === 1) {
      monthsEarned = 1;
    } else if (newCompletedCount === 2) {
      monthsEarned = 2;
    } else if (newCompletedCount >= 3) {
      monthsEarned = 3;
    }
    
    // Update the invite status
    const invite = info.invitesSent.find(inv => inv.status === 'pending');
    if (invite) {
      invite.status = 'completed';
      invite.completedAt = new Date().toISOString();
      invite.referralCode = referralCode;
    }
    
    info.rewardsEarned = newCompletedCount;
    info.totalMonthsEarned = monthsEarned;
    
    await AsyncStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(info));
    console.log('[ReferralService] Processed referral reward:', monthsEarned, 'months');
    
    return monthsEarned;
  } catch (error) {
    console.error('[ReferralService] Error processing referral reward:', error);
    return 0;
  }
};

/**
 * Get referral link
 * @param {string} referralCode - User's referral code
 * @returns {string} Full referral link
 */
export const getReferralLink = (referralCode) => {
  // In production, this would be a proper deep link or web URL
  // For now, we'll use a custom URL scheme
  return `proofpix://referral?code=${referralCode}`;
};

/**
 * Get share message with referral link
 * @param {string} referralCode - User's referral code
 * @returns {string} Pre-formatted share message
 */
export const getShareMessage = (referralCode) => {
  const link = getReferralLink(referralCode);
  return `Try ProofPix to manage your cleaning jobs effortlessly! Install using my link and I'll earn free months too: ${link}`;
};

/**
 * Reset referral data (for testing)
 * @returns {Promise<void>}
 */
export const resetReferralData = async () => {
  try {
    await AsyncStorage.multiRemove([
      REFERRAL_STORAGE_KEY,
      REFERRAL_CODE_KEY,
      REFERRAL_ACCEPTED_KEY,
    ]);
    console.log('[ReferralService] Referral data reset');
  } catch (error) {
    console.error('[ReferralService] Error resetting referral data:', error);
  }
};

