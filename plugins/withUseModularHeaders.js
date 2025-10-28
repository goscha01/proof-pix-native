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
  end
end
`;

const withUseModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let podfileContent = await fs.readFile(podfilePath, 'utf8');

      // Check if the hook is already present to avoid adding it multiple times
      if (podfileContent.includes('post_install do |installer|')) {
        return config;
      }
      
      const lines = podfileContent.trim().split('\n');
      const lastLineIndex = lines.length - 1;

      // Make sure the last line is 'end' before modifying to avoid corrupting the Podfile
      if (lines[lastLineIndex].trim() === 'end') {
        lines.splice(lastLineIndex, 0, postInstallHook);
        const newPodfileContent = lines.join('\n');
        await fs.writeFile(podfilePath, newPodfileContent);
      }
      
      return config;
    },
  ]);
};

module.exports = withUseModularHeaders;
