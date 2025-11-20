# Feature Permissions System

This document describes the role-based feature access control system for ProofPix. This system is for **internal use only** (developers and App Store) to control which features are available for each tier.

## Overview

The feature permissions system allows you to:
- Define roles for each tier (starter, pro, business, enterprise, team)
- Assign features to each role
- Set limits for resources (projects, photos, team members, etc.)
- Check feature access throughout the app

## File Structure

- `src/constants/featurePermissions.js` - Feature definitions and tier roles
- `src/hooks/useFeaturePermissions.js` - React hook for easy access

## Usage

### Basic Feature Check

```javascript
import { useFeaturePermissions, FEATURES } from '../hooks/useFeaturePermissions';

function MyComponent() {
  const { canUse } = useFeaturePermissions();
  
  // Check if feature is available
  if (canUse(FEATURES.GOOGLE_DRIVE_SYNC)) {
    // Show Google Drive sync option
    return <GoogleDriveSyncButton />;
  }
  
  return null;
}
```

### Check Resource Limits

```javascript
import { useFeaturePermissions } from '../hooks/useFeaturePermissions';

function ProjectManager() {
  const { exceedsLimit, getLimit, isUnlimited } = useFeaturePermissions();
  const projects = useProjects(); // Your projects array
  
  // Check if user can create more projects
  const maxProjects = getLimit('maxProjects');
  const canCreateMore = !exceedsLimit('maxProjects', projects.length);
  
  if (!canCreateMore) {
    return <UpgradeMessage limit={maxProjects} />;
  }
  
  // Check if unlimited
  if (isUnlimited('maxProjects')) {
    return <UnlimitedProjectsView />;
  }
  
  return <ProjectsList />;
}
```

### Conditional Rendering

```javascript
import { useFeaturePermissions, FEATURES } from '../hooks/useFeaturePermissions';

function SettingsScreen() {
  const { canUse } = useFeaturePermissions();
  
  return (
    <View>
      <SettingItem label="Basic Settings" />
      
      {canUse(FEATURES.CUSTOM_WATERMARKS) && (
        <SettingItem label="Custom Watermarks" />
      )}
      
      {canUse(FEATURES.TEAM_COLLABORATION) && (
        <SettingItem label="Team Management" />
      )}
      
      {canUse(FEATURES.ANALYTICS) && (
        <SettingItem label="Analytics" />
      )}
    </View>
  );
}
```

### Direct Import (Outside Components)

```javascript
import { hasFeature, getLimit, FEATURES } from '../constants/featurePermissions';

// In a service or utility function
function canUploadToCloud(userPlan) {
  return hasFeature(FEATURES.GOOGLE_DRIVE_SYNC, userPlan) || 
         hasFeature(FEATURES.DROPBOX_SYNC, userPlan);
}

function getMaxTeamMembers(userPlan) {
  return getLimit('maxTeamMembers', userPlan);
}
```

## Available Features

All features are defined in `FEATURES` constant:

- `UNLIMITED_PHOTOS` - Unlimited photo storage
- `PHOTO_EXPORT` - Export photos
- `BULK_DELETE` - Bulk delete operations
- `GOOGLE_DRIVE_SYNC` - Google Drive integration
- `DROPBOX_SYNC` - Dropbox integration
- `MULTIPLE_CLOUD_ACCOUNTS` - Multiple cloud account connections
- `BACKGROUND_UPLOAD` - Background upload processing
- `TEAM_COLLABORATION` - Team collaboration features
- `TEAM_INVITES` - Invite team members
- `TEAM_MANAGEMENT` - Manage team settings
- `MULTIPLE_TEAMS` - Support for multiple teams
- `CUSTOM_WATERMARKS` - Custom watermark settings
- `CUSTOM_LABELS` - Custom label settings
- `ADVANCED_TEMPLATES` - Advanced photo templates
- `BRANDING` - Custom branding options
- `MULTIPLE_PROJECTS` - Multiple project support
- `UNLIMITED_PROJECTS` - Unlimited projects
- `PROJECT_SHARING` - Share projects
- `ANALYTICS` - Analytics dashboard
- `REPORTS` - Generate reports
- `EXPORT_REPORTS` - Export reports
- `API_ACCESS` - API access
- `WEBHOOKS` - Webhook support
- `CUSTOM_INTEGRATIONS` - Custom integrations
- `PRIORITY_SUPPORT` - Priority customer support

## Tier Definitions

### Starter
- Basic photo management
- Limited projects (3 max)
- Basic customization
- No cloud sync
- No team features

### Pro
- Unlimited photos
- Unlimited projects
- Google Drive sync
- Custom watermarks & labels
- Advanced templates
- Project sharing

### Business
- All Pro features
- Dropbox sync
- Team collaboration
- Team invites (up to 10 members)
- Analytics
- Custom branding

### Enterprise
- All Business features
- Multiple cloud accounts
- Unlimited team members
- Multiple teams
- API access
- Webhooks
- Custom integrations
- Priority support
- Reports & export

### Team
- Unlimited photos
- Multiple projects
- Team collaboration
- Basic customization
- No admin features

## Resource Limits

Each tier has limits defined in the `limits` object:

- `maxProjects` - Maximum number of projects (-1 = unlimited)
- `maxPhotosPerProject` - Maximum photos per project (-1 = unlimited)
- `maxTeamMembers` - Maximum team members (-1 = unlimited)
- `maxCloudAccounts` - Maximum cloud accounts (-1 = unlimited)

## Adding New Features

1. Add the feature constant to `FEATURES` in `featurePermissions.js`
2. Add the feature to the appropriate tier roles in `TIER_ROLES`
3. Use `canUse(FEATURES.NEW_FEATURE)` in your components

Example:

```javascript
// In featurePermissions.js
export const FEATURES = {
  // ... existing features
  NEW_FEATURE: 'new_feature',
};

// In TIER_ROLES
export const TIER_ROLES = {
  pro: {
    name: 'Pro',
    features: [
      // ... existing features
      FEATURES.NEW_FEATURE, // Add here
    ],
    // ...
  },
};
```

## Best Practices

1. **Always check permissions before showing features** - Don't show UI elements for features the user doesn't have access to
2. **Check limits before allowing actions** - Prevent users from exceeding their plan limits
3. **Show upgrade messages** - When a limit is reached, guide users to upgrade
4. **Use the hook in components** - Use `useFeaturePermissions()` hook in React components
5. **Use direct imports in services** - Use direct imports in non-React code (services, utilities)

## Example: Complete Feature Gate

```javascript
import { useFeaturePermissions, FEATURES } from '../hooks/useFeaturePermissions';
import { Alert } from 'react-native';

function CloudSyncButton() {
  const { canUse, userPlan } = useFeaturePermissions();
  
  const handleSync = () => {
    if (!canUse(FEATURES.GOOGLE_DRIVE_SYNC)) {
      Alert.alert(
        'Feature Not Available',
        `Google Drive sync is not available in your ${userPlan} plan. Please upgrade to Pro or higher.`
      );
      return;
    }
    
    // Proceed with sync
    startSync();
  };
  
  if (!canUse(FEATURES.GOOGLE_DRIVE_SYNC)) {
    return <UpgradeButton />;
  }
  
  return <SyncButton onPress={handleSync} />;
}
```

## Notes

- This system is for **internal use only** - not visible to end users
- Feature checks are client-side only
- Limits are enforced client-side (consider server-side validation for production)
- All tier definitions are in one place for easy management

