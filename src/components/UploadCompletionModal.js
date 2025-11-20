import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { COLORS } from '../constants/rooms';
import { useTranslation } from 'react-i18next';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const UploadCompletionModal = ({ visible, completedUploads, onClose, onClearCompleted, onDeleteProject, userPlan, onShowPlanModal, planModalVisible }) => {
  const { t } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  if (!completedUploads || completedUploads.length === 0) return null;

  const latestUpload = completedUploads[completedUploads.length - 1];
  const { result, albumName } = latestUpload;
  const { successful, failed } = result || { successful: [], failed: [] };

  const handleClose = () => {
    onClearCompleted();
    onClose();
  };

  const handleDeleteConfirm = (deleteFromStorage) => {
    if (onDeleteProject) {
      // If onDeleteProject accepts a parameter, pass it; otherwise call without parameter
      if (typeof onDeleteProject === 'function' && onDeleteProject.length > 0) {
        onDeleteProject(deleteFromStorage);
      } else {
        onDeleteProject();
      }
    }
    setShowDeleteConfirm(false);
    handleClose();
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  // Override onShowPlanModal - don't close delete confirmation, just show plan modal on top
  const handleShowPlanModal = () => {
    // Don't close delete confirmation - let plan modal float on top
    if (onShowPlanModal) {
      onShowPlanModal();
    }
  };

  const getCompletionMessage = () => {
    if (failed.length === 0) {
      return t('gallery.uploadCompleteMessage', { count: successful.length, albumName });
    } else {
      return t('gallery.uploadPartialMessage', { successCount: successful.length, failedCount: failed.length });
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
              {failed.length === 0 ? t('gallery.uploadCompleteTitle') : t('gallery.uploadPartialTitle')}
            </Text>
            <Text style={styles.message}>{getCompletionMessage()}</Text>
            
            {successful.length > 0 && (
              <View style={styles.successSection}>
                <Text style={styles.sectionTitle}>
                  🟡 {t('gallery.successfulCount', { count: successful.length })}
                </Text>
                <Text style={styles.sectionText}>
                  {successful.map(item => item.filename).join(', ')}
                </Text>
              </View>
            )}

            {failed.length > 0 && (
              <View style={styles.failedSection}>
                <Text style={styles.sectionTitle}>
                  ❌ {t('gallery.failedCount', { count: failed.length })}
                </Text>
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
                {failed.length === 0 ? t('gallery.great') : t('common.ok')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={() => setShowDeleteConfirm(true)}
            >
              <Text style={styles.deleteButtonText}>
                🗑️ {t('gallery.deleteProjectButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <DeleteConfirmationModal
        visible={showDeleteConfirm}
        title={t('gallery.deleteProjectTitle')}
        message={t('gallery.deleteProjectMessage')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        deleteFromStorageDefault={true}
        userPlan={userPlan}
        onShowPlanModal={handleShowPlanModal}
      />
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
