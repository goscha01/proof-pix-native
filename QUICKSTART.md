# ProofPix Native - Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
cd proof-pix-native
npm install
```

### Step 2: Start the App
```bash
npm start
```

### Step 3: Run on Device
- **iOS**: Press `i` or scan QR code with Camera app
- **Android**: Press `a` or scan QR code with Expo Go app
- **Web**: Press `w` (limited functionality)

## 📱 Using the App

### 1. Take Your First Before Photo
1. Open the app
2. Select a room (Kitchen, Bathroom, etc.)
3. Tap the "Take Photo" card
4. Position your camera and tap the capture button
5. Photo is saved automatically

### 2. Take the After Photo
1. Camera reopens automatically after before photo
2. You'll see a faint overlay of the before photo
3. Align your camera with the overlay
4. Tap capture to take the after photo

### 3. Create Combined Image
1. Photo editor opens automatically
2. Choose your layout:
   - **Portrait**: Stacked vertically (9:16)
   - **Landscape**: Side by side (16:9)
3. Tap "Save Combined Photo"
4. Done! Photo saved to your device

### 4. View All Photos
- Tap "All Photos" button in top-right
- Browse all before, after, and combined photos
- Tap any photo to view full screen
- Delete unwanted photos with trash icon

## 🎯 Tips

- **Best Results**: Keep camera steady and aligned
- **Lighting**: Try to match lighting conditions for before/after
- **Organization**: Photos auto-organize by room
- **Storage**: Photos save to "ProofPix" album in your photo library

## 🔧 Troubleshooting

**Camera permission denied?**
- Go to device Settings → ProofPix → Enable Camera

**Photos not saving?**
- Go to device Settings → ProofPix → Enable Photos

**App crashes?**
- Restart the development server: `npm start -- --clear`

## 📋 App Structure

```
Home Screen
  ├── Room Tabs (Kitchen, Bathroom, etc.)
  ├── Photo Grid
  │   ├── Combined Photos (clickable)
  │   ├── Before Photos waiting for After (yellow border)
  │   └── Take Photo Card
  └── All Photos Button

Camera Screen
  ├── Before Mode: Take initial photo
  └── After Mode: Take matching photo with overlay

Photo Editor
  ├── Layout Selection
  └── Save Combined Photo

All Photos
  └── View all photos across all rooms
```

## 🎨 Key Features

✅ **Auto-Save**: All photos automatically save
✅ **Smart Overlay**: After photos show before overlay
✅ **Room Organization**: Organize by room type
✅ **Combined Images**: Auto-create before/after comparisons
✅ **Native Performance**: Fast and smooth
✅ **Offline**: Works completely offline

## 📦 What's Included

- 5 Screens (Home, Camera, Editor, All Photos, Detail)
- Photo Context for state management
- AsyncStorage for metadata
- MediaLibrary for photo storage
- React Navigation for screen transitions
- Complete TypeScript support ready

## 🚢 Next Steps

1. **Customize**: Edit colors in `src/constants/rooms.js`
2. **Add Rooms**: Add more room types as needed
3. **Build**: `eas build` for production builds
4. **Deploy**: Submit to App Store / Play Store

## 📖 Full Documentation

See [README.md](./README.md) for complete documentation.

---

**Need Help?** Check the troubleshooting section or file an issue.
