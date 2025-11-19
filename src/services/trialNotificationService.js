import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTrialDaysRemaining, isTrialActive, getTrialPlan, getTrialInfo } from './trialService';

const TRIAL_NOTIFICATIONS_KEY = '@trial_notifications_shown';

/**
 * Trial Notification Service
 * Manages showing trial-related messages at specific days
 */

/**
 * Get which notifications have been shown
 * @returns {Promise<Object>} Object with notification flags
 */
export const getShownNotifications = async () => {
  try {
    const stored = await AsyncStorage.getItem(TRIAL_NOTIFICATIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      day0: false,
      day7_10: false,
      day15: false,
      day22_24: false,
      day27_28: false,
      day30: false,
    };
  } catch (error) {
    console.error('[TrialNotification] Error getting shown notifications:', error);
    return {
      day0: false,
      day7_10: false,
      day15: false,
      day22_24: false,
      day27_28: false,
      day30: false,
    };
  }
};

/**
 * Mark a notification as shown
 * @param {string} notificationKey - Key of the notification (day0, day7_10, etc.)
 * @returns {Promise<void>}
 */
export const markNotificationShown = async (notificationKey) => {
  try {
    const shown = await getShownNotifications();
    shown[notificationKey] = true;
    await AsyncStorage.setItem(TRIAL_NOTIFICATIONS_KEY, JSON.stringify(shown));
  } catch (error) {
    console.error('[TrialNotification] Error marking notification shown:', error);
  }
};

/**
 * Check if a notification should be shown based on days remaining
 * @param {boolean} skipDay0 - Skip Day 0 welcome message (for app startup checks)
 * @returns {Promise<Object|null>} Notification object to show, or null
 */
export const getNotificationToShow = async (skipDay0 = false) => {
  const trialActive = await isTrialActive();
  if (!trialActive) {
    // Check if trial just expired (day 30)
    const shown = await getShownNotifications();
    if (!shown.day30) {
      const trialPlan = await getTrialPlan();
      if (trialPlan) {
        // Trial expired, show expiration message
        await markNotificationShown('day30');
        return {
          key: 'day30',
          type: 'expiration',
          title: 'Trial Ended',
          message: 'Your free trial has ended. Upgrade now to keep full access to all features, or continue with the free tier.',
          showUpgrade: true,
          urgent: true,
        };
      }
    }
    return null;
  }

  const daysRemaining = await getTrialDaysRemaining();
  const shown = await getShownNotifications();
  const trialPlan = await getTrialPlan();

  // Day 0 (Welcome) - Show immediately when trial starts (only if not skipped)
  if (!skipDay0 && daysRemaining >= 28 && !shown.day0) {
    await markNotificationShown('day0');
    
    // Get trial end date
    let endDateText = '';
    let formattedDate = '';
    try {
      const trialInfo = await getTrialInfo();
      if (trialInfo && trialInfo.endDate) {
        const endDate = new Date(trialInfo.endDate);
        formattedDate = endDate.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });
        endDateText = ` Your trial ends on ${formattedDate}.`;
      }
    } catch (error) {
      console.error('[TrialNotification] Error getting trial end date:', error);
    }
    
    return {
      key: 'day0',
      type: 'welcome',
      title: 'Welcome to Your Free Trial! 🎉',
      message: `You're now on a 30-day free trial of ${trialPlan ? trialPlan.charAt(0).toUpperCase() + trialPlan.slice(1) : 'Premium'} features. Get started with bulk photo capture, custom watermarks, and automation tools.`,
      endDate: formattedDate, // Store end date separately for styling
      showUpgrade: false,
      urgent: false,
    };
  }

  // Day 7-10 (Engagement Nudge)
  if (daysRemaining >= 20 && daysRemaining <= 23 && !shown.day7_10) {
    await markNotificationShown('day7_10');
    const messages = [
      {
        title: 'Pro Tip: Bulk Delete',
        message: 'Did you know you can delete entire projects at once? Try the bulk delete feature to manage your photos efficiently.',
      },
      {
        title: 'Brand Your Photos',
        message: 'Custom watermarks help you brand your photos professionally. Set up your watermark in Settings to add your logo or text.',
      },
      {
        title: 'Organize with Projects',
        message: 'Create multiple projects to organize your before/after photos by location, client, or date. Keep everything organized!',
      },
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    return {
      key: 'day7_10',
      type: 'engagement',
      ...randomMessage,
      showUpgrade: false,
      urgent: false,
    };
  }

  // Day 15 (Mid-Trial Check-in)
  if (daysRemaining >= 14 && daysRemaining <= 16 && !shown.day15) {
    await markNotificationShown('day15');
    return {
      key: 'day15',
      type: 'checkin',
      title: 'Halfway Through Your Trial!',
      message: `You're halfway through your free trial. How's it going? Make sure to explore all the premium features like unlimited photos, cloud sync, and team collaboration before your trial ends.`,
      showUpgrade: false,
      urgent: false,
    };
  }

  // Day 22-24 (Early End-of-Trial Reminder)
  if (daysRemaining >= 6 && daysRemaining <= 8 && !shown.day22_24) {
    await markNotificationShown('day22_24');
    return {
      key: 'day22_24',
      type: 'reminder',
      title: 'Your Trial Ends in 1 Week!',
      message: `Only ${daysRemaining} days left in your free trial. Upgrade now to keep full access to all premium features without interruption.`,
      showUpgrade: true,
      urgent: false,
    };
  }

  // Day 27-28 (Last Chance Reminder)
  if (daysRemaining >= 2 && daysRemaining <= 3 && !shown.day27_28) {
    await markNotificationShown('day27_28');
    return {
      key: 'day27_28',
      type: 'urgent',
      title: 'Last Chance - Trial Ending Soon!',
      message: `Only ${daysRemaining} days left! Upgrade now to continue uninterrupted access to all premium features.`,
      showUpgrade: true,
      urgent: true,
    };
  }

  return null;
};

/**
 * Reset all notifications (useful for testing or new trial)
 * @returns {Promise<void>}
 */
export const resetNotifications = async () => {
  try {
    await AsyncStorage.removeItem(TRIAL_NOTIFICATIONS_KEY);
  } catch (error) {
    console.error('[TrialNotification] Error resetting notifications:', error);
  }
};

