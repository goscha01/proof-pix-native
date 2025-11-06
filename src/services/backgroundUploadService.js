import { uploadPhotoBatch, uploadPhotoAsTeamMember } from './uploadService';
import { markPhotosAsUploaded } from './uploadTracker';

class BackgroundUploadService {
  constructor() {
    this.activeUploads = new Map();
    this.listeners = new Set();
    this.uploadQueue = [];
    this.isProcessing = false;
    this.completedUploads = new Map();
  }

  // Subscribe to upload progress updates
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners of upload progress
  notifyListeners() {
    this.listeners.forEach(listener => {
      listener({
        activeUploads: Array.from(this.activeUploads.values()),
        queueLength: this.uploadQueue.length,
        isProcessing: this.isProcessing,
        completedUploads: this.getCompletedUploads()
      });
    });
  }

  // Add upload to queue
  queueUpload(uploadData) {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const upload = {
      id: uploadId,
      ...uploadData,
      status: 'queued',
      progress: { current: 0, total: 0 },
      startTime: null,
      endTime: null,
      error: null
    };

    this.uploadQueue.push(upload);
    this.notifyListeners();
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return uploadId;
  }

  // Process upload queue
  async processQueue() {
    if (this.isProcessing || this.uploadQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.notifyListeners();

    while (this.uploadQueue.length > 0) {
      const upload = this.uploadQueue.shift();
      if (upload.uploadType === 'team') {
        await this.processTeamUpload(upload);
      } else {
        await this.processUpload(upload);
      }
    }

    this.isProcessing = false;
    this.notifyListeners();
  }

  // Process individual upload
  async processUpload(upload) {
    try {
      // Move to active uploads
      upload.status = 'uploading';
      upload.startTime = Date.now();
      // Initialize progress with correct total count
      upload.progress = { current: 0, total: upload.items.length };
      this.activeUploads.set(upload.id, upload);
      this.notifyListeners();

      // Prepare upload options
      const uploadOptions = {
        scriptUrl: upload.config?.scriptUrl,
        folderId: upload.config?.folderId,
        albumName: upload.albumName,
        location: upload.location,
        cleanerName: upload.userName,
        batchSize: upload.items.length, // Upload all photos in parallel
        flat: upload.flat,
        useDirectDrive: upload.config?.useDirectDrive || upload.useDirectDrive || false, // Pass flag for proxy server upload
        sessionId: upload.config?.sessionId || upload.sessionId || null, // Pass proxy session ID
        onProgress: (current, total) => {
          upload.progress = { current, total };
          this.notifyListeners();
        }
      };

      // Perform upload
      const result = await uploadPhotoBatch(upload.items, uploadOptions);
      
      // Mark photos as uploaded in tracker (only successful ones)
      if (result.successful && result.successful.length > 0) {
        const successfulPhotos = result.successful.map(item => item.photo);
        await markPhotosAsUploaded(successfulPhotos, upload.albumName);
      }
      
      // Mark as completed
      upload.status = 'completed';
      upload.endTime = Date.now();
      upload.result = result;
      
      // Store in completed uploads for notification
      this.completedUploads.set(upload.id, upload);
      
      // Remove from active uploads
      this.activeUploads.delete(upload.id);
      this.notifyListeners();

    } catch (error) {
      // Mark as failed
      upload.status = 'failed';
      upload.endTime = Date.now();
      upload.error = error.message || 'Upload failed';
      
      // Remove from active uploads
      this.activeUploads.delete(upload.id);
      this.notifyListeners();
    }
  }

  async processTeamUpload(upload) {
    try {
      upload.status = 'uploading';
      upload.startTime = Date.now();
      upload.progress = { current: 0, total: upload.items.length };
      this.activeUploads.set(upload.id, upload);
      this.notifyListeners();

      const { items, teamInfo } = upload;
      const successful = [];
      const failed = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          // Team member uploads don't use albums, so we pass a generic identifier
          const filename = `team-upload-${item.name}-${Date.now()}.jpg`;
          const result = await uploadPhotoAsTeamMember({
            imageDataUrl: item.uri,
            filename: filename,
            sessionId: teamInfo.sessionId,
            token: teamInfo.token,
          });

          successful.push({ photo: item, result });
        } catch (error) {
          failed.push({ photo: item, error });
        }
        upload.progress = { current: i + 1, total: items.length };
        this.notifyListeners();
      }

      // In team mode, we don't use the same persistent upload tracking
      // because there's no "album" concept to check against for duplicates.
      
      upload.status = 'completed';
      upload.endTime = Date.now();
      upload.result = { successful, failed };
      this.completedUploads.set(upload.id, upload);
      this.activeUploads.delete(upload.id);
      this.notifyListeners();

    } catch (error) {
      upload.status = 'failed';
      upload.endTime = Date.now();
      upload.error = error.message || 'Team upload failed';
      this.activeUploads.delete(upload.id);
      this.notifyListeners();
    }
  }

  // Cancel specific upload
  cancelUpload(uploadId) {
    // Remove from queue
    this.uploadQueue = this.uploadQueue.filter(upload => upload.id !== uploadId);
    
    // Remove from active uploads
    if (this.activeUploads.has(uploadId)) {
      const upload = this.activeUploads.get(uploadId);
      upload.status = 'cancelled';
      upload.endTime = Date.now();
      this.activeUploads.delete(uploadId);
    }
    
    this.notifyListeners();
  }

  // Cancel all uploads
  cancelAllUploads() {
    this.uploadQueue = [];
    this.activeUploads.clear();
    this.isProcessing = false;
    this.notifyListeners();
  }

  // Get upload status
  getStatus() {
    return {
      activeUploads: Array.from(this.activeUploads.values()),
      queueLength: this.uploadQueue.length,
      isProcessing: this.isProcessing
    };
  }

  // Get completed uploads
  getCompletedUploads() {
    return Array.from(this.completedUploads.values());
  }

  // Clear completed uploads
  clearCompletedUploads() {
    this.completedUploads.clear();
    this.notifyListeners();
  }
}

// Create singleton instance
const backgroundUploadService = new BackgroundUploadService();

export default backgroundUploadService;
