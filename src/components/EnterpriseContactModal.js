/**
 * Enterprise Contact Modal Component
 * Reusable modal for enterprise plan requests across the app
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';
import enterpriseContactService from '../services/enterpriseContactService';

export default function EnterpriseContactModal({ visible, onClose }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      await enterpriseContactService.sendRequest(formData);

      // Show success message
      Alert.alert(
        t('enterprise.successTitle'),
        t('enterprise.successMessage'),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              handleClose();
            },
          },
        ]
      );
    } catch (error) {
      let errorMessage = t('enterprise.submitError');

      if (error.message === 'NAME_REQUIRED') {
        errorMessage = t('enterprise.nameRequired');
      } else if (error.message === 'EMAIL_REQUIRED') {
        errorMessage = t('enterprise.emailRequired');
      } else if (error.message === 'INVALID_EMAIL') {
        errorMessage = t('enterprise.invalidEmail');
      }

      Alert.alert(t('enterprise.error'), errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      description: '',
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('enterprise.title')}</Text>
          <Text style={styles.modalSubtitle}>{t('enterprise.subtitle')}</Text>

          <TextInput
            style={styles.modalInput}
            placeholder={t('enterprise.namePlaceholder')}
            placeholderTextColor="#999"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            autoCapitalize="words"
          />

          <TextInput
            style={styles.modalInput}
            placeholder={t('enterprise.emailPlaceholder')}
            placeholderTextColor="#999"
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.modalInput}
            placeholder={t('enterprise.phonePlaceholder')}
            placeholderTextColor="#999"
            value={formData.phone}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            keyboardType="phone-pad"
          />

          <TextInput
            style={[styles.modalInput, styles.modalTextArea]}
            placeholder={t('enterprise.descriptionPlaceholder')}
            placeholderTextColor="#999"
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.submitButton, isSubmitting && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? t('enterprise.submitting') : t('enterprise.submit')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: FONTS.QUICKSAND_BOLD,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  modalTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: COLORS.PRIMARY,
    marginLeft: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
