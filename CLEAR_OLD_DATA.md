# Clear Old Photo Data

## 🚨 Quick Fix for ph:// URI Error

If you're still seeing the `ph://` error, you need to clear old photo data from your device.

### Method 1: Automatic (Recommended)

**The app now auto-cleans on startup!**

1. **Force close the app** completely
2. **Reopen the app**
3. Check logs - you should see:
   ```
   🧹 Cleaned X photos with invalid URIs
   ```
4. The error should be gone!

### Method 2: Manual Clear (If needed)

If the error persists, manually clear app data:

#### On iOS Simulator:
1. **Erase app data**:
   ```bash
   # Stop the app
   # In terminal, run:
   xcrun simctl erase all
   ```
   OR

2. **Delete and reinstall**:
   - Long press the ProofPix app icon
   - Delete app
   - Restart: `npm start` → press `i`

#### On Physical iOS Device:
1. Delete the Expo Go app
2. Reinstall Expo Go
3. Scan QR code again

#### On Android:
1. Open Settings → Apps → Expo Go
2. Tap "Storage"
3. Tap "Clear Data"
4. Restart app

### Method 3: Reset in App (Coming Soon)

Add this to your app for testing:

**Create a reset button** in `HomeScreen.js`:

```javascript
import { clearAllPhotoData } from '../utils/migration';

// In your component:
const handleReset = async () => {
  await clearAllPhotoData();
  refreshPhotos(); // Reload
  Alert.alert('Success', 'All photo data cleared!');
};

// Add button:
<TouchableOpacity onPress={handleReset}>
  <Text>🗑️ Reset App Data</Text>
</TouchableOpacity>
```

### Why This Happens

- **Old photos** were saved with `ph://` URIs
- **New photos** use `file://` URIs
- App now **auto-filters** old photos on load
- **Next photo** you take will work perfectly

### After Clearing:

✅ Take new photos - they'll use `file://` URIs
✅ Photos will display correctly
✅ No more `ph://` errors
✅ App works normally

### Verify It's Fixed:

1. Clear data (any method above)
2. Take a new photo
3. Check logs:
   ```
   📱 Photo copied to: file://...  ← Good!
   📱 Photo saved successfully
   ```
4. Photo displays in app ✓

## 🔄 What Changed

**Before**: Returned `ph://` from MediaLibrary
**After**: Returns `file://` from DocumentDirectory

**Auto-cleanup** is now enabled, so old data gets removed automatically!

---

**TL;DR**:
1. Close app completely
2. Reopen app (auto-cleans old data)
3. Take new photo
4. Error gone! ✓
