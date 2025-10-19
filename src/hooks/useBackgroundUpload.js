import { useState, useEffect } from 'react';
import backgroundUploadService from '../services/backgroundUploadService';

export const useBackgroundUpload = () => {
  const [uploadStatus, setUploadStatus] = useState({
    activeUploads: [],
    queueLength: 0,
    isProcessing: false,
    completedUploads: []
  });

  useEffect(() => {
    // Subscribe to upload service updates
    const unsubscribe = backgroundUploadService.subscribe((status) => {
      setUploadStatus(status);
    });

    // Get initial status
    setUploadStatus(backgroundUploadService.getStatus());

    return unsubscribe;
  }, []);

  const startBackgroundUpload = (uploadData) => {
    return backgroundUploadService.queueUpload(uploadData);
  };

  const cancelUpload = (uploadId) => {
    backgroundUploadService.cancelUpload(uploadId);
  };

  const cancelAllUploads = () => {
    backgroundUploadService.cancelAllUploads();
  };

  const clearCompletedUploads = () => {
    backgroundUploadService.clearCompletedUploads();
  };

  return {
    uploadStatus,
    startBackgroundUpload,
    cancelUpload,
    cancelAllUploads,
    clearCompletedUploads
  };
};
