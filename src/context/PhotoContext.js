import React, { createContext, useState, useContext, useEffect } from 'react';
import { loadPhotosMetadata, savePhotosMetadata, deletePhotoFromDevice, loadProjects, saveProjects, createProject as storageCreateProject, deleteProjectEntry, loadActiveProjectId, saveActiveProjectId } from '../services/storage';
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
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Load photos on mount
  useEffect(() => {
    (async () => {
      await loadPhotos();
      await loadProjectsList();
      const savedActive = await loadActiveProjectId();
      if (savedActive) setActiveProjectId(savedActive);
    })();
  }, []);

  // Reassign photo names sequentially per project and room
  const reassignPhotoNames = (photoList) => {
    const groups = {};

    // Group ONLY before photos by projectId + room and sort by timestamp
    photoList.forEach(photo => {
      if (photo.mode === PHOTO_MODES.BEFORE) {
        const key = `${photo.projectId || 'none'}::${photo.room}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(photo);
      }
    });

    // Sort each group's before photos by timestamp
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.timestamp - b.timestamp);
    });

    // Create a map of before photo ID to new name
    const nameMap = {};
    Object.keys(groups).forEach(key => {
      groups[key].forEach((photo, index) => {
        const roomName = photo.room.charAt(0).toUpperCase() + photo.room.slice(1);
        const sequentialName = `${roomName} ${index + 1}`;
        nameMap[photo.id] = sequentialName;
      });
    });

    // Build a reverse map from old name to before photo ID (for combined)
    const nameToBeforeId = {};
    Object.values(groups).forEach(arr => {
      arr.forEach((photo) => {
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

  const loadProjectsList = async () => {
    try {
      const list = await loadProjects();
      setProjects(list);
    } catch (e) {
      console.error('Error loading projects list:', e);
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
    const newPhotos = [...photos, { ...photo, projectId: photo.projectId ?? activeProjectId ?? null }];
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

  // ===== Project operations =====
  const createProject = async (name) => {
    const project = await storageCreateProject(name);
    setProjects(prev => [project, ...prev]);
    // Auto-assign only unassigned photos to the new project
    const unassigned = photos.filter(p => !p.projectId);
    if (unassigned.length > 0) {
      const updated = photos.map(p => (!p.projectId ? { ...p, projectId: project.id } : p));
      await savePhotos(updated);
    }
    return project;
  };

  const assignPhotosToProject = async (projectId) => {
    // Assign only unassigned photos to avoid moving between projects implicitly
    const updated = photos.map(p => (!p.projectId ? { ...p, projectId } : p));
    await savePhotos(updated);
  };

  const getPhotosByProject = (projectId) => {
    return photos.filter(p => p.projectId === projectId);
  };

  const deleteProject = async (projectId, options = {}) => {
    const { deleteFromStorage = true } = options;
    const related = photos.filter(p => p.projectId === projectId);
    console.log('🗂️ deleteProject start', { projectId, deleteFromStorage, relatedCount: related.length });
    // Delete all photos for this project from device and metadata
    if (deleteFromStorage) {
      for (const p of related) {
        try {
          console.log('🗑️ Deleting device file for photo', { id: p.id, name: p.name, uri: p.uri });
          await deletePhotoFromDevice(p);
        } catch (e) {
          console.warn('⚠️ deletePhotoFromDevice failed', { id: p.id, uri: p.uri, error: e?.message });
        }
      }
    } else {
      console.log('ℹ️ Skipping device file deletion for project', projectId);
    }
    const remaining = photos.filter(p => p.projectId !== projectId);
    await savePhotos(remaining);
    console.log('🧹 Removed project photos from metadata', { projectId, remainingCount: remaining.length });
    await deleteProjectEntry(projectId);
    console.log('✅ Project entry removed', { projectId });
    await loadProjectsList();
    console.log('🔄 Projects list reloaded');
  };

  const getPhotosByRoom = (room) => {
    return photos.filter(p => p.room === room && (activeProjectId ? p.projectId === activeProjectId : true));
  };

  const getBeforePhotos = (room) => {
    return photos.filter(p => p.room === room && p.mode === PHOTO_MODES.BEFORE && (activeProjectId ? p.projectId === activeProjectId : true));
  };

  const getAfterPhotos = (room) => {
    return photos.filter(p => p.room === room && p.mode === PHOTO_MODES.AFTER && (activeProjectId ? p.projectId === activeProjectId : true));
  };

  const getCombinedPhotos = (room) => {
    return photos.filter(p => p.room === room && p.mode === PHOTO_MODES.COMBINED && (activeProjectId ? p.projectId === activeProjectId : true));
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
    projects,
    activeProjectId,
    currentRoom,
    setCurrentRoom,
    loading,
    addPhoto,
    updatePhoto,
    deletePhoto,
    deleteAllPhotos,
    setActiveProject: async (projectId) => {
      setActiveProjectId(projectId);
      await saveActiveProjectId(projectId);
    },
    createProject,
    assignPhotosToProject,
    getPhotosByProject,
    deleteProject,
    getPhotosByRoom,
    getBeforePhotos,
    getAfterPhotos,
    getCombinedPhotos,
    getUnpairedBeforePhotos,
    refreshPhotos: loadPhotos
  };

  return <PhotoContext.Provider value={value}>{children}</PhotoContext.Provider>;
};
