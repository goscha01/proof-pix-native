import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import CameraScreen from './CameraScreen';
import { uploadPhotoAsTeamMember } from '../services/uploadService';
import UploadCompletionModal from '../components/UploadCompletionModal';

export default function InviteScreen({ route, navigation }) {
  const { token, scriptUrl } = route.params || {};
  const [modalVisible, setModalVisible] = React.useState(false);
  const [lastPhoto, setLastPhoto] = React.useState(null);

  // This function will be passed to the CameraScreen to be called after a photo is taken.
  const handlePictureTaken = async (photo) => {
    if (!token || !scriptUrl) {
      Alert.alert(
        'Invalid Invite Link',
        'This invite link is missing necessary information. Please ask your team admin for a new link.'
      );
      return;
    }

    try {
      // The photo object from the camera includes the base64 data
      const imageDataUrl = `data:image/jpeg;base64,${photo.base64}`;
      const filename = `team-upload-${new Date().toISOString()}.jpg`;

      // Use the dedicated upload service for team members
      const response = await uploadPhotoAsTeamMember({
        imageDataUrl,
        filename,
        scriptUrl,
        token,
      });

      if (response && response.success) {
        setLastPhoto({ uri: photo.uri });
        setModalVisible(true);
      } else {
        // The response from the Apps Script might contain a specific error message
        const errorMessage = response?.error || 'Unknown error occurred during upload.';
        Alert.alert('Upload Failed', errorMessage);
      }
    } catch (error) {
      console.error('Error uploading photo as team member:', error);
      Alert.alert('Upload Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setLastPhoto(null);
  };
  
  const handleRetake = () => {
    setModalVisible(false);
    setLastPhoto(null);
  };
  
  const handleNewPhoto = () => {
    setModalVisible(false);
    setLastPhoto(null);
  };


  if (!token || !scriptUrl) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>This invite link is invalid or incomplete.</Text>
        <Text style={styles.errorSubText}>Please request a new link from your administrator.</Text>
      </View>
    );
  }

  return (
    <>
      <CameraScreen
        navigation={navigation}
        route={{
          params: {
            onPictureTaken: handlePictureTaken,
            // Pass a special mode to tell the camera screen this is for a team upload.
            // This can be used to customize the UI if needed (e.g., hide certain buttons).
            mode: 'team',
          },
        }}
      />
      <UploadCompletionModal
        visible={modalVisible}
        onClose={handleModalClose}
        onRetake={handleRetake}
        onNewPhoto={handleNewPhoto}
        photo={lastPhoto}
        isTeamMember={true}
      />
    </>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
