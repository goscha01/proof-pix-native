# Firebase Analytics Setup for ProofPix

## Overview
Firebase Analytics has been successfully integrated into the ProofPix app.

### Project Information
- **Project Name**: ProofPix
- **Project ID**: proofpix-d87f0
- **Project Number**: 219286146191
- **Organization**: organizations/32876712607

## What Was Configured

### 1. Package Installation
- Installed `@react-native-firebase/analytics` version 23.5.0
- Already had `@react-native-firebase/app` version 23.4.1

### 2. App Configuration
Updated [app.config.js](app.config.js) to include the Firebase Analytics plugin in the plugins array.

### 3. Firebase Configuration Files
The following files are already in place:
- `google-services.json` - Android configuration
- `GoogleService-Info.plist` - iOS configuration

### 4. Analytics Initialization
Updated [App.js](App.js) to:
- Import Firebase Analytics
- Enable analytics collection on app start
- Automatically track screen views using React Navigation

### 5. Analytics Utility
Created [src/utils/analytics.js](src/utils/analytics.js) with helper functions:

#### Core Functions
- `logEvent(eventName, params)` - Log custom events
- `logScreenView(screenName, screenClass)` - Log screen views
- `setUserProperties(properties)` - Set user properties
- `setUserId(userId)` - Set user ID
- `setAnalyticsEnabled(enabled)` - Enable/disable analytics

#### ProofPix-Specific Functions
- `logPhotoCapture(photoType)` - Track photo captures
- `logPhotoSave(hasLabels, labelPosition)` - Track photo saves
- `logPhotoExport(exportType)` - Track photo exports
- `logSettingsChange(settingName, settingValue)` - Track settings changes
- `logSignIn(method)` - Track user sign-ins
- `logSignOut()` - Track user sign-outs
- `logTeamAction(action)` - Track team creation/joining
- `logLabelCustomization(customization)` - Track label customizations
- `logLanguageChange(language)` - Track language changes

## How to Use

### Automatic Screen Tracking
Screen views are automatically tracked when users navigate between screens in the app.

### Manual Event Tracking
Import the analytics utility in your components:

```javascript
import { logPhotoCapture, logPhotoSave, logSignIn } from './src/utils/analytics';

// Track a photo capture
logPhotoCapture('before');

// Track a photo save
logPhotoSave(true, 'top-left');

// Track user sign-in
logSignIn('google');
```

### Custom Events
For custom events not covered by the helper functions:

```javascript
import { logEvent } from './src/utils/analytics';

logEvent('custom_event_name', {
  param1: 'value1',
  param2: 123,
});
```

## Next Steps

### 1. Rebuild the App
You need to rebuild the app for the changes to take effect:

```bash
# For Android
npm run android

# For iOS
npm run ios
```

### 2. Add Analytics to Key Actions
Consider adding analytics tracking to:
- Camera screen when photos are taken
- Photo editor when images are saved
- Settings screen when preferences change
- Authentication screens for sign-in/sign-out
- Gallery when photos are viewed or shared

### 3. Test Analytics
After rebuilding:
1. Run the app in development
2. Perform various actions (take photos, change settings, etc.)
3. Check the console for analytics logs
4. View events in Firebase Console (Analytics > Events)
   - Note: It may take 24-48 hours for events to appear in the Firebase Console

### 4. View Analytics in Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **proofpix-d87f0**
3. Navigate to Analytics > Dashboard
4. View real-time events in Analytics > DebugView (requires enabling debug mode)

## Enable Debug Mode

### Android
```bash
adb shell setprop debug.firebase.analytics.app com.proofpix.app
```

### iOS
1. In Xcode, select Product > Scheme > Edit Scheme
2. Select Run from the left menu
3. Select the Arguments tab
4. Add `-FIRAnalyticsDebugEnabled` to Arguments Passed On Launch

## Disable Analytics (Optional)
If you need to disable analytics collection:

```javascript
import { setAnalyticsEnabled } from './src/utils/analytics';

setAnalyticsEnabled(false);
```

## Privacy Considerations
- Analytics is enabled by default
- Consider adding a privacy policy and user consent mechanism
- You may want to add a setting to allow users to opt-out of analytics

## Troubleshooting

### Events Not Showing Up
- Make sure you've rebuilt the app
- Enable debug mode to see events in real-time
- Check console logs for error messages
- Verify Firebase configuration files are in the correct locations

### Build Errors
- Run `npm install` again
- Clear Metro bundler cache: `npx expo start -c`
- For iOS: `cd ios && pod install && cd ..`

## Resources
- [Firebase Analytics Documentation](https://rnfirebase.io/analytics/usage)
- [Firebase Console](https://console.firebase.google.com/project/proofpix-d87f0/overview)
- [React Native Firebase](https://rnfirebase.io/)
