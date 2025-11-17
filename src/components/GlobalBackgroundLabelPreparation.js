/**
 * Global component for background label preparation
 * This component stays mounted at the app root level, independent of navigation
 * It handles all background label preparation tasks using react-native-view-shot
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Modal, Image, Dimensions } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system';
import backgroundLabelPreparationService from '../services/backgroundLabelPreparationService';
import { saveCachedLabeledPhoto } from '../services/labelCacheService';
import PhotoLabel from './PhotoLabel';
import { PHOTO_MODES } from '../constants/rooms';
import { useSettings } from '../context/SettingsContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GlobalBackgroundLabelPreparation() {
  const [preparingPhoto, setPreparingPhoto] = useState(null);
  const labelCaptureRef = useRef(null);
  const combinedCaptureRef = useRef(null);
  const { showLabels } = useSettings();

  useEffect(() => {
    // Subscribe to preparation service updates
    const unsubscribe = backgroundLabelPreparationService.subscribe((state) => {
      // When new preparations are queued, process them if we're not already processing
      setPreparingPhoto((current) => {
        if (current) return current; // Already processing one
        
        const pending = state.pendingPreparations;
        if (pending.length > 0) {
          const next = pending[0];
          console.log(`[GLOBAL_BG_PREP] Starting preparation for ${next.key}`);
          return next;
        }
        return null;
      });
    });

    // Check for pending preparations on mount
    const state = backgroundLabelPreparationService.getState();
    const pending = state.pendingPreparations;
    if (pending.length > 0) {
      const next = pending[0];
      console.log(`[GLOBAL_BG_PREP] Found pending preparation on mount: ${next.key}`);
      setPreparingPhoto(next);
    }

    return unsubscribe;
  }, []); // Empty deps - only run on mount/unmount

  // When preparingPhoto becomes null (after completion), process next
  useEffect(() => {
    if (!preparingPhoto) {
      // Current preparation completed, check for next
      const state = backgroundLabelPreparationService.getState();
      const pending = state.pendingPreparations;
      if (pending.length > 0) {
        const next = pending[0];
        console.log(`[GLOBAL_BG_PREP] Processing next preparation: ${next.key}`);
        setPreparingPhoto(next);
      }
    }
  }, [preparingPhoto]);

  // Effect to handle photo capture when preparingPhoto changes
  useEffect(() => {
    if (!preparingPhoto) return;

    const { photo, width, height, labelPosition, settingsHash, mode, beforePhoto, afterPhoto, isCombined, isLetterbox } = preparingPhoto;
    let timeoutId;

    console.log(`[GLOBAL_BG_PREP] Setting up capture for ${preparingPhoto.key}, mode: ${mode}, isCombined: ${isCombined}`);

    // Wait for view to render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        timeoutId = setTimeout(async () => {
          try {
            const ref = isCombined ? combinedCaptureRef : labelCaptureRef;
            
            if (!ref.current) {
              console.log(`[GLOBAL_BG_PREP] Ref not ready for ${preparingPhoto.key}, retrying...`);
              setTimeout(async () => {
                if (!ref.current) {
                  console.error(`[GLOBAL_BG_PREP] Ref still not ready for ${preparingPhoto.key}, skipping`);
                  backgroundLabelPreparationService.removePreparation(preparingPhoto.key);
                  setPreparingPhoto(null);
                  return;
                }
                await captureAndSave();
              }, 500);
              return;
            }

            await captureAndSave();
          } catch (error) {
            console.error(`[GLOBAL_BG_PREP] Error preparing ${preparingPhoto.key}:`, error);
            backgroundLabelPreparationService.removePreparation(preparingPhoto.key);
            setPreparingPhoto(null);
          }
        }, 800);
      });
    });

    const captureAndSave = async () => {
      try {
        const ref = isCombined ? combinedCaptureRef : labelCaptureRef;
        console.log(`[GLOBAL_BG_PREP] Capturing ${preparingPhoto.key}...`);
        
        const capturedUri = await captureRef(ref, {
          format: 'jpg',
          quality: 0.95
        });

        // Save to cache
        const cachedUri = await saveCachedLabeledPhoto(photo, capturedUri, settingsHash);
        if (cachedUri) {
          console.log(`[GLOBAL_BG_PREP] ✅ Successfully cached ${preparingPhoto.key}: ${cachedUri}`);
        } else {
          console.log(`[GLOBAL_BG_PREP] ⚠️ Failed to save ${preparingPhoto.key} to cache`);
        }

        // Resolve promise if provided
        if (preparingPhoto.resolve) {
          preparingPhoto.resolve(cachedUri || capturedUri);
        }

        // Remove from queue and move to next
        backgroundLabelPreparationService.removePreparation(preparingPhoto.key);
        setPreparingPhoto(null);
      } catch (error) {
        console.error(`[GLOBAL_BG_PREP] Error in captureAndSave for ${preparingPhoto.key}:`, error);
        if (preparingPhoto.reject) {
          preparingPhoto.reject(error);
        }
        backgroundLabelPreparationService.removePreparation(preparingPhoto.key);
        setPreparingPhoto(null);
      }
    };

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [preparingPhoto]);

  // Render hidden modals for capture
  return (
    <>
      {/* Single photo preparation */}
      {preparingPhoto && !preparingPhoto.isCombined && (
        <Modal
          visible={true}
          transparent={true}
          animationType="none"
          onRequestClose={() => {}}
        >
          <View style={{ 
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'transparent',
            opacity: 0,
            position: 'absolute',
            left: SCREEN_WIDTH + 1000, // Off-screen but still rendered
            top: 0,
          }}>
            <View
              ref={labelCaptureRef}
              collapsable={false}
              style={{
                width: Math.min(preparingPhoto.width, SCREEN_WIDTH),
                height: Math.min(preparingPhoto.height, SCREEN_WIDTH * (preparingPhoto.height / preparingPhoto.width)),
                backgroundColor: 'white',
                overflow: 'hidden',
              }}
            >
              <Image
                source={{ uri: preparingPhoto.photo.uri }}
                style={{
                  width: '100%',
                  height: '100%'
                }}
                resizeMode="cover"
              />
              {showLabels && preparingPhoto.photo.mode && (
                <PhotoLabel
                  label={preparingPhoto.photo.mode === PHOTO_MODES.BEFORE ? 'common.before' : 'common.after'}
                  position={preparingPhoto.labelPosition}
                />
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Combined photo preparation */}
      {preparingPhoto && preparingPhoto.isCombined && (
        <Modal
          visible={true}
          transparent={true}
          animationType="none"
          onRequestClose={() => {}}
        >
          <View style={{ 
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'transparent',
            opacity: 0,
            position: 'absolute',
            left: SCREEN_WIDTH + 1000, // Off-screen but still rendered
            top: 0,
          }}>
            <View
              ref={combinedCaptureRef}
              collapsable={false}
              style={{
                width: Math.min(preparingPhoto.width, SCREEN_WIDTH),
                height: Math.min(preparingPhoto.height, SCREEN_WIDTH * (preparingPhoto.height / preparingPhoto.width)),
                backgroundColor: 'white',
                overflow: 'hidden',
                flexDirection: preparingPhoto.isLetterbox ? 'column' : 'row',
              }}
            >
              {/* Before photo */}
              <View style={{ flex: 1 }}>
                <Image
                  source={{ uri: preparingPhoto.beforePhoto.uri }}
                  style={{
                    width: '100%',
                    height: '100%'
                  }}
                  resizeMode="cover"
                />
                {showLabels && (
                  <PhotoLabel
                    label="common.before"
                    position={preparingPhoto.beforeLabelPosition || 'top-left'}
                  />
                )}
              </View>
              {/* After photo */}
              <View style={{ flex: 1 }}>
                <Image
                  source={{ uri: preparingPhoto.afterPhoto.uri }}
                  style={{
                    width: '100%',
                    height: '100%'
                  }}
                  resizeMode="cover"
                />
                {showLabels && (
                  <PhotoLabel
                    label="common.after"
                    position={preparingPhoto.afterLabelPosition || 'top-right'}
                  />
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

