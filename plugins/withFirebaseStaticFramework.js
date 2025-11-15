const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to configure React Native Firebase to use static frameworks
 * This is required for Firebase Analytics compatibility with Expo
 */
const withFirebaseStaticFramework = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      try {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        // Check if our fix is already present
        if (podfileContent.includes('$RNFirebaseAsStaticFramework = true')) {
          console.log('[Firebase Plugin] Firebase static framework flag already present in Podfile');
          return config;
        }

        // Add the static framework flag at the top of the file, after require statements
        const lines = podfileContent.split('\n');
        let insertIndex = 0;

        // Find the last require statement or first non-comment line
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('require')) {
            insertIndex = i + 1;
          } else if (!line.startsWith('#') && line !== '' && insertIndex === 0) {
            insertIndex = i;
            break;
          }
        }

        // Insert the Firebase static framework flag
        const firebaseFlag = '\n# Required for React Native Firebase with static frameworks\n$RNFirebaseAsStaticFramework = true\n';
        lines.splice(insertIndex, 0, firebaseFlag);

        podfileContent = lines.join('\n');
        fs.writeFileSync(podfilePath, podfileContent, 'utf8');
        console.log('[Firebase Plugin] Successfully added Firebase static framework flag to Podfile');
      } catch (error) {
        console.error('[Firebase Plugin] Error modifying Podfile:', error);
      }

      return config;
    },
  ]);
};

module.exports = withFirebaseStaticFramework;
