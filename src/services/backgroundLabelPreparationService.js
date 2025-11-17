/**
 * Global service for background label preparation
 * This service manages label preparation tasks that need to run independently of screen navigation
 */

class BackgroundLabelPreparationService {
  constructor() {
    this.pendingPreparations = new Map(); // Map of photoId -> preparation data
    this.listeners = new Set(); // Listeners for preparation updates
  }

  /**
   * Subscribe to preparation updates
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Get current state
   */
  getState() {
    return {
      pendingPreparations: Array.from(this.pendingPreparations.values()),
    };
  }

  /**
   * Queue a photo for background label preparation
   * @param {Object} preparationData - Photo and settings data for preparation
   */
  queuePreparation(preparationData) {
    const { photo } = preparationData;
    const key = `${photo.id}_${photo.mode || 'unknown'}`;
    
    console.log(`[BG_LABEL_PREP] Queueing preparation for ${key}`);
    this.pendingPreparations.set(key, {
      ...preparationData,
      key,
      queuedAt: Date.now(),
    });
    
    this.notifyListeners();
    return key;
  }

  /**
   * Remove a preparation from the queue (when completed or cancelled)
   */
  removePreparation(key) {
    if (this.pendingPreparations.has(key)) {
      console.log(`[BG_LABEL_PREP] Removing preparation ${key}`);
      this.pendingPreparations.delete(key);
      this.notifyListeners();
    }
  }

  /**
   * Clear all pending preparations
   */
  clearAll() {
    this.pendingPreparations.clear();
    this.notifyListeners();
  }
}

// Export singleton instance
const backgroundLabelPreparationService = new BackgroundLabelPreparationService();
export default backgroundLabelPreparationService;

