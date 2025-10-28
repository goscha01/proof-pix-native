/**
 * Location Configuration
 * Maps location IDs to Google Drive settings from environment variables
 */

import Constants from 'expo-constants';

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
  // 
  const location = LOCATIONS.find(loc => loc.id === locationId);

  if (!location) {
    return getLocationConfig('tampa');
  }

  // Get environment variables from app config
  const config = Constants.expoConfig?.extra || {};
  // );
  
  let scriptUrl, folderId;
  
  switch (location.key) {
    case 'LOCATION_A':
      scriptUrl = config.locationAScriptUrl;
      folderId = config.locationAFolderId;
      break;
    case 'LOCATION_B':
      scriptUrl = config.locationBScriptUrl;
      folderId = config.locationBFolderId;
      break;
    case 'LOCATION_C':
      scriptUrl = config.locationCScriptUrl;
      folderId = config.locationCFolderId;
      break;
    case 'LOCATION_D':
      scriptUrl = config.locationDScriptUrl;
      folderId = config.locationDFolderId;
      break;
    default:
      return { scriptUrl: '', folderId: '' };
  }

  // 

  if (!scriptUrl || !folderId) {
    return { scriptUrl: '', folderId: '' };
  }

  // 
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
