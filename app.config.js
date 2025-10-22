import 'dotenv/config';

export default {
  expo: {
    name: process.env.APP_NAME || "ProofPix",
    slug: "proof-pix-native",
    version: process.env.VERSION || "1.0.0",
    orientation: "default",
    icon: "./assets/PP_logo.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    backgroundColor: "#000000",
    splash: {
      image: "./assets/PP_logo.png",
      resizeMode: "contain",
      backgroundColor: "#F2C31B"
    },
    fonts: [
      "./assets/fonts/Quicksand-Light.ttf",
      "./assets/fonts/Quicksand-Regular.ttf",
      "./assets/fonts/Quicksand-Medium.ttf",
      "./assets/fonts/Quicksand-Bold.ttf"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.proofpix.app",
      buildNumber: "4",
      requireFullScreen: false,
      infoPlist: {
        NSCameraUsageDescription: "ProofPix needs access to your camera to take before and after photos.",
        NSPhotoLibraryUsageDescription: "ProofPix needs access to your photo library to save before and after photos.",
        NSPhotoLibraryAddUsageDescription: "ProofPix needs permission to save photos to your library.",
        UIViewControllerBasedStatusBarAppearance: true,
        UISupportedInterfaceOrientations: [
          "UIInterfaceOrientationPortrait",
          "UIInterfaceOrientationLandscapeLeft",
          "UIInterfaceOrientationLandscapeRight"
        ],
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/PP_logo.png",
        backgroundColor: "#F2C31B"
      },
      package: "com.proofpix.app",
      versionCode: 4,
      permissions: [
        "CAMERA",
        "WRITE_EXTERNAL_STORAGE",
        "READ_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.ACCESS_MEDIA_LOCATION",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO"
      ],
      edgeToEdgeEnabled: true
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission: "Allow ProofPix to access your camera to take before and after photos."
        }
      ],
      [
        "expo-media-library",
        {
          photosPermission: "Allow ProofPix to access your photos.",
          savePhotosPermission: "Allow ProofPix to save photos.",
          isAccessMediaLocationEnabled: true
        }
      ],
      "expo-screen-orientation"
    ],
    extra: {
      eas: {
        projectId: "c65badb3-ddbc-4bb8-9de5-fab32a427f16"
      },
      // Environment variables accessible in your app
      locationAScriptUrl: process.env.EXPO_PUBLIC_LOCATION_A_SCRIPT_URL,
      locationAFolderId: process.env.EXPO_PUBLIC_LOCATION_A_FOLDER_ID,
      locationBScriptUrl: process.env.EXPO_PUBLIC_LOCATION_B_SCRIPT_URL,
      locationBFolderId: process.env.EXPO_PUBLIC_LOCATION_B_FOLDER_ID,
      locationCScriptUrl: process.env.EXPO_PUBLIC_LOCATION_C_SCRIPT_URL,
      locationCFolderId: process.env.EXPO_PUBLIC_LOCATION_C_FOLDER_ID,
      locationDScriptUrl: process.env.EXPO_PUBLIC_LOCATION_D_SCRIPT_URL,
      locationDFolderId: process.env.EXPO_PUBLIC_LOCATION_D_FOLDER_ID,
      googleServiceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
    }
  }
};
