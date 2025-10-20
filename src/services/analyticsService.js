import analytics from '@react-native-firebase/analytics';

const analyticsService = {
  logEvent: (eventName, eventProperties = {}) => {
    try {
      // Log to console for debugging during development
      console.log(`[ANALYTICS] ${eventName}`, eventProperties);
      // Send event to Firebase Analytics
      analytics().logEvent(eventName, eventProperties);
    } catch (error) {
      console.error('Analytics Error:', error);
    }
  },
};

export default analyticsService;
