import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { useSOS } from '../contexts/SOSContext';

const SOSButton = ({ 
  style, 
  textStyle, 
  onPress, 
  onSuccess, 
  onError,
  compact = false,
  showConfirmation = true 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { triggerSOS } = useSOS();

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      };
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  };

  const triggerSOSAlert = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);

      // Get current location
      const location = await getCurrentLocation();

      // Use SOS context to trigger alert
      const result = await triggerSOS(location.latitude, location.longitude);

      // Success callback
      if (onSuccess) {
        onSuccess(result);
      }

      Alert.alert(
        'SOS Alert Sent! ✅',
        `Emergency alert sent to your contacts with your location. Help is on the way!`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('SOS Error:', error);
      
      // Error callback
      if (onError) {
        onError(error);
      }

      // Handle specific error types with better messages
      let errorMessage = 'Failed to send SOS alert. Please try again or call emergency services directly.';
      let errorTitle = 'SOS Failed';
      
      if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
        errorTitle = 'Network Error';
      } else if (error.message.includes('contacts')) {
        errorMessage = 'No emergency contacts found. Please add emergency contacts in your profile.';
        errorTitle = 'No Contacts';
      } else if (error.message.includes('authentication')) {
        errorMessage = 'Authentication error. Please log in again.';
        errorTitle = 'Authentication Error';
      }

      Alert.alert(errorTitle, errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePress = async () => {
    if (showConfirmation) {
      Alert.alert(
        '🚨 Send Emergency Alert?',
        'This will send an emergency alert to all your emergency contacts with your location. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Send Alert 🚨', 
            style: 'destructive',
            onPress: triggerSOSAlert
          }
        ]
      );
    } else {
      triggerSOSAlert();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        compact ? styles.compactButton : styles.fullButton,
        style
      ]}
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={[
          styles.buttonText,
          compact ? styles.compactText : styles.fullText,
          textStyle
        ]}>
          {compact ? 'SOS' : 'EMERGENCY'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fullButton: {
    backgroundColor: '#FF4444',
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  compactButton: {
    backgroundColor: '#FF4444',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  fullText: {
    fontSize: 18,
    letterSpacing: 1,
  },
  compactText: {
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

export default SOSButton;