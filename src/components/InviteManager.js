import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Share, Clipboard } from 'react-native';
import { useAdmin } from '../context/AdminContext';
import { generateInviteToken } from '../utils/tokens';
import googleScriptService from '../services/googleScriptService';

/**
 * A component for admins to manage their team invites.
 */
export default function InviteManager() {
  const {
    scriptId,
    scriptUrl,
    inviteTokens,
    getRemainingInvites,
    canAddMoreInvites,
    addInviteToken,
    removeInviteToken,
  } = useAdmin();

  const handleGenerateInvite = async () => {
    if (!canAddMoreInvites()) {
      Alert.alert('Cannot add more invites', 'You have reached your plan limit.');
      return;
    }

    const newToken = generateInviteToken();

    try {
      console.log('Generating invite token...', { scriptId, newToken });

      // Save token locally (script will be updated when first used for uploads)
      await addInviteToken(newToken);
      console.log('Invite token generated and saved successfully');

      Alert.alert(
        'Invite Generated',
        `A new invite has been created. You can now share it with your team member.\n\nNote: The invite will be activated when first used for uploads.`
      );
    } catch (error) {
      console.error('Failed to generate invite token:', error);
      Alert.alert('Error', `Failed to generate invite token: ${error.message}`);
    }
  };

  const handleRevokeInvite = async (token) => {
    try {
      await removeInviteToken(token);
      Alert.alert('Invite Revoked', `The invite has been revoked locally. It will no longer work for new uploads.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to revoke invite token. Please try again.');
    }
  };

  const handleCopyToken = (token) => {
    Clipboard.setString(token);
    Alert.alert('Copied!', 'Invite code copied to clipboard. Share this code with your team member.');
  };

  const handleShareInvite = async (token) => {
    try {
      await Share.share({
        message: `Join my ProofPix team!\n\nInvite Code: ${token}\n\nDownload ProofPix and enter this code to join.`,
        title: 'ProofPix Team Invite'
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share the invite.');
    }
  };

  const renderInviteItem = ({ item }) => (
    <View style={styles.inviteItem}>
      <View style={styles.tokenContainer}>
        <Text style={styles.tokenLabel}>Code:</Text>
        <Text style={styles.inviteToken} selectable>{item}</Text>
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity onPress={() => handleCopyToken(item)} style={styles.actionButton}>
          <Text style={styles.copyButton}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleShareInvite(item)} style={styles.actionButton}>
          <Text style={styles.shareButton}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleRevokeInvite(item)} style={styles.actionButton}>
          <Text style={styles.revokeButton}>Revoke</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Team Invites</Text>
      <Text style={styles.subtitle}>
        You have {getRemainingInvites()} invite slots remaining.
      </Text>

      <FlatList
        data={inviteTokens || []}
        renderItem={renderInviteItem}
        keyExtractor={(item) => item}
        ListEmptyComponent={<Text>No active invites.</Text>}
        scrollEnabled={false}
      />

      {canAddMoreInvites() && (
        <TouchableOpacity style={styles.generateButton} onPress={handleGenerateInvite}>
          <Text style={styles.generateButtonText}>Generate New Invite</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  inviteItem: {
    flexDirection: 'column',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tokenLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginRight: 8,
  },
  inviteToken: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#007bff',
    fontWeight: '600',
    flex: 1,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  copyButton: {
    color: '#28a745',
    fontSize: 13,
    fontWeight: '600',
  },
  shareButton: {
    color: '#007bff',
    fontSize: 13,
    fontWeight: '600',
  },
  revokeButton: {
    color: '#dc3545',
    fontSize: 13,
    fontWeight: '600',
  },
  generateButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 15,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
