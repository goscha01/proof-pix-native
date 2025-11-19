import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';

export default function TrialNotificationModal({ visible, notification, onClose, onUpgrade }) {
  if (!notification) return null;

  const getButtonStyle = () => {
    if (notification.urgent) {
      return [styles.button, styles.urgentButton];
    }
    return [styles.button, styles.primaryButton];
  };

  const getButtonTextStyle = () => {
    if (notification.urgent) {
      return [styles.buttonText, styles.urgentButtonText];
    }
    return [styles.buttonText, styles.primaryButtonText];
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{notification.title}</Text>
          </View>
          
          <View style={styles.content}>
            <Text style={styles.message}>
              {notification.message}
              {notification.endDate && (
                <Text> Your trial ends on <Text style={styles.endDate}>{notification.endDate}</Text>.</Text>
              )}
            </Text>
          </View>

          <View style={styles.actions}>
            {notification.showUpgrade ? (
              <>
                <TouchableOpacity
                  style={getButtonStyle()}
                  onPress={onUpgrade}
                >
                  <Text style={getButtonTextStyle()}>
                    {notification.urgent ? 'Upgrade Now' : 'Upgrade'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={onClose}
                >
                  <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                    Maybe Later
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={getButtonStyle()}
                onPress={onClose}
              >
                <Text style={getButtonTextStyle()}>Got It</Text>
              </TouchableOpacity>
            )}
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
  endDate: {
    color: '#4CAF50',
    fontWeight: 'bold',
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
    backgroundColor: COLORS.PRIMARY,
  },
  urgentButton: {
    backgroundColor: '#FF4444',
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
    color: '#000000',
  },
  urgentButtonText: {
    color: '#FFFFFF',
  },
  secondaryButtonText: {
    color: COLORS.TEXT,
  },
});


