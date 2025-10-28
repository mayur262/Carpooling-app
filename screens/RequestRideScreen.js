import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  SafeAreaView,
} from 'react-native';
import SafeTextInput from '../components/SafeTextInput';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function RequestRideScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    origin: '',
    originCoordinates: null,
    destination: '',
    destinationCoordinates: null,
    requestedDate: new Date(),
    requestedTime: null,
    flexibleTime: false,
    numberOfPassengers: '1',
    maxPricePerPerson: '',
    description: ''
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required for some features.');
    }
  };

  const handleSubmit = async () => {
    if (!formData.origin || !formData.destination || !formData.requestedDate) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to request a ride.');
      return;
    }

    setLoading(true);
    
    try {
      // Prepare coordinate data in GeoJSON format for PostGIS
      const requestData = {
        passenger_id: user.id,
        origin: formData.origin,
        destination: formData.destination,
        requested_date: formData.requestedDate.toISOString().split('T')[0],
        requested_time: formData.requestedTime ? formData.requestedTime.toTimeString().split(' ')[0] : null,
        flexible_time: formData.flexibleTime,
        number_of_passengers: parseInt(formData.numberOfPassengers),
        max_price_per_person: formData.maxPricePerPerson ? parseFloat(formData.maxPricePerPerson) : null,
        description: formData.description
      };

      // Add coordinates in GeoJSON format if available
      if (formData.originCoordinates) {
        // Store as PostgreSQL POINT format: (longitude,latitude)
        requestData.origin_coordinates = `(${formData.originCoordinates.longitude},${formData.originCoordinates.latitude})`;
      }

      if (formData.destinationCoordinates) {
        // Store as PostgreSQL POINT format: (longitude,latitude)
        requestData.destination_coordinates = `(${formData.destinationCoordinates.longitude},${formData.destinationCoordinates.latitude})`;
      }

      const { data, error } = await supabase
        .from('ride_requests')
        .insert([requestData]);

      if (error) {
        throw error;
      }

      Alert.alert('Success', 'Your ride request has been posted successfully!');
      
      // Reset form
      setFormData({
        origin: '',
        originCoordinates: null,
        destination: '',
        destinationCoordinates: null,
        requestedDate: new Date(),
        requestedTime: null,
        flexibleTime: false,
        numberOfPassengers: '1',
        maxPricePerPerson: '',
        description: ''
      });
      
      // Navigate to home or ride requests list
      navigation.navigate('Home');
      
    } catch (error) {
      console.error('Detailed error posting ride request:', error);
      console.error('User ID:', user?.id);
      console.error('Request data:', requestData);
      Alert.alert('Error', `Failed to post ride request: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData(prev => ({ ...prev, requestedDate: selectedDate }));
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setFormData(prev => ({ ...prev, requestedTime: selectedTime }));
    }
  };

  const detectCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to detect your current location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      const formattedAddress = `${address.street || ''} ${address.name || ''}, ${address.city || ''}, ${address.region || ''}`.trim();

      setFormData(prev => ({
        ...prev,
        origin: formattedAddress,
        originCoordinates: { latitude, longitude }
      }));

    } catch (error) {
      Alert.alert('Error', 'Failed to detect current location.');
    }
  };

  const openMapSelector = (type) => {
    navigation.navigate('Map', {
      mode: 'select',
      onLocationSelect: async (coordinates) => {
        try {
          const [address] = await Location.reverseGeocodeAsync({
            latitude: coordinates.latitude,
            longitude: coordinates.longitude
          });

          const formattedAddress = `${address.street || ''} ${address.name || ''}, ${address.city || ''}, ${address.region || ''}`.trim();

          if (type === 'origin') {
            setFormData(prev => ({
              ...prev,
              origin: formattedAddress,
              originCoordinates: coordinates
            }));
          } else {
            setFormData(prev => ({
              ...prev,
              destination: formattedAddress,
              destinationCoordinates: coordinates
            }));
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to get location details.');
        }
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Request a Ride</Text>
        <Text style={styles.subtitle}>Tell us where you need to go</Text>

        {/* Origin Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>From *</Text>
          <View style={styles.locationInputContainer}>
            <SafeTextInput
              style={styles.locationInput}
              placeholder="Enter pickup location"
              value={formData.origin}
              onChangeText={(text) => setFormData(prev => ({ ...prev, origin: text }))}
              multiline
            />
            <TouchableOpacity style={styles.mapButton} onPress={() => openMapSelector('origin')}>
              <Ionicons name="map" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.autoDetectButton} onPress={detectCurrentLocation}>
            <Ionicons name="locate" size={16} color="#007AFF" />
            <Text style={styles.autoDetectText}>Auto-Detect Current Location</Text>
          </TouchableOpacity>
        </View>

        {/* Destination Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>To *</Text>
          <View style={styles.locationInputContainer}>
            <SafeTextInput
              style={styles.locationInput}
              placeholder="Enter destination"
              value={formData.destination}
              onChangeText={(text) => setFormData(prev => ({ ...prev, destination: text }))}
              multiline
            />
            <TouchableOpacity style={styles.mapButton} onPress={() => openMapSelector('destination')}>
              <Ionicons name="map" size={20} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date *</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateButtonText}>
              {formData.requestedDate.toDateString()}
            </Text>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={formData.requestedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Time Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Preferred Time</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.dateButtonText}>
              {formData.requestedTime ? formData.requestedTime.toLocaleTimeString() : 'Select time (optional)'}
            </Text>
            <Ionicons name="time" size={20} color="#007AFF" />
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={formData.requestedTime || new Date()}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
            />
          )}
        </View>

        {/* Flexible Time */}
        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setFormData(prev => ({ ...prev, flexibleTime: !prev.flexibleTime }))}
          >
            <Ionicons
              name={formData.flexibleTime ? "checkbox" : "square-outline"}
              size={24}
              color="#007AFF"
            />
            <Text style={styles.checkboxLabel}>Flexible with time</Text>
          </TouchableOpacity>
        </View>

        {/* Number of Passengers */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Number of Passengers *</Text>
          <SafeTextInput
            style={styles.input}
            placeholder="1"
            value={formData.numberOfPassengers}
            onChangeText={(text) => setFormData(prev => ({ ...prev, numberOfPassengers: text }))}
            keyboardType="numeric"
          />
        </View>

        {/* Max Price */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Max Price Per Person ($)</Text>
          <SafeTextInput
            style={styles.input}
            placeholder="Optional"
            value={formData.maxPricePerPerson}
            onChangeText={(text) => setFormData(prev => ({ ...prev, maxPricePerPerson: text }))}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Additional Notes</Text>
          <SafeTextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any special requirements, luggage, etc."
            value={formData.description}
            onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Posting Request...' : 'Post Ride Request'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginRight: 8,
  },
  mapButton: {
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoDetectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  autoDetectText: {
    color: '#007AFF',
    marginLeft: 6,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  checkboxContainer: {
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});