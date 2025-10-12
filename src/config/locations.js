/**
 * Location Configuration
 * Maps location IDs to Google Drive settings from environment variables
 */

// Location definitions matching the original JS app
export const LOCATIONS = [
  { id: 'tampa', name: 'Tampa', key: 'LOCATION_A' },
  { id: 'st-petersburg', name: 'St. Petersburg', key: 'LOCATION_B' },
  { id: 'jacksonville', name: 'Jacksonville', key: 'LOCATION_C' },
  { id: 'miami', name: 'Miami', key: 'LOCATION_D' }
];

/**
 * Get Google Drive configuration for a specific location
 * @param {string} locationId - Location ID (e.g., 'tampa', 'st-petersburg')
 * @returns {Object} - { scriptUrl: string, folderId: string }
 */
export function getLocationConfig(locationId) {
  const location = LOCATIONS.find(loc => loc.id === locationId);

  if (!location) {
    console.warn(`Unknown location: ${locationId}. Defaulting to Tampa.`);
    return getLocationConfig('tampa');
  }

  const scriptUrl = process.env[`EXPO_PUBLIC_${location.key}_SCRIPT_URL`];
  const folderId = process.env[`EXPO_PUBLIC_${location.key}_FOLDER_ID`];

  if (!scriptUrl || !folderId) {
    console.error(`Missing environment variables for ${location.name}`);
    return { scriptUrl: '', folderId: '' };
  }

  return { scriptUrl, folderId };
}

/**
 * Get location name from location ID
 * @param {string} locationId - Location ID
 * @returns {string} - Location name
 */
export function getLocationName(locationId) {
  const location = LOCATIONS.find(loc => loc.id === locationId);
  return location ? location.name : locationId;
}

/**
 * Get location ID from location name
 * @param {string} locationName - Location name
 * @returns {string} - Location ID
 */
export function getLocationId(locationName) {
  const location = LOCATIONS.find(
    loc => loc.name.toLowerCase() === locationName.toLowerCase()
  );
  return location ? location.id : 'tampa';
}
