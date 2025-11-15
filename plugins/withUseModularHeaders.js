const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs').promises;
const path = require('path');

// This plugin is necessary to address a build issue with React Native Firebase on iOS.
// The build fails due to a "non-modular header" error when using frameworks.
// This plugin adds a `post_install` hook to the Podfile to explicitly enable
// module definition for `React-Core`, which resolves the conflict.
const postInstallHook = `
post_install do |installer|
  installer.pods_project.targets.each do |target|
    if target.name == "React-Core"
      target.build_configurations.each do |config|
        config.build_settings['DEFINES_MODULE'] = 'YES'
      end
    end

    # Fix for React Native Firebase non-modular header issue
    if target.name.start_with?('RNFB')
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
  end
end
`;

const withUseModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfileContent = await fs.readFile(podfilePath, 'utf8');

      // Check if our specific Firebase fix is already present
      if (podfileContent.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        return config;
      }

      // If there's already a post_install hook, we need to modify it instead of adding a new one
      if (podfileContent.includes('post_install do |installer|')) {
        // Find the last 'end' before the final 'end' of the file
        const lines = podfileContent.split('\n');
        let postInstallEndIndex = -1;
        let depth = 0;
        let foundPostInstall = false;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('post_install do |installer|')) {
            foundPostInstall = true;
            depth = 1;
          } else if (foundPostInstall) {
            if (lines[i].trim().startsWith('do ') || lines[i].includes(' do |')) {
              depth++;
            } else if (lines[i].trim() === 'end') {
              depth--;
              if (depth === 0) {
                postInstallEndIndex = i;
                break;
              }
            }
          }
        }

        if (postInstallEndIndex !== -1) {
          // Insert our Firebase fix before the post_install's end
          const firebaseFix = `
    # Fix for React Native Firebase non-modular header issue
    installer.pods_project.targets.each do |target|
      if target.name.start_with?('RNFB')
        target.build_configurations.each do |config|
          config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
    end`;
          lines.splice(postInstallEndIndex, 0, firebaseFix);
          await fs.writeFile(podfilePath, lines.join('\n'));
        }
      } else {
        // No post_install hook exists, add our complete one
        const lines = podfileContent.trim().split('\n');
        const lastLineIndex = lines.length - 1;

        if (lines[lastLineIndex].trim() === 'end') {
          lines.splice(lastLineIndex, 0, postInstallHook);
          const newPodfileContent = lines.join('\n');
          await fs.writeFile(podfilePath, newPodfileContent);
        }
      }

      return config;
    },
  ]);
};

module.exports = withUseModularHeaders;
