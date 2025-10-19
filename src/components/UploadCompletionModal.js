import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert
} from 'react-native';
import { COLORS } from '../constants/rooms';

const UploadCompletionModal = ({ visible, completedUploads, onClose, onClearCompleted, onDeleteProject }) => {
  if (!completedUploads || completedUploads.length === 0) return null;

  const latestUpload = completedUploads[completedUploads.length - 1];
  const { result, albumName } = latestUpload;
  const { successful, failed } = result || { successful: [], failed: [] };

  const handleClose = () => {
    onClearCompleted();
    onClose();
  };

  const getCompletionMessage = () => {
    if (failed.length === 0) {
      return `Successfully uploaded ${successful.length} photo${successful.length > 1 ? 's' : ''} to "${albumName}"`;
    } else {
      return `Uploaded ${successful.length} photo${successful.length > 1 ? 's' : ''}, ${failed.length} failed. Please try again.`;
    }
  };

  const getStatusColor = () => {
    return COLORS.PRIMARY; // Default yellow color
  };

  const getStatusIcon = () => {
    return failed.length === 0 ? '🟡' : '⚠️';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.body}>
            <Text style={styles.title}>
              {failed.length === 0 ? 'Upload Complete!' : 'Upload Partially Complete'}
            </Text>
            <Text style={styles.message}>{getCompletionMessage()}</Text>
            
            {successful.length > 0 && (
              <View style={styles.successSection}>
                <Text style={styles.sectionTitle}>🟡 Successful ({successful.length})</Text>
                <Text style={styles.sectionText}>
                  {successful.map(item => item.filename).join(', ')}
                </Text>
              </View>
            )}

            {failed.length > 0 && (
              <View style={styles.failedSection}>
                <Text style={styles.sectionTitle}>❌ Failed ({failed.length})</Text>
                <Text style={styles.sectionText}>
                  {failed.map(item => item.filename).join(', ')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, { backgroundColor: getStatusColor() }]}
              onPress={handleClose}
            >
              <Text style={styles.buttonText}>
                {failed.length === 0 ? 'Great!' : 'OK'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={() => {
                Alert.alert(
                  'Delete Project',
                  'Are you sure you want to delete this project and all its photos? This action cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Delete', 
                      style: 'destructive',
                      onPress: () => {
                        onDeleteProject && onDeleteProject();
                        handleClose();
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.deleteButtonText}>🗑️ Delete Project</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  message: {
    fontSize: 16,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  successSection: {
    marginBottom: 16,
  },
  failedSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 12,
    color: COLORS.GRAY,
    lineHeight: 16,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  buttonText: {
    color: '#000000', // Black text for yellow background
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFE6E6', // Light red background
  },
  deleteButtonText: {
    color: '#CC0000', // Red text
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UploadCompletionModal;
