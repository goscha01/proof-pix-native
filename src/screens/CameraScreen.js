import React, { useState, useRef, useEffect } from 'react';
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
  Animated
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { captureRef } from 'react-native-view-shot';
import * as ScreenOrientation from 'expo-screen-orientation';
import { usePhotos } from '../context/PhotoContext';
import { useSettings } from '../context/SettingsContext';
import { savePhotoToDevice } from '../services/storage';
import { COLORS, PHOTO_MODES, TEMPLATE_TYPES, ROOMS } from '../constants/rooms';
import { CroppedThumbnail } from '../components/CroppedThumbnail';

const initialDimensions = Dimensions.get('window');
const initialWidth = initialDimensions.width;
const initialHeight = initialDimensions.height;

export default function CameraScreen({ route, navigation }) {
  const { mode, beforePhoto, afterPhoto: existingAfterPhoto, combinedPhoto: existingCombinedPhoto, room: initialRoom } = route.params || {};
  const [room, setRoom] = useState(initialRoom);
  const [facing, setFacing] = useState('back');
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
  const [deviceOrientation, setDeviceOrientation] = useState('portrait');
  const [specificOrientation, setSpecificOrientation] = useState(1); // 1=PORTRAIT, 3=LANDSCAPE_LEFT, 4=LANDSCAPE_RIGHT
  const [isGalleryAnimating, setIsGalleryAnimating] = useState(false);
  const [tempPhotoUri, setTempPhotoUri] = useState(null);
  const [tempPhotoLabel, setTempPhotoLabel] = useState(null);
  const [tempPhotoDimensions, setTempPhotoDimensions] = useState({ width: 1080, height: 1920 });
  const longPressGalleryTimer = useRef(null);
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
  const { addPhoto, getBeforePhotos, getUnpairedBeforePhotos, deletePhoto } = usePhotos();
  const { cameraMode, showLabels } = useSettings();
  const labelViewRef = useRef(null);

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

  // Update ref when room changes
  useEffect(() => {
    currentRoomRef.current = room;
  }, [room]);

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

  // Set gallery index when opening gallery or changing selection
  useEffect(() => {
    if (showGallery) {
      const photos = mode === 'before' ? getBeforePhotos(room) : getUnpairedBeforePhotos(room);
      
      if (mode === 'after' && selectedBeforePhoto) {
        const index = photos.findIndex(p => p.id === selectedBeforePhoto.id);
        if (index !== -1) {
          setGalleryIndex(index);
          // Scroll to the selected photo
          setTimeout(() => {
            if (galleryScrollRef.current) {
              galleryScrollRef.current.scrollTo({ x: index * 112, animated: false });
            }
          }, 50);
        }
      } else {
        setGalleryIndex(0);
      }
    }
  }, [showGallery, mode, room]);

  // Scroll enlarged gallery to correct position when opening
  useEffect(() => {
    if (showEnlargedGallery && enlargedGalleryScrollRef.current) {
      setTimeout(() => {
        if (enlargedGalleryScrollRef.current) {
          enlargedGalleryScrollRef.current.scrollTo({ 
            x: enlargedGalleryIndex * dimensions.width, 
            animated: false 
          });
        }
      }, 50);
    }
  }, [showEnlargedGallery]);


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
          console.log('Carousel: Vertical swipe detected', dy);
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
          console.log('Carousel moving down:', gestureState.dy);
          carouselTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const threshold = 100; // Swipe down at least 100px to dismiss
        console.log('Carousel release, dy:', gestureState.dy);
        if (gestureState.dy > threshold) {
          // Dismiss carousel with animation - slide down
          console.log('Carousel swipe-down detected - closing carousel, staying on camera');
          Animated.timing(carouselTranslateY, {
            toValue: dimensionsRef.current.height,
            duration: 300,
            useNativeDriver: true
          }).start(() => {
            console.log('Carousel closed - back to camera view');
            setShowCarousel(false);
            carouselTranslateY.setValue(0);
          });
        } else {
          // Spring back to original position
          console.log('Carousel swipe not enough - springing back');
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
          console.log('Camera swipe-down detected - closing');
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
        const currentIndex = ROOMS.findIndex(r => r.id === currentRoomRef.current);
        let newRoomIndex;
        
        if (gestureState.dx > swipeThreshold) {
          // Swipe right - go to previous room (circular)
          newRoomIndex = currentIndex > 0 ? currentIndex - 1 : ROOMS.length - 1;
        } else if (gestureState.dx < -swipeThreshold) {
          // Swipe left - go to next room (circular)
          newRoomIndex = currentIndex < ROOMS.length - 1 ? currentIndex + 1 : 0;
        } else {
          return; // Not enough swipe distance
        }

        const newRoom = ROOMS[newRoomIndex].id;
        console.log('Switching to room:', newRoom);
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
              `There are no before photos in ${ROOMS[newRoomIndex].name}. Please take a before photo first.`,
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
          console.log('Combined: Carousel is open - ignoring gesture');
          return false;
        }
        if (showGalleryRef.current) {
          console.log('Combined: Gallery is open - ignoring gesture');
          return false;
        }
        
        const { dx, dy } = gestureState;
        // Vertical swipe down for closing camera
        if (Math.abs(dy) > Math.abs(dx) && dy > 10) {
          console.log('Combined: Vertical swipe DOWN detected (will close camera)');
          return true;
        }
        // Horizontal swipe for room switching
        if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 30) {
          console.log('Combined: Horizontal swipe detected (will switch room)');
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
            console.log('Combined: Camera swipe-down detected - closing');
            navigation.goBack();
          }
        } 
        // Check if it's a horizontal swipe (room switching)
        else if (Math.abs(dx) > Math.abs(dy)) {
          console.log('Combined: Horizontal swipe - switching room');
          const swipeThreshold = 50;
          const currentIndex = ROOMS.findIndex(r => r.id === currentRoomRef.current);
          
          if (dx > swipeThreshold) {
            // Swipe right - go to previous room (circular)
            const newIndex = currentIndex > 0 ? currentIndex - 1 : ROOMS.length - 1;
            const newRoom = ROOMS[newIndex].id;
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
            const newIndex = currentIndex < ROOMS.length - 1 ? currentIndex + 1 : 0;
            const newRoom = ROOMS[newIndex].id;
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
        // Don't activate if carousel, fullscreen, enlarged gallery/photo is open, or gallery is animating
        if (showCarouselRef.current || isFullScreen || isGalleryAnimatingRef.current || enlargedGalleryPhotoRef.current || showEnlargedGalleryRef.current) {
          console.log('Camera gesture blocked:', { 
            carousel: showCarouselRef.current, 
            fullscreen: isFullScreen,
            animating: isGalleryAnimatingRef.current,
            enlarged: enlargedGalleryPhotoRef.current !== null,
            enlargedGallery: showEnlargedGalleryRef.current
          });
          return false;
        }
        
        const { dx, dy } = gestureState;
        
        // If gallery is shown, only respond to swipe down
        if (showGalleryRef.current) {
          const isSwipeDown = Math.abs(dy) > Math.abs(dx) && dy > 2;
          console.log('Camera with gallery - swipe down check:', { dy, dx, isSwipeDown });
          return isSwipeDown;
        }
        
        // If gallery is NOT shown, respond to swipe up, swipe down, or horizontal swipes (reduced threshold)
        const isVerticalSwipe = Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10;
        const isHorizontalSwipe = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10;
        
        console.log('Camera without gallery - gesture check:', { dy, dx, vertical: isVerticalSwipe, horizontal: isHorizontalSwipe });
        return isVerticalSwipe || isHorizontalSwipe;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Don't activate if carousel, fullscreen, enlarged gallery/photo is open, or gallery is animating
        if (showCarouselRef.current || isFullScreen || isGalleryAnimatingRef.current || enlargedGalleryPhotoRef.current || showEnlargedGalleryRef.current) {
          return false;
        }
        
        const { dx, dy } = gestureState;
        
        // Capture vertical or horizontal swipes early
        if (showGalleryRef.current) {
          const shouldCapture = Math.abs(dy) > Math.abs(dx) && dy > 2;
          console.log('Capture check with gallery:', { dy, dx, shouldCapture });
          return shouldCapture;
        }
        
        return (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) || 
               (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, dy } = gestureState;
        
        // If gallery is shown, swipe down closes it
        if (showGalleryRef.current && dy > 30) {
          console.log('Swipe down with gallery - closing gallery. Current state:', { 
            gallery: showGalleryRef.current, 
            cameraViewMode,
            deviceOrientation 
          });
          
          // Set animating flag to block new gestures
          isGalleryAnimatingRef.current = true;
          setIsGalleryAnimating(true);
          
          // Update state immediately before animation
          setShowGallery(false);
          
          console.log('Gallery closing - animating to scale: 1, translateY: 0');
          
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
            console.log('Gallery animation complete. Resetting values explicitly.');
            // Explicitly reset values to ensure they're at default
            cameraScale.setValue(1);
            cameraTranslateY.setValue(0);
            galleryOpacity.setValue(0);
            
            // Add small delay before allowing next gesture
            setTimeout(() => {
              isGalleryAnimatingRef.current = false;
              setIsGalleryAnimating(false);
              console.log('Gallery animation flag cleared - ready for next gesture');
            }, 100);
          });
          return;
        }
        
        // If gallery is NOT shown, handle all gestures
        if (!showGalleryRef.current) {
          // Check for vertical swipe
          if (Math.abs(dy) > Math.abs(dx)) {
            // Swipe down - close camera
            if (dy > 100) {
              console.log('Swipe down without gallery - closing camera');
              navigation.goBack();
              return;
            }
            // Swipe up - show gallery
            if (dy < -100) {
              console.log('Swipe up - showing gallery');
              
              // Set animating flag
              isGalleryAnimatingRef.current = true;
              setIsGalleryAnimating(true);
              setShowGallery(true);
              
              const galleryHeight = dimensions.height * 0.4;
              const cameraHeight = dimensions.height - galleryHeight;
              const scale = cameraHeight / dimensions.height;
              const translateY = -galleryHeight / 2;
              
              console.log('Gallery opening - scale:', scale, 'translateY:', translateY, 'galleryHeight:', galleryHeight);
              
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
                console.log('Gallery open animation complete');
                setTimeout(() => {
                  isGalleryAnimatingRef.current = false;
                  setIsGalleryAnimating(false);
                  console.log('Gallery open animation flag cleared');
                }, 100);
              });
              return;
            }
          }
          
          // Check for horizontal swipe (room switching)
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
            console.log('Horizontal swipe - switching room');
            const currentIndex = ROOMS.findIndex(r => r.id === currentRoomRef.current);
            
            if (dx > 0) {
              // Swipe right - previous room
              const newIndex = currentIndex > 0 ? currentIndex - 1 : ROOMS.length - 1;
              const newRoom = ROOMS[newIndex].id;
              setRoom(newRoom);
              if (mode === 'after') {
                const beforePhotos = getBeforePhotos(newRoom);
                if (beforePhotos.length > 0) {
                  setSelectedBeforePhoto(beforePhotos[0]);
                } else {
                  setSelectedBeforePhoto(null);
                  Alert.alert(
                    'No Before Photos',
                    `There are no before photos in ${ROOMS[newIndex].name}. Please take a before photo first.`,
                    [{ text: 'OK' }]
                  );
                }
              } else {
                setSelectedBeforePhoto(null);
              }
            } else {
              // Swipe left - next room
              const newIndex = currentIndex < ROOMS.length - 1 ? currentIndex + 1 : 0;
              const newRoom = ROOMS[newIndex].id;
              setRoom(newRoom);
              if (mode === 'after') {
                const beforePhotos = getBeforePhotos(newRoom);
                if (beforePhotos.length > 0) {
                  setSelectedBeforePhoto(beforePhotos[0]);
                } else {
                  setSelectedBeforePhoto(null);
                  Alert.alert(
                    'No Before Photos',
                    `There are no before photos in ${ROOMS[newIndex].name}. Please take a before photo first.`,
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
        if (gestureState.dy > 0) {
          enlargedGalleryTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy } = gestureState;
        const threshold = 100;
        
        if (dy > threshold) {
          console.log('Enlarged gallery swipe down - closing');
          Animated.timing(enlargedGalleryTranslateY, {
            toValue: dimensions.height,
            duration: 300,
            useNativeDriver: true
          }).start(() => {
            setShowEnlargedGallery(false);
            enlargedGalleryTranslateY.setValue(0);
          });
        } else {
          Animated.spring(enlargedGalleryTranslateY, {
            toValue: 0,
            useNativeDriver: true
          }).start();
        }
      }
    })
  ).current;

  // PanResponder for swipe down to hide gallery (only closes gallery, doesn't close camera)
  const gallerySwipeDownPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        const shouldSet = showGalleryRef.current;
        console.log('Gallery swipe down - start should set:', shouldSet);
        return shouldSet;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only activate if gallery is shown and swiping down
        if (!showGalleryRef.current) {
          console.log('Gallery swipe down: Gallery not shown');
          return false;
        }
        
        const { dy } = gestureState;
        const isSwipeDown = dy > 10;
        
        console.log('Gallery swipe down check:', { dy, isSwipeDown, gallery: showGalleryRef.current });
        return isSwipeDown;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dy } = gestureState;
        const threshold = 50; // Swipe down at least 50px
        
        console.log('Gallery swipe down release:', { dy, threshold, gallery: showGalleryRef.current });
        
        if (dy > threshold && showGalleryRef.current) {
          console.log('Swipe-down detected - hiding gallery (returning to full camera)');
          
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
            setShowGallery(false);
          });
        }
      }
    })
  ).current;

  // Detect screen rotation and update dimensions
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      const newOrientation = window.width > window.height ? 'landscape' : 'portrait';
      console.log('Screen rotated - Width:', window.width, 'Height:', window.height, 'Orientation:', newOrientation);
      
      // Update dimensions immediately for instant response
      setDimensions({ width: window.width, height: window.height });
      setDeviceOrientation(newOrientation);
    });

    // Get specific orientation (landscape-left vs landscape-right)
    const getSpecificOrientation = async () => {
      const orientation = await ScreenOrientation.getOrientationAsync();
      console.log('Specific orientation value:', orientation);
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
      console.log('📱 Orientation changed to:', orientation, '-', orientationNames[orientation]);
      
      // Update immediately - native rotation is already smooth
      setSpecificOrientation(event.orientationInfo.orientation);
    });
    
    getSpecificOrientation();

    return () => {
      subscription?.remove();
      ScreenOrientation.removeOrientationChangeListener(orientationSubscription);
    };
  }, []);

  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

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

  // In after mode, camera view mode follows device orientation (no toggle available)
  useEffect(() => {
    if (mode === 'after') {
      setCameraViewMode(deviceOrientation);
    }
  }, [mode, deviceOrientation]);

  // Log when selectedBeforePhoto changes in after mode
  useEffect(() => {
    if (mode === 'after' && selectedBeforePhoto) {
      console.log('📸 Selected before photo changed:', {
        name: selectedBeforePhoto.name,
        orientation: selectedBeforePhoto.orientation,
        deviceOrientation,
        willShowWarning: selectedBeforePhoto.orientation !== deviceOrientation
      });
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

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture');
    } finally {
      setIsCapturing(false);
    }
  };

  // Helper function to add label to photo
  const addLabelToPhoto = async (uri, labelText) => {
    console.log('addLabelToPhoto called - showLabels:', showLabels, 'labelText:', labelText);
    if (!showLabels) {
      console.log('Labels disabled, returning original URI');
      return uri;
    }

    try {
      // Get image dimensions
      return new Promise((resolve) => {
        Image.getSize(uri, async (width, height) => {
          console.log('Image dimensions:', width, 'x', height);
          console.log('Setting temp photo state for label capture');
          setTempPhotoDimensions({ width, height });
          setTempPhotoUri(uri);
          setTempPhotoLabel(labelText);
          
          // Wait for next frame to ensure view is rendered
          setTimeout(async () => {
            try {
              console.log('Attempting to capture labeled view, ref exists:', !!labelViewRef.current);
              if (labelViewRef.current) {
                const capturedUri = await captureRef(labelViewRef, {
                  format: 'jpg',
                  quality: 0.95,
                  width,
                  height
                });
                console.log('Successfully captured labeled photo:', capturedUri);
                setTempPhotoUri(null);
                setTempPhotoLabel(null);
                setTempPhotoDimensions({ width: 1080, height: 1920 });
                resolve(capturedUri);
              } else {
                console.log('Label view ref not found, returning original URI');
                setTempPhotoUri(null);
                setTempPhotoLabel(null);
                setTempPhotoDimensions({ width: 1080, height: 1920 });
                resolve(uri);
              }
            } catch (error) {
              console.error('Error adding label to photo:', error);
              setTempPhotoUri(null);
              setTempPhotoLabel(null);
              setTempPhotoDimensions({ width: 1080, height: 1920 });
              resolve(uri);
            }
          }, 300);
        }, (error) => {
          console.error('Error getting image size:', error);
          resolve(uri);
        });
      });
    } catch (error) {
      console.error('Error in addLabelToPhoto:', error);
      return uri;
    }
  };

  const handleBeforePhoto = async (uri) => {
    try {
      // Generate photo name
      const roomPhotos = getBeforePhotos(room);
      const photoNumber = roomPhotos.length + 1;
      const photoName = `${room.charAt(0).toUpperCase() + room.slice(1)} ${photoNumber}`;

      // Add label if enabled
      const processedUri = await addLabelToPhoto(uri, 'BEFORE');

      // Save to device
      const savedUri = await savePhotoToDevice(processedUri, `${room}_${photoName}_BEFORE_${Date.now()}.jpg`);

      // Capture device orientation (actual phone orientation)
      const currentOrientation = deviceOrientation;
      console.log('Saving before photo with orientation:', currentOrientation, 'Device:', deviceOrientation, 'Camera view mode:', cameraViewMode);

      // Add to photos with device orientation
      const newPhoto = {
        id: Date.now(),
        uri: savedUri,
        room,
        mode: PHOTO_MODES.BEFORE,
        name: photoName,
        timestamp: Date.now(),
        aspectRatio: cameraViewMode === 'landscape' ? '4:3' : '2:3',
        orientation: currentOrientation
      };

      await addPhoto(newPhoto);

      // Update selectedBeforePhoto so thumbnail shows immediately
      setSelectedBeforePhoto(newPhoto);

      // Stay in before mode to allow taking more photos
      // User can close camera to see photos in home grid
    } catch (error) {
      console.error('Error saving before photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    }
  };

  const handleAfterPhoto = async (uri) => {
    try {
      // Use selectedBeforePhoto for split mode, or beforePhoto for overlay mode
      const activeBeforePhoto = getActiveBeforePhoto();

      if (!activeBeforePhoto) {
        Alert.alert('Error', 'Please select a before photo first');
        return;
      }

      const beforePhotoId = activeBeforePhoto.id;
      console.log('Taking after photo for:', activeBeforePhoto.name, 'ID:', beforePhotoId);

      // If replacing existing photos, delete them first
      if (existingAfterPhoto) {
        console.log('Deleting old after photo:', existingAfterPhoto.id);
        await deletePhoto(existingAfterPhoto.id);
      }
      if (existingCombinedPhoto) {
        console.log('Deleting old combined photo:', existingCombinedPhoto.id);
        await deletePhoto(existingCombinedPhoto.id);
      }

      // Add label if enabled
      const processedUri = await addLabelToPhoto(uri, 'AFTER');

      // Save to device
      const savedUri = await savePhotoToDevice(
        processedUri,
        `${activeBeforePhoto.room}_${activeBeforePhoto.name}_AFTER_${Date.now()}.jpg`
      );

      // Add after photo (use same aspect ratio and orientation as before photo)
      const newAfterPhoto = {
        id: Date.now(),
        uri: savedUri,
        room: activeBeforePhoto.room,
        mode: PHOTO_MODES.AFTER,
        name: activeBeforePhoto.name,
        timestamp: Date.now(),
        beforePhotoId: beforePhotoId,
        aspectRatio: activeBeforePhoto.aspectRatio || '4:3',
        orientation: activeBeforePhoto.orientation || deviceOrientation
      };

      console.log('Adding after photo with beforePhotoId:', beforePhotoId);
      await addPhoto(newAfterPhoto);

      // If we're replacing an existing combined photo, navigate to PhotoEditor to recreate it
      if (existingCombinedPhoto) {
        console.log('Navigating to PhotoEditor to recreate combined photo');
        navigation.navigate('PhotoEditor', {
          beforePhoto: activeBeforePhoto,
          afterPhoto: newAfterPhoto
        });
        return;
      }

      // Wait a moment for state to update
      setTimeout(() => {
        // Auto-advance to next unpaired photo
        const remainingUnpaired = getUnpairedBeforePhotos(activeBeforePhoto.room);
        console.log('Remaining unpaired photos:', remainingUnpaired.length);

        // Filter out the photo we just paired to ensure we don't count it
        const nextUnpaired = remainingUnpaired.filter(p => p.id !== beforePhotoId);
        console.log('Next unpaired after filtering:', nextUnpaired.length);

        if (nextUnpaired.length > 0) {
          // Select the next unpaired photo
          console.log('Moving to next photo:', nextUnpaired[0].name);
          setSelectedBeforePhoto(nextUnpaired[0]);
        } else {
          // All photos paired, go back to main grid
          Alert.alert(
            'All Photos Taken',
            'All after photos have been captured!',
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack()
              }
            ]
          );
        }
      }, 500);
    } catch (error) {
      console.error('Error saving after photo:', error);
      Alert.alert('Error', 'Failed to save photo');
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  // Render cropped image preview (shows only the area within aspect ratio bounds)
  const renderCroppedImage = (imageUri, showLabel = false, labelText = '') => {
    const containerWidth = width;
    const containerHeight = cameraMode === 'split' ? height / 2 : height;

    let frameWidth, frameHeight;

    // Always leave margin to show dimmed borders on all sides
    const MARGIN = 20;
    const maxWidth = containerWidth - (MARGIN * 2);
    const maxHeight = containerHeight - (MARGIN * 2);

    if (aspectRatio === '4:3') {
      const widthBasedHeight = (maxWidth / 4) * 3;
      const heightBasedWidth = (maxHeight / 3) * 4;

      if (widthBasedHeight <= maxHeight) {
        frameWidth = maxWidth;
        frameHeight = widthBasedHeight;
      } else {
        frameHeight = maxHeight;
        frameWidth = heightBasedWidth;
      }
    } else {
      const widthBasedHeight = (maxWidth / 2) * 3;
      const heightBasedWidth = (maxHeight / 3) * 2;

      if (widthBasedHeight <= maxHeight) {
        frameWidth = maxWidth;
        frameHeight = widthBasedHeight;
      } else {
        frameHeight = maxHeight;
        frameWidth = heightBasedWidth;
      }
    }

    const verticalOffset = (containerHeight - frameHeight) / 2;
    const horizontalOffset = (containerWidth - frameWidth) / 2;

    return (
      <View style={styles.croppedImageContainer}>
        {/* Background image (blurred/dimmed) */}
        <Image source={{ uri: imageUri }} style={styles.splitBeforeImage} resizeMode="cover" />

        {/* Dark overlay to dim the background */}
        <View style={styles.backgroundDim} />

        {/* Cropped view in the center */}
        <View style={[styles.croppedViewport, {
          width: frameWidth,
          height: frameHeight,
          top: verticalOffset,
          left: horizontalOffset
        }]}>
          <Image source={{ uri: imageUri }} style={styles.croppedImage} resizeMode="cover" />
        </View>

        {showLabel && <Text style={styles.splitPhotoLabel}>{labelText}</Text>}
      </View>
    );
  };

  // Render crop overlay to show aspect ratio bounds
  const renderCropOverlay = () => {
    // Calculate the crop frame dimensions based on aspect ratio
    // Phone is always in portrait orientation
    const containerWidth = width;
    const containerHeight = cameraMode === 'split' ? height / 2 : height;

    let frameWidth, frameHeight;

    // Always leave margin to show dimmed borders on all sides
    const MARGIN = 20; // Fixed margin in pixels
    const maxWidth = containerWidth - (MARGIN * 2);
    const maxHeight = containerHeight - (MARGIN * 2);

    if (aspectRatio === '4:3') {
      // 4:3 means width:height = 4:3 (more horizontal, wider rectangle)
      // Fit to the smaller constraint
      const widthBasedHeight = (maxWidth / 4) * 3;
      const heightBasedWidth = (maxHeight / 3) * 4;

      if (widthBasedHeight <= maxHeight) {
        // Width is the constraint
        frameWidth = maxWidth;
        frameHeight = widthBasedHeight;
      } else {
        // Height is the constraint
        frameHeight = maxHeight;
        frameWidth = heightBasedWidth;
      }
    } else {
      // 2:3 means width:height = 2:3 (more vertical, taller rectangle)
      // Fit to the smaller constraint
      const widthBasedHeight = (maxWidth / 2) * 3;
      const heightBasedWidth = (maxHeight / 3) * 2;

      if (widthBasedHeight <= maxHeight) {
        // Width is the constraint
        frameWidth = maxWidth;
        frameHeight = widthBasedHeight;
      } else {
        // Height is the constraint
        frameHeight = maxHeight;
        frameWidth = heightBasedWidth;
      }
    }

    // Center the frame with remaining space distributed evenly
    const verticalOffset = (containerHeight - frameHeight) / 2;
    const horizontalOffset = (containerWidth - frameWidth) / 2;

    return (
      <View style={styles.cropOverlayContainer} pointerEvents="none">
        {/* Top dark overlay - fills from top to frame, full width */}
        <View style={[styles.darkOverlay, {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: verticalOffset
        }]} />

        {/* Left dark overlay - only the middle section height */}
        <View style={[styles.darkOverlay, {
          position: 'absolute',
          top: verticalOffset,
          height: frameHeight,
          left: 0,
          width: horizontalOffset
        }]} />

        {/* Right dark overlay - only the middle section height */}
        <View style={[styles.darkOverlay, {
          position: 'absolute',
          top: verticalOffset,
          height: frameHeight,
          right: 0,
          width: horizontalOffset
        }]} />

        {/* Bottom dark overlay - fills from frame to bottom, full width */}
        <View style={[styles.darkOverlay, {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: verticalOffset
        }]} />

        {/* Frame area - clear center with border */}
        <View style={[styles.frameArea, {
          position: 'absolute',
          top: verticalOffset,
          left: horizontalOffset,
          width: frameWidth,
          height: frameHeight
        }]}>
          {/* Corner brackets */}
          <View style={[styles.frameCorner, styles.frameTopLeft]} />
          <View style={[styles.frameCorner, styles.frameTopRight]} />
          <View style={[styles.frameCorner, styles.frameBottomLeft]} />
          <View style={[styles.frameCorner, styles.frameBottomRight]} />
        </View>
      </View>
    );
  };

  // Render gallery of before photos for split mode
  const renderBeforeGallery = () => {
    if (mode === 'before') {
      // Show all before photos taken in this session
      const beforePhotos = getBeforePhotos(room);

      return (
        <View style={styles.galleryContainer}>
          <Text style={styles.galleryTitle}>Before Photos Taken ({beforePhotos.length})</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryContent}
          >
            {beforePhotos.length === 0 && (
              <Text style={styles.galleryEmptyText}>Take before photos using the button above</Text>
            )}
            {beforePhotos.map((photo) => (
              <View
                key={photo.id}
                style={styles.galleryItem}
              >
                <CroppedThumbnail imageUri={photo.uri} aspectRatio={photo.aspectRatio || '4:3'} orientation={photo.orientation || 'portrait'} size={120} />
                <Text style={styles.galleryItemName}>{photo.name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      );
    } else {
      // Show unpaired before photos for selection in after mode
      const unpairedPhotos = getUnpairedBeforePhotos(room);

      return (
        <View style={styles.galleryContainer}>
          <Text style={styles.galleryTitle}>
            {selectedBeforePhoto ? selectedBeforePhoto.name : 'Select Before Photo'}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.galleryContent}
          >
            {unpairedPhotos.length === 0 && (
              <Text style={styles.galleryEmptyText}>All before photos have been paired!</Text>
            )}
            {unpairedPhotos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={[
                  styles.galleryItem,
                  selectedBeforePhoto?.id === photo.id && styles.galleryItemSelected
                ]}
                onPress={() => setSelectedBeforePhoto(photo)}
              >
                <CroppedThumbnail imageUri={photo.uri} aspectRatio={photo.aspectRatio || '4:3'} orientation={photo.orientation || 'portrait'} size={120} />
                <Text style={styles.galleryItemName}>{photo.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }
  };

  // Get current room info
  const getCurrentRoomInfo = () => {
    return ROOMS.find(r => r.id === room) || ROOMS[0];
  };

  // Check if orientation matches for after mode
  const isOrientationMismatch = () => {
    if (mode !== 'after') return false;
    
    const activeBeforePhoto = getActiveBeforePhoto();
    if (!activeBeforePhoto) {
      console.log('🔍 No active before photo for orientation check');
      return false;
    }
    
    const beforeOrientation = activeBeforePhoto.orientation || 'portrait';
    // In after mode, device orientation must match before photo orientation
    const mismatch = beforeOrientation !== deviceOrientation;
    
    console.log('🔍 Orientation check:', {
      photoName: activeBeforePhoto.name,
      beforeOrientation,
      deviceOrientation,
      mismatch
    });
    
    return mismatch;
  };

  // Render overlay mode (current implementation)
  const renderOverlayMode = () => (
    <View 
      style={styles.container}
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
        {...cameraViewPanResponder.panHandlers}
      >
        {/* Swipe indicator */}
        <View style={styles.swipeIndicator}>
          <View style={styles.swipeHandle} />
        </View>

        {/* Orientation mismatch warning */}
        {(() => {
          const mismatch = isOrientationMismatch();
          console.log('⚠️ Rendering warning check:', { mismatch, showEnlargedGallery, mode });
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
            const showLetterbox = cameraViewMode === 'landscape' && deviceOrientation === 'portrait';
            console.log('Camera render - Letterbox check:', { cameraViewMode, deviceOrientation, showLetterbox });
            return showLetterbox;
          })() ? (
            <View style={styles.letterboxContainer}>
              {/* Top bar */}
              <View style={styles.letterboxBar} />
              
              {/* Camera in landscape aspect ratio */}
              <View style={styles.letterboxCamera}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        />
        
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

              {/* Bottom bar */}
              <View style={styles.letterboxBar} />
            </View>
          ) : (
            <>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={facing}
              />
              
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
            </>
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
            console.log('Close button pressed - going back');
            navigation.goBack();
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.bottomControls}>
          {/* Main control row */}
          <View style={styles.mainControlRow}>
            {/* Left side thumbnail - only show when gallery is NOT open */}
            {!showGallery && !showEnlargedGallery && (() => {
              const activePhoto = getActiveBeforePhoto();
              
              if (activePhoto) {
                const photoOrientation = activePhoto.orientation || 'portrait';
                console.log('Thumbnail - Photo orientation:', photoOrientation, 'Photo:', activePhoto.name, 'Room:', room);
                return (
              <TouchableOpacity
                    style={[
                      styles.thumbnailViewerContainer,
                      photoOrientation === 'landscape' ? styles.thumbnailLandscape : styles.thumbnailPortrait
                    ]}
                activeOpacity={1}
                onPress={handleDoubleTap}
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
                // Show empty placeholder matching current camera view mode
                return (
                  <View style={[
                    styles.thumbnailViewerContainer, 
                    cameraViewMode === 'landscape' ? styles.thumbnailLandscape : styles.thumbnailPortrait
                  ]} />
                );
              }
            })()}

            {/* Capture button - center */}
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

            {/* Right side button */}
            {mode === 'before' ? (
              /* Camera orientation toggle - only in before mode */
              <TouchableOpacity
                style={[
                  styles.orientationToggle,
                  cameraViewMode === 'landscape' ? styles.thumbnailLandscape : styles.thumbnailPortrait
                ]}
                onPress={() => {
                  const newMode = cameraViewMode === 'portrait' ? 'landscape' : 'portrait';
                  console.log('Toggling camera view mode:', newMode);
                  setCameraViewMode(newMode);
                }}
              >
                <View style={styles.orientationToggleIcon}>
                  <Text style={styles.orientationToggleText}>
                    {cameraViewMode === 'portrait' ? '📐' : '📱'}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              /* Save button - in after mode */
            <TouchableOpacity
              style={styles.saveButton}
                onPress={() => {
                  console.log('Save button pressed - going back');
                  navigation.goBack();
                }}
            >
              <Text style={styles.saveButtonText}>💾</Text>
              <Text style={styles.saveButtonLabel}>Save</Text>
            </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Gallery at bottom - shown when swiping up */}
      {showGallery && (
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
                contentOffset={{ x: galleryIndex * 112, y: 0 }}
                onMomentumScrollEnd={(event) => {
                  const offsetX = event.nativeEvent.contentOffset.x;
                  const index = Math.round(offsetX / 112);
                  console.log('Gallery scrolled to index:', index, 'Photo:', photos[index]?.name);
                  setGalleryIndex(index);
                  
                  // In after mode, auto-select the visible photo
                  if (mode === 'after' && photos[index]) {
                    setSelectedBeforePhoto(photos[index]);
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
                  <TouchableWithoutFeedback
                    onPressIn={() => {
                      // Track tap start time
                      tapStartTime.current = Date.now();
                      
                      // Start long press timer for full-screen
                      longPressGalleryTimer.current = setTimeout(() => {
                        console.log('Half-screen gallery - long press, showing full screen:', photo.name);
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
                        console.log('Half-screen gallery - releasing full screen');
                        setEnlargedGalleryPhoto(null);
                      }
                      // If it was a quick tap (< 300ms), open enlarged carousel
                      else if (pressDuration < 300) {
                        console.log('Half-screen gallery - quick tap, opening enlarged carousel:', photo.name);
                        setEnlargedGalleryIndex(index);
                        setShowEnlargedGallery(true);
                        
                        // In after mode, immediately select the tapped photo
                        if (mode === 'after') {
                          console.log('After mode - selecting photo immediately:', photo.name);
                          setSelectedBeforePhoto(photo);
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
                  </TouchableWithoutFeedback>
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
                height: dimensions.height * 0.4,
                transform: [{ translateY: enlargedGalleryTranslateY }]
              }
            ]}
            {...enlargedGalleryPanResponder.panHandlers}
          >
      <TouchableOpacity
              style={styles.enlargedGalleryCloseButton}
        onPress={() => {
                console.log('Closing enlarged gallery');
                setShowEnlargedGallery(false);
        }}
      >
              <Text style={styles.enlargedGalleryCloseText}>✕</Text>
      </TouchableOpacity>
            <ScrollView
              ref={enlargedGalleryScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentOffset={{ x: enlargedGalleryIndex * dimensions.width, y: 0 }}
              onMomentumScrollEnd={(event) => {
                const offsetX = event.nativeEvent.contentOffset.x;
                const index = Math.round(offsetX / dimensions.width);
                console.log('📸 Enlarged gallery scrolled to index:', index, 'Photo:', photos[index]?.name);
                setEnlargedGalleryIndex(index);
                
                // In after mode, auto-select the visible photo
                if (mode === 'after' && photos[index]) {
                  console.log('📸 Auto-selecting photo from scroll:', {
                    name: photos[index].name,
                    orientation: photos[index].orientation,
                    deviceOrientation
                  });
                  setSelectedBeforePhoto(photos[index]);
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
                      console.log('Long press - showing full screen:', photo.name);
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
                      console.log('Released - closing full screen');
                      setEnlargedGalleryPhoto(null);
                    } 
                    // If it was a quick tap (< 300ms) and in after mode, select the photo
                    else if (pressDuration < 300 && mode === 'after') {
                      console.log('Quick tap - selecting photo:', photo.name);
                      setSelectedBeforePhoto(photo);
                      setEnlargedGalleryIndex(index);
                    }
                    
                    tapStartTime.current = null;
                  }}
                >
                  <View style={[styles.enlargedGallerySlide, { width: dimensions.width }]}>
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.enlargedGalleryImage}
                      resizeMode="contain"
                    />
                  </View>
                </TouchableWithoutFeedback>
              ))}
            </ScrollView>
          </Animated.View>
        );
      })()}

      {/* Full-screen photo - shown when long-pressing in enlarged gallery */}
      {enlargedGalleryPhoto && (
        <View style={styles.fullScreenPhotoContainer}>
          <Image
            source={{ uri: enlargedGalleryPhoto.uri }}
            style={styles.fullScreenPhotoImage}
            resizeMode="contain"
          />
          <Text style={styles.fullScreenPhotoName}>{enlargedGalleryPhoto.name}</Text>
        </View>
      )}

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
                console.log('Carousel background tapped - closing');
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
                  console.log('Carousel close button pressed - closing carousel');
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

  // Render split screen mode
  const renderSplitMode = () => {
    if (mode === 'before') {
      // Before mode: Camera on top, Gallery on bottom (50/50 split)
      return (
        <View 
          style={styles.container}
          {...combinedPanResponder.panHandlers}
        >
          {/* Swipe down indicator */}
          <View style={styles.swipeIndicator}>
            <View style={styles.swipeHandle} />
          </View>

          {/* Room name indicator with mode */}
          <View style={styles.roomIndicator}>
            <Text style={styles.roomIndicatorIcon}>{getCurrentRoomInfo().icon}</Text>
            <View style={styles.roomIndicatorTextContainer}>
              <Text style={styles.roomIndicatorText}>{getCurrentRoomInfo().name}</Text>
              <Text style={styles.roomIndicatorMode}>{mode.toUpperCase()}</Text>
            </View>
          </View>

          {/* Orientation mismatch warning */}
          {isOrientationMismatch() && (
            <View style={styles.orientationWarning}>
              <Text style={styles.rotatePhoneIcon}>🔄</Text>
              <Text style={styles.orientationWarningText}>Wrong Orientation!</Text>
              <Text style={styles.orientationWarningHint}>
                Before photo was taken in {getActiveBeforePhoto()?.orientation || 'portrait'} mode. 
                {deviceOrientation === 'portrait' ? ' Tap the orientation button to switch.' : ' Please rotate your phone.'}
              </Text>
            </View>
          )}

          <View style={styles.splitContentWrapper}>
            <View style={styles.splitHalfContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={facing}
                zoom={zoom}
                enableZoomGesture={true}
              />
              {/* Aspect ratio cropping overlay */}
              {renderCropOverlay()}
            </View>

            <View style={styles.splitHalfContainer}>
              {renderBeforeGallery()}
            </View>
          </View>

          {/* Close button layer - separate from content */}
          <View style={styles.closeButtonLayer} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.closeButtonTopRight}
              onPress={() => {
                console.log('Close button pressed (split before) - going back');
                navigation.goBack();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Controls at bottom */}
          <View style={styles.splitBottomControls}>
            {/* Main control row */}
            <View style={styles.mainControlRow}>
              {/* Aspect ratio on left */}
              <View style={styles.aspectRatioContainer}>
                <TouchableOpacity
                  style={[styles.aspectRatioButton, aspectRatio === '4:3' && styles.aspectRatioButtonActive]}
                  onPress={() => setAspectRatio('4:3')}
                >
                  <Text style={[styles.aspectRatioText, aspectRatio === '4:3' && styles.aspectRatioTextActive]}>4:3</Text>
                  <Text style={styles.aspectRatioHint}>📐</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.aspectRatioButton, aspectRatio === '2:3' && styles.aspectRatioButtonActive]}
                  onPress={() => setAspectRatio('2:3')}
                >
                  <Text style={[styles.aspectRatioText, aspectRatio === '2:3' && styles.aspectRatioTextActive]}>2:3</Text>
                  <Text style={styles.aspectRatioHint}>📱</Text>
                </TouchableOpacity>
              </View>

              {/* Capture button in center */}
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

              {/* Save button on right */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  console.log('Save button pressed (split before) - going back');
                  navigation.goBack();
                }}
              >
                <Text style={styles.saveButtonText}>💾</Text>
                <Text style={styles.saveButtonLabel}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    } else {
      // After mode: Camera on top, Selected before photo on bottom (50/50 split)
      return (
        <View 
          style={styles.container}
          {...combinedPanResponder.panHandlers}
        >
          {/* Swipe down indicator */}
          <View style={styles.swipeIndicator}>
            <View style={styles.swipeHandle} />
          </View>

          {/* Room name indicator with mode */}
          <View style={styles.roomIndicator}>
            <Text style={styles.roomIndicatorIcon}>{getCurrentRoomInfo().icon}</Text>
            <View style={styles.roomIndicatorTextContainer}>
              <Text style={styles.roomIndicatorText}>{getCurrentRoomInfo().name}</Text>
              <Text style={styles.roomIndicatorMode}>{mode.toUpperCase()}</Text>
            </View>
          </View>

          {/* Orientation mismatch warning */}
          {isOrientationMismatch() && (
            <View style={styles.orientationWarning}>
              <Text style={styles.rotatePhoneIcon}>🔄</Text>
              <Text style={styles.orientationWarningText}>Wrong Orientation!</Text>
              <Text style={styles.orientationWarningHint}>
                Before photo was taken in {getActiveBeforePhoto()?.orientation || 'portrait'} mode. 
                {deviceOrientation === 'portrait' ? ' Tap the orientation button to switch.' : ' Please rotate your phone.'}
              </Text>
            </View>
          )}

          <View style={styles.splitContentWrapper}>
            <View style={styles.splitHalfContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing={facing}
                zoom={zoom}
                enableZoomGesture={true}
              />
              {/* Aspect ratio cropping overlay */}
              {renderCropOverlay()}
            </View>

            {selectedBeforePhoto && (
              <View style={styles.splitHalfContainer}>
                {renderCroppedImage(selectedBeforePhoto.uri, true, selectedBeforePhoto.name)}
              </View>
            )}
          </View>

          {/* Close button layer - separate from content */}
          <View style={styles.closeButtonLayer} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.closeButtonTopRight}
              onPress={() => {
                console.log('Close button pressed (split after) - going back');
                navigation.goBack();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Controls at bottom */}
          <View style={styles.splitBottomControls}>
            {/* Main control row */}
            <View style={styles.mainControlRow}>
              {/* Show locked aspect ratio (matching before photo) */}
              <View style={styles.aspectRatioContainer}>
                <View style={[styles.aspectRatioButton, styles.aspectRatioButtonLocked]}>
                  <Text style={[styles.aspectRatioText, styles.aspectRatioTextActive]}>{aspectRatio}</Text>
                  <Text style={styles.aspectRatioHint}>{aspectRatio === '4:3' ? '📐' : '📱'}</Text>
                  <Text style={styles.aspectRatioLockIcon}>🔒</Text>
                </View>
              </View>

              {/* Capture button in center */}
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

              {/* Save button on right */}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => {
                  console.log('Save button pressed (split after) - going back');
                  navigation.goBack();
                }}
              >
                <Text style={styles.saveButtonText}>💾</Text>
                <Text style={styles.saveButtonLabel}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }
  };

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
        <View style={styles.hiddenPhotoLabel}>
          <Text style={styles.hiddenPhotoLabelText}>{tempPhotoLabel}</Text>
        </View>
      </View>
    );
  };

  return (
    <>
      {cameraMode === 'split' ? renderSplitMode() : renderOverlayMode()}
      {renderLabelView()}
    </>
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
  swipeIndicator: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
    paddingVertical: 10
  },
  swipeHandle: {
    width: 60,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)'
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
    backgroundColor: '#000'
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
    paddingBottom: 10,
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
    alignItems: 'center',
    marginBottom: 20
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
  saveButton: {
    position: 'absolute',
    right: 10,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY
  },
  saveButtonText: {
    fontSize: 28,
    marginBottom: 2
  },
  saveButtonLabel: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    fontWeight: '600'
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
    position: 'absolute',
    left: 10,
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
  // Split mode styles
  splitContentWrapper: {
    flex: 1,
    flexDirection: 'column'
  },
  splitHalfContainer: {
    flex: 1,
    position: 'relative'
  },
  closeButtonLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000
  },
  galleryContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.PRIMARY,
    paddingVertical: 10
  },
  galleryContent: {
    paddingHorizontal: 10,
    gap: 10
  },
  galleryTitle: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    marginLeft: 10,
    textAlign: 'left'
  },
  splitBeforeImage: {
    width: '100%',
    height: '100%'
  },
  croppedImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000'
  },
  backgroundDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)'
  },
  croppedViewport: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY
  },
  croppedImage: {
    width: '100%',
    height: '100%'
  },
  thumbnailContainer: {
    position: 'relative',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden'
  },
  thumbnailBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000'
  },
  thumbnailCropped: {
    position: 'absolute',
    overflow: 'hidden'
  },
  thumbnailImage: {
    width: '100%',
    height: '100%'
  },
  splitPhotoLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    color: COLORS.TEXT,
    fontSize: 14,
    fontWeight: 'bold'
  },
  splitBottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.7)'
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
  letterboxBar: {
    width: '100%',
    backgroundColor: '#000',
    flex: 1
  },
  letterboxCamera: {
    width: '100%',
    aspectRatio: 4 / 3, // Landscape 4:3 aspect ratio
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
  hiddenPhotoLabel: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12
  },
  hiddenPhotoLabelText: {
    color: COLORS.TEXT,
    fontSize: 24,
    fontWeight: 'bold'
  }
});
