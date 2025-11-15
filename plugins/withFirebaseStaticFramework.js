const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to configure React Native Firebase to use static frameworks
 * This is required for Firebase Analytics compatibility with Expo
 *
 * This plugin:
 * 1. Sets $RNFirebaseAsStaticFramework = true for React Native Firebase
 * 2. Adds CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES flag for RNFB targets
 */
const withFirebaseStaticFramework = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      try {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        // Check if our fixes are already present
        if (podfileContent.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
          console.log('[Firebase Plugin] Firebase fix already present in Podfile');
          return config;
        }

        // Step 1: Add $RNFirebaseAsStaticFramework flag at the top
        if (!podfileContent.includes('$RNFirebaseAsStaticFramework = true')) {
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

          const firebaseFlag = '\n# Required for React Native Firebase with static frameworks\n$RNFirebaseAsStaticFramework = true\n';
          lines.splice(insertIndex, 0, firebaseFlag);
          podfileContent = lines.join('\n');
        }

        // Step 2: Add post_install hook to set CLANG flag for RNFB targets
        const rnfbClangFix = `
  # Fix for React Native Firebase non-modular header errors
  installer.pods_project.targets.each do |target|
    if target.name.start_with?('RNFB') || target.name.start_with?('RNFirebase')
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end`;

        // Check if there's already a post_install block
        if (podfileContent.includes('post_install do |installer|')) {
          console.log('[Firebase Plugin] Found existing post_install block, adding RNFB fix');

          // Find the end of the post_install block
          const lines = podfileContent.split('\n');
          let insertIndex = -1;
          let depth = 0;
          let inPostInstall = false;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.includes('post_install do |installer|')) {
              inPostInstall = true;
              depth = 1;
              continue;
            }

            if (inPostInstall) {
              // Count 'do' keywords to track depth
              if (line.match(/\bdo\b/) && (line.includes(' do |') || line.includes(' do\n') || line.includes(' do'))) {
                depth++;
              }

              // Count 'end' keywords
              if (line.trim().startsWith('end')) {
                depth--;
                if (depth === 0) {
                  insertIndex = i;
                  break;
                }
              }
            }
          }

          if (insertIndex !== -1) {
            lines.splice(insertIndex, 0, rnfbClangFix);
            podfileContent = lines.join('\n');
          } else {
            console.warn('[Firebase Plugin] Could not find post_install block end');
          }
        } else {
          // No post_install block exists, add one before the final 'end'
          console.log('[Firebase Plugin] No post_install block found, creating new one');

          const postInstallBlock = `
post_install do |installer|${rnfbClangFix}
end
`;

          // Find the last 'end' in the file
          const lines = podfileContent.split('\n');
          let lastEndIndex = -1;

          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim() === 'end') {
              lastEndIndex = i;
              break;
            }
          }

          if (lastEndIndex !== -1) {
            lines.splice(lastEndIndex, 0, postInstallBlock);
            podfileContent = lines.join('\n');
          }
        }

        fs.writeFileSync(podfilePath, podfileContent, 'utf8');
        console.log('[Firebase Plugin] Successfully configured Podfile for React Native Firebase with static frameworks');
      } catch (error) {
        console.error('[Firebase Plugin] Error modifying Podfile:', error);
      }

      return config;
    },
  ]);
};

module.exports = withFirebaseStaticFramework;
