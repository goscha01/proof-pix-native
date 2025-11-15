const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Plugin to fix React Native Firebase build issues on iOS
 * Adds necessary build settings to allow non-modular headers in Firebase framework modules
 */
const withFirebasePodfile = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      try {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');

        // Check if our fix is already present
        if (podfileContent.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
          console.log('[Firebase Plugin] Firebase build fix already present in Podfile');
          return config;
        }

        // Prepare the post_install hook content
        const firebaseFix = `
  # Fix for React Native Firebase non-modular header issue
  installer.pods_project.targets.each do |target|
    if target.name == 'React-Core'
      target.build_configurations.each do |config|
        config.build_settings['DEFINES_MODULE'] = 'YES'
      end
    end

    # Allow non-modular includes for Firebase modules
    if target.name.start_with?('RNFB')
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end`;

        // Check if there's already a post_install block
        if (podfileContent.includes('post_install do |installer|')) {
          console.log('[Firebase Plugin] Found existing post_install block, adding Firebase fix');

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
              if (line.match(/\bdo\b/) && (line.includes(' do |') || line.includes(' do\n'))) {
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
            lines.splice(insertIndex, 0, firebaseFix);
            podfileContent = lines.join('\n');
            fs.writeFileSync(podfilePath, podfileContent, 'utf8');
            console.log('[Firebase Plugin] Successfully added Firebase fix to existing post_install block');
          } else {
            console.warn('[Firebase Plugin] Could not find post_install block end');
          }
        } else {
          // No post_install block exists, add one before the final 'end'
          console.log('[Firebase Plugin] No post_install block found, creating new one');

          const postInstallBlock = `
post_install do |installer|${firebaseFix}
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
            fs.writeFileSync(podfilePath, podfileContent, 'utf8');
            console.log('[Firebase Plugin] Successfully created new post_install block');
          }
        }
      } catch (error) {
        console.error('[Firebase Plugin] Error modifying Podfile:', error);
      }

      return config;
    },
  ]);
};

module.exports = withFirebasePodfile;
