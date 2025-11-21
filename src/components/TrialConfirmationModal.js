import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';

export default function TrialConfirmationModal({ visible, planName, onUseTrial, onCancel }) {
  const [trialDays, setTrialDays] = useState(30);

  useEffect(() => {
    const checkReferral = async () => {
      try {
        const referralData = await AsyncStorage.getItem('@referral_accepted');
        setTrialDays(referralData !== null ? 45 : 30);
      } catch (error) {
        setTrialDays(30);
      }
    };

    if (visible) {
      checkReferral();
    }
  }, [visible]);
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Start Free Trial? 🎉</Text>
          </View>
          
          <View style={styles.content}>
            <Text style={styles.message}>
              You're eligible for a {trialDays}-day free trial of {planName} features. Would you like to start your free trial now?
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={onUseTrial}
            >
              <Text style={[styles.buttonText, styles.primaryButtonText]}>
                Start Free Trial
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={onCancel}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Continue Without Trial
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    fontFamily: FONTS.QUICKSAND_BOLD,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  message: {
    fontSize: 16,
    color: COLORS.TEXT,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: '#F5F5F5',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: FONTS.QUICKSAND_BOLD,
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: COLORS.TEXT,
  },
});

