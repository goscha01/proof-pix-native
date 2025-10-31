import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { useAdmin } from '../context/AdminContext';
import { COLORS } from '../constants/rooms';
import { LOCATIONS, getLocationConfig } from '../config/locations';
import RoomEditor from '../components/RoomEditor';
import googleDriveService from '../services/googleDriveService';
import googleScriptService from '../services/googleScriptService';
import InviteManager from '../components/InviteManager';
import { generateInviteToken } from '../utils/tokens';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

export default function SettingsScreen({ navigation }) {
  const {
    showLabels,
    toggleLabels,
    userName,
    location,
    updateUserInfo,
    isBusiness,
    toggleBusiness,
    useFolderStructure,
    toggleUseFolderStructure,
    enabledFolders,
    updateEnabledFolders,
    resetUserData,
    customRooms,
    saveCustomRooms,
    getRooms,
    resetCustomRooms
  } = useSettings();

  const {
    isAuthenticated,
    userInfo: adminUserInfo,
    signIn,
    signOut,
    isSetupComplete,
    folderId: adminFolderId,
    scriptUrl: adminScriptUrl,
    scriptId: adminScriptId,
    userMode,
    saveFolderId,
    saveScriptInfo,
    addInviteToken,
    removeInviteToken,
    adminSignIn,
    individualSignIn,
    isGoogleSignInAvailable,
  } = useAdmin();

  const [name, setName] = useState(userName);
  const [selectedLocation, setSelectedLocation] = useState(location);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showRoomEditor, setShowRoomEditor] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const runAdminSetup = useCallback(async () => {
    if (isAuthenticated && userMode === 'admin' && !isSetupComplete() && !isSigningIn) {
      try {
        console.log('Running automatic admin setup...');
        setIsSigningIn(true); // Show a loading indicator

        // Step 1: Find or create the Google Drive folder
        const folderId = await googleDriveService.findOrCreateProofPixFolder();
        await saveFolderId(folderId);
        console.log('Admin folder ID saved:', folderId);

        // Step 2: Create and deploy the Google Apps Script
        const { scriptId, scriptUrl } = await googleScriptService.createAndDeployScript(folderId);
        await saveScriptInfo(scriptUrl, scriptId);
        console.log('Admin script deployed:', { scriptId, scriptUrl });

        Alert.alert('Setup Complete', 'Your admin account is now fully configured.');

      } catch (error) {
         // The error is already handled by the signIn function's alert
         console.error('Auto-setup failed:', error.message);
         if (error.message && error.message.includes("User has not enabled the Apps Script API")) {
          const settingsUrl = 'https://script.google.com/home/usersettings';
          const userEmail = adminUserInfo?.email;
          // Construct a URL that forces the Google Account Chooser
          const finalUrl = userEmail
            ? `https://accounts.google.com/AccountChooser?Email=${userEmail}&continue=${encodeURIComponent(settingsUrl)}`
            : settingsUrl;

          Alert.alert(
            'Setup Required for ' + userEmail,
            'Google requires you to manually enable the Apps Script API for this account. Tap "Open Settings" and confirm you are enabling it for the correct user.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openURL(finalUrl),
                style: 'default',
              },
            ]
          );
        }
      } finally {
        setIsSigningIn(false);
      }
    }
  }, [isAuthenticated, userMode, isSetupComplete, saveFolderId, saveScriptInfo, adminUserInfo, isSigningIn]);

  useFocusEffect(
    useCallback(() => {
      runAdminSetup();
    }, [runAdminSetup])
  );


  const handleSaveUserInfo = async () => {
    await updateUserInfo(name, selectedLocation);
  };

  const handleLocationSelect = (locationId) => {
    setSelectedLocation(locationId);
    setShowLocationPicker(false);
    updateUserInfo(name, locationId);
  };

  const handleResetUserData = () => {
    Alert.alert(
      'Reset User Data',
      'This will clear your name and location settings. You will be taken to the setup screen to configure them again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetUserData();
            navigation.reset({
              index: 0,
              routes: [{ name: 'FirstLoad' }],
            });
          }
        }
      ]
    );
  };

  const handleIndividualSignIn = async () => {
    setIsSigningIn(true);
    try {
      await individualSignIn();
    } catch (error) {
      console.error("Error during individual sign in:", error);
    } finally {
      setIsSigningIn(false);
    }
    // The useFocusEffect will handle running the setup automatically.
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await adminSignIn();
    } catch (error) {
      console.error("Error during admin sign in:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'This will sign you out and clear all admin setup data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            const result = await signOut();
            if (result.success) {
              Alert.alert('Success', 'Signed out successfully');
            } else {
              Alert.alert('Error', result.error || 'Failed to sign out');
            }
          }
        }
      ]
    );
  };

  const selectedLocationObj = LOCATIONS.find(loc => loc.id === selectedLocation) || LOCATIONS[0];
  const config = getLocationConfig(selectedLocation);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Admin Setup Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cloud & Team Sync</Text>
          
          {isSigningIn ? (
             <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.loadingText}>Connecting to Google...</Text>
             </View>
          ) : !isAuthenticated ? (
            <>
              <Text style={styles.sectionDescription}>
                Sign in to sync your photos to the cloud and enable team features.
              </Text>
              {!isGoogleSignInAvailable && (
                <View style={styles.expoGoWarning}>
                  <Text style={styles.expoGoWarningText}>
                    ⚠️ Google Sign-in requires a development build and is not available in Expo Go.
                  </Text>
                  <Text style={styles.expoGoWarningSubtext}>
                    Run: npx expo install expo-dev-client && eas build --profile development
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.signInButton,
                  !isGoogleSignInAvailable && styles.buttonDisabled
                ]}
                onPress={handleIndividualSignIn}
                disabled={!isGoogleSignInAvailable}
              >
                <Text style={[
                  styles.signInButtonText,
                  !isGoogleSignInAvailable && styles.buttonTextDisabled
                ]}>
                  Use for Individual Work
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.googleSignInButton,
                  !isGoogleSignInAvailable && styles.buttonDisabled
                ]}
                onPress={handleGoogleSignIn}
                disabled={!isGoogleSignInAvailable}
              >
                <Text style={[
                  styles.googleSignInButtonText,
                  !isGoogleSignInAvailable && styles.buttonTextDisabled
                ]}>
                  Set Up a Team (Admin)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.joinTeamButton}
                onPress={() => navigation.navigate('JoinTeam')}
              >
                <Text style={styles.joinTeamButtonText}>
                  Join an Existing Team
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.adminInfoBox}>
                <Text style={styles.adminInfoLabel}>Signed in as:</Text>
                <Text style={styles.adminInfoValue}>
                  {adminUserInfo?.name || 'Unknown Name'}
                </Text>
                <Text style={styles.adminInfoEmail}>
                  {adminUserInfo?.email || 'Unknown Email'}
                </Text>
              </View>

              {userMode === 'admin' && !isSetupComplete() && (
                 <Text style={styles.setupIncompleteText}>
                    Admin setup in progress... This may take a moment.
                 </Text>
              )}

              {userMode === 'admin' && isSetupComplete() && (
                <InviteManager />
              )}

              <TouchableOpacity
                style={styles.signOutButton}
                onPress={handleSignOut}
              >
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Local Settings Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Settings</Text>
          <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Show Labels</Text>
                  <Text style={styles.settingDescription}>
                    Display "BEFORE" and "AFTER" labels on all photos
                  </Text>
                </View>
                <Switch
                  value={showLabels}
                  onValueChange={toggleLabels}
                  trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                  thumbColor="white"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Business</Text>
                  <Text style={styles.settingDescription}>
                    Enable business mode features
                  </Text>
                </View>
                <Switch
                  value={isBusiness}
                  onValueChange={toggleBusiness}
                  trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                  thumbColor="white"
                />
              </View>
            </View>

            {/* Room Customization */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Folder Customization</Text>
              <Text style={styles.sectionDescription}>
                Customize the names and icons of folders in your app
              </Text>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Custom Folders</Text>
                  <Text style={styles.settingDescription}>
                    {customRooms ? `${customRooms.length} custom folders` : 'Using default folders'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.customizeButton}
                  onPress={() => {

                    setShowRoomEditor(true);
                  }}
                >
                  <Text style={styles.customizeButtonText}>Customize</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Upload Structure */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upload Structure</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Use folder structure</Text>
                  <Text style={styles.settingDescription}>
                    If off, all photos go into the project folder
                  </Text>
                </View>
                <Switch
                  value={useFolderStructure}
                  onValueChange={toggleUseFolderStructure}
                  trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                  thumbColor="white"
                />
              </View>

              {useFolderStructure && (
                <>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Before folder</Text>
                      <Text style={styles.settingDescription}>Uploads to "before" subfolder</Text>
                    </View>
                    <Switch
                      value={enabledFolders.before}
                      onValueChange={(v) => updateEnabledFolders({ before: v })}
                      trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                      thumbColor="white"
                    />
                  </View>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>After folder</Text>
                      <Text style={styles.settingDescription}>Uploads to "after" subfolder</Text>
                    </View>
                    <Switch
                      value={enabledFolders.after}
                      onValueChange={(v) => updateEnabledFolders({ after: v })}
                      trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                      thumbColor="white"
                    />
                  </View>
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Combined folder</Text>
                      <Text style={styles.settingDescription}>Uploads to "combined"/formats subfolders</Text>
                    </View>
                    <Switch
                      value={enabledFolders.combined}
                      onValueChange={(v) => updateEnabledFolders({ combined: v })}
                      trackColor={{ false: COLORS.BORDER, true: COLORS.PRIMARY }}
                      thumbColor="white"
                    />
                  </View>
                </>
              )}
            </View>

            {/* Google Drive Configuration (Read-only) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Google Drive Configuration</Text>
              <Text style={styles.sectionDescription}>
                Automatically configured based on selected location
              </Text>

              <View style={styles.configRow}>
                <Text style={styles.configLabel}>Script URL:</Text>
                <Text style={styles.configValue} numberOfLines={1}>
                  {config.scriptUrl ? '✓ Configured' : '✗ Not configured'}
                </Text>
              </View>

              <View style={styles.configRow}>
                <Text style={styles.configLabel}>Folder ID:</Text>
                <Text style={styles.configValue} numberOfLines={1}>
                  {config.folderId ? '✓ Configured' : '✗ Not configured'}
                </Text>
              </View>

              {(!config.scriptUrl || !config.folderId) && (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    ⚠️ Configuration missing for {selectedLocationObj.name}. Please check environment variables.
                  </Text>
                </View>
              )}
            </View>

            {/* User Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>User Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cleaner Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.GRAY}
                  onBlur={handleSaveUserInfo}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Location</Text>
                <TouchableOpacity
                  style={styles.locationPicker}
                  onPress={() => setShowLocationPicker(!showLocationPicker)}
                >
                  <Text style={styles.locationPickerText}>
                    {selectedLocationObj.name}
                  </Text>
                  <Text style={styles.locationPickerArrow}>▼</Text>
                </TouchableOpacity>

                {showLocationPicker && (
                  <View style={styles.locationDropdown}>
                    {LOCATIONS.map((loc) => (
                      <TouchableOpacity
                        key={loc.id}
                        style={[
                          styles.locationOption,
                          selectedLocation === loc.id && styles.locationOptionSelected
                        ]}
                        onPress={() => handleLocationSelect(loc.id)}
                      >
                        <Text style={[
                          styles.locationOptionText,
                          selectedLocation === loc.id && styles.locationOptionTextSelected
                        ]}>
                          {loc.name}
                        </Text>
                        {selectedLocation === loc.id && (
                          <Text style={styles.locationOptionCheck}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetUserData}
              >
                <Text style={styles.resetButtonText}>Reset User Data</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <RoomEditor
            visible={showRoomEditor}
            onClose={() => setShowRoomEditor(false)}
            onSave={(rooms) => {
              saveCustomRooms(rooms);
              // Force a small delay to ensure state updates propagate
              setTimeout(() => {
              }, 100);
            }}
            initialRooms={customRooms}
          />
        </SafeAreaView>
      );
    }

    const styles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: COLORS.BACKGROUND
      },
      header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 10,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.BORDER
      },
      backButton: {
        width: 60
      },
      backButtonText: {
        color: COLORS.PRIMARY,
        fontSize: 18
      },
      title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.TEXT
      },
      content: {
        flex: 1
      },
      section: {
        backgroundColor: 'white',
        marginTop: 20,
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.BORDER
      },
      sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.TEXT,
        marginBottom: 16
      },
      inputGroup: {
        marginBottom: 16
      },
      label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.TEXT,
        marginBottom: 8
      },
      input: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        padding: 12,
        borderRadius: 8,
        color: COLORS.TEXT
      },
      locationPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        padding: 12,
        borderRadius: 8
      },
      locationPickerText: {
        color: COLORS.TEXT,
        fontWeight: '600'
      },
      locationPickerArrow: {
        color: COLORS.GRAY
      },
      locationDropdown: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        borderRadius: 8,
        overflow: 'hidden'
      },
      locationOption: {
        padding: 12,
        backgroundColor: 'white'
      },
      locationOptionSelected: {
        backgroundColor: '#f7f7f7'
      },
      locationOptionText: {
        color: COLORS.TEXT
      },
      locationOptionTextSelected: {
        fontWeight: '700'
      },
      locationOptionCheck: {
        position: 'absolute',
        right: 12,
        top: 12,
        color: COLORS.PRIMARY
      },
      sectionDescription: {
        color: COLORS.GRAY,
        marginBottom: 12
      },
      configRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8
      },
      configLabel: {
        color: COLORS.GRAY
      },
      configValue: {
        color: COLORS.TEXT,
        maxWidth: '70%'
      },
      warningBox: {
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FFF8E1'
      },
      warningText: {
        color: '#8A6D3B'
      },
      settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12
      },
      settingInfo: {
        flex: 1,
        paddingRight: 16
      },
      settingLabel: {
        color: COLORS.TEXT,
        fontWeight: '600'
      },
      settingDescription: {
        color: COLORS.GRAY,
        fontSize: 12
      },
      resetButton: {
        backgroundColor: '#FFE6E6',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginTop: 8
      },
      resetButtonText: {
        color: '#CC0000',
        fontSize: 16,
        fontWeight: '600'
      },
      customizeButton: {
        backgroundColor: COLORS.PRIMARY,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8
      },
      customizeButtonText: {
        color: COLORS.TEXT,
        fontWeight: '600',
        fontSize: 14
      },
      googleSignInButton: {
        backgroundColor: '#4285F4',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginBottom: 8
      },
      googleSignInButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600'
      },
      joinTeamButton: {
        backgroundColor: '#28a745',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginTop: 8
      },
      joinTeamButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600'
      },
      buttonDisabled: {
        backgroundColor: '#cccccc',
        opacity: 0.6
      },
      buttonTextDisabled: {
        color: '#666666'
      },
      expoGoWarning: {
        backgroundColor: '#fff3cd',
        borderWidth: 1,
        borderColor: '#ffc107',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16
      },
      expoGoWarningText: {
        color: '#856404',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8
      },
      expoGoWarningSubtext: {
        color: '#856404',
        fontSize: 12,
        fontFamily: 'monospace'
      },
      adminNote: {
        color: COLORS.GRAY,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8
      },
      adminInfoBox: {
        backgroundColor: '#F0F8FF',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12
      },
      adminInfoLabel: {
        color: COLORS.GRAY,
        fontSize: 12,
        marginBottom: 4
      },
      adminInfoValue: {
        color: COLORS.TEXT,
        fontSize: 14,
        fontWeight: '600'
      },
      adminInfoEmail: {
        color: COLORS.GRAY,
        fontSize: 12,
      },
      setupStatusBox: {
        backgroundColor: '#E8F5E9',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12
      },
      setupStatusText: {
        color: '#2E7D32',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8
      },
      setupDetailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4
      },
      setupDetailLabel: {
        color: COLORS.GRAY,
        fontSize: 12
      },
      setupDetailValue: {
        color: COLORS.TEXT,
        fontSize: 12,
        maxWidth: '60%'
      },
      signOutButton: {
        backgroundColor: '#FFE6E6',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center'
      },
      signOutButtonText: {
        color: '#CC0000',
        fontSize: 14,
        fontWeight: '600'
      },
      signInButton: {
        backgroundColor: '#34A853',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginBottom: 12,
      },
      signInButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
      },
      loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: COLORS.BACKGROUND,
      },
      loadingText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.TEXT,
        marginTop: 10,
      },
      loadingSubText: {
        fontSize: 14,
        color: COLORS.GRAY,
        marginTop: 5,
        textAlign: 'center',
      },
      infoText: {
        fontSize: 16,
        color: COLORS.GRAY,
        textAlign: 'center',
        marginBottom: 20,
      },
      setupIncompleteText: {
        color: COLORS.GRAY,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
      },
    });
