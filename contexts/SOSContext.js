import React, { createContext, useContext, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import Constants from 'expo-constants';

const SOSContext = createContext();

export const useSOS = () => {
  const context = useContext(SOSContext);
  if (!context) {
    throw new Error('useSOS must be used within an SOSProvider');
  }
  return context;
};

export const SOSProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSOSError, setLastSOSError] = useState(null);
  const { user } = useAuth();

  const triggerSOS = async (latitude, longitude) => {
    setIsLoading(true);
    setLastSOSError(null);
    
    try {
      // Check if user is authenticated
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Get the correct API URL based on platform
      let apiUrl;
      if (Platform.OS === 'web') {
        // For web, use localhost
        apiUrl = 'http://localhost:3000';
      } else {
        // For mobile, check if running in development or production
        if (__DEV__) {
          // In development, use the computer's IP address
          // You can also use ngrok or a similar service for testing
          apiUrl = 'http://localhost:3000'; // This will need to be your computer's IP
        } else {
          // In production, use your actual backend URL
          apiUrl = 'https://your-production-api.com';
        }
      }
      
      // For testing purposes, let's try to get the API URL from environment variables first
      const envApiUrl = Constants.manifest?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;
      if (envApiUrl) {
        apiUrl = envApiUrl.replace('3001', '3000'); // Fix port mismatch
      }
      
      // Create test token for authentication (base64 encoded user info)
      const testToken = btoa(JSON.stringify({ 
        userId: user.id, 
        email: user.email,
        phone: user.phone || '+1234567890'
      }));

      console.log('Attempting to connect to API:', `${apiUrl}/api/sos/trigger`);

      const response = await fetch(`${apiUrl}/api/sos/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`
        },
        body: JSON.stringify({
          latitude,
          longitude,
          userPhone: user.phone || '+1234567890'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send SOS alert');
      }

      return data;
    } catch (error) {
      setLastSOSError(error.message);
      console.error('SOS Error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearLastError = () => {
    setLastSOSError(null);
  };

  const value = {
    triggerSOS,
    isLoading,
    lastSOSError,
    clearLastError
  };

  return (
    <SOSContext.Provider value={value}>
      {children}
    </SOSContext.Provider>
  );
};