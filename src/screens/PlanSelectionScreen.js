import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';
import { COLORS } from '../constants/rooms';
import { FONTS } from '../constants/fonts';
import EnterpriseContactModal from '../components/EnterpriseContactModal';
import { canStartTrial, startTrial } from '../services/trialService';

export default function PlanSelectionScreen({ navigation }) {
  const { t } = useTranslation();
  const { updateUserPlan } = useSettings();
  const insets = useSafeAreaInsets();

  // Enterprise modal state
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [trialAvailable, setTrialAvailable] = useState(false);

  useEffect(() => {
    // Check if trial is available for new users
    const checkTrialAvailability = async () => {
      const available = await canStartTrial();
      setTrialAvailable(available);
    };
    checkTrialAvailability();
  }, []);

  const handleSelectPlan = async (plan) => {
    if (plan === 'enterprise') {
      // Show enterprise contact form modal
      setShowEnterpriseModal(true);
      return;
    }

    // Check if user can start a trial for this plan
    if (trialAvailable) {
      try {
        // Start 30-day free trial for the selected plan
        await startTrial(plan);
        await updateUserPlan(plan);
      } catch (error) {
        console.error('[PlanSelection] Error starting trial:', error);
        // Fallback to regular plan selection
        await updateUserPlan(plan);
      }
    } else {
      // Regular plan selection (trial already used or not available)
      await updateUserPlan(plan);
    }

    if (plan === 'starter') {
      // For Starter plan, go to Label Language Setup screen
      navigation.replace('LabelLanguageSetup');
    } else {
      // For Pro, Business, go to the Google Sign-Up screen
      navigation.navigate('GoogleSignUp', { plan });
    }
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 10, left: insets.left + 10 }]}
        onPress={handleGoBack}
      >
        <Text style={styles.backButtonText}>←</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>{t('firstLoad.choosePlan')}</Text>
          
          {trialAvailable && (
            <View style={styles.trialBanner}>
              <Text style={styles.trialBannerText}>
                🎉 {t('firstLoad.freeTrialAvailable', { defaultValue: '30-Day Free Trial Available!' })}
              </Text>
            </View>
          )}

          <View style={styles.planContainer}>
            <TouchableOpacity
              style={[styles.selectionButton, styles.planButton]}
              onPress={() => handleSelectPlan('starter')}
            >
              <Text style={[styles.selectionButtonText, styles.planButtonText]}>
                {t('firstLoad.starter')}
                {trialAvailable && (
                  <Text style={styles.trialBadge}> {t('firstLoad.freeTrial', { defaultValue: '(Free Trial)' })}</Text>
                )}
              </Text>
            </TouchableOpacity>
            <Text style={styles.planSubtext}>{t('firstLoad.starterDesc')}</Text>
          </View>

          <View style={styles.planContainer}>
            <TouchableOpacity
              style={[styles.selectionButton, styles.planButton]}
              onPress={() => handleSelectPlan('pro')}
            >
              <Text style={[styles.selectionButtonText, styles.planButtonText]}>
                {t('firstLoad.pro')}
                {trialAvailable && (
                  <Text style={styles.trialBadge}> {t('firstLoad.freeTrial', { defaultValue: '(Free Trial)' })}</Text>
                )}
              </Text>
            </TouchableOpacity>
            <Text style={styles.planSubtext}>{t('firstLoad.proDesc')}</Text>
          </View>

          <View style={styles.planContainer}>
            <TouchableOpacity
              style={[styles.selectionButton, styles.planButton]}
              onPress={() => handleSelectPlan('business')}
            >
              <Text style={[styles.selectionButtonText, styles.planButtonText]}>
                {t('firstLoad.business')}
                {trialAvailable && (
                  <Text style={styles.trialBadge}> {t('firstLoad.freeTrial', { defaultValue: '(Free Trial)' })}</Text>
                )}
              </Text>
            </TouchableOpacity>
            <Text style={styles.planSubtext}>{t('firstLoad.businessDesc')}</Text>
          </View>

          <View style={styles.planContainer}>
            <TouchableOpacity
              style={[styles.selectionButton, styles.planButton]}
              onPress={() => handleSelectPlan('enterprise')}
            >
              <Text style={[styles.selectionButtonText, styles.planButtonText]}>
                {t('firstLoad.enterprise')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.planSubtext}>{t('firstLoad.enterpriseDesc')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Enterprise Contact Form Modal */}
      <EnterpriseContactModal
        visible={showEnterpriseModal}
        onClose={() => setShowEnterpriseModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
  },
  backButton: {
    position: 'absolute',
    zIndex: 10,
    padding: 10,
  },
  backButtonText: {
    color: COLORS.TEXT,
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 30,
    fontFamily: FONTS.QUICKSAND_BOLD,
  },
  planContainer: {
    marginBottom: 20,
    width: '100%',
  },
  selectionButton: {
    backgroundColor: COLORS.PRIMARY,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  selectionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: FONTS.QUICKSAND_BOLD,
  },
  planButton: {
    backgroundColor: '#fff',
    borderColor: '#ddd',
  },
  planButtonText: {
    color: '#333',
  },
  planSubtext: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
  },
  trialBanner: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
  },
  trialBannerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: FONTS.QUICKSAND_BOLD,
  },
  trialBadge: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
});
