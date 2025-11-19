import AsyncStorage from '@react-native-async-storage/async-storage';

const TRIAL_STORAGE_KEY = '@user_trial_info';
const TRIAL_DURATION_DAYS = 30;

/**
 * Trial Service
 * Manages 30-day free trial for any tier (for new users)
 */

/**
 * Get trial information from storage
 * @returns {Promise<Object|null>} Trial info object or null
 */
export const getTrialInfo = async () => {
  try {
    const stored = await AsyncStorage.getItem(TRIAL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.error('[TrialService] Error getting trial info:', error);
    return null;
  }
};

/**
 * Check if user has already used the trial
 * @returns {Promise<boolean>} True if trial has been used
 */
export const hasUsedTrial = async () => {
  const trialInfo = await getTrialInfo();
  return trialInfo?.used === true;
};

/**
 * Check if trial is currently active
 * @returns {Promise<boolean>} True if trial is active
 */
export const isTrialActive = async () => {
  const trialInfo = await getTrialInfo();
  if (!trialInfo || !trialInfo.active) {
    return false;
  }

  // Check if trial has expired
  const now = new Date().getTime();
  const endDate = new Date(trialInfo.endDate).getTime();
  
  if (now > endDate) {
    // Trial expired, mark as inactive
    await setTrialInactive();
    return false;
  }

  return true;
};

/**
 * Start a new trial for a specific plan tier
 * @param {string} plan - Plan tier (starter, pro, business, enterprise)
 * @returns {Promise<Object>} Trial info object
 */
export const startTrial = async (plan) => {
  try {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + TRIAL_DURATION_DAYS);

    const trialInfo = {
      active: true,
      used: true,
      startDate: now.toISOString(),
      endDate: endDate.toISOString(),
      plan: plan, // Store which plan tier the trial is for
    };

    await AsyncStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(trialInfo));
    
    // Reset notification flags for new trial
    try {
      const { resetNotifications } = await import('./trialNotificationService');
      await resetNotifications();
    } catch (error) {
      console.error('[TrialService] Error resetting notifications:', error);
    }
    
    return trialInfo;
  } catch (error) {
    console.error('[TrialService] Error starting trial:', error);
    throw error;
  }
};

/**
 * Mark trial as inactive (expired or cancelled)
 * @returns {Promise<void>}
 */
export const setTrialInactive = async () => {
  try {
    const trialInfo = await getTrialInfo();
    if (trialInfo) {
      const updated = {
        ...trialInfo,
        active: false,
      };
      await AsyncStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (error) {
    console.error('[TrialService] Error setting trial inactive:', error);
  }
};

/**
 * Get days remaining in trial
 * @returns {Promise<number>} Days remaining (0 if expired or no trial)
 */
export const getTrialDaysRemaining = async () => {
  const trialInfo = await getTrialInfo();
  if (!trialInfo || !trialInfo.active) {
    return 0;
  }

  const now = new Date().getTime();
  const endDate = new Date(trialInfo.endDate).getTime();
  
  if (now > endDate) {
    await setTrialInactive();
    return 0;
  }

  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Check if user can start a trial
 * @returns {Promise<boolean>} True if trial can be started
 */
export const canStartTrial = async () => {
  const used = await hasUsedTrial();
  const active = await isTrialActive();
  return !used && !active;
};

/**
 * Get effective plan (trial plan if trial active, otherwise actual plan)
 * @param {string} currentPlan - Current user plan
 * @returns {Promise<string>} Effective plan name
 */
export const getEffectivePlan = async (currentPlan) => {
  const trialActive = await isTrialActive();
  if (trialActive) {
    const trialInfo = await getTrialInfo();
    if (trialInfo?.plan) {
      return trialInfo.plan; // Return the plan tier from trial
    }
  }
  return currentPlan;
};

/**
 * Get the plan tier that the trial is for
 * @returns {Promise<string|null>} Plan tier or null
 */
export const getTrialPlan = async () => {
  const trialInfo = await getTrialInfo();
  return trialInfo?.plan || null;
};

/**
 * Check if trial has expired and needs action
 * @returns {Promise<boolean>} True if trial expired and user needs to subscribe
 */
export const isTrialExpired = async () => {
  const trialInfo = await getTrialInfo();
  if (!trialInfo || !trialInfo.used) {
    return false;
  }

  const now = new Date().getTime();
  const endDate = new Date(trialInfo.endDate).getTime();
  
  return now > endDate;
};

