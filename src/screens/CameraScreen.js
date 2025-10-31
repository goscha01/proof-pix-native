import React, { useState, useRef, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Alert,
  Dimensions,
  ScrollView,
  Platform,
  PanResponder,
  Animated,
  PixelRatio,
  StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { captureRef } from 'react-native-view-shot';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { savePhotoToDevice } from '../services/storage';
import { COLORS, PHOTO_MODES, TEMPLATE_TYPES, ROOMS } from '../constants/rooms';
import analyticsService from '../services/analyticsService';
import PhotoLabel from '../components/PhotoLabel';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect } from '@react-navigation/native';

const initialDimensions = Dimensions.get('window');
const initialWidth = initialDimensions.width;
const initialHeight = initialDimensions.height;
const initialOrientation = initialWidth > initialHeight ? 'landscape' : 'portrait';

// Get initial specific orientation synchronously
const getInitialSpecificOrientation = () => {
  if (initialOrientation === 'portrait') {
    return 1; // PORTRAIT
  } else {
    // For landscape, default to LANDSCAPE_LEFT (3) - will be corrected immediately by async check
    return 3;
  }
};

export default function CameraScreen({ route, navigation }) {
  const { mode, beforePhoto, afterPhoto: existingAfterPhoto, combinedPhoto: existingCombinedPhoto, room: initialRoom } = route.params || {};
  const [room, setRoom] = useState(initialRoom);
  const [facing, setFacing] = useState('back');
  const [enableTorch, setEnableTorch] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [aspectRatio, setAspectRatio] = useState('4:3'); // '4:3' or '2:3'
  const [selectedBeforePhoto, setSelectedBeforePhoto] = useState(beforePhoto);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showEnlargedGallery, setShowEnlargedGallery] = useState(false);
  const [enlargedGalleryIndex, setEnlargedGalleryIndex] = useState(0);
  const [enlargedGalleryPhoto, setEnlargedGalleryPhoto] = useState(null);
  const [cameraViewMode, setCameraViewMode] = useState('portrait'); // 'portrait' or 'landscape'
  const [deviceOrientation, setDeviceOrientation] = useState(initialOrientation);
  const [specificOrientation, setSpecificOrientation] = useState(getInitialSpecificOrientation()); // 1=PORTRAIT, 3=LANDSCAPE_LEFT, 4=LANDSCAPE_RIGHT
  const [isGalleryAnimating, setIsGalleryAnimating] = useState(false);
  const [tempPhotoUri, setTempPhotoUri] = useState(null);
  const [tempPhotoLabel, setTempPhotoLabel] = useState(null);
  const [tempPhotoDimensions, setTempPhotoDimensions] = useState({ width: 1080, height: 1920 });
  const [showRoomIndicator, setShowRoomIndicator] = useState(false);
  const longPressGalleryTimer = useRef(null);
  const roomIndicatorTimer = useRef(null);
  const enlargedGalleryScrollRef = useRef(null);
  const tapStartTime = useRef(null);
  const [dimensions, setDimensions] = useState({ width: initialWidth, height: initialHeight });
  const lastTap = useRef(null);
  const longPressTimer = useRef(null);
  const cameraRef = useRef(null);
  const carouselScrollRef = useRef(null);
  const fullScreenScrollRef = useRef(null);
  const galleryScrollRef = useRef(null);
  const carouselTranslateY = useRef(new Animated.Value(0)).current;
  const enlargedGalleryTranslateY = useRef(new Animated.Value(0)).current;
  const cameraScale = useRef(new Animated.Value(1)).current;
  const cameraTranslateY = useRef(new Animated.Value(0)).current;
  const galleryOpacity = useRef(new Animated.Value(0)).current;
  const currentRoomRef = useRef(room);
  const dimensionsRef = useRef(dimensions);
  const showCarouselRef = useRef(showCarousel);
  const showGalleryRef = useRef(showGallery);
  const showEnlargedGalleryRef = useRef(showEnlargedGallery);
  const enlargedGalleryPhotoRef = useRef(enlargedGalleryPhoto);
  const isGalleryAnimatingRef = useRef(false);
  const { addPhoto, getBeforePhotos, getUnpairedBeforePhotos, deletePhoto, setCurrentRoom, activeProjectId } = usePhotos();
  const { showLabels, getRooms } = useSettings();
  
  // Get rooms from settings (custom or default)
  const rooms = getRooms();
  const labelViewRef = useRef(null);
  // Hidden vertical side-by-side base renderer
  const sideBaseRef = useRef(null);
  const [sideBasePair, setSideBasePair] = useState(null); // { beforeUri, afterUri }
  const [sideBaseDims, setSideBaseDims] = useState(null); // { width, height, leftW, rightW }
  const [sideLoadedA, setSideLoadedA] = useState(false);
  const [sideLoadedB, setSideLoadedB] = useState(false);
  const [isTakingPicture, setIsTakingPicture] = useState(false);
  const [showFullScreenPhoto, setShowFullScreenPhoto] = useState(null);
  const [layout, setLayout] = useState(null);

  // Helper function to get the active before photo based on current room and mode
  const getActiveBeforePhoto = () => {
    if (mode === 'after') {
      // After mode: show selectedBeforePhoto if set, otherwise beforePhoto if it matches current room
      return selectedBeforePhoto || (beforePhoto?.room === room ? beforePhoto : null);
    } else {
      // Before mode: show selectedBeforePhoto only if it matches current room
      return selectedBeforePhoto?.room === room ? selectedBeforePhoto : null;
    }
  };

  // Update ref when room changes AND sync with global room state
  useEffect(() => {
    currentRoomRef.current = room;
    // Update global room state so HomeScreen shows the same room when camera closes
    setCurrentRoom(room);
  }, [room, setCurrentRoom]);

  // Cleanup: Turn off flashlight when component unmounts
  useEffect(() => {
    return () => {
      if (enableTorch) {
        setEnableTorch(false);
      }
    };
  }, []);

  // Update dimensions ref when dimensions change
  useEffect(() => {
    dimensionsRef.current = dimensions;
  }, [dimensions]);

  // Update showCarousel ref when showCarousel changes
  useEffect(() => {
    showCarouselRef.current = showCarousel;
  }, [showCarousel]);

  // Update showGallery ref when showGallery changes
  useEffect(() => {
    showGalleryRef.current = showGallery;
  }, [showGallery]);

  // Update showEnlargedGallery ref when it changes
  useEffect(() => {
    showEnlargedGalleryRef.current = showEnlargedGallery;
  }, [showEnlargedGallery]);

  // Update enlargedGalleryPhoto ref when it changes
  useEffect(() => {
    enlargedGalleryPhotoRef.current = enlargedGalleryPhoto;
  }, [enlargedGalleryPhoto]);

  // Scroll gallery to correct position when opening
  useEffect(() => {
    if (showGallery && galleryScrollRef.current) {
      setTimeout(() => {
        if (!galleryScrollRef.current) return;
        
        if (mode === 'after' && selectedBeforePhoto) {
          // In after mode, scroll to selected photo
          const photos = getUnpairedBeforePhotos(room);
          const index = photos.findIndex(p => p.id === selectedBeforePhoto.id);
          if (index !== -1) {
            galleryScrollRef.current.scrollTo({ x: index * 112, animated: false });
          }
        } else if (mode === 'before') {
          // In before mode, scroll to the LAST photo (newest, on the right)
          const photos = getBeforePhotos(room);
          if (photos.length > 0) {
            const lastIndex = photos.length - 1;
            const scrollX = lastIndex * 112;
            galleryScrollRef.current.scrollTo({ x: scrollX, animated: false });
          }
        }
      }, 50);
    }
  }, [showGallery, mode, room, selectedBeforePhoto]);

  // Scroll enlarged gallery to correct position when opening
  useEffect(() => {
    if (showEnlargedGallery && enlargedGalleryScrollRef.current) {
      setTimeout(() => {
        if (enlargedGalleryScrollRef.current) {
          // Scroll to the tapped photo index
          const scrollX = enlargedGalleryIndex * dimensions.width;
          enlargedGalleryScrollRef.current.scrollTo({ 
            x: scrollX, 
            animated: false 
          });
        }
      }, 50);
    }
  }, [showEnlargedGallery, enlargedGalleryIndex]);


  // Handle double tap
  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (lastTap.current && (now - lastTap.current) < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const photos = mode === 'after' ? getUnpairedBeforePhotos(room) : getBeforePhotos(room);
      const currentPhoto = mode === 'after' ? getActiveBeforePhoto() : getBeforePhotos(room)[getBeforePhotos(room).length - 1];
      const index = photos.findIndex(p => p.id === currentPhoto?.id);
      
      // Set index first, then show carousel
      setCarouselIndex(index >= 0 ? index : 0);
      
      // Use setTimeout to ensure index is set before carousel opens
      setTimeout(() => {
        carouselTranslateY.setValue(0);
      setShowCarousel(true);
      }, 10);
      
      lastTap.current = null;
    } else {
      lastTap.current = now;
    }
  };

  // Handle long press with delay
  const handleThumbnailPressIn = () => {
    // Clear any existing timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    // Set a timer for long press (500ms delay)
    longPressTimer.current = setTimeout(() => {
      // Set the index to current photo
      const photos = mode === 'after' ? getUnpairedBeforePhotos(room) : getBeforePhotos(room);
      const currentPhoto = mode === 'after' ? getActiveBeforePhoto() : getBeforePhotos(room)[getBeforePhotos(room).length - 1];
      const index = photos.findIndex(p => p.id === currentPhoto?.id);
      setFullScreenIndex(index >= 0 ? index : 0);
      setIsFullScreen(true);
    }, 500);
  };

  const handleThumbnailPressOut = () => {
    // Clear the timer if user releases before long press is triggered
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Hide full screen
    setIsFullScreen(false);
  };

  // PanResponder for swipe-to-dismiss carousel (swipe DOWN)
  const carouselPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate for vertical swipes (more vertical than horizontal)
        const { dx, dy } = gestureState;
        const isVertical = Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 20;
        if (isVertical) {
        }
        return isVertical;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Capture vertical gestures, let horizontal pass through to ScrollView
        const { dx, dy } = gestureState;
        return Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 20;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow downward swipes (positive dy)
        if (gestureState.dy > 0) {
          carouselTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const threshold = 100; // Swipe down at least 100px to dismiss
        if (gestureState.dy > threshold) {
          // Dismiss carousel with animation - slide down
          Animated.timing(carouselTranslateY, {
            toValue: dimensionsRef.current.height,
            duration: 300,
            useNativeDriver: true
          }).start(() => {
            setShowCarousel(false);
            carouselTranslateY.setValue(0);
          });
        } else {
          // Spring back to original position
          Animated.spring(carouselTranslateY, {
            toValue: 0,
            useNativeDriver: true
          }).start();
        }
      },
      onPanResponderTerminationRequest: () => false
    })
  ).current;

  // PanResponder for closing camera (vertical swipe down)
  const cameraClosePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate for vertical downward swipes (more vertical than horizontal)
        const { dx, dy } = gestureState;
        return Math.abs(dy) > Math.abs(dx) && dy > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Don't show movement - just detect threshold
      },
      onPanResponderRelease: (evt, gestureState) => {
        const threshold = 100; // Swipe down at least 100px to close
        if (gestureState.dy > threshold) {
          // Close camera immediately - native animation handles it
          navigation.goBack();
        }
      }
    })
  ).current;

  // PanResponder for room switching (horizontal swipes)
  const roomSwitchPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate for horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 30;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const swipeThreshold = 50;
        const currentIndex = rooms.findIndex(r => r.id === currentRoomRef.current);
        let newRoomIndex;
        
        if (gestureState.dx > swipeThreshold) {
          // Swipe right - go to previous room (circular)
          newRoomIndex = currentIndex > 0 ? currentIndex - 1 : rooms.length - 1;
        } else if (gestureState.dx < -swipeThreshold) {
          // Swipe left - go to next room (circular)
          newRoomIndex = currentIndex < rooms.length - 1 ? currentIndex + 1 : 0;
        } else {
          return; // Not enough swipe distance
        }

        const newRoom = rooms[newRoomIndex].id;
        setRoom(newRoom);
        
        // Update thumbnail based on mode
        if (mode === 'after') {
          // For after mode, try to get first unpaired before photo
          const allBeforePhotos = getBeforePhotos(newRoom);
          if (allBeforePhotos.length > 0) {
            // Set to first before photo in the room
            setSelectedBeforePhoto(allBeforePhotos[0]);
          } else {
            // No before photos in this room
            setSelectedBeforePhoto(null);
            Alert.alert(
              'No Before Photos',
              `There are no before photos in ${rooms[newRoomIndex].name}. Please take a before photo first.`,
              [{ text: 'OK' }]
            );
          }
        } else {
          // For before mode, clear the selected photo (will show empty thumbnail)
          setSelectedBeforePhoto(null);
        }
      }
    })
  ).current;

  // Combined PanResponder that handles both swipe directions
  const combinedPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Don't capture gestures if carousel or gallery is open
        if (showCarouselRef.current) {
          return false;
        }
        if (showGalleryRef.current) {
          return false;
        }
        
        const { dx, dy } = gestureState;
        // Vertical swipe down for closing camera
        if (Math.abs(dy) > Math.abs(dx) && dy > 10) {
          return true;
        }
        // Horizontal swipe for room switching
        if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 30) {
          return true;
        }
        return false;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Don't show movement - just detect threshold
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        
        // Check if it's a vertical swipe down (closing gesture)
        if (Math.abs(dy) > Math.abs(dx)) {
          const threshold = 100;
          if (dy > threshold) {
            // Close camera immediately - native animation handles it
            navigation.goBack();
          }
        } 
        // Check if it's a horizontal swipe (room switching)
        else if (Math.abs(dx) > Math.abs(dy)) {
          const swipeThreshold = 50;
          const currentIndex = rooms.findIndex(r => r.id === currentRoomRef.current);
          
          if (dx > swipeThreshold) {
            // Swipe right - go to previous room (circular)
            const newIndex = currentIndex > 0 ? currentIndex - 1 : rooms.length - 1;
            const newRoom = rooms[newIndex].id;
            setRoom(newRoom);
            if (mode === 'after') {
              const unpairedPhotos = getUnpairedBeforePhotos(newRoom);
              if (unpairedPhotos.length > 0) {
                setSelectedBeforePhoto(unpairedPhotos[0]);
              } else {
                setSelectedBeforePhoto(null);
              }
            }
          } else if (dx < -swipeThreshold) {
            // Swipe left - go to next room (circular)
            const newIndex = currentIndex < rooms.length - 1 ? currentIndex + 1 : 0;
            const newRoom = rooms[newIndex].id;
            setRoom(newRoom);
            if (mode === 'after') {
              const unpairedPhotos = getUnpairedBeforePhotos(newRoom);
              if (unpairedPhotos.length > 0) {
                setSelectedBeforePhoto(unpairedPhotos[0]);
              } else {
                setSelectedBeforePhoto(null);
              }
            }
          }
        }
      }
    })
  ).current;

  // Unified PanResponder for camera view (handles swipe up/down based on gallery state)
  const cameraViewPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Don't activate if carousel, fullscreen, or enlarged gallery/photo is open
        // NOTE: Allow gestures even when gallery is animating, so user can cancel the opening animation
        if (showCarouselRef.current || isFullScreen || enlargedGalleryPhotoRef.current || showEnlargedGalleryRef.current) {
          return false;
        }
        
        const { dx, dy } = gestureState;
        
        // If gallery is shown, respond to swipe down from ANYWHERE or horizontal swipe
        if (showGalleryRef.current) {
          const gestureY = evt.nativeEvent.pageY;
          const screenHeight = dimensionsRef.current.height;
          const galleryTop = screenHeight * 0.6; // top of bottom gallery area
          const isTopArea = gestureY < galleryTop;
          const isSwipeDown = dy > 0 && (Math.abs(dy) >= Math.abs(dx) || Math.abs(dx) < 5);
          const isHorizontal = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5;
          // Only allow horizontal room switching from TOP area; bottom area horizontal should be handled by ScrollView
          return isSwipeDown || (isTopArea && isHorizontal);
        }
        
        // If gallery is NOT shown, respond to swipe up, swipe down, or horizontal swipes
        const isVerticalSwipe = Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10;
        const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10;
        return isVerticalSwipe || isHorizontalSwipe;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Don't activate if carousel, fullscreen, or enlarged gallery/photo is open
        // NOTE: Allow gestures even when gallery is animating, so user can cancel the opening animation
        if (showCarouselRef.current || isFullScreen || enlargedGalleryPhotoRef.current || showEnlargedGalleryRef.current) {
          return false;
        }
        
        const { dx, dy } = gestureState;
        
        // When gallery is shown:
        // Capture strategy: be EXTREMELY aggressive to beat ScrollView
        if (showGalleryRef.current) {
          const gestureY = evt.nativeEvent.pageY;
          const screenHeight = dimensionsRef.current.height;
          const galleryTop = screenHeight * 0.6;
          const isBottomArea = gestureY >= galleryTop;
          
          // Gallery area (bottom 40%): Capture at the SLIGHTEST vertical movement
          // We need to capture before ScrollView claims it
          if (isBottomArea) {
            // ANY downward movement, even 0.1px, as long as it's not clearly horizontal
            const isDownward = dy > 0;
            const notClearlyHorizontal = Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < 5;
            if (isDownward && notClearlyHorizontal) {
              return true;
            }
            // Don't capture horizontal gestures - let ScrollView handle them
            return false;
          }
          
          // Camera area (top 60%): Standard capture for vertical/horizontal
          const isVertical = dy > 2 && Math.abs(dy) > Math.abs(dx);
          const isHorizontal = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10;
          if (isVertical || isHorizontal) {
            return true;
          }
          
          return false;
        }
        
        return (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) || 
               (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        
        // If gallery is shown, handle swipes
        if (showGalleryRef.current) {
          // Vertical swipe down - close gallery (reduced threshold for better responsiveness)
          if (Math.abs(dy) > Math.abs(dx) && dy > 20) {
            // Stop any ongoing animations immediately
            cameraScale.stopAnimation();
            cameraTranslateY.stopAnimation();
            galleryOpacity.stopAnimation();
            
            // Set animating flag to block new gestures
            isGalleryAnimatingRef.current = true;
            setIsGalleryAnimating(true);
            
            // Update state immediately before animation
            setShowGallery(false);
            Animated.parallel([
              Animated.spring(cameraScale, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 10
              }),
              Animated.spring(cameraTranslateY, {
                toValue: 0,
                useNativeDriver: true,
                tension: 50,
                friction: 10
              }),
              Animated.timing(galleryOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true
              })
            ]).start(() => {
              // Explicitly reset values to ensure they're at default
              cameraScale.setValue(1);
              cameraTranslateY.setValue(0);
              galleryOpacity.setValue(0);
              
              // Add small delay before allowing next gesture
              setTimeout(() => {
                isGalleryAnimatingRef.current = false;
                setIsGalleryAnimating(false);
              }, 100);
            });
            return;
          }
          
          // Horizontal swipe - switch rooms (in half-screen mode, reduced threshold)
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
            // Only switch rooms if the gesture started in the TOP camera area
            const startY = gestureState.y0;
            const galleryTop = dimensionsRef.current.height * 0.6;
            if (startY >= galleryTop) {
              return;
            }
            const currentIndex = rooms.findIndex(r => r.id === currentRoomRef.current);
            
            if (dx > 0) {
              // Swipe right - previous room
              const newIndex = currentIndex > 0 ? currentIndex - 1 : rooms.length - 1;
              const newRoom = rooms[newIndex].id;
              setRoom(newRoom);
              if (mode === 'after') {
                const beforePhotos = getBeforePhotos(newRoom);
                if (beforePhotos.length > 0) {
                  setSelectedBeforePhoto(beforePhotos[0]);
                } else {
                  setSelectedBeforePhoto(null);
                  Alert.alert(
                    'No Before Photos',
                    `There are no before photos in ${rooms[newIndex].name}. Please take a before photo first.`,
                    [{ text: 'OK' }]
                  );
                }
              }
            } else {
              // Swipe left - next room
              const newIndex = currentIndex < rooms.length - 1 ? currentIndex + 1 : 0;
              const newRoom = rooms[newIndex].id;
              setRoom(newRoom);
              if (mode === 'after') {
                const beforePhotos = getBeforePhotos(newRoom);
                if (beforePhotos.length > 0) {
                  setSelectedBeforePhoto(beforePhotos[0]);
                } else {
                  setSelectedBeforePhoto(null);
                  Alert.alert(
                    'No Before Photos',
                    `There are no before photos in ${rooms[newIndex].name}. Please take a before photo first.`,
                    [{ text: 'OK' }]
                  );
                }
              }
            }
            return;
          }
        }
        
        // If gallery is NOT shown, handle all gestures
        if (!showGalleryRef.current) {
          // Check for vertical swipe
          if (Math.abs(dy) > Math.abs(dx)) {
            // Swipe down - close camera
            if (dy > 100) {
              navigation.goBack();
              return;
            }
            // Swipe up - show gallery
            if (dy < -100) {
              // Set animating flag
              isGalleryAnimatingRef.current = true;
              setIsGalleryAnimating(true);
              setShowGallery(true);
              
              const galleryHeight = dimensions.height * 0.4;
              const cameraHeight = dimensions.height - galleryHeight;
              
              // Scale to fill width, cropping top/bottom
              // Container: width × cameraHeight (60% of screen)
              // Camera: 4:3 aspect ratio
              // To fill width: scale = baseScale × (cameraAspect / containerAspect)
              const containerAspect = dimensions.width / cameraHeight; // W/H of visible area
              const cameraAspect = 4 / 3; // Camera is 4:3 (W/H)
              const baseScale = cameraHeight / dimensions.height; // 0.6
              const zoomFactor = cameraAspect / containerAspect; // Zoom to fill width
              const scale = baseScale * zoomFactor; // Final scale
              const translateY = -galleryHeight / 2;
              Animated.parallel([
                Animated.spring(cameraScale, {
                  toValue: scale,
                  useNativeDriver: true,
                  tension: 50,
                  friction: 10
                }),
                Animated.spring(cameraTranslateY, {
                  toValue: translateY,
                  useNativeDriver: true,
                  tension: 50,
                  friction: 10
                }),
                Animated.timing(galleryOpacity, {
                  toValue: 1,
                  duration: 300,
                  useNativeDriver: true
                })
              ]).start(() => {
                setTimeout(() => {
                  isGalleryAnimatingRef.current = false;
                  setIsGalleryAnimating(false);
                }, 100);
              });
              return;
            }
          }
          
          // Check for horizontal swipe (room switching, reduced threshold)
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
            const currentIndex = rooms.findIndex(r => r.id === currentRoomRef.current);
            
            if (dx > 0) {
              // Swipe right - previous room
              const newIndex = currentIndex > 0 ? currentIndex - 1 : rooms.length - 1;
              const newRoom = rooms[newIndex].id;
              setRoom(newRoom);
              if (mode === 'after') {
                const beforePhotos = getBeforePhotos(newRoom);
                if (beforePhotos.length > 0) {
                  setSelectedBeforePhoto(beforePhotos[0]);
                } else {
                  setSelectedBeforePhoto(null);
                  Alert.alert(
                    'No Before Photos',
                    `There are no before photos in ${rooms[newIndex].name}. Please take a before photo first.`,
                    [{ text: 'OK' }]
                  );
                }
              } else {
                setSelectedBeforePhoto(null);
              }
            } else {
              // Swipe left - next room
              const newIndex = currentIndex < rooms.length - 1 ? currentIndex + 1 : 0;
              const newRoom = rooms[newIndex].id;
              setRoom(newRoom);
              if (mode === 'after') {
                const beforePhotos = getBeforePhotos(newRoom);
                if (beforePhotos.length > 0) {
                  setSelectedBeforePhoto(beforePhotos[0]);
                } else {
                  setSelectedBeforePhoto(null);
                  Alert.alert(
                    'No Before Photos',
                    `There are no before photos in ${rooms[newIndex].name}. Please take a before photo first.`,
                    [{ text: 'OK' }]
                  );
                }
              } else {
                setSelectedBeforePhoto(null);
              }
            }
          }
        }
      },
      onPanResponderTerminationRequest: () => false
    })
  ).current;

  // PanResponder for swipe down on enlarged gallery carousel
  const enlargedGalleryPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const { dy } = gestureState;
        return showEnlargedGalleryRef.current && dy > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Don't animate movement - just detect swipe down gesture
        // This prevents visual sliding that would flash the gallery underneath
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy } = gestureState;
        const threshold = 80;
        
        if (dy > threshold) {
          // Clear both states immediately (same as cross button)
          setEnlargedGalleryPhoto(null);
          setShowEnlargedGallery(false);
        }
        // If swipe wasn't strong enough, just ignore it (no spring back animation needed)
      }
    })
  ).current;

  // Detect screen rotation and update dimensions
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const newOrientation = window.width > window.height ? 'landscape' : 'portrait';
      // Update dimensions immediately for instant response
      setDimensions({ width: window.width, height: window.height });
      setDeviceOrientation(newOrientation);
      
      // Also update specificOrientation to match if there's a clear portrait/landscape change
      if (newOrientation === 'portrait') {
        setSpecificOrientation(1); // Force to portrait
      }
      // For landscape, let the ScreenOrientation listener handle the specific value (3 or 4)
    });

    // Get specific orientation (landscape-left vs landscape-right)
    const getSpecificOrientation = async () => {
      const orientation = await ScreenOrientation.getOrientationAsync();
      setSpecificOrientation(orientation);
    };
    
    const orientationSubscription = ScreenOrientation.addOrientationChangeListener((event) => {
      const orientation = event.orientationInfo.orientation;
      const orientationNames = {
        1: 'PORTRAIT',
        2: 'PORTRAIT_UPSIDE_DOWN',
        3: 'LANDSCAPE_LEFT (counter-clockwise)',
        4: 'LANDSCAPE_RIGHT (clockwise)'
      };
      // Cross-check with dimensions to ensure consistency
      const currentDims = Dimensions.get('window');
      const currentOrientation = currentDims.width > currentDims.height ? 'landscape' : 'portrait';
      
      if (currentOrientation === 'portrait' && (orientation === 3 || orientation === 4)) {
        setSpecificOrientation(1);
      } else if (currentOrientation === 'landscape' && orientation === 1) {
        // Keep the landscape orientation (3 or 4) - don't force to portrait
      } else {
        // Update immediately - native rotation is already smooth
        setSpecificOrientation(event.orientationInfo.orientation);
      }
    });
    
    // Get orientation immediately on mount
    getSpecificOrientation();

    // Cleanup listener on unmount
    return () => {
      subscription?.remove();
      ScreenOrientation.removeOrientationChangeListener(orientationSubscription);
    };
  }, []);

  // Update camera view mode when device orientation changes - Android only
  useEffect(() => {
    // Only auto-sync on Android; iOS uses manual toggle only
    if (Platform.OS === 'android') {
      setCameraViewMode(deviceOrientation);
    }
  }, [deviceOrientation]);

  // Handle screen focus/blur to re-check permissions and settings
  useFocusEffect(
    useCallback(() => {
      if (permission && !permission.granted) {
        requestPermission();
      }
    }, [permission, requestPermission])
  );

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Force orientation check on mount to ensure correct initial state
  // Show room indicator when room changes (but not on initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Clear any existing timer
    if (roomIndicatorTimer.current) {
      clearTimeout(roomIndicatorTimer.current);
    }
    
    // Show indicator
    setShowRoomIndicator(true);
    
    // Hide after 500ms
    roomIndicatorTimer.current = setTimeout(() => {
      setShowRoomIndicator(false);
      roomIndicatorTimer.current = null;
    }, 500);
    
    return () => {
      if (roomIndicatorTimer.current) {
        clearTimeout(roomIndicatorTimer.current);
      }
    };
  }, [room]);

  useEffect(() => {
    const checkOrientation = async () => {
      // Delay to ensure screen transition is complete and stable
      setTimeout(async () => {
        const orientation = await ScreenOrientation.getOrientationAsync();
        const currentDims = Dimensions.get('window');
        const currentOrientation = currentDims.width > currentDims.height ? 'landscape' : 'portrait';
        // Cross-check: If dimensions say portrait but API says landscape (or vice versa), trust dimensions
        if (currentOrientation === 'portrait' && (orientation === 3 || orientation === 4)) {
          setSpecificOrientation(1);
        } else if (currentOrientation === 'landscape' && orientation === 1) {
          setSpecificOrientation(3);
        } else {
          setSpecificOrientation(orientation);
        }
      }, 250);
    };
    checkOrientation();
  }, []);

  // Initialize selectedBeforePhoto from beforePhoto if not set
  useEffect(() => {
    if (mode === 'after' && beforePhoto && !selectedBeforePhoto) {
      setSelectedBeforePhoto(beforePhoto);
    }
  }, [mode, beforePhoto]);

  // Check if there are before photos when entering after mode
  useEffect(() => {
    if (mode === 'after' && !beforePhoto && !selectedBeforePhoto) {
      const allBeforePhotos = getBeforePhotos(room);
      if (allBeforePhotos.length > 0) {
        // Set to first before photo in the room
        setSelectedBeforePhoto(allBeforePhotos[0]);
      }
    }
  }, [mode, room]);

  // Set aspect ratio to match before photo in after mode
  useEffect(() => {
    if (mode === 'after') {
      const activeBeforePhoto = getActiveBeforePhoto();
      if (activeBeforePhoto) {
        if (activeBeforePhoto.aspectRatio) {
        setAspectRatio(activeBeforePhoto.aspectRatio);
      }
    }
    }
  }, [selectedBeforePhoto, mode, beforePhoto]);

  // In after mode, camera view mode should match the before photo's camera view mode
  useEffect(() => {
    if (mode === 'after') {
      // Android: always use device orientation (auto-sync)
      // iOS: match before photo's camera view mode
      if (Platform.OS === 'android') {
        setCameraViewMode(deviceOrientation);
      } else {
        const activeBeforePhoto = getActiveBeforePhoto();
        if (activeBeforePhoto && activeBeforePhoto.cameraViewMode) {
          setCameraViewMode(activeBeforePhoto.cameraViewMode);
        } else {
          // Fallback to device orientation if no cameraViewMode saved
          setCameraViewMode(deviceOrientation);
        }
      }
    }
  }, [mode, deviceOrientation, selectedBeforePhoto]);

  // Log when selectedBeforePhoto changes in after mode
  useEffect(() => {
    if (mode === 'after' && selectedBeforePhoto) {
    }
  }, [selectedBeforePhoto, mode, deviceOrientation]);

  // Ensure carousel starts at correct position
  useEffect(() => {
    if (showCarousel && carouselScrollRef.current) {
      // Small delay to ensure ScrollView is rendered, then force scroll to position
      requestAnimationFrame(() => {
        carouselScrollRef.current?.scrollTo({
          x: carouselIndex * dimensions.width,
          y: 0,
          animated: false
        });
      });
    }
  }, [showCarousel]);

  useEffect(() => {
    if (route.params?.beforePhoto) {
      setSelectedBeforePhoto(route.params.beforePhoto);
    }
    analyticsService.logEvent('CameraScreen_Open', { mode: route.params?.mode || 'before' });
  }, [route.params]);

  useEffect(() => {
    const getPermissions = async () => {
      if (!permission || permission.granted) return;
      requestPermission();
    };
    getPermissions();
  }, [permission, requestPermission]);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    // Check orientation mismatch for after mode
    if (isOrientationMismatch()) {
      const beforeOrientation = getActiveBeforePhoto()?.orientation || 'portrait';
      Alert.alert(
        'Wrong Orientation',
        `The before photo was taken in ${beforeOrientation} mode. Please rotate your phone to ${beforeOrientation} orientation to match.`,
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false
      });

      if (mode === 'before') {
        await handleBeforePhoto(photo.uri);
      } else if (mode === 'after') {
        await handleAfterPhoto(photo.uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take picture');
    } finally {
      setIsCapturing(false);
    }
  };

  // Helper function to add label to photo
  const addLabelToPhoto = async (uri, labelText) => {
    return uri; // Temporarily disabled
    
    if (!showLabels) {
      return uri;
    }

    try {
      // Get image dimensions
      return new Promise((resolve) => {
        Image.getSize(uri, async (width, height) => {
          setTempPhotoDimensions({ width, height });
          setTempPhotoUri(uri);
          setTempPhotoLabel(labelText);
          
          // Wait for next frame to ensure view is rendered
          setTimeout(async () => {
            try {
              if (labelViewRef.current) {
                const capturedUri = await captureRef(labelViewRef, {
                  format: 'jpg',
                  quality: 0.95,
                  width,
                  height
                });
                setTempPhotoUri(null);
                setTempPhotoLabel(null);
                setTempPhotoDimensions({ width: 1080, height: 1920 });
                resolve(capturedUri);
              } else {
                setTempPhotoUri(null);
                setTempPhotoLabel(null);
                setTempPhotoDimensions({ width: 1080, height: 1920 });
                resolve(uri);
              }
            } catch (error) {
              setTempPhotoUri(null);
              setTempPhotoLabel(null);
              setTempPhotoDimensions({ width: 1080, height: 1920 });
              resolve(uri);
            }
          }, 300);
        }, (error) => {
          resolve(uri);
        });
      });
    } catch (error) {
      return uri;
    }
  };

  const handleBeforePhoto = async (uri) => {
    try {
      // Generate photo name
      const roomPhotos = getBeforePhotos(room);
      const photoNumber = roomPhotos.length + 1;
      const photoName = `${room.charAt(0).toUpperCase() + room.slice(1)} ${photoNumber}`;

      // Save original photo to device immediately (no label delay)
      const savedUri = await savePhotoToDevice(uri, `${room}_${photoName}_BEFORE_${Date.now()}.jpg`, activeProjectId || null);

      // Capture device orientation (actual phone orientation)
      const currentOrientation = deviceOrientation;
      // Calculate aspect ratio based on camera mode and platform
      let aspectRatio;
      if (Platform.OS === 'android') {
        // Android: use cameraViewMode toggle - landscape mode uses 4:3 letterbox, portrait uses 9:16
        aspectRatio = cameraViewMode === 'landscape' ? '4:3' : '9:16';
      } else {
        // iOS:
        if (cameraViewMode === 'landscape') {
          // Letterbox mode enabled: use 4:3 (matches letterboxCamera style)
          aspectRatio = '4:3';
        } else {
          // No letterbox: calculate from actual screen dimensions
          const screenWidth = dimensions.width;
          const screenHeight = dimensions.height;
          const ratio = deviceOrientation === 'landscape'
            ? screenWidth / screenHeight  // landscape orientation: wider / narrower
            : screenHeight / screenWidth; // portrait orientation: taller / wider
          // Format as string with 2 decimal places, e.g., "2.16:1" or "2.17:1"
          aspectRatio = `${ratio.toFixed(2)}:1`;
        }
      }

      // Add to photos with device orientation AND camera view mode
      const newPhoto = {
        id: Date.now(),
        uri: savedUri,
        room,
        mode: PHOTO_MODES.BEFORE,
        name: photoName,
        timestamp: Date.now(),
        aspectRatio: aspectRatio,
        orientation: currentOrientation,
        cameraViewMode: cameraViewMode // Save the camera view mode
      };

      await addPhoto(newPhoto);

      // Update selectedBeforePhoto so thumbnail shows immediately
      setSelectedBeforePhoto(newPhoto);

      // Process label in background if enabled (non-blocking)
      // ⚠️ TEMPORARILY DISABLED FOR DEBUGGING
      if (false && showLabels) {
        (async () => {
          try {
            const labeledUri = await addLabelToPhoto(uri, 'BEFORE');
            const labeledSavedUri = await savePhotoToDevice(labeledUri, `${room}_${photoName}_BEFORE_LABELED_${Date.now()}.jpg`, activeProjectId || null);
            
            // Update the photo with labeled version
            const updatedPhoto = {
              ...newPhoto,
              uri: labeledSavedUri
            };
            await addPhoto(updatedPhoto);
            setSelectedBeforePhoto(updatedPhoto);
          } catch (error) {
          }
        })();
      }

      // Stay in before mode to allow taking more photos
      // User can close camera to see photos in home grid
    } catch (error) {
      Alert.alert('Error', 'Failed to save photo');
    }
  };

  const handleAfterPhoto = async (uri) => {
    try {
      // Get the active before photo
      const activeBeforePhoto = getActiveBeforePhoto();

      if (!activeBeforePhoto) {
        Alert.alert('Error', 'Please select a before photo first');
        return;
      }

      const beforePhotoId = activeBeforePhoto.id;
      // If replacing existing photos, delete them first
      if (existingAfterPhoto) {
        await deletePhoto(existingAfterPhoto.id);
      }
      if (existingCombinedPhoto) {
        await deletePhoto(existingCombinedPhoto.id);
      }

      // Save original photo to device immediately (no label delay)
      const savedUri = await savePhotoToDevice(
        uri,
        `${activeBeforePhoto.room}_${activeBeforePhoto.name}_AFTER_${Date.now()}.jpg`,
        activeProjectId || null
      );

      // Add after photo (use same aspect ratio, orientation, and camera view mode as before photo)
      const newAfterPhoto = {
        id: Date.now(),
        uri: savedUri,
        room: activeBeforePhoto.room,
        mode: PHOTO_MODES.AFTER,
        name: activeBeforePhoto.name,
        timestamp: Date.now(),
        beforePhotoId: beforePhotoId,
        aspectRatio: activeBeforePhoto.aspectRatio || '4:3',
        orientation: activeBeforePhoto.orientation || deviceOrientation,
        cameraViewMode: activeBeforePhoto.cameraViewMode || 'portrait'
      };
      await addPhoto(newAfterPhoto);

      // Process label in background if enabled (non-blocking)
      // ⚠️ TEMPORARILY DISABLED FOR DEBUGGING
      if (false && showLabels) {
        (async () => {
          try {
            const labeledUri = await addLabelToPhoto(uri, 'AFTER');
            const labeledSavedUri = await savePhotoToDevice(labeledUri, `${activeBeforePhoto.room}_${activeBeforePhoto.name}_AFTER_LABELED_${Date.now()}.jpg`, activeProjectId || null);
            
            // Update the after photo with labeled version
            const updatedAfterPhoto = {
              ...newAfterPhoto,
              uri: labeledSavedUri
            };
            await addPhoto(updatedAfterPhoto);
          } catch (error) {
          }
        })();
      }

      // Create combined photo in background (non-blocking)
      (async () => {
        try {
          // Measure original sizes
          const getSize = (u) => new Promise((resolve) => {
            Image.getSize(u, (w, h) => resolve({ w, h }), () => resolve({ w: 1080, h: 1920 }));
          });
          const aSize = await getSize(activeBeforePhoto.uri);
          const bSize = await getSize(savedUri);
          // Choose a relative total width: match device width in pixels for good fidelity
          const logicalW = Dimensions.get('window').width;
          const pixelScale = PixelRatio.get() || 2;
          const totalW = Math.min(2160, Math.max(720, Math.round(logicalW * pixelScale))); // relative to device, capped

          // Decide layout: landscape or letterbox -> STACK, else SIDE-BY-SIDE
          const beforeOrientation = activeBeforePhoto.orientation || 'portrait';
          const cameraVM = activeBeforePhoto.cameraViewMode || 'portrait';
          const isLandscapePair = beforeOrientation === 'landscape' || cameraVM === 'landscape';
          const isLetterbox = (beforeOrientation === 'portrait' && cameraVM === 'landscape');

          let dimsLocal;
          if (isLandscapePair) {
            // STACK: heights sum based on width
            const r1h = aSize.h / aSize.w; // height per unit width
            const r2h = bSize.h / bSize.w;
            const totalH = Math.max(400, Math.round(totalW * (r1h + r2h)));
            const topH = Math.round(totalW * r1h);
            const bottomH = totalH - topH;
            dimsLocal = { width: totalW, height: totalH, topH, bottomH };
          } else {
            // SIDE-BY-SIDE: widths split based on height-normalized ratios
            const r1w = aSize.w / aSize.h;
            const r2w = bSize.w / bSize.h;
            const denom = (r1w + r2w) || 1;
            const totalH = Math.max(400, Math.round(totalW / denom));
            const leftW = Math.round(totalW * (r1w / denom));
            const rightW = totalW - leftW;
            dimsLocal = { width: totalW, height: totalH, leftW, rightW };
          }

          setSideBaseDims(dimsLocal);
          setSideBasePair({ beforeUri: activeBeforePhoto.uri, afterUri: savedUri, isLandscapePair });

          // Allow mount (short)
          await new Promise((r) => setTimeout(r, 60));
          // Prefetch images to improve load reliability
          try {
            await Promise.all([
              Image.prefetch(activeBeforePhoto.uri),
              Image.prefetch(savedUri)
            ]);
          } catch (pfErr) {
          }
          // Brief wait for images to load; don't block long
          const start = Date.now();
          const maxWaitMs = 300; // keep UI snappy
          while (!(sideLoadedA && sideLoadedB) && (Date.now() - start) < maxWaitMs) {
            await new Promise((r) => setTimeout(r, 20));
          }
          // Capture without altering proportions
          if (sideBaseRef.current) {
            const capUri = await captureRef(sideBaseRef, {
              format: 'jpg',
              quality: 0.95,
              width: dimsLocal.width,
              height: dimsLocal.height
            });
            const safeName = (activeBeforePhoto.name || 'Photo').replace(/\s+/g, '_');
            const baseType = isLandscapePair ? 'STACK' : 'SIDE';
            const projectIdSuffix = activeProjectId ? `_P${activeProjectId}` : '';
            const firstSaved = await savePhotoToDevice(
              capUri,
              `${activeBeforePhoto.room}_${safeName}_COMBINED_BASE_${baseType}_${Date.now()}${projectIdSuffix}.jpg`,
              activeProjectId || null
            );
            // In LETTERBOX, also save the SIDE-BY-SIDE variant in addition to STACK
            if (isLetterbox) {
              try {
                // Prepare side-by-side dims based on existing sizes and totalW
                const r1wLB = aSize.w / aSize.h;
                const r2wLB = bSize.w / bSize.h;
                const denomLB = (r1wLB + r2wLB) || 1;
                const totalHLB = Math.max(400, Math.round(totalW / denomLB));
                const leftWLB = Math.round(totalW * (r1wLB / denomLB));
                const rightWLB = totalW - leftWLB;
                const sideDimsLB = { width: totalW, height: totalHLB, leftW: leftWLB, rightW: rightWLB };
                // Reset load flags and mount the side-by-side renderer
                setSideLoadedA(false);
                setSideLoadedB(false);
                setSideBaseDims(sideDimsLB);
                setSideBasePair({ beforeUri: activeBeforePhoto.uri, afterUri: savedUri, isLandscapePair: false });
                await new Promise((r) => setTimeout(r, 60));
                // Brief wait for images to load
                const startLB = Date.now();
                const maxWaitMsLB = 300;
                while (!(sideLoadedA && sideLoadedB) && (Date.now() - startLB) < maxWaitMsLB) {
                  await new Promise((r) => setTimeout(r, 20));
                }
                if (sideBaseRef.current) {
                  const capUriLB = await captureRef(sideBaseRef, {
                    format: 'jpg',
                    quality: 0.95,
                    width: sideDimsLB.width,
                    height: sideDimsLB.height
                  });
                  const projectIdSuffix = activeProjectId ? `_P${activeProjectId}` : '';
                  const secondSaved = await savePhotoToDevice(
                    capUriLB,
                    `${activeBeforePhoto.room}_${safeName}_COMBINED_BASE_SIDE_${Date.now()}${projectIdSuffix}.jpg`,
                    activeProjectId || null
                  );
                } else {
                }
              } catch (eLB) {
              }
            }
          } else {
          }
        } catch (e) {
        } finally {
          setSideBasePair(null);
          setSideBaseDims(null);
          setSideLoadedA(false);
          setSideLoadedB(false);
        }
      })();

      // If we're replacing an existing combined photo, navigate to PhotoEditor to recreate it
      if (existingCombinedPhoto) {
        navigation.navigate('PhotoEditor', {
          beforePhoto: activeBeforePhoto,
          afterPhoto: newAfterPhoto
        });
        return;
      }

      // Auto-advance to next unpaired photo (immediate)
      const remainingUnpaired = getUnpairedBeforePhotos(activeBeforePhoto.room);
      // Filter out the photo we just paired to ensure we don't count it
      const nextUnpaired = remainingUnpaired.filter(p => p.id !== beforePhotoId);
      if (nextUnpaired.length > 0) {
        // Select the next unpaired photo
        setSelectedBeforePhoto(nextUnpaired[0]);
      } else {
        // All photos paired, go back to main grid
        Alert.alert(
          'All Photos Taken',
          'All after photos have been captured!',
          [
            {
              text: 'OK',
              onPress: () => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('Home');
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save photo');
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => {
      const newFacing = current === 'back' ? 'front' : 'back';
      // Turn off flashlight when switching to front camera
      if (newFacing === 'front' && enableTorch) {
        setEnableTorch(false);
      }
      return newFacing;
    });
  };

  // Get current room info
  const getCurrentRoomInfo = () => {
    return rooms.find(r => r.id === room) || rooms[0];
  };

  // Check if orientation matches for after mode
  const isOrientationMismatch = () => {
    if (mode !== 'after') return false;
    
    const activeBeforePhoto = getActiveBeforePhoto();
    if (!activeBeforePhoto) {
      return false;
    }
    
    const beforeOrientation = activeBeforePhoto.orientation || 'portrait';
    // In after mode, device orientation must match before photo orientation
    const mismatch = beforeOrientation !== deviceOrientation;
    return mismatch;
  };

  // Render overlay mode (current implementation)
  const renderOverlayMode = () => (
              <View
      style={styles.container}
      {...cameraViewPanResponder.panHandlers}
    >
      {/* Animated camera view 
          Gesture handling:
          - When gallery is shown: swipe down closes gallery (returns to full camera)
          - When gallery is NOT shown: swipe down closes camera (navigates to main), swipe up shows gallery, horizontal swipes switch rooms
      */}
      <Animated.View
                style={[
          styles.cameraWrapper,
          {
            transform: [
              { scaleX: cameraScale },
              { scaleY: cameraScale },
              { translateY: cameraTranslateY }
            ]
          }
        ]}
      >
        {/* Orientation mismatch warning */}
        {(() => {
          const mismatch = isOrientationMismatch();
          return mismatch;
        })() && (
          <View style={styles.orientationWarning}>
            <Text style={styles.rotatePhoneIcon}>🔄</Text>
            <Text style={styles.orientationWarningText}>Rotate Phone!</Text>
            <Text style={styles.orientationWarningHint}>
              Before photo was taken in {getActiveBeforePhoto()?.orientation || 'portrait'} mode. 
              Please rotate your device.
            </Text>
        </View>
        )}

      {/* Camera preview with before photo overlay (for after mode) */}
      <View style={styles.cameraContainer}>
          {/* Letterbox container for landscape mode */}
          {(() => {
            const showLetterbox = cameraViewMode === 'landscape';
            return showLetterbox;
          })() ? (
            <View style={[
              styles.letterboxContainer,
              deviceOrientation === 'landscape' ? styles.letterboxContainerLandscape : null
            ]}>
              {/* First bar - top for portrait, left for landscape */}
              <View style={deviceOrientation === 'landscape' ? styles.letterboxBarHorizontal : styles.letterboxBar} />
              
              {/* Camera in landscape aspect ratio */}
              <View style={styles.letterboxCamera}>
                {layout && (
                  <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing={facing}
                    zoom={0}
                    enableTorch={enableTorch}
                  />
                )}

                {/* Before photo overlay (for after mode) */}
                {mode === 'after' && getActiveBeforePhoto() && (
                  <View style={styles.beforePhotoOverlay}>
                    <Image
                      source={{ uri: getActiveBeforePhoto().uri }}
                      style={styles.beforePhotoImage}
                      resizeMode="cover"
                    />
                  </View>
                )}
              </View>

              {/* Second bar - bottom for portrait, right for landscape */}
              <View style={deviceOrientation === 'landscape' ? styles.letterboxBarHorizontal : styles.letterboxBar} />
            </View>
          ) : (
            <View style={Platform.OS === 'android' ? styles.androidCameraWrapper : {flex: 1}}>
              {layout && (
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing={facing}
                  zoom={0}
                  enableTorch={enableTorch}
                />
              )}
              
              {/* Before photo overlay (for after mode) */}
              {mode === 'after' && getActiveBeforePhoto() && (
                <View style={styles.beforePhotoOverlay}>
                  <Image
                    source={{ uri: getActiveBeforePhoto().uri }}
                    style={styles.beforePhotoImage}
                    resizeMode="cover"
                  />
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>


      {/* Fixed UI Layer - doesn't rotate with device */}
      <Animated.View style={[
        styles.fixedUILayer,
        // Counter-rotate to keep UI fixed to screen geometry
        // LANDSCAPE_LEFT (3) = buttons should be on RIGHT (counter-rotate -90)
        specificOrientation === 3 && {
          transform: [{ rotate: '90deg' }],
          width: dimensions.height,
          height: dimensions.width,
          left: (dimensions.width - dimensions.height) / 2,
          top: (dimensions.height - dimensions.width) / 2
        },
        // LANDSCAPE_RIGHT (4) = buttons should be on LEFT (counter-rotate +90)
        specificOrientation === 4 && {
          transform: [{ rotate: '-90deg' }],
          width: dimensions.height,
          height: dimensions.width,
          left: (dimensions.width - dimensions.height) / 2,
          top: (dimensions.height - dimensions.width) / 2
        }
      ]} pointerEvents="box-none">
        {/* Room name indicator - fixed to screen */}
        <View style={styles.roomIndicator}>
          <Text style={styles.roomIndicatorIcon}>{getCurrentRoomInfo().icon}</Text>
          <View style={styles.roomIndicatorTextContainer}>
            <Text style={styles.roomIndicatorText}>{getCurrentRoomInfo().name}</Text>
            <Text style={styles.roomIndicatorMode}>{mode.toUpperCase()}</Text>
          </View>
        </View>

        {/* Close button - fixed to screen */}
        <TouchableOpacity
          style={styles.closeButtonTopRight}
          onPress={() => {
            navigation.goBack();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.bottomControls}>
          {/* Main control row */}
          <View style={styles.mainControlRow}>
            {/* Left container - Thumbnail */}
            <View style={styles.buttonContainer}>
              {!showGallery && !showEnlargedGallery && (() => {
                const activePhoto = getActiveBeforePhoto();
                
                if (activePhoto) {
                  const photoOrientation = activePhoto.orientation || 'portrait';
                  return (
                <TouchableOpacity
                      style={[
                        styles.thumbnailViewerContainer,
                        cameraViewMode === 'landscape' ? styles.thumbnailLandscape : styles.thumbnailPortrait
                      ]}
                  activeOpacity={1}
                  onPress={() => {
                    const newMode = cameraViewMode === 'portrait' ? 'landscape' : 'portrait';
                    setCameraViewMode(newMode);
                  }}
                      onPressIn={handleThumbnailPressIn}
                      onPressOut={handleThumbnailPressOut}
                >
                  <Image
                        source={{ uri: activePhoto.uri }}
                    style={styles.thumbnailViewerImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.thumbnailViewerLabel}>👁</Text>
                </TouchableOpacity>
                  );
                } else {
                  // Show empty placeholder - allow switching camera view mode
                  return (
                    <TouchableOpacity
                      style={[
                        styles.thumbnailViewerContainer,
                        cameraViewMode === 'landscape' ? styles.thumbnailLandscape : styles.thumbnailPortrait
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        const newMode = cameraViewMode === 'portrait' ? 'landscape' : 'portrait';
                        setCameraViewMode(newMode);
                      }}
                    />
                  );
                }
              })()}
            </View>

            {/* Center container - Capture button */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.captureButton, isOrientationMismatch() && styles.captureButtonDisabled]} 
                onPress={takePicture}
                disabled={isOrientationMismatch()}
              >
                <View style={[styles.captureButtonInner, isOrientationMismatch() && styles.captureButtonInnerDisabled]} />
                {isOrientationMismatch() && (
                  <Text style={styles.captureButtonWarning}>🔄</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Right container - Flashlight */}
            <View style={styles.buttonContainer}>
              {facing === 'back' ? (
                <TouchableOpacity
                  style={styles.flashlightButton}
                  onPress={() => {
                    setEnableTorch(!enableTorch);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flashlightButtonText}>
                    {enableTorch ? '💡' : '⚫'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.flashlightButton} />
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Gallery at bottom - shown when swiping up (hidden when enlarged gallery is open) */}
      {showGallery && !showEnlargedGallery && (
        <Animated.View 
          style={[
            styles.bottomGallery,
            {
              opacity: galleryOpacity,
              height: dimensions.height * 0.4
            }
          ]}
        >
          <Text style={styles.galleryTitle}>
            {mode === 'before' ? `${getCurrentRoomInfo().name} Photos` : 'Before Photos'}
          </Text>
          {(() => {
            const photos = mode === 'before' ? getBeforePhotos(room) : getUnpairedBeforePhotos(room);
            
            if (photos.length === 0) {
              return (
                <View style={styles.galleryEmpty}>
                  <Text style={styles.galleryEmptyText}>
                    {mode === 'before' ? 'No photos yet' : 'All photos paired'}
                  </Text>
      </View>
              );
            }
            
            return (
              <ScrollView
                ref={galleryScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={112} // Gallery item width (100) + gap (12)
                decelerationRate="fast"
                snapToAlignment="center"
                scrollEventThrottle={16}
                directionalLockEnabled={true}
                onMomentumScrollEnd={(event) => {
                  // Only update state in after mode (for auto-selection)
                  if (mode === 'after') {
                    const offsetX = event.nativeEvent.contentOffset.x;
                    const index = Math.round(offsetX / 112);
                    if (photos[index]) {
                      setSelectedBeforePhoto(photos[index]);
                    }
                  }
                }}
                contentContainerStyle={styles.galleryContent}
              >
                {photos.map((photo, index) => (
                <View
                  key={photo.id}
                  style={[
                    styles.galleryItem,
                    mode === 'after' && selectedBeforePhoto?.id === photo.id && styles.galleryItemSelected
                  ]}
                >
      <TouchableOpacity
                    activeOpacity={0.7}
                    delayPressIn={50}
                    onPressIn={() => {
                      // Track tap start time
                      tapStartTime.current = Date.now();
                      
                      // Start long press timer for full-screen
                      longPressGalleryTimer.current = setTimeout(() => {
                        setEnlargedGalleryPhoto(photo);
                      }, 300);
                    }}
                    onPressOut={() => {
                      const pressDuration = Date.now() - (tapStartTime.current || 0);
                      
                      // Cancel long press timer
                      if (longPressGalleryTimer.current) {
                        clearTimeout(longPressGalleryTimer.current);
                        longPressGalleryTimer.current = null;
                      }
                      
                      // If full-screen photo is showing, close it
                      if (enlargedGalleryPhoto) {
                        setEnlargedGalleryPhoto(null);
                      }
                      // If it was a quick tap (< 300ms)
                      else if (pressDuration < 300) {
                        if (mode === 'before') {
                          // Before mode: tap opens enlarged carousel immediately
                          setEnlargedGalleryIndex(index);
                          setShowEnlargedGallery(true);
                        } else if (mode === 'after') {
                          // After mode: first tap selects, second tap (on already selected) opens enlarged carousel
                          if (selectedBeforePhoto?.id === photo.id) {
                            // Already selected - open enlarged carousel
                            setEnlargedGalleryIndex(index);
                            setShowEnlargedGallery(true);
                          } else {
                            // Not selected yet - just select it
                            setSelectedBeforePhoto(photo);
                          }
                        }
                      }
                      
                      tapStartTime.current = null;
                    }}
                  >
                    <View>
                <Image
                        source={{ uri: photo.uri }}
                        style={styles.galleryImage}
                  resizeMode="cover"
                />
                      <Text style={styles.galleryItemName} numberOfLines={1}>
                        {photo.name}
                      </Text>
                    </View>
              </TouchableOpacity>
                </View>
              ))}
              </ScrollView>
            );
          })()}
        </Animated.View>
      )}

      {/* Enlarged gallery carousel - shown when tapping a gallery item */}
      {showEnlargedGallery && (() => {
        const photos = mode === 'before' ? getBeforePhotos(room) : getUnpairedBeforePhotos(room);
        
        return (
          <Animated.View 
            style={[
              styles.enlargedGalleryContainer,
              {
                height: dimensions.height * 0.4
              }
            ]}
            {...enlargedGalleryPanResponder.panHandlers}
          >
            {/* Close button - top right */}
            <TouchableOpacity
              style={styles.enlargedGalleryCloseButton}
              onPress={() => {
                // Clear both states immediately
                setEnlargedGalleryPhoto(null);
                setShowEnlargedGallery(false);
              }}
            >
              <Text style={styles.enlargedGalleryCloseText}>✕</Text>
            </TouchableOpacity>

            {/* Delete button - top left */}
      <TouchableOpacity
              style={styles.enlargedGalleryDeleteButton}
        onPress={async () => {
                const currentPhoto = photos[enlargedGalleryIndex];
                if (!currentPhoto) return;
                await deletePhoto(currentPhoto.id);

                // Close enlarged gallery and refresh
                setEnlargedGalleryPhoto(null);
                setShowEnlargedGallery(false);

                // If no more photos, close gallery
                const remainingPhotos = mode === 'before' ? getBeforePhotos(room) : getUnpairedBeforePhotos(room);
                if (remainingPhotos.length === 0) {
                  setShowGallery(false);
                }
              }}
            >
              <Text style={styles.enlargedGalleryDeleteText}>🗑️</Text>
      </TouchableOpacity>
            <ScrollView
              ref={enlargedGalleryScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(event) => {
                // Only update state in after mode (for auto-selection)
                if (mode === 'after') {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / dimensions.width);
                  if (photos[index]) {
                    setSelectedBeforePhoto(photos[index]);
                  }
                }
              }}
            >
              {photos.map((photo, index) => (
                <TouchableWithoutFeedback
                  key={photo.id}
                  onPressIn={() => {
                    // Track when the press started
                    tapStartTime.current = Date.now();
                    
                    // Start long press timer for full-screen
                    longPressGalleryTimer.current = setTimeout(() => {
                      setEnlargedGalleryPhoto(photo);
                    }, 300);
                  }}
                  onPressOut={() => {
                    const pressDuration = Date.now() - (tapStartTime.current || 0);
                    
                    // Cancel long press timer if released early
                    if (longPressGalleryTimer.current) {
                      clearTimeout(longPressGalleryTimer.current);
                      longPressGalleryTimer.current = null;
                    }
                    
                    // If full-screen photo is showing, close it on release
                    if (enlargedGalleryPhoto) {
                      setEnlargedGalleryPhoto(null);
                    } 
                    // If it was a quick tap (< 300ms) and in after mode, select the photo
                    else if (pressDuration < 300 && mode === 'after') {
                      setSelectedBeforePhoto(photo);
                      setEnlargedGalleryIndex(index);
                    }
                    
                    tapStartTime.current = null;
                  }}
                >
                  <View style={[styles.enlargedGallerySlide, { width: dimensions.width }]}>
                    {(() => {
                      // Match the camera's aspect ratio from the upper half
                      // Upper half: width × (height × 0.6)
                      // Camera aspect ratio: width / (height × 0.6)
                      const cameraAspect = dimensions.width / (dimensions.height * 0.6);
                      
                      // Lower container height is 40% of screen
                      const containerHeight = dimensions.height * 0.4;
                      
                      // Calculate width to fit height while maintaining camera aspect
                      const photoWidth = containerHeight * cameraAspect;
                      return (
                        <View style={{
                          width: photoWidth,
                          height: containerHeight,
                          overflow: 'hidden'
                        }}>
                          <Image
                            source={{ uri: photo.uri }}
                            style={styles.enlargedGalleryImage}
                            resizeMode="cover"
                          />
                        </View>
                      );
                    })()}
                  </View>
                </TouchableWithoutFeedback>
              ))}
            </ScrollView>
          </Animated.View>
        );
      })()}

      {/* Full-screen photo - shown when long-pressing in enlarged gallery (only when enlarged gallery is open) */}
      {enlargedGalleryPhoto && showEnlargedGallery && (
        <View style={styles.fullScreenPhotoContainer}>
          <Image
            source={{ uri: enlargedGalleryPhoto.uri }}
            style={styles.fullScreenPhotoImage}
            resizeMode="contain"
          />
          <Text style={styles.fullScreenPhotoName}>{enlargedGalleryPhoto.name}</Text>
        </View>
      )}

      {/* Room transition indicator - shown briefly when switching rooms */}
      {showRoomIndicator && (() => {
        const squareSize = (dimensions.width - 60) / 2;
        const iconSize = 48; // matches styles.roomTransitionIcon
        const screenCenterTopForCard = (dimensions.height - squareSize) / 2; // centers the square
        // Both full and half screen: move up by 1/3 of square size
        const topOffset = squareSize / 3;
        const computedTop = screenCenterTopForCard - topOffset;
        return (
          <View style={[styles.roomTransitionIndicator, { top: computedTop }]}>
            <View
              style={[
                styles.roomTransitionCard,
                { width: squareSize, height: squareSize }
              ]}
            >
              <Text style={styles.roomTransitionIcon}>{getCurrentRoomInfo().icon}</Text>
              <Text style={styles.roomTransitionName}>{getCurrentRoomInfo().name}</Text>
            </View>
          </View>
        );
      })()}

      {/* Full screen view - activated by holding thumbnail */}
      {isFullScreen && !showCarousel && (() => {
        const photos = mode === 'after' ? getUnpairedBeforePhotos(room) : getBeforePhotos(room);
        
        if (photos.length === 0) return null;
        
        return (
          <View style={styles.fullScreenContainer} pointerEvents="box-none">
            <View style={styles.fullScreenBackground} />
            <ScrollView
              ref={fullScreenScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={dimensions.width}
              decelerationRate="fast"
              contentOffset={{ x: fullScreenIndex * dimensions.width, y: 0 }}
              onMomentumScrollEnd={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const index = Math.round(offsetX / dimensions.width);
                setFullScreenIndex(index);
                // Update selected photo in after mode
                if (mode === 'after' && photos[index]) {
                  setSelectedBeforePhoto(photos[index]);
                }
              }}
              scrollEventThrottle={16}
              style={styles.fullScreenScroll}
            >
              {photos.map((photo) => (
                <View key={photo.id} style={[styles.fullScreenSlide, { width: dimensions.width, height: dimensions.height }]}>
            <Image
                    source={{ uri: photo.uri }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
                </View>
              ))}
            </ScrollView>
            <View style={styles.fullScreenInfo} pointerEvents="none">
              <Text style={styles.fullScreenName}>{photos[fullScreenIndex]?.name}</Text>
              <Text style={styles.fullScreenHint}>Release to return • Swipe to navigate</Text>
            </View>
          </View>
        );
      })()}

      {/* Carousel view - activated by double-tap */}
      {showCarousel && (() => {
        const photos = mode === 'after' ? getUnpairedBeforePhotos(room) : getBeforePhotos(room);
        
        return (
          <View style={styles.carouselOverlay}>
            <TouchableOpacity
              style={styles.carouselBackground}
              activeOpacity={1}
              onPress={() => {
                setShowCarousel(false);
              }}
            />
            
            <Animated.View 
              style={[
                styles.carouselContainer,
                {
                  transform: [{ translateY: carouselTranslateY }]
                }
              ]}
              {...carouselPanResponder.panHandlers}
            >
              <ScrollView
                ref={carouselScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={dimensions.width}
                decelerationRate="fast"
                snapToAlignment="center"
                contentOffset={{ x: carouselIndex * dimensions.width, y: 0 }}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / dimensions.width);
                  setCarouselIndex(index);
                  // Update selected photo in after mode
                  if (mode === 'after' && photos[index]) {
                    setSelectedBeforePhoto(photos[index]);
                  }
                }}
                scrollEventThrottle={16}
              >
                {photos.map((photo) => (
                  <View key={photo.id} style={[styles.carouselSlide, { width: dimensions.width, height: dimensions.height }]}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.carouselImage}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>

              <View style={styles.carouselInfo}>
                <Text style={styles.carouselPhotoName}>{photos[carouselIndex]?.name}</Text>
                <Text style={styles.carouselCounter}>{carouselIndex + 1} / {photos.length}</Text>
              </View>

              <TouchableOpacity
                style={styles.carouselCloseButton}
                onPress={() => {
                  setShowCarousel(false);
                }}
              >
                <Text style={styles.carouselCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        );
      })()}
    </View>
  );

  const renderLabelView = () => {
    if (!tempPhotoUri || !tempPhotoLabel) return null;

      return (
      <View
        ref={labelViewRef}
        style={[
          styles.hiddenLabelView,
          {
            width: tempPhotoDimensions.width,
            height: tempPhotoDimensions.height
          }
        ]}
        collapsable={false}
      >
        <Image
          source={{ uri: tempPhotoUri }}
          style={styles.hiddenLabelImage}
          resizeMode="cover"
        />
        {/* Calculate scale factor for label to match standard size
            Camera photos are typically 1920x1080 (portrait) or 1080x1920 (landscape)
            Scale factor needed to make label appear the same size as on screen photos
        */}
        {(() => {
          // Use the same consistent scale factor as PhotoDetailScreen
          // Reference width: 1920px (landscape photo width for consistent scaling)
          const referenceWidth = 1920;
          const screenWidth = Dimensions.get('window').width;
          const scaleFactor = referenceWidth / screenWidth;
          return (
            <PhotoLabel
              label={tempPhotoLabel}
              style={{
                top: 10 * scaleFactor,
                left: 10 * scaleFactor,
                paddingHorizontal: 12 * scaleFactor,
                paddingVertical: 6 * scaleFactor,
                borderRadius: 6 * scaleFactor
              }}
              textStyle={{
                fontSize: 14 * scaleFactor
              }}
            />
          );
        })()}
        </View>
      );
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
    return () => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
      }
    };
  }, []);

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container} onLayout={(event) => setLayout(event.nativeEvent.layout)}>
     
      {/* Animated container for camera and gallery - allows sliding up/down */}
      <Animated.View
        style={[
          styles.cameraWrapper,
          {
            transform: [
              { scaleX: cameraScale },
              { scaleY: cameraScale },
              { translateY: cameraTranslateY }
            ]
          }
        ]}
      >
        {renderOverlayMode()}
        {renderLabelView()}

        {/* Hidden vertical side-by-side renderer (no transform, no padding) */}
        {sideBasePair && sideBaseDims && (
          <View
            ref={sideBaseRef}
            style={{ position: 'absolute', top: -10000, left: 0, width: sideBaseDims.width, height: sideBaseDims.height, backgroundColor: 'transparent' }}
            collapsable={false}
          >
            {sideBasePair.isLandscapePair ? (
              // STACKED
              <View style={{ width: '100%', height: '100%', flexDirection: 'column' }}>
                <View style={{ width: '100%', height: sideBaseDims.topH }}>
                  <Image
                    source={{ uri: sideBasePair.beforeUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    onLoad={() => setSideLoadedA(true)}
                  />
                  {/* BEFORE label - only if photo doesn't already have labels */}
                  {false && showLabels && !sideBasePair.beforeUri.includes('_LABELED') && (
                    <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: '#F2C31B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                      <Text style={{ color: '#303030', fontSize: 14, fontWeight: 'bold' }}>BEFORE</Text>
                    </View>
                  )}
                </View>
                <View style={{ width: '100%', height: sideBaseDims.bottomH }}>
                  <Image
                    source={{ uri: sideBasePair.afterUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    onLoad={() => setSideLoadedB(true)}
                  />
                  {/* AFTER label - only if photo doesn't already have labels */}
                  {false && showLabels && !sideBasePair.afterUri.includes('_LABELED') && (
                    <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: '#F2C31B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                      <Text style={{ color: '#303030', fontSize: 14, fontWeight: 'bold' }}>AFTER</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              // SIDE-BY-SIDE
              <View style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
                <View style={{ width: sideBaseDims.leftW, height: '100%' }}>
                  <Image
                    source={{ uri: sideBasePair.beforeUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    onLoad={() => setSideLoadedA(true)}
                  />
                  {/* BEFORE label - only if photo doesn't already have labels */}
                  {false && showLabels && !sideBasePair.beforeUri.includes('_LABELED') && (
                    <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: '#F2C31B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                      <Text style={{ color: '#303030', fontSize: 14, fontWeight: 'bold' }}>BEFORE</Text>
                    </View>
                  )}
                </View>
                <View style={{ width: sideBaseDims.rightW, height: '100%' }}>
                  <Image
                    source={{ uri: sideBasePair.afterUri }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    onLoad={() => setSideLoadedB(true)}
                  />
                  {/* AFTER label - only if photo doesn't already have labels */}
                  {false && showLabels && !sideBasePair.afterUri.includes('_LABELED') && (
                    <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: '#F2C31B', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                      <Text style={{ color: '#303030', fontSize: 14, fontWeight: 'bold' }}>AFTER</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
    overflow: 'hidden'
  },
  orientationWarning: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(242, 195, 27, 0.95)',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    zIndex: 1500,
    elevation: 1500,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10
  },
  rotatePhoneIcon: {
    fontSize: 64,
    marginBottom: 12
  },
  orientationWarningText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 8
  },
  orientationWarningHint: {
    fontSize: 14,
    color: COLORS.TEXT,
    textAlign: 'center',
    opacity: 0.8
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
    fontSize: 16
  },
  permissionButton: {
    backgroundColor: COLORS.PRIMARY,
    padding: 16,
    borderRadius: 8,
    margin: 20
  },
  permissionButtonText: {
    color: COLORS.TEXT,
    textAlign: 'center',
    fontWeight: 'bold'
  },
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  camera: {
    flex: 1
  },
  beforePhotoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  beforePhotoImage: {
    width: '100%',
    height: '100%'
  },
  fixedUILayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 260,
    elevation: 260,
    backgroundColor: 'transparent',
    overflow: 'hidden'
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 260,
    elevation: 260
  },
  roomIndicator: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    zIndex: 1000,
    elevation: 1000,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    gap: 8
  },
  roomIndicatorIcon: {
    fontSize: 20
  },
  roomIndicatorTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  roomIndicatorText: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    fontWeight: 'bold'
  },
  roomIndicatorMode: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  closeButtonTopRight: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeButtonText: {
    color: 'white',
    fontSize: 24
  },
  flashlightButton: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    width: 56,   // Portrait orientation - narrow width
    height: 84   // Portrait orientation - full height
  },
  flashlightButtonText: {
    fontSize: 24
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  flipButtonText: {
    fontSize: 24
  },
  bottomControls: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'transparent'
  },
  mainControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
    paddingHorizontal: 10
  },
  buttonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 84  // Match tallest button height
  },
  modeInfo: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20
  },
  modeText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '600'
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center'
  },
  captureButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#ccc'
  },
  captureButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.PRIMARY
  },
  captureButtonInnerDisabled: {
    backgroundColor: '#999'
  },
  captureButtonWarning: {
    position: 'absolute',
    fontSize: 32
  },
  zoomContainer: {
    alignItems: 'center',
    marginBottom: 20
  },
  zoomButtons: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 24,
    backdropFilter: 'blur(10px)'
  },
  zoomPresetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7
  },
  zoomPresetButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 1,
    transform: [{ scale: 1.1 }]
  },
  zoomPresetText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  },
  zoomPresetTextActive: {
    color: COLORS.PRIMARY,
    fontWeight: '700'
  },
  aspectRatioContainer: {
    flexDirection: 'column',
    gap: 8,
    width: 80,
    position: 'absolute',
    left: 10
  },
  aspectRatioButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center'
  },
  aspectRatioButtonActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY
  },
  aspectRatioButtonLocked: {
    backgroundColor: 'rgba(242, 195, 27, 0.3)',
    borderColor: COLORS.PRIMARY,
    opacity: 0.7
  },
  aspectRatioText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600'
  },
  aspectRatioTextActive: {
    color: COLORS.TEXT
  },
  aspectRatioHint: {
    fontSize: 10,
    marginTop: 2
  },
  aspectRatioLockIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: 10
  },
  // Thumbnail viewer styles (overlay mode - left side of shutter button)
  thumbnailViewerContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY
  },
  thumbnailLandscape: {
    width: 100,
    height: 75  // Landscape orientation - wider than tall
  },
  thumbnailPortrait: {
    width: 56,
    height: 84  // Portrait orientation - taller than wide (3:4 ratio approx)
  },
  thumbnailViewerImage: {
    width: '100%',
    height: '100%'
  },
  thumbnailViewerLabel: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    fontSize: 20
  },
  // Full screen styles
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 1001,
    elevation: 1001
  },
  fullScreenBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    width: '100%',
    height: '100%'
  },
  fullScreenScroll: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%'
  },
  fullScreenSlide: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
  },
  fullScreenImage: {
    width: '100%',
    height: '100%'
  },
  fullScreenInfo: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  fullScreenName: {
    color: COLORS.PRIMARY,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4
  },
  fullScreenHint: {
    color: COLORS.GRAY,
    fontSize: 13
  },
  // Carousel styles
  carouselOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1002,
    elevation: 1002
  },
  carouselBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000'
  },
  carouselCloseHintText: {
    color: COLORS.GRAY,
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20
  },
  carouselContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'center'
  },
  carouselSwipeIndicator: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    paddingVertical: 10
  },
  carouselDragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 8
  },
  carouselSlide: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
  },
  carouselImage: {
    width: '100%',
    height: '100%'
  },
  carouselInfo: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 12,
    paddingHorizontal: 20
  },
  carouselPhotoName: {
    color: COLORS.PRIMARY,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4
  },
  carouselCounter: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  carouselCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5
  },
  carouselCloseButtonText: {
    color: COLORS.TEXT,
    fontSize: 24,
    fontWeight: 'bold'
  },
  photoFrameGuide: {
    position: 'absolute',
    top: '5%',
    left: '5%',
    right: '5%',
    bottom: '5%',
    borderWidth: 2,
    borderColor: 'rgba(242, 195, 27, 0.6)',
    borderStyle: 'dashed'
  },
  frameCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: COLORS.PRIMARY
  },
  frameTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4
  },
  frameTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4
  },
  frameBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4
  },
  frameBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4
  },
  // Crop overlay styles
  cropOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  darkOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)'
  },
  frameArea: {
    position: 'relative',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY
  },
  // Gallery swipe-up styles
  cameraWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    overflow: 'hidden'
  },
  bottomGallery: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 2,
    borderTopColor: COLORS.PRIMARY,
    paddingTop: 10,
    zIndex: 150,
    elevation: 150
  },
  galleryTitle: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 16,
    textAlign: 'left'
  },
  galleryContent: {
    paddingHorizontal: 16,
    gap: 12
  },
  galleryItem: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    width: 100,
    alignSelf: 'flex-start'
  },
  galleryItemSelected: {
    borderColor: COLORS.PRIMARY
  },
  galleryImage: {
    width: 100,
    height: 100,
    backgroundColor: '#333'
  },
  galleryItemName: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    width: 100
  },
  galleryEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  galleryEmptyText: {
    color: COLORS.GRAY,
    fontSize: 14,
    fontStyle: 'italic'
  },
  // Enlarged gallery carousel styles (bottom 40%)
  enlargedGalleryContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderWidth: 3,
    borderColor: COLORS.PRIMARY,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    zIndex: 250,
    elevation: 250
  },
  enlargedGalleryCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 260
  },
  enlargedGalleryCloseText: {
    color: COLORS.PRIMARY,
    fontSize: 24,
    fontWeight: 'bold'
  },
  enlargedGalleryDeleteButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 260
  },
  enlargedGalleryDeleteText: {
    color: COLORS.PRIMARY,
    fontSize: 20
  },
  enlargedGallerySlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  enlargedGalleryImage: {
    width: '100%',
    height: '100%'
  },
  // Full-screen photo styles (entire screen)
  fullScreenPhotoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 300,
    elevation: 300
  },
  fullScreenPhotoImage: {
    width: '100%',
    height: '100%'
  },
  fullScreenPhotoName: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    color: COLORS.PRIMARY,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 20
  },
  // Room transition indicator (shows briefly when switching rooms)
  roomTransitionIndicator: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 500,
    pointerEvents: 'none'
  },
  roomTransitionCard: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(240, 240, 240, 0.5)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  roomTransitionIcon: {
    fontSize: 48
  },
  roomTransitionName: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  // Orientation toggle styles (replaces save button in before mode)
  orientationToggle: {
    position: 'absolute',
    right: 10,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    transform: [{ rotate: '90deg' }],
    justifyContent: 'center',
    alignItems: 'center'
  },
  orientationToggleIcon: {
    transform: [{ rotate: '-90deg' }]
  },
  orientationToggleText: {
    fontSize: 24
  },
  // Letterbox styles for landscape camera mode
  letterboxContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000'
  },
  letterboxContainerLandscape: {
    flexDirection: 'row'
  },
  letterboxBar: {
    width: '100%',
    backgroundColor: '#000',
    flex: 1
  },
  letterboxBarHorizontal: {
    height: '100%',
    backgroundColor: '#000',
    flex: 1
  },
  letterboxCamera: {
    width: '100%',
    aspectRatio: 4 / 3, // Landscape 4:3 for both platforms
    position: 'relative',
    overflow: 'hidden'
  },
  // Hidden view for adding labels to photos
  hiddenLabelView: {
    position: 'absolute',
    top: -10000,
    left: 0
  },
  hiddenLabelImage: {
    width: '100%',
    height: '100%'
  },
  androidCameraWrapper: {
    width: '100%',
    aspectRatio: 9/16,
    overflow: 'hidden',
    alignSelf: 'center',
  },
});
