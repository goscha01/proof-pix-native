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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { useAdmin } from '../context/AdminContext';
import { COLORS } from '../constants/rooms';
import RoomEditor from '../components/RoomEditor';
import googleDriveService from '../services/googleDriveService';
import InviteManager from '../components/InviteManager';
import { generateInviteToken } from '../utils/tokens';
import { useNavigation } from '@react-navigation/native';
import proxyService from '../services/proxyService';

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
    resetCustomRooms,
    userPlan,
    updateUserPlan
  } = useSettings();
  
  const [showPlanSelection, setShowPlanSelection] = useState(false);

  const {
    isAuthenticated,
    userInfo: adminUserInfo,
    signIn,
    signOut,
    signOutFromTeam,
    isSetupComplete,
    folderId: adminFolderId,
    proxySessionId,
    userMode,
    teamInfo,
    saveFolderId,
    addInviteToken,
    removeInviteToken,
    adminSignIn,
    individualSignIn,
    isGoogleSignInAvailable,
    initializeProxySession,
    teamName,
    updateTeamName,
    switchToIndividualMode,
    disconnectAllAccounts,
    connectedAccounts,
    removeConnectedAccount,
  } = useAdmin();
  const isEnterprisePlan = userPlan === 'enterprise';
  const activeEnterpriseAccount = isEnterprisePlan
    ? connectedAccounts?.find((account) => account.isActive)
    : null;
  const otherEnterpriseAccounts = isEnterprisePlan
    ? (connectedAccounts || []).filter((account) => !account.isActive)
    : [];
  const displayedActiveAccount = activeEnterpriseAccount || adminUserInfo;

  const [name, setName] = useState(userName);
  
  // Update name when userName changes (e.g., when switching back from team mode)
  useEffect(() => {
    setName(userName);
  }, [userName]);
  const [showRoomEditor, setShowRoomEditor] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [adminInfo, setAdminInfo] = useState(null);
  const [loadingAdminInfo, setLoadingAdminInfo] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState('');

  const handleSetupTeam = async () => {
    if (!isAuthenticated || userMode !== 'admin' || isSigningIn) {
      return;
    }

    // Check if already set up - only consider it connected if folderId is also saved (admin setup)
    if (isSetupComplete()) {
      Alert.alert('Already Connected', 'Your team is already connected. You can manage invites below.');
      return;
    }

    try {
      console.log('[SETUP] Running team setup with proxy server...');
      setIsSigningIn(true); // Show a loading indicator

      // Step 1: Find or create the Google Drive folder
      // Note: makeAuthenticatedRequest will handle checking if user is signed in
      const folderId = await googleDriveService.findOrCreateProofPixFolder();
      await saveFolderId(folderId);
      console.log('[SETUP] Admin folder ID saved:', folderId);

      // Step 2: Initialize proxy session (this creates the session and stores refresh token)
      const sessionResult = await initializeProxySession(folderId);
      if (!sessionResult || !sessionResult.sessionId) {
        throw new Error('Failed to initialize proxy session');
      }
      console.log('[SETUP] Proxy session initialized:', sessionResult.sessionId);

      // Step 3: Set default team name to Google profile name if not already set
      if (!teamName && adminUserInfo?.name) {
        await updateTeamName(adminUserInfo.name);
        console.log('[SETUP] Default team name set to:', adminUserInfo.name);
      }

      Alert.alert(
        'Team Connected!', 
        'Your team is now connected. You can now generate invite links for your team members.'
      );

    } catch (error) {
      console.error('[SETUP] Setup failed:', error.message);
      Alert.alert(
        'Setup Failed',
        error.message || 'Failed to connect team. Please try again.',
        [{ text: 'OK', style: 'cancel' }]
      );
    } finally {
      setIsSigningIn(false);
    }
  };


  const handleSaveUserInfo = async () => {
    await updateUserInfo(name, location);
  };

  const handleResetUserData = () => {
    Alert.alert(
      'Reset User Data',
      'This will clear your name settings. You will be taken to the setup screen to configure them again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectAllAccounts();
            } catch (error) {
              console.warn('[SETTINGS] Failed to disconnect accounts during reset:', error?.message || error);
            }

            try {
              await resetUserData();
            } finally {
              navigation.reset({
                index: 0,
                routes: [{ name: 'FirstLoad' }],
              });
            }
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
  };

  const handleActivateConnectedAccount = (account) => {
    if (!account || account.isActive) {
      return;
    }

    if (!isGoogleSignInAvailable) {
      Alert.alert(
        'Unavailable',
        'Google Sign-In is not available in this build. Please use a development build.'
      );
      return;
    }

    Alert.alert(
      'Switch Google Account',
      `Switch active account to ${account.email}? You will be prompted to sign in again with this account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setIsSigningIn(true);
            try {
              await adminSignIn();
            } catch (error) {
              console.error('[SETTINGS] Error switching connected account:', error);
              Alert.alert('Error', 'Failed to switch accounts. Please try again.');
            } finally {
              setIsSigningIn(false);
            }
          },
        },
      ]
    );
  };

  const handleRemoveConnectedAccount = (account) => {
    if (!account) {
      return;
    }

    if (account.isActive) {
      Alert.alert(
        'Account Active',
        'Switch to another account before removing this one.'
      );
      return;
    }

    Alert.alert(
      'Remove Google Account',
      `Remove ${account.email} from your connected accounts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeConnectedAccount(account.id);
            } catch (error) {
              console.error('[SETTINGS] Failed to remove connected account:', error);
              Alert.alert('Error', 'Failed to remove account. Please try again.');
            }
          },
        },
      ]
    );
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


  const handleSignOut = async () => {
    // For Business/Enterprise users in admin mode with team setup, sign out from team only
    // This keeps Google authentication but clears team setup, showing "Set Up Team" button again
    if (userMode === 'admin' && isSetupComplete() && (userPlan === 'business' || userPlan === 'enterprise')) {
      Alert.alert(
        'Disconnect Team',
        'This will disconnect your team setup but keep you signed in to Google. You can set up your team again later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              const result = await signOutFromTeam();
              if (result.success) {
                Alert.alert('Success', 'Team disconnected successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to disconnect team');
              }
            }
          }
        ]
      );
    } else {
      // For all other cases, do full sign out
      await signOut();
    }
  };

  // Fetch admin info for team members
  useEffect(() => {
    const fetchAdminInfo = async () => {
      if (userMode === 'team_member' && teamInfo?.sessionId) {
        setLoadingAdminInfo(true);
        try {
          console.log('[SETTINGS] Fetching admin info for session:', teamInfo.sessionId);
          const sessionInfo = await proxyService.getSessionInfo(teamInfo.sessionId);
          console.log('[SETTINGS] Session info received:', sessionInfo);
          if (sessionInfo.success && sessionInfo.adminUserInfo) {
            setAdminInfo(sessionInfo.adminUserInfo);
            console.log('[SETTINGS] Admin info set:', sessionInfo.adminUserInfo);
          } else {
            console.warn('[SETTINGS] No admin info in session response:', sessionInfo);
          }
        } catch (error) {
          console.error('[SETTINGS] Failed to fetch admin info:', error);
          // Set a fallback so user knows they're connected even if we can't get the name
          setAdminInfo({ name: null, email: null });
        } finally {
          setLoadingAdminInfo(false);
        }
      }
    };

    fetchAdminInfo();
  }, [userMode, teamInfo?.sessionId]);

  // Update team name input when teamName changes from context
  useEffect(() => {
    if (!editingTeamName) {
      setTeamNameInput(teamName || '');
    }
  }, [teamName]);

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
          
          {/* Show current plan above buttons */}
          {userPlan && (
            <TouchableOpacity 
              style={styles.currentPlanBox}
              onPress={() => setShowPlanModal(true)}
            >
              <Text style={styles.currentPlanLabel}>Current Plan:</Text>
              <View style={styles.currentPlanValueContainer}>
                <Text style={styles.currentPlanValue}>
                  {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                </Text>
                <Text style={styles.changePlanText}>Change</Text>
              </View>
            </TouchableOpacity>
          )}
          
          {userMode === 'team_member' ? (
            <>
              {/* Team Member View - Show team connection info (read-only) */}
              <View style={styles.adminInfoBox}>
                <Text style={styles.adminInfoLabel}>Connected to Team:</Text>
                {loadingAdminInfo ? (
                  <ActivityIndicator size="small" color={COLORS.PRIMARY} style={{ marginVertical: 8 }} />
                ) : adminInfo && (adminInfo.name || adminInfo.email) ? (
                  <>
                    <Text style={styles.adminInfoValue}>
                      {adminInfo.name || adminInfo.email || 'Admin'}
                    </Text>
                    {adminInfo.email && adminInfo.name && (
                      <Text style={styles.adminInfoEmail}>
                        {adminInfo.email}
                      </Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.adminInfoValue}>
                    ✓ Connected to Team
                  </Text>
                )}
              </View>
              
              {/* Switch to Individual Mode Button */}
              <TouchableOpacity
                style={styles.switchModeButton}
                onPress={async () => {
                  Alert.alert(
                    'Switch to Individual Mode',
                    'This will switch you back to your individual account. You can rejoin the team later using the invite code.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Switch',
                        onPress: async () => {
                          try {
                            const result = await switchToIndividualMode();
                            if (result.success) {
                              // Reload settings to ensure UI updates with restored name and plan
                              // The SettingsContext should pick up the changes from AsyncStorage
                              // Force a re-render by waiting a bit for state updates
                              setTimeout(() => {
                                Alert.alert(
                                  'Switched to Individual Mode',
                                  `You are now in ${result.plan.charAt(0).toUpperCase() + result.plan.slice(1)} mode.`,
                                  [{ text: 'OK' }]
                                );
                              }, 100);
                            } else {
                              Alert.alert('Error', result.error || 'Failed to switch to individual mode.');
                            }
                          } catch (error) {
                            console.error('[SETTINGS] Error switching to individual mode:', error);
                            Alert.alert('Error', 'Failed to switch to individual mode. Please try again.');
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.switchModeButtonText}>Switch to Individual Mode</Text>
              </TouchableOpacity>
              
            </>
          ) : isSigningIn ? (
             <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0000ff" />
                <Text style={styles.loadingText}>Connecting to Google...</Text>
             </View>
          ) : !isAuthenticated ? (
            <>
              {showPlanSelection ? (
                <>
                  <TouchableOpacity onPress={() => setShowPlanSelection(false)} style={styles.backLink}>
                    <Text style={styles.backLinkText}>&larr; Back</Text>
                  </TouchableOpacity>
                  <Text style={styles.sectionDescription}>
                    Choose a Plan
                  </Text>
                  
                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'starter' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('starter');
                        setShowPlanSelection(false);
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'starter' && styles.planButtonTextSelected]}>Starter</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>Free forever. Easily manage your first project and create stunning before/after photos ready for social sharing.</Text>
                  </View>

                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'pro' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('pro');
                        setShowPlanSelection(false);
                        navigation.navigate('GoogleSignUp', { plan: 'pro' });
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'pro' && styles.planButtonTextSelected]}>Pro</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>For professionals. Cloud sync + bulk upload.</Text>
                  </View>
                  
                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'business' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('business');
                        setShowPlanSelection(false);
                        navigation.navigate('GoogleSignUp', { plan: 'business' });
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'business' && styles.planButtonTextSelected]}>Business</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>For small teams. Includes team management.</Text>
                  </View>
                  
                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'enterprise' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('enterprise');
                        setShowPlanSelection(false);
                        navigation.navigate('GoogleSignUp', { plan: 'enterprise' });
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'enterprise' && styles.planButtonTextSelected]}>Enterprise</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>For growing organizations. Unlimited members, multi-location support.</Text>
                  </View>
                </>
              ) : (
                <>
                  {/* Show feature buttons with enable/disable based on plan */}
                  <Text style={styles.sectionDescription}>
                    {userPlan ? 
                      `Your ${userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} plan features:` :
                      'Sign in to sync your photos to the cloud and enable team features.'
                    }
                  </Text>
                  
                  {/* Determine which buttons are enabled based on plan */}
                  {(() => {
                    const isStarter = !userPlan || userPlan === 'starter';
                    const isPro = userPlan === 'pro';
                    const isBusiness = userPlan === 'business';
                    const isEnterprise = userPlan === 'enterprise';
                    
                    const canConnectGoogle = isPro || isBusiness || isEnterprise;
                    const canSetupTeam = isBusiness || isEnterprise;
                    
                    return (
                      <>
                        {/* Connect to Google Account Button */}
                        <TouchableOpacity
                          style={[
                            styles.featureButton,
                            (!canConnectGoogle || !isGoogleSignInAvailable || isSigningIn) && styles.buttonDisabled
                          ]}
                          onPress={async () => {
                            if (!canConnectGoogle) {
                              Alert.alert('Feature Unavailable', 'Google Account connection is available for Pro, Business, and Enterprise plans.');
                              return;
                            }
                            setIsSigningIn(true);
                            try {
                              // For Pro, use individual sign-in; for Business/Enterprise, use admin sign-in
                              if (isPro) {
                                await individualSignIn();
                              } else {
                                await adminSignIn();
                              }
                            } catch (error) {
                              console.error("Error during sign in:", error);
                            } finally {
                              setIsSigningIn(false);
                            }
                          }}
                          disabled={!canConnectGoogle || !isGoogleSignInAvailable || isSigningIn}
                        >
                          {isSigningIn && canConnectGoogle ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={[
                              styles.featureButtonText,
                              (!canConnectGoogle || !isGoogleSignInAvailable) && styles.buttonTextDisabled
                            ]}>
                              Connect to Google Account
                            </Text>
                          )}
                        </TouchableOpacity>
                        
                        {/* Set Up Team Button */}
                        <TouchableOpacity
                          style={[
                            styles.featureButton,
                            (!canSetupTeam || isSigningIn) && styles.buttonDisabled
                          ]}
                          onPress={async () => {
                            if (!canSetupTeam) {
                              Alert.alert('Feature Unavailable', 'Team setup is available for Business and Enterprise plans.');
                              return;
                            }
                            if (!isAuthenticated) {
                              Alert.alert('Sign In Required', 'Please connect your Google account first.');
                              return;
                            }
                            await handleSetupTeam();
                          }}
                          disabled={!canSetupTeam || isSigningIn}
                        >
                          <Text style={[
                            styles.featureButtonText,
                            !canSetupTeam && styles.buttonTextDisabled
                          ]}>
                            Set Up Team
                          </Text>
                        </TouchableOpacity>
                        
                        {!isGoogleSignInAvailable && (canConnectGoogle || canSetupTeam) && (
                          <View style={styles.expoGoWarning}>
                            <Text style={styles.expoGoWarningText}>
                              ⚠️ Google Sign-in requires a development build and is not available in Expo Go.
                            </Text>
                            <Text style={styles.expoGoWarningSubtext}>
                              Run: npx expo install expo-dev-client && eas build --profile development
                            </Text>
                          </View>
                        )}
                        
                        {/* Show plan selection option for Starter users */}
                        {isStarter && (
                          <>
                            <TouchableOpacity
                              style={styles.signInButton}
                              onPress={() => setShowPlanSelection(true)}
                            >
                              <Text style={styles.signInButtonText}>
                                Upgrade Plan
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.googleSignInButton}
                              onPress={() => navigation.navigate('JoinTeam')}
                            >
                              <Text style={styles.googleSignInButtonText}>
                                Join a Team
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </>
          ) : (
            <>
              <View style={styles.adminInfoBox}>
                <View style={styles.adminInfoHeader}>
                  <View style={styles.activeAccountContainer}>
                    <Text style={styles.activeAccountLabel}>Active Google Account</Text>
                    <Text style={styles.activeAccountName}>
                      {displayedActiveAccount?.name || 'Unknown Name'}
                    </Text>
                    <Text style={styles.activeAccountEmail}>
                      {displayedActiveAccount?.email || 'Unknown Email'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={handleSignOut}
                  >
                    <Text style={styles.disconnectButtonText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>

                {isEnterprisePlan && otherEnterpriseAccounts.length > 0 && (
                  <View style={styles.connectedAccountsList}>
                    <Text style={styles.connectedAccountsTitle}>Other connected accounts</Text>
                    {otherEnterpriseAccounts.map((account, index) => (
                      <View
                        key={account.id}
                        style={[
                          styles.connectedAccountRow,
                          index === otherEnterpriseAccounts.length - 1 && styles.connectedAccountRowLast,
                        ]}
                      >
                        <View style={styles.connectedAccountHeader}>
                          <View style={styles.connectedAccountInfo}>
                            <Text style={styles.connectedAccountName}>
                              {account.name || account.email}
                            </Text>
                            <Text style={styles.connectedAccountEmail}>
                              {account.email}
                            </Text>
                          </View>
                          <View style={[styles.accountStatusBadge, styles.accountStatusInactive]}>
                            <Text style={[styles.accountStatusText, styles.accountStatusTextInactive]}>
                              Inactive
                            </Text>
                          </View>
                        </View>
                        <View style={styles.connectedAccountActions}>
                          <TouchableOpacity
                            style={[
                              styles.accountActionButton,
                              isSigningIn && styles.accountActionButtonDisabled,
                            ]}
                            onPress={() => handleActivateConnectedAccount(account)}
                            disabled={isSigningIn}
                          >
                            <Text style={styles.accountActionButtonText}>
                              {isSigningIn ? 'Switching…' : 'Make Active'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.accountActionButton, styles.accountRemoveButton]}
                            onPress={() => handleRemoveConnectedAccount(account)}
                          >
                            <Text
                              style={[
                                styles.accountActionButtonText,
                                styles.accountRemoveButtonText,
                              ]}
                            >
                              Remove
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Show all buttons when authenticated, with enable/disable based on plan */}
              {(() => {
                const isPro = userPlan === 'pro';
                const isBusiness = userPlan === 'business';
                const isEnterprise = userPlan === 'enterprise';
                
                const canSetupTeam = isBusiness || isEnterprise;
                const isAdmin = userMode === 'admin';
                const connectButtonDisabled = !isEnterprise || !isGoogleSignInAvailable || isSigningIn;
                
                return (
                  <>
                    {/* Keep Connect button visible even after authentication */}
                    <TouchableOpacity
                      style={[
                        styles.featureButton,
                        connectButtonDisabled && styles.buttonDisabled
                      ]}
                      onPress={async () => {
                        if (connectButtonDisabled) {
                          return;
                        }
                        setIsSigningIn(true);
                        try {
                          if (isAdmin) {
                            await adminSignIn();
                          } else {
                            await individualSignIn();
                          }
                        } catch (error) {
                          console.error('Error reconnecting Google account:', error);
                        } finally {
                          setIsSigningIn(false);
                        }
                      }}
                      disabled={connectButtonDisabled}
                    >
                      {isSigningIn && !connectButtonDisabled ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={[
                          styles.featureButtonText,
                          connectButtonDisabled && styles.buttonTextDisabled
                        ]}>
                          Connect to Google Account
                        </Text>
                      )}
                    </TouchableOpacity>
                    {/* Set Up Team Button - shown for authenticated Business/Enterprise admins who haven't set up yet */}
                    {isAdmin && !isSetupComplete() && canSetupTeam && (
                      <TouchableOpacity
                        style={[
                          styles.featureButton,
                          isSigningIn && styles.buttonDisabled
                        ]}
                        onPress={handleSetupTeam}
                        disabled={isSigningIn}
                      >
                        {isSigningIn ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.featureButtonText}>
                            Set Up Team
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                    
                    {/* Add Location button removed */}
                  </>
                );
              })()}

              {userMode === 'admin' && isSetupComplete() && (
                <>
                  <View style={styles.connectedStatus}>
                    <Text style={styles.connectedText}>✓ Team Connected</Text>
                  </View>
                  
                  {/* Editable Team Name */}
                  <View style={styles.teamNameContainer}>
                    <Text style={styles.teamNameLabel}>Team Name</Text>
                    {editingTeamName ? (
                      <View style={styles.teamNameEditContainer}>
                        <TextInput
                          style={styles.teamNameInput}
                          value={teamNameInput}
                          onChangeText={setTeamNameInput}
                          placeholder="Enter team name"
                          placeholderTextColor={COLORS.GRAY}
                          autoFocus={true}
                        />
                        <View style={styles.teamNameButtons}>
                          <TouchableOpacity
                            style={styles.teamNameButton}
                            onPress={async () => {
                              await updateTeamName(teamNameInput);
                              setEditingTeamName(false);
                            }}
                          >
                            <Text style={styles.teamNameButtonText}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.teamNameButton, styles.teamNameButtonCancel]}
                            onPress={() => {
                              setTeamNameInput(teamName || '');
                              setEditingTeamName(false);
                            }}
                          >
                            <Text style={[styles.teamNameButtonText, styles.teamNameButtonTextCancel]}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.teamNameDisplay}
                        onPress={() => {
                          setTeamNameInput(teamName || '');
                          setEditingTeamName(true);
                        }}
                      >
                        <Text style={[
                          styles.teamNameText,
                          !teamName && styles.teamNameTextPlaceholder
                        ]}>
                          {teamName || 'Tap to add team name'}
                        </Text>
                        <Text style={styles.teamNameEditIcon}>✏️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <InviteManager navigation={navigation} />
                </>
              )}
            </>
          )}
        </View>

        {/* Local Settings Sections - Hidden for team members */}
        {userMode !== 'team_member' && (
          <>
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
              </>
            )}

            {/* User Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>User Information</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>User name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.GRAY}
                  onBlur={handleSaveUserInfo}
                />
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

          {/* Plan Selection Modal */}
          <Modal
            visible={showPlanModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowPlanModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose a Plan</Text>
                  <TouchableOpacity 
                    onPress={() => setShowPlanModal(false)}
                    style={styles.modalCloseButton}
                  >
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScrollView}>
                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'starter' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('starter');
                        setShowPlanModal(false);
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'starter' && styles.planButtonTextSelected]}>Starter</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>Free forever. Easily manage your first project and create stunning before/after photos ready for social sharing.</Text>
                  </View>

                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'pro' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('pro');
                        setShowPlanModal(false);
                        if (!isAuthenticated) {
                          navigation.navigate('GoogleSignUp', { plan: 'pro' });
                        }
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'pro' && styles.planButtonTextSelected]}>Pro</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>For professionals. Cloud sync + bulk upload.</Text>
                  </View>
                  
                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'business' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('business');
                        setShowPlanModal(false);
                        if (!isAuthenticated) {
                          navigation.navigate('GoogleSignUp', { plan: 'business' });
                        }
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'business' && styles.planButtonTextSelected]}>Business</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>For small teams. Includes team management.</Text>
                  </View>
                  
                  <View style={styles.planContainer}>
                    <TouchableOpacity 
                      style={[styles.planButton, userPlan === 'enterprise' && styles.planButtonSelected]} 
                      onPress={async () => {
                        await updateUserPlan('enterprise');
                        setShowPlanModal(false);
                        if (!isAuthenticated) {
                          navigation.navigate('GoogleSignUp', { plan: 'enterprise' });
                        }
                      }}
                    >
                      <Text style={[styles.planButtonText, userPlan === 'enterprise' && styles.planButtonTextSelected]}>Enterprise</Text>
                    </TouchableOpacity>
                    <Text style={styles.planSubtext}>For growing organizations. Unlimited members, multi-location support.</Text>
                  </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
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
      buttonDisabled: {
        backgroundColor: '#cccccc',
        opacity: 0.6
      },
      buttonTextDisabled: {
        color: '#666666'
      },
      currentPlanBox: {
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
      },
      currentPlanLabel: {
        fontSize: 14,
        color: COLORS.GRAY,
        fontWeight: '600'
      },
      currentPlanValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
      },
      currentPlanValue: {
        fontSize: 16,
        color: COLORS.TEXT,
        fontWeight: 'bold'
      },
      changePlanText: {
        fontSize: 14,
        color: COLORS.PRIMARY,
        fontWeight: '600'
      },
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end'
      },
      modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 20
      },
      modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.BORDER
      },
      modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.TEXT
      },
      modalCloseButton: {
        width: 30,
        height: 30,
        justifyContent: 'center',
        alignItems: 'center'
      },
      modalCloseText: {
        fontSize: 24,
        color: COLORS.GRAY
      },
      modalScrollView: {
        paddingHorizontal: 20,
        paddingTop: 20
      },
      backLink: {
        marginBottom: 12,
        alignSelf: 'flex-start'
      },
      backLinkText: {
        fontSize: 16,
        color: COLORS.PRIMARY,
        fontWeight: '600'
      },
      planContainer: {
        marginBottom: 20
      },
      planButton: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        borderWidth: 2,
        borderColor: '#ddd',
        alignItems: 'center'
      },
      planButtonSelected: {
        borderColor: COLORS.PRIMARY,
        backgroundColor: '#f0f7ff'
      },
      planButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333'
      },
      planButtonTextSelected: {
        color: COLORS.PRIMARY
      },
      planSubtext: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 10
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
      adminInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      },
      activeAccountContainer: {
        flex: 1,
        paddingRight: 8,
        backgroundColor: '#E6F0FF',
        borderRadius: 8,
        padding: 14,
      },
      activeAccountLabel: {
        color: '#3366CC',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 6,
        textTransform: 'uppercase',
      },
      activeAccountName: {
        color: COLORS.TEXT,
        fontSize: 16,
        fontWeight: '700',
      },
      activeAccountEmail: {
        color: COLORS.GRAY,
        fontSize: 12,
        marginTop: 4,
      },
      connectedAccountsList: {
        marginTop: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#D8E1F6',
      },
      connectedAccountsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.TEXT,
        marginBottom: 8,
      },
      connectedAccountRow: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E6F5',
        padding: 12,
        marginBottom: 8,
      },
      connectedAccountRowLast: {
        marginBottom: 0,
      },
      connectedAccountHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      },
      connectedAccountInfo: {
        flex: 1,
        paddingRight: 12,
      },
      connectedAccountName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.TEXT,
        marginBottom: 2,
      },
      connectedAccountEmail: {
        fontSize: 12,
        color: COLORS.GRAY,
      },
      accountStatusBadge: {
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
      },
      accountStatusActive: {
        backgroundColor: '#E8F5E9',
      },
      accountStatusInactive: {
        backgroundColor: '#FFF4E5',
      },
      accountStatusText: {
        fontSize: 12,
        fontWeight: '600',
      },
      accountStatusTextActive: {
        color: '#2E7D32',
      },
      accountStatusTextInactive: {
        color: '#C77800',
      },
      connectedAccountActions: {
        flexDirection: 'row',
        gap: 8,
      },
      accountActionButton: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: COLORS.PRIMARY,
      },
      accountActionButtonDisabled: {
        opacity: 0.6,
      },
      accountActionButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
      },
      accountRemoveButton: {
        backgroundColor: '#FFE6E6',
      },
      accountRemoveButtonText: {
        color: '#CC0000',
      },
      disconnectButton: {
        backgroundColor: '#FFE6E6',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 14,
      },
      disconnectButtonText: {
        color: '#CC0000',
        fontSize: 14,
        fontWeight: '600',
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
      featureButton: {
        backgroundColor: COLORS.PRIMARY,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8
      },
      featureButtonText: {
        color: COLORS.TEXT,
        fontSize: 16,
        fontWeight: '600'
      },
      setupTeamButton: {
        backgroundColor: COLORS.PRIMARY,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 8
      },
      setupTeamButtonText: {
        color: COLORS.TEXT,
        fontSize: 16,
        fontWeight: '600'
      },
      connectedStatus: {
        backgroundColor: '#d4edda',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
        alignItems: 'center',
      },
      connectedText: {
        color: '#155724',
        fontSize: 14,
        fontWeight: '600',
      },
      teamNameContainer: {
        marginBottom: 15,
      },
      teamNameLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.TEXT,
        marginBottom: 8,
      },
      teamNameDisplay: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        borderRadius: 8,
        padding: 12,
      },
      teamNameText: {
        fontSize: 16,
        color: COLORS.TEXT,
        flex: 1,
      },
      teamNameTextPlaceholder: {
        color: COLORS.GRAY,
        fontStyle: 'italic',
      },
      teamNameEditIcon: {
        fontSize: 18,
        marginLeft: 8,
      },
      teamNameEditContainer: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        borderRadius: 8,
        padding: 12,
      },
      teamNameInput: {
        fontSize: 16,
        color: COLORS.TEXT,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        borderRadius: 6,
        padding: 10,
        marginBottom: 8,
      },
      teamNameButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
      },
      teamNameButton: {
        backgroundColor: COLORS.PRIMARY,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 6,
      },
      teamNameButtonCancel: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.BORDER,
      },
      teamNameButtonText: {
        color: COLORS.TEXT,
        fontSize: 14,
        fontWeight: '600',
      },
      teamNameButtonTextCancel: {
        color: COLORS.GRAY,
      },
      switchModeButton: {
        backgroundColor: COLORS.PRIMARY,
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 8,
      },
      switchModeButtonText: {
        color: COLORS.TEXT,
        fontSize: 16,
        fontWeight: '600',
      },
    });
