let analytics;
try {
  // Try to import Firebase Analytics
  analytics = require('@react-native-firebase/analytics').default;
} catch (error) {
  // Firebase not available (e.g., in Expo Go)
  console.log('[ANALYTICS] Firebase Analytics not available (running in Expo Go?)');
  analytics = null;
}

const analyticsService = {
  logEvent: (eventName, eventProperties = {}) => {
    try {
      // Log to console for debugging during development
      console.log(`[ANALYTICS] ${eventName}`, eventProperties);
      
      // Send event to Firebase Analytics if available
      if (analytics) {
        analytics().logEvent(eventName, eventProperties);
      }
    } catch (error) {
      console.error('Analytics Error:', error);
    }
  },
};

export default analyticsService;
