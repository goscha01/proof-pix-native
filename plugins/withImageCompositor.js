const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs').promises;
const path = require('path');

/**
 * This plugin copies the ImageCompositor native module files into the iOS project
 * and adds them to the Xcode project.
 */
const withImageCompositor = (config) => {
  // First, copy the files
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;

      // Source files in the modules/image-compositor directory
      const swiftSource = path.join(projectRoot, 'modules', 'image-compositor', 'ImageCompositor.swift');
      const objcSource = path.join(projectRoot, 'modules', 'image-compositor', 'ImageCompositor.m');

      // Destination in the iOS project directory
      const appName = config.modRequest.projectName || 'proofpixnative';
      const destDir = path.join(platformProjectRoot, appName);
      const swiftDest = path.join(destDir, 'ImageCompositor.swift');
      const objcDest = path.join(destDir, 'ImageCompositor.m');

      try {
        // Ensure destination directory exists
        await fs.mkdir(destDir, { recursive: true });

        // Copy Swift file
        const swiftContent = await fs.readFile(swiftSource, 'utf8');
        await fs.writeFile(swiftDest, swiftContent);
        console.log(`✅ Copied ImageCompositor.swift to ${swiftDest}`);

        // Copy Objective-C bridge file
        const objcContent = await fs.readFile(objcSource, 'utf8');
        await fs.writeFile(objcDest, objcContent);
        console.log(`✅ Copied ImageCompositor.m to ${objcDest}`);
      } catch (error) {
        console.error('❌ Error copying ImageCompositor files:', error);
      }

      return config;
    },
  ]);

  // Then add them to the Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const appName = config.modRequest.projectName || 'proofpixnative';

    // Add Swift file with correct path relative to iOS project
    const swiftPath = `${appName}/ImageCompositor.swift`;
    if (!xcodeProject.hasFile(swiftPath)) {
      xcodeProject.addSourceFile(
        swiftPath,
        {},
        xcodeProject.findPBXGroupKey({ name: appName })
      );
      console.log(`✅ Added ${swiftPath} to Xcode project`);
    }

    // Add Objective-C bridge file with correct path
    const objcPath = `${appName}/ImageCompositor.m`;
    if (!xcodeProject.hasFile(objcPath)) {
      xcodeProject.addSourceFile(
        objcPath,
        {},
        xcodeProject.findPBXGroupKey({ name: appName })
      );
      console.log(`✅ Added ${objcPath} to Xcode project`);
    }

    return config;
  });

  return config;
};

module.exports = withImageCompositor;
