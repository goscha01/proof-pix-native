# Google OAuth Setup - Fresh Start Guide

This guide will help you set up Google OAuth from scratch using the proper approach for React Native/Expo apps.

## Prerequisites

- Google Cloud Console access
- Your Expo username: `goscha01`
- Your app bundle ID: `com.proofpix.app`

## Part 1: Google Cloud Console Setup

### Step 1: Create or Select Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your existing project (proofpix-475818) or create a new one
3. Make sure you're in the correct project (check top left dropdown)

### Step 2: Enable Required APIs

1. Go to [APIs & Services → Library](https://console.cloud.google.com/apis/library)
2. Enable these APIs:
   - **Google Drive API**
   - **Google Apps Script API** (if you need Apps Script functionality)

### Step 3: Configure OAuth Consent Screen

1. Go to [APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
2. Choose **User Type: External**
3. Click **CREATE**
4. Fill in the required fields:
   - **App name**: ProofPix
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click **SAVE AND CONTINUE**

### Step 4: Add Scopes

1. Click **ADD OR REMOVE SCOPES**
2. Add these scopes (search and check them):
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   - `.../auth/drive.file`
   - `.../auth/drive`
3. Click **UPDATE**
4. Click **SAVE AND CONTINUE**

### Step 5: Add Test Users

1. Click **+ ADD USERS**
2. Add the email address(es) you'll use for testing
3. Click **ADD**
4. Click **SAVE AND CONTINUE**
5. Click **BACK TO DASHBOARD**

**IMPORTANT**: Make sure the Publishing Status shows **"Testing"** - NOT "In production"

### Step 6: Create OAuth Client IDs

You need to create **TWO** separate OAuth clients - one for iOS and one for Android/Web.

#### A. Create iOS OAuth Client ID

1. Go to [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Choose **Application type**: **iOS**
4. **Name**: `ProofPix iOS`
5. **Bundle ID**: `com.proofpix.app`
6. Click **CREATE**
7. **COPY THE CLIENT ID** - you'll need this!

#### B. Create Web OAuth Client ID

1. Click **+ CREATE CREDENTIALS** → **OAuth client ID** again
2. Choose **Application type**: **Web application**
3. **Name**: `ProofPix Web`
4. **Authorized redirect URIs**: Add the following URI:
   - `https://auth.expo.io/@goscha01/proof-pix-native`
5. Click **CREATE**
6. **COPY THE CLIENT ID** - you'll need this too!

## Part 2: Configure Your App

### Step 7: Update Environment Variables

Create or update your `.env` file with the client IDs:

```bash
# Google OAuth Configuration
# iOS Client ID (from Step 6A)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID_HERE.apps.googleusercontent.com

# Web Client ID (from Step 6B) - used for getting refresh tokens
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID_HERE.apps.googleusercontent.com
```

### Step 8: Update app.config.js

Add the Google Sign-In plugin to your `app.config.js`:

```javascript
plugins: [
  // ... your existing plugins ...
  [
    '@react-native-google-signin/google-signin',
    {
      iosUrlScheme: 'com.googleusercontent.apps.YOUR_IOS_CLIENT_ID_REVERSED'
    }
  ]
],
```

**Note**: Replace `YOUR_IOS_CLIENT_ID_REVERSED` with your iOS Client ID in reverse DNS notation.
For example, if your client ID is `123456-abc.apps.googleusercontent.com`, use `com.googleusercontent.apps.123456-abc`.

## Part 3: Testing

### Step 9: Restart Development Server

```bash
npx expo start --clear
```

### Step 10: Test Sign-In

1. Open your app on a device/simulator
2. Go to Settings → Admin Setup
3. Click "Sign in with Google"
4. Select the test user you added in Step 5
5. Grant permissions

## Troubleshooting

### "Sign-in cancelled" or "DEVELOPER_ERROR"

- **Cause**: Client IDs not configured correctly
- **Solution**: Double-check your iOS and Web Client IDs in `.env`

### "Access blocked"

- **Cause**: Email not added as test user OR app in "In production" mode
- **Solution**:
  1. Check OAuth consent screen is in "Testing" mode
  2. Verify your email is in the test users list

### "PLAY_SERVICES_NOT_AVAILABLE" (Android only)

- **Cause**: Google Play Services not installed
- **Solution**: Only occurs on Android emulators without Play Services - use a real device or emulator with Play Services

### iOS: "No client ID provided"

- **Cause**: `iosClientId` not set in configure()
- **Solution**: Make sure `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is in your `.env` file

## Key Differences from Previous Approach

1. ✅ **Native SDK** instead of web-based OAuth flow
2. ✅ **Platform-specific** client IDs (iOS + Web)
3. ✅ **No redirect URI issues** - handled natively
4. ✅ **Simpler configuration** - no need for Expo auth proxy
5. ✅ **Better user experience** - uses system account picker

## Next Steps

Once sign-in works:
1. Test API access with Drive API
2. Add error handling for edge cases
3. Test on both iOS and Android
4. When ready for production, publish the OAuth consent screen

