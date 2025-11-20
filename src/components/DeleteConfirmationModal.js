import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { COLORS } from '../constants/rooms';
import { useTranslation } from 'react-i18next';

const DeleteConfirmationModal = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  deleteFromStorageDefault = true,
}) => {
  const { t } = useTranslation();
  const [deleteFromStorage, setDeleteFromStorage] = useState(deleteFromStorageDefault);

  // Log when modal visibility changes
  useEffect(() => {
    if (visible) {
      console.log('[DeleteConfirmationModal] 📋 Modal opened');
      console.log('[DeleteConfirmationModal] Title:', title);
      console.log('[DeleteConfirmationModal] Message:', message);
      console.log('[DeleteConfirmationModal] deleteFromStorageDefault:', deleteFromStorageDefault);
    } else {
      console.log('[DeleteConfirmationModal] 🚪 Modal closed');
    }
  }, [visible, title, message, deleteFromStorageDefault]);

  const handleConfirm = () => {
    console.log('[DeleteConfirmationModal] ✅ Confirm button clicked');
    console.log('[DeleteConfirmationModal] deleteFromStorage:', deleteFromStorage);
    console.log('[DeleteConfirmationModal] Calling onConfirm callback...');
    onConfirm(deleteFromStorage);
    console.log('[DeleteConfirmationModal] ✅ onConfirm callback called');
  };

  const handleCancel = () => {
    console.log('[DeleteConfirmationModal] ❌ Cancel button clicked');
    setDeleteFromStorage(deleteFromStorageDefault);
    onCancel();
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      statusBarTranslucent={true}
      hardwareAccelerated={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setDeleteFromStorage(!deleteFromStorage)}
              >
                <View style={[styles.checkboxBox, deleteFromStorage && styles.checkboxBoxChecked]}>
                  {deleteFromStorage && <Text style={styles.checkboxCheck}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  {t('common.deleteFromPhoneStorage')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.deleteButton]}
              onPress={handleConfirm}
            >
              <Text style={styles.deleteButtonText}>
                {t('common.delete')}
              </Text>
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
    zIndex: 9999,
    elevation: 9999,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    zIndex: 10000,
    elevation: 10000,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  checkboxContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: COLORS.PRIMARY,
  },
  checkboxCheck: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: COLORS.TEXT,
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  cancelButtonText: {
    color: COLORS.TEXT,
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FFE6E6',
  },
  deleteButtonText: {
    color: '#CC0000',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeleteConfirmationModal;
