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

export default function TrialNotificationModal({ visible, notification, onClose, onUpgrade, onCTA, onRefer }) {
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
            {notification.cta && !notification.showUpgrade && (
              <TouchableOpacity
                onPress={() => {
                  if (onCTA) {
                    onCTA(notification);
                  } else {
                    onClose();
                  }
                }}
                style={styles.ctaButton}
              >
                <Text style={styles.cta}>{notification.cta}</Text>
              </TouchableOpacity>
            )}
            {notification.ctaDescription && (
              <Text style={styles.ctaDescription}>{notification.ctaDescription}</Text>
            )}
            {notification.featuresList && (
              <Text style={styles.featuresList}>{notification.featuresList}</Text>
            )}
            {notification.referralIncentive && notification.key !== 'day30' && (
              <Text style={styles.referralIncentive}>{notification.referralIncentive}</Text>
            )}
            {notification.discountOffer && (
              <Text style={styles.discountOffer}>{notification.discountOffer}</Text>
            )}
          </View>

          <View style={styles.actions}>
            {notification.showUpgrade ? (
              <>
                {notification.key === 'day30' ? (
                  // Day 30: Upgrade Now, then Referral text, then Refer a Friend, then I'm Good
                  <>
                    <TouchableOpacity
                      style={[styles.button, styles.upgradeButton]}
                      onPress={onUpgrade}
                    >
                      <Text style={[styles.buttonText, styles.upgradeButtonText]}>
                        {notification.cta ? notification.cta.replace('👉 ', '') : 'Upgrade Now'}
                      </Text>
                    </TouchableOpacity>
                    {notification.referralIncentive && (
                      <Text style={styles.referralIncentiveDay30}>{notification.referralIncentive}</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.button, styles.referButton]}
                      onPress={onRefer || onClose}
                    >
                      <Text style={[styles.buttonText, styles.referButtonText]}>
                        Refer a friend
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.secondaryButton]}
                      onPress={onClose}
                    >
                      <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                        I'm Good
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : notification.key === 'day27_28' ? (
                  // Day 27-28: Two buttons stacked vertically, then Maybe Later
                  <>
                    <View style={styles.twoButtonRow}>
                      <TouchableOpacity
                        style={[styles.button, styles.upgradeButton]}
                        onPress={onUpgrade}
                      >
                        <Text style={[styles.buttonText, styles.upgradeButtonText]}>
                          Upgrade
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.button, styles.referButton]}
                        onPress={onRefer || onClose}
                      >
                        <Text style={[styles.buttonText, styles.referButtonText]}>
                          Refer a Friend
                        </Text>
                      </TouchableOpacity>
                    </View>
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
                  <>
                    <TouchableOpacity
                      style={getButtonStyle()}
                      onPress={onUpgrade}
                    >
                      <Text style={getButtonTextStyle()}>
                        {notification.cta ? notification.cta.replace('👉 ', '') : (notification.urgent ? 'Upgrade Now' : 'Upgrade')}
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
                )}
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
  ctaButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignSelf: 'center',
  },
  cta: {
    fontSize: 16,
    color: COLORS.PRIMARY,
    fontWeight: '600',
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: 14,
    color: COLORS.GRAY,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  referralIncentive: {
    fontSize: 14,
    color: COLORS.TEXT,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  referralIncentiveDay30: {
    fontSize: 16,
    color: '#4CAF50',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  featuresList: {
    fontSize: 14,
    color: COLORS.TEXT,
    marginTop: 12,
    textAlign: 'left',
    lineHeight: 22,
  },
  discountOffer: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 12,
    textAlign: 'center',
  },
  prominentButton: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
  twoButtonRow: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  upgradeButton: {
    backgroundColor: '#FFD700', // Yellow
    width: '100%',
  },
  upgradeButtonText: {
    color: '#000000',
  },
  referButton: {
    backgroundColor: '#4CAF50', // Green
    width: '100%',
  },
  referButtonText: {
    color: '#FFFFFF',
  },
});


