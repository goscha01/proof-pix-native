# How to Share Error Logs with Claude

When you encounter an error in the ProofPix app, here's how to share the logs with me for debugging:

## 📱 Method 1: Terminal/Console Logs (Recommended)

### If using Expo Development Server:

1. **Open your terminal** where you ran `npm start`
2. **Look for error messages** in the terminal output
3. **Copy the entire error message** including:
   - Error type (e.g., `TypeError`, `ReferenceError`)
   - Error message
   - Stack trace (file names and line numbers)
   - Any red text or warnings

**Example of what to copy:**
```
Error: Cannot read property 'uri' of undefined
    at HomeScreen.js:45:23
    at Array.map
    at renderPhotoGrid (HomeScreen.js:40:15)
```

4. **Paste it in your message** to me

---

## 📊 Method 2: Expo Error Screen

### If the app crashes and shows a red error screen:

1. **Take a screenshot** of the error screen
2. **Or copy the text** from the error screen:
   - Long press on the error message
   - Select "Copy" or tap the copy icon
   - Paste it in your message to me

---

## 🔍 Method 3: Console Logs (Web/Browser)

### If running on web (`npm start` → press `w`):

1. **Open Developer Tools**:
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Opt+I` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+K`

2. **Go to Console tab**

3. **Look for errors** (shown in red)

4. **Copy the error**:
   - Right-click on error → "Copy message"
   - Or select and copy the text

5. **Paste it in your message** to me

---

## 📝 Method 4: Device Logs (Physical Device)

### iOS Device:

1. **Connect your iPhone to computer**
2. **Open Xcode** (Mac only)
3. **Window → Devices and Simulators**
4. **Select your device**
5. **Click "Open Console"**
6. **Filter by "ProofPix"**
7. **Copy error logs**

### Android Device:

1. **Enable USB Debugging** on your device
2. **Connect to computer**
3. **Open terminal and run**:
   ```bash
   adb logcat | grep ProofPix
   ```
4. **Copy the error output**

---

## 🎯 What Information to Include

When sharing error logs, please include:

### ✅ Essential Information:
- [ ] **What you were doing** when the error occurred
- [ ] **Error message** (exact text)
- [ ] **Stack trace** (file names and line numbers)
- [ ] **Screen/feature** where it happened

### ✅ Helpful Context:
- [ ] **Device type**: iOS or Android
- [ ] **Running where**: Simulator, emulator, or physical device
- [ ] **Steps to reproduce**: What actions trigger the error

### Example Good Error Report:
```
I'm getting an error when trying to take an after photo.

Steps to reproduce:
1. Open app
2. Select Kitchen room
3. Take before photo ✓
4. Camera opens for after photo
5. Tap capture button
6. App crashes ❌

Error from terminal:
TypeError: Cannot read property 'uri' of undefined
    at CameraScreen.js:123:45
    at handleAfterPhoto
    at takePicture

Running on:
- iPhone 15 Simulator
- iOS 17.0
- Expo SDK 52
```

---

## 🚀 Quick Copy-Paste Templates

### Template 1: Simple Error
```
**Issue**: [Brief description]

**Error Message**:
[Paste error here]

**What I was doing**:
1. [Step 1]
2. [Step 2]
3. [Error occurred]
```

### Template 2: Detailed Error
```
**Issue**: [Brief description]

**Environment**:
- Device: [iOS/Android]
- Running on: [Simulator/Physical Device]
- Expo SDK: [Version from package.json]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Error occurred]

**Error Log**:
```
[Paste full error with stack trace]
```

**Expected**: [What should happen]
**Actual**: [What actually happened]
```

---

## 🛠️ Built-in Error Reporter (Coming Soon)

I've also created an error logger in the app. To use it:

1. **Enable it in App.js** (add at top):
   ```javascript
   import { setupGlobalErrorHandler } from './src/services/errorLogger';
   setupGlobalErrorHandler();
   ```

2. **View logs in app** (coming in next update):
   - Settings → View Error Logs
   - Export → Share logs file

---

## 💡 Pro Tips

1. **Don't edit the logs** - Send them exactly as they appear
2. **Include full stack trace** - Line numbers help me find the exact issue
3. **Multiple errors?** - Share them all, they might be related
4. **Screenshots help** - Visual errors are easier to understand
5. **Version info matters** - Check `package.json` for versions

---

## 🆘 Can't Find Logs?

If you can't find error logs:

1. **Check terminal** where you ran `npm start`
2. **Try running**: `npm start -- --clear` (clears cache, might show errors)
3. **Enable verbose logging**:
   ```bash
   EXPO_DEBUG=true npm start
   ```
4. **Just describe the issue** - I can work with a good description!

---

## 📧 How to Send

### Option 1: Direct Message (Best)
Just paste the error in our chat:
```
Hey, I'm getting this error:
[paste error here]
```

### Option 2: Code Block (For Long Logs)
Use triple backticks for formatting:
```
\`\`\`
[paste error here]
\`\`\`
```

### Option 3: Share Context
If error is too long, share the relevant parts:
- Error type and message
- File name and line number
- What you were doing

---

## ✅ Summary

**Easiest way**:
1. Look at your terminal where `npm start` is running
2. Copy any red error text
3. Paste it in your message to me
4. Tell me what you were doing

That's it! I can usually figure out the issue from the error message and stack trace.

**Questions?** Just ask "How do I get error logs?" and I'll help! 🚀
