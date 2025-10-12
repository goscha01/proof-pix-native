# Upload Functionality Implementation

## Overview
I've successfully implemented the Google Drive upload functionality from the JavaScript app (`before-after-photos`) into your React Native app (`proof-pix-native`). The implementation uses **environment variables** to automatically configure Google Drive settings for each location, just like the original JS app.

## What Was Implemented

### 1. **Environment Variables** ([.env](.env))
Updated to use Expo's environment variable format with location-based configurations:
```env
# Location A - Tampa
EXPO_PUBLIC_LOCATION_A_SCRIPT_URL=https://script.google.com/...
EXPO_PUBLIC_LOCATION_A_FOLDER_ID=1G6TFwfrx0IkGc7aFmwxUQgesjaKywt04...

# Location B - St. Petersburg
EXPO_PUBLIC_LOCATION_B_SCRIPT_URL=https://script.google.com/...
EXPO_PUBLIC_LOCATION_B_FOLDER_ID=1-7IKEG1MLave-HXuA4h7hLBRS5A65KhM

# Location C - Jacksonville
# Location D - Miami
```

**Note:** Environment variables prefixed with `EXPO_PUBLIC_` are automatically available at runtime in Expo apps.

### 2. **Location Configuration** ([src/config/locations.js](src/config/locations.js))
Created a centralized location management system:
- **`LOCATIONS`** - Array of all supported locations (Tampa, St. Petersburg, Jacksonville, Miami)
- **`getLocationConfig(locationId)`** - Returns Script URL and Folder ID for a location
- **`getLocationName(locationId)`** - Converts location ID to display name
- **`getLocationId(locationName)`** - Converts display name to location ID

### 3. **Settings Context Updates** ([src/context/SettingsContext.js](src/context/SettingsContext.js))
Simplified to only store user information:
- `userName` - Cleaner's name
- `location` - Selected location ID (e.g., 'tampa', 'miami')
- Removed manual Google Drive configuration (now auto-loaded from environment)

### 4. **Settings Screen Updates** ([src/screens/SettingsScreen.js](src/screens/SettingsScreen.js))
Enhanced with location picker and configuration display:

#### User Information Section:
- **Cleaner Name** - Text input
- **Location** - Dropdown picker with 4 locations

#### Google Drive Configuration Section (Read-only):
- Shows configuration status for selected location
- Displays ✓ Configured or ✗ Not configured for Script URL and Folder ID
- Warning message if configuration is missing

### 5. **Upload Service** ([src/services/uploadService.js](src/services/uploadService.js))
Created a comprehensive upload service:

#### Functions:
- **`uploadPhoto()`** - Uploads a single photo to Google Drive
  - Accepts image data URL, filename, album name, room, type, format, location, cleaner name
  - Prepares FormData and sends POST request to Google Apps Script
  - Returns upload result

- **`uploadPhotoBatch()`** - Uploads multiple photos in batches
  - Processes photos in configurable batch sizes (default: 3 concurrent uploads)
  - Provides progress callbacks
  - Returns successful and failed uploads separately
  - Includes delay between batches to avoid overwhelming the server

- **`createAlbumName()`** - Creates formatted album names
  - Format: "John - Tampa - Dec 21, 2024"
  - Matches the original JS app's naming convention

### 6. **AllPhotosScreen Updates** ([src/screens/AllPhotosScreen.js](src/screens/AllPhotosScreen.js))
Enhanced with location-aware upload functionality:

#### Features:
- **Automatic Configuration** - Uses location-based settings from environment
- **Upload Button** (📤) in the header - Triggers the upload process
- **Configuration Validation** - Checks if location has valid configuration
- **Upload Confirmation** - Shows dialog with photo count before uploading
- **Upload Progress Modal** - Displays:
  - Loading spinner
  - Current progress (e.g., "5 / 20")
  - Progress bar
- **Success/Error Handling** - Shows appropriate alerts after upload completes

## How to Use

### Step 1: Configure Settings
1. Open the app and navigate to **Settings** (⚙️ icon)
2. Fill in the **User Information** section:
   - **Cleaner Name**: Your name
   - **Location**: Select from dropdown (Tampa, St. Petersburg, Jacksonville, or Miami)
3. Verify the **Google Drive Configuration** section shows ✓ Configured for both fields
   - If not configured, check your `.env` file

### Step 2: Upload Photos
1. Navigate to **All Photos** screen (📷 All Photos button)
2. Tap the **Upload** button (📤) in the top-right corner
3. Confirm the upload when prompted
4. Wait for the upload to complete
5. You'll see a success message when done

## Location-Based Upload Flow

```
1. User selects location in Settings (e.g., "Tampa")
2. App loads LOCATION_A_SCRIPT_URL and LOCATION_A_FOLDER_ID from .env
3. When uploading:
   - getLocationConfig('tampa') returns the correct Script URL and Folder ID
   - Photos are uploaded to Tampa's Google Drive folder
   - Album created: "John - Tampa - Dec 21, 2024"
```

## Album Structure
Photos are uploaded to Google Drive in the following structure:
```
Location-Specific Folder (from FOLDER_ID)
└── John - Tampa - Dec 21, 2024 (album folder)
    ├── before/
    ├── after/
    └── combined/
```

## Technical Details

### Environment Variable Flow
1. Variables defined in `.env` with `EXPO_PUBLIC_` prefix
2. Automatically available via `process.env.EXPO_PUBLIC_*`
3. Location config utility reads the correct variables based on selected location
4. Upload service uses the location-specific Script URL and Folder ID

### Upload Process
1. Validates location configuration from environment
2. Creates album name from user name, location, and current date
3. Batches photos into groups of 3 for concurrent upload
4. Each photo is uploaded with metadata:
   - `folderId` - Location-specific Google Drive folder
   - `filename` - Photo filename
   - `albumName` - Album name (e.g., "John - Tampa - Dec 21, 2024")
   - `room` - Room name (e.g., "kitchen", "bathroom")
   - `type` - Photo type ("before", "after", or "mix")
   - `format` - Format type (e.g., "default", "portrait", "square")
   - `timestamp` - Upload timestamp
   - `location` - Location/city
   - `cleanerName` - Cleaner's name
   - `image` - Base64 image data

### Error Handling
- Shows error if location configuration is missing
- Guides user to Settings if user info is missing
- Reports partial success if some uploads fail
- Displays detailed error messages

## Files Modified/Created

### Created:
- `src/services/uploadService.js` - Upload service
- `src/config/locations.js` - Location configuration utility

### Modified:
- `.env` - Added location-based environment variables
- `src/context/SettingsContext.js` - Simplified to user info only
- `src/screens/SettingsScreen.js` - Added location picker and config display
- `src/screens/AllPhotosScreen.js` - Added location-aware upload functionality

## Environment Setup

### Required Environment Variables:
For each location (A, B, C, D), you need:
```env
EXPO_PUBLIC_LOCATION_X_SCRIPT_URL=<Google Apps Script URL>
EXPO_PUBLIC_LOCATION_X_FOLDER_ID=<Google Drive Folder ID>
```

### Location Mapping:
- **Location A** → Tampa
- **Location B** → St. Petersburg
- **Location C** → Jacksonville
- **Location D** → Miami

## Google Apps Script
The upload service expects the same Google Apps Script endpoint from the original JS app. The script should be deployed as a Web App and accept POST requests with the parameters listed above.

## Advantages Over Manual Configuration

### Original Implementation:
- ❌ Users had to manually enter Script URL and Folder ID
- ❌ Risk of typos or incorrect configuration
- ❌ Different settings per device

### New Implementation:
- ✅ Automatic configuration based on location
- ✅ No manual entry required
- ✅ Consistent configuration across all devices
- ✅ Easy to update (just change .env file)
- ✅ Supports multiple locations out of the box

## Next Steps

### Optional Enhancements:
1. **Image Compression** - Add expo-image-manipulator for image compression before upload
2. **Retry Logic** - Add automatic retry for failed uploads
3. **Upload Queue** - Save failed uploads for retry later
4. **Background Upload** - Continue uploads even if app goes to background
5. **Multiple Formats** - Support uploading multiple format variations (portrait, square, landscape)

## Troubleshooting

### Upload button shows "Configuration missing" error:
1. Check that `.env` file exists in the project root
2. Verify the location-specific variables are defined
3. Restart the Expo dev server to reload environment variables

### Photos upload to wrong folder:
1. Verify the correct location is selected in Settings
2. Check that the FOLDER_ID for that location is correct in `.env`

## Notes
- All configuration is loaded from environment variables at build time
- Settings are persisted using AsyncStorage and remembered between app sessions
- Album names are auto-generated using the same format as the original JS app
- Photos are uploaded in batches of 3 to balance speed and server load
