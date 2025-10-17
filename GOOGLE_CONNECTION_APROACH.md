. You can drop Apps Script and upload directly to Google Drive from the app using OAuth2.
Recommended approach (no backend required)
Enable Drive API in Google Cloud; create OAuth client IDs for iOS and Android (installed app).
Sign-in on device with OAuth:
Expo/React Native: use expo-auth-session (Google provider) or react-native-google-signin.
Request scope: https://www.googleapis.com/auth/drive.file (recommended; only files your app creates). Avoid full drive scope unless truly needed.
Ask for offline access (access_type=offline, prompt=consent) to receive a refresh token; store tokens in secure storage (Keychain/EncryptedSharedPrefs via expo-secure-store).
Upload to Drive via REST:
Small files: multipart upload to https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart with Authorization: Bearer <access_token>, metadata (name, parents), and image data.
Large files: resumable upload (init session then PUT chunks).
Create/ensure folders with mimeType: application/vnd.google-apps.folder; set parents to your target folder (or none for flat).
For Shared Drives, pass supportsAllDrives=true and driveId/parents that your user can access.
Production details:
Handle token refresh (use refresh token to fetch new access tokens).
Rate-limit and exponential backoff on 429/5xx; keep concurrent uploads low.
Use drive.file scope to simplify Google OAuth verification; drive scope likely needs a security assessment.
If you need uploads to a central company Drive regardless of user permissions, you’ll need a backend (service account or domain-wide delegation) or user must have write access to that folder.
Tradeoffs
Pure client-side is simplest and secure if you use installed-app OAuth, drive.file scope, and secure token storage.
If you must upload into a folder the user cannot access, or want centralized control/quota shielding, add a lightweight backend that accepts files (or signed URLs) and performs Drive API calls with a service account.