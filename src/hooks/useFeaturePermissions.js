import { useSettings } from '../context/SettingsContext';
import { 
  hasFeature, 
  getLimit, 
  isUnlimited, 
  exceedsLimit,
  getTierFeatures,
  getTierRole,
  FEATURES 
} from '../constants/featurePermissions';

/**
 * Hook to check feature permissions and limits based on user's tier
 * 
 * Usage:
 * const { canUse, getLimit, isUnlimited, exceedsLimit } = useFeaturePermissions();
 * 
 * if (canUse(FEATURES.GOOGLE_DRIVE_SYNC)) {
 *   // Show Google Drive sync option
 * }
 * 
 * if (exceedsLimit('maxProjects', projects.length)) {
 *   // Show upgrade message
 * }
 */
export const useFeaturePermissions = () => {
  const { userPlan } = useSettings();

  /**
   * Check if current tier has access to a feature
   * @param {string} feature - Feature constant from FEATURES
   * @returns {boolean}
   */
  const canUse = (feature) => {
    return hasFeature(feature, userPlan);
  };

  /**
   * Get the limit for a resource type
   * @param {string} limitType - Limit type (maxProjects, maxPhotosPerProject, etc.)
   * @returns {number} - Limit value (-1 means unlimited)
   */
  const getResourceLimit = (limitType) => {
    return getLimit(limitType, userPlan);
  };

  /**
   * Check if a resource type is unlimited
   * @param {string} limitType - Limit type
   * @returns {boolean}
   */
  const isResourceUnlimited = (limitType) => {
    return isUnlimited(limitType, userPlan);
  };

  /**
   * Check if current usage exceeds the limit
   * @param {string} limitType - Limit type
   * @param {number} currentUsage - Current usage count
   * @returns {boolean}
   */
  const resourceExceedsLimit = (limitType, currentUsage) => {
    return exceedsLimit(limitType, userPlan, currentUsage);
  };

  /**
   * Get all features available for current tier
   * @returns {Array<string>}
   */
  const getAvailableFeatures = () => {
    return getTierFeatures(userPlan);
  };

  /**
   * Get current tier role information
   * @returns {Object|null}
   */
  const getCurrentTierRole = () => {
    return getTierRole(userPlan);
  };

  return {
    // Current tier
    userPlan,
    
    // Feature checks
    canUse,
    hasFeature: canUse, // Alias for convenience
    
    // Limit checks
    getLimit: getResourceLimit,
    isUnlimited: isResourceUnlimited,
    exceedsLimit: resourceExceedsLimit,
    
    // Information
    getAvailableFeatures,
    getTierRole: getCurrentTierRole,
    
    // Export FEATURES for convenience
    FEATURES,
  };
};

export default useFeaturePermissions;

