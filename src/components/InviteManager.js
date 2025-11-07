import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Share, Clipboard, ActivityIndicator } from 'react-native';
import { useAdmin } from '../context/AdminContext';
import { generateInviteToken } from '../utils/tokens';
import proxyService from '../services/proxyService';
import { PROXY_SERVER_URL } from '../config/proxy';
import { COLORS } from '../constants/rooms';

/**
 * A component for admins to manage their team invites.
 */
export default function InviteManager() {
  const {
    proxySessionId,
    inviteTokens,
    getRemainingInvites,
    canAddMoreInvites,
    addInviteToken,
    removeInviteToken,
  } = useAdmin();

  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Fetch team members
  const fetchTeamMembers = async () => {
    if (proxySessionId) {
      setLoadingMembers(true);
      try {
        const result = await proxyService.getTeamMembers(proxySessionId);
        if (result.success && result.teamMembers) {
          setTeamMembers(result.teamMembers);
        }
      } catch (error) {
        console.error('Failed to fetch team members:', error);
      } finally {
        setLoadingMembers(false);
      }
    }
  };

  useEffect(() => {
    if (!proxySessionId) return;
    
    // Fetch team members only when component mounts or session changes
    // No need for constant polling - team members are fetched when invites are generated/revoked
    fetchTeamMembers();
  }, [proxySessionId]);

  const handleGenerateInvite = async () => {
    if (!canAddMoreInvites()) {
      Alert.alert('Cannot add more invites', 'You have reached your plan limit.');
      return;
    }

    if (!proxySessionId) {
      Alert.alert('Error', 'Proxy session not initialized. Please connect your team first.');
      return;
    }

    const newToken = generateInviteToken();

    try {
      console.log('[INVITE] Generating invite token...', { proxySessionId, newToken });

      // Add token to proxy server
      await proxyService.addInviteToken(proxySessionId, newToken);
      console.log('[INVITE] Token added to proxy server');

      // Save token locally
      await addInviteToken(newToken);
      console.log('[INVITE] Invite token generated and saved successfully');

      // Refresh team members list
      await fetchTeamMembers();

      Alert.alert(
        'Invite Generated',
        `A new invite has been created. You can now share it with your team member.`
      );
    } catch (error) {
      console.error('[INVITE] Failed to generate invite token:', error);
      Alert.alert('Error', `Failed to generate invite token: ${error.message}`);
    }
  };

  const handleRevokeInvite = async (token) => {
    try {
      if (proxySessionId) {
        // Remove token from proxy server
        await proxyService.removeInviteToken(proxySessionId, token);
        console.log('[INVITE] Token removed from proxy server');
      }
      
      // Remove token locally
      await removeInviteToken(token);
      
      // Refresh team members list
      await fetchTeamMembers();
      
      Alert.alert('Invite Revoked', `The invite has been revoked. It will no longer work for new uploads.`);
    } catch (error) {
      console.error('[INVITE] Failed to revoke invite token:', error);
      Alert.alert('Error', 'Failed to revoke invite token. Please try again.');
    }
  };

  const handleCopyToken = (token) => {
    // Copy token with sessionId for proxy server (proxy URL is in config)
    const inviteData = `${token}|${proxySessionId}`;
    Clipboard.setString(inviteData);
    Alert.alert('Copied!', 'Invite code copied to clipboard. Share this code with your team member.');
  };

  const handleShareInvite = async (token) => {
    try {
      // Create invite code with token and sessionId for proxy server
      const inviteData = `${token}|${proxySessionId}`;

      await Share.share({
        message: `Join my ProofPix team!\n\nInvite Code:\n${inviteData}\n\nPaste this code in ProofPix → Settings → Join an Existing Team`,
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'joined':
        return '#28a745';
      case 'pending':
        return '#ffc107';
      case 'declined':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'joined':
        return 'Joined';
      case 'pending':
        return 'Pending';
      case 'declined':
        return 'Declined';
      default:
        return 'Unknown';
    }
  };

  const renderTeamMemberItem = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const statusText = getStatusText(item.status);
    
    // Find the invite token for this member
    const hasActiveInvite = inviteTokens?.includes(item.token);
    
    return (
      <View style={styles.memberItem}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name || 'Unknown'}</Text>
          <View style={styles.memberMeta}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusText}
              </Text>
            </View>
            {item.lastUploadAt && (
              <Text style={styles.memberDate}>
                Last upload: {new Date(item.lastUploadAt).toLocaleDateString()}
              </Text>
            )}
            {!hasActiveInvite && (
              <Text style={styles.memberNote}>Invite revoked</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

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

      {/* Team Members Section */}
      <View style={styles.teamMembersSection}>
        <Text style={styles.teamMembersTitle}>Team Members</Text>
        {loadingMembers ? (
          <ActivityIndicator size="small" color={COLORS.PRIMARY} style={{ marginVertical: 10 }} />
        ) : teamMembers.length > 0 ? (
          <FlatList
            data={teamMembers}
            renderItem={renderTeamMemberItem}
            keyExtractor={(item) => item.token}
            ListEmptyComponent={<Text style={styles.emptyText}>No team members yet.</Text>}
            scrollEnabled={false}
          />
        ) : (
          <Text style={styles.emptyText}>No team members yet. Share an invite to get started.</Text>
        )}
      </View>
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
  teamMembersSection: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  teamMembersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  memberItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  memberDate: {
    fontSize: 12,
    color: '#666',
  },
  memberNote: {
    fontSize: 12,
    color: '#dc3545',
    fontStyle: 'italic',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 10,
  },
});
