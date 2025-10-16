import React, { createContext, useState, useContext, useEffect } from 'react';
import { loadPhotosMetadata, savePhotosMetadata, deletePhotoFromDevice } from '../services/storage';
import { PHOTO_MODES } from '../constants/rooms';

const PhotoContext = createContext();

export const usePhotos = () => {
  const context = useContext(PhotoContext);
  if (!context) {
    throw new Error('usePhotos must be used within PhotoProvider');
  }
  return context;
};

export const PhotoProvider = ({ children }) => {
  const [photos, setPhotos] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('kitchen');
  const [loading, setLoading] = useState(true);

  // Load photos on mount
  useEffect(() => {
    loadPhotos();
  }, []);

  // Reassign photo names sequentially
  const reassignPhotoNames = (photoList) => {
    const rooms = {};

    // Group ONLY before photos by room and sort by timestamp
    photoList.forEach(photo => {
      if (photo.mode === PHOTO_MODES.BEFORE) {
        if (!rooms[photo.room]) {
          rooms[photo.room] = [];
        }
        rooms[photo.room].push(photo);
      }
    });

    // Sort each room's before photos by timestamp
    Object.keys(rooms).forEach(room => {
      rooms[room].sort((a, b) => a.timestamp - b.timestamp);
    });

    // Create a map of before photo ID to new name
    const nameMap = {};
    Object.keys(rooms).forEach(room => {
      rooms[room].forEach((photo, index) => {
        const roomName = photo.room.charAt(0).toUpperCase() + photo.room.slice(1);
        const sequentialName = `${roomName} ${index + 1}`;
        nameMap[photo.id] = sequentialName;
      });
    });

    // Build a reverse map from old name to before photo ID
    const nameToBeforeId = {};
    Object.keys(rooms).forEach(room => {
      rooms[room].forEach((photo) => {
        nameToBeforeId[photo.name] = photo.id;
      });
    });

    console.log('nameMap:', nameMap);
    console.log('nameToBeforeId:', nameToBeforeId);

    // Reassign names: before photos get sequential names, after/combined photos use their before photo's name
    const updatedPhotos = photoList.map(photo => {
      if (photo.mode === PHOTO_MODES.BEFORE) {
        return {
          ...photo,
          name: nameMap[photo.id]
        };
      } else if (photo.mode === PHOTO_MODES.AFTER && photo.beforePhotoId) {
        // After photo uses the name of its paired before photo
        const newName = nameMap[photo.beforePhotoId] || photo.name;
        console.log('After photo old name:', photo.name, '-> new name:', newName);
        return {
          ...photo,
          name: newName
        };
      } else if (photo.mode === PHOTO_MODES.COMBINED) {
        // Combined photo should match the before photo's new name
        // Find the before photo ID by the combined photo's current name
        const beforeId = nameToBeforeId[photo.name];
        const newName = nameMap[beforeId] || photo.name;
        console.log('Combined photo old name:', photo.name, 'beforeId:', beforeId, '-> new name:', newName);
        return {
          ...photo,
          name: newName
        };
      }
      return photo;
    });

    return updatedPhotos;
  };

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const metadata = await loadPhotosMetadata();

      // Filter out any photos with ph:// URIs (old data)
      const validPhotos = metadata.filter(photo => {
        if (photo.uri && photo.uri.startsWith('ph://')) {
          console.warn('⚠️ Skipping photo with invalid URI:', photo.uri);
          return false;
        }
        return true;
      });

      // If we filtered out any photos, save the cleaned data
      if (validPhotos.length !== metadata.length) {
        console.log(`🧹 Cleaned ${metadata.length - validPhotos.length} photos with invalid URIs`);
        await savePhotosMetadata(validPhotos);
      }

      // Reassign photo names sequentially
      const renamedPhotos = reassignPhotoNames(validPhotos);

      // Save if names changed
      const namesChanged = renamedPhotos.some((photo, idx) => photo.name !== validPhotos[idx]?.name);
      if (namesChanged) {
        await savePhotosMetadata(renamedPhotos);
      }

      setPhotos(renamedPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePhotos = async (newPhotos) => {
    try {
      // Reassign names sequentially before saving
      const renamedPhotos = reassignPhotoNames(newPhotos);
      setPhotos(renamedPhotos);
      await savePhotosMetadata(renamedPhotos);
    } catch (error) {
      console.error('Error saving photos:', error);
    }
  };

  const addPhoto = async (photo) => {
    const newPhotos = [...photos, photo];
    await savePhotos(newPhotos);
  };

  const updatePhoto = async (photoId, updates) => {
    const newPhotos = photos.map(p =>
      p.id === photoId ? { ...p, ...updates } : p
    );
    await savePhotos(newPhotos);
  };

  const deletePhoto = async (photoId) => {
    try {
      const target = photos.find(p => p.id === photoId);
      if (target) {
        await deletePhotoFromDevice(target);
      }
    } finally {
      const newPhotos = photos.filter(p => p.id !== photoId);
      await savePhotos(newPhotos);
    }
  };

  const deleteAllPhotos = async () => {
    await savePhotos([]);
  };

  const getPhotosByRoom = (room) => {
    return photos.filter(p => p.room === room);
  };

  const getBeforePhotos = (room) => {
    return photos.filter(p => p.room === room && p.mode === PHOTO_MODES.BEFORE);
  };

  const getAfterPhotos = (room) => {
    return photos.filter(p => p.room === room && p.mode === PHOTO_MODES.AFTER);
  };

  const getCombinedPhotos = (room) => {
    return photos.filter(p => p.room === room && p.mode === PHOTO_MODES.COMBINED);
  };

  const getUnpairedBeforePhotos = (room) => {
    const beforePhotos = getBeforePhotos(room);
    const afterPhotos = getAfterPhotos(room);

    return beforePhotos.filter(beforePhoto => {
      return !afterPhotos.some(afterPhoto => afterPhoto.beforePhotoId === beforePhoto.id);
    });
  };

  const value = {
    photos,
    currentRoom,
    setCurrentRoom,
    loading,
    addPhoto,
    updatePhoto,
    deletePhoto,
    deleteAllPhotos,
    getPhotosByRoom,
    getBeforePhotos,
    getAfterPhotos,
    getCombinedPhotos,
    getUnpairedBeforePhotos,
    refreshPhotos: loadPhotos
  };

  return <PhotoContext.Provider value={value}>{children}</PhotoContext.Provider>;
};
