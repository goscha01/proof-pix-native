let analytics;
try {
  // Try to import Firebase Analytics
  analytics = require('@react-native-firebase/analytics').default;
} catch (error) {
  // Firebase not available (e.g., in Expo Go)
  analytics = null;
}

const analyticsService = {
  logEvent: (eventName, eventProperties = {}) => {
    try {
      // Log to console for debugging during development
      // Send event to Firebase Analytics if available
      if (analytics) {
        analytics().logEvent(eventName, eventProperties);
      }
    } catch (error) {
    }
  },
};

export default analyticsService;
