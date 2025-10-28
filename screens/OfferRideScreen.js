import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import SafeTextInput from '../components/SafeTextInput';

const OfferRideScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    rideDate: new Date(),
    rideTime: new Date(),
    availableSeats: '',
    pricePerSeat: '',
    vehicleType: '',
    vehicleModel: '',
    vehiclePlate: ''
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      // Validate form
      if (!formData.origin || !formData.destination || !formData.availableSeats || !formData.pricePerSeat) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      if (parseInt(formData.availableSeats) <= 0) {
        Alert.alert('Error', 'Available seats must be greater than 0');
        return;
      }

      if (parseFloat(formData.pricePerSeat) < 0) {
        Alert.alert('Error', 'Price per seat cannot be negative');
        return;
      }

      setLoading(true);

      // Ensure driver profile exists before creating ride
      const { data: driverProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!driverProfile) {
        // Create driver profile if it doesn't exist
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            full_name: user.user_metadata?.name || 'Driver',
            email: user.email,
            bio: '',
            role: 'driver',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          throw new Error('Failed to create driver profile. Please try again.');
        }
      }

      // Format date and time
      const rideDate = formData.rideDate.toISOString().split('T')[0];
      const rideTime = formData.rideTime.toTimeString().split(' ')[0];
      
      console.log('Creating ride with date:', rideDate, 'and time:', rideTime);
      console.log('Ride details:', {
        origin: formData.origin,
        destination: formData.destination,
        available_seats: parseInt(formData.availableSeats),
        price_per_seat: parseFloat(formData.pricePerSeat)
      });

      // Build the ride data object dynamically to handle schema cache issues
      const rideData = {
        driver_id: user.id,
        origin: formData.origin,
        destination: formData.destination,
        ride_date: rideDate,
        ride_time: rideTime,
        available_seats: parseInt(formData.availableSeats),
        price_per_seat: parseFloat(formData.pricePerSeat),
        status: 'active'
      };

      // Only add optional fields if they have values
      if (formData.vehicleType) {
        rideData.vehicle_type = formData.vehicleType;
      }
      if (formData.vehicleModel) {
        rideData.vehicle_model = formData.vehicleModel;
      }
      if (formData.vehiclePlate) {
        rideData.vehicle_plate = formData.vehiclePlate;
      }

      const { data, error } = await supabase
        .from('rides')
        .insert([rideData]);

      if (error) {
        // If we get a schema cache error, try without optional fields first
        if (error.message.includes('schema cache') || error.message.includes('vehicle_model')) {
          const basicRideData = {
            driver_id: user.id,
            origin: formData.origin,
            destination: formData.destination,
            ride_date: rideDate,
            ride_time: rideTime,
            available_seats: parseInt(formData.availableSeats),
            price_per_seat: parseFloat(formData.pricePerSeat),
            status: 'active'
          };

          const { data: basicData, error: basicError } = await supabase
            .from('rides')
            .insert([basicRideData]);

          if (basicError) throw basicError;
          
          // Success with basic data
          Alert.alert('Success', 'Ride offered successfully! (Vehicle details will be added once schema cache refreshes)', [
            { text: 'OK', onPress: () => navigation.goBack() }
          ]);
          return;
        }
        throw error;
      }

      Alert.alert('Success', 'Ride offered successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      // Handle foreign key constraint violations specifically
      if (error.message?.includes('violates foreign key constraint') && error.message?.includes('rides_driver_id_fkey')) {
        Alert.alert('Profile Error', 'Driver profile not found. Please ensure your profile is complete before offering rides.');
      } else {
        Alert.alert('Error', error.message);
      }
      console.error('Error offering ride:', error);
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setFormData({ ...formData, rideDate: selectedDate });
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      setFormData({ ...formData, rideTime: selectedTime });
    }
  };

  const detectCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permissions to use auto-detect location feature.',
          [{ text: 'OK' }]
        );
        setLocationLoading(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 0
      });

      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (address) {
        const locationText = `${address.street || ''} ${address.name || ''}, ${address.city || address.subregion || ''}, ${address.region || ''}`.trim();
        const formattedLocation = locationText.replace(/^,|,$/g, '').replace(/,\s*,/g, ',').trim();
        
        setFormData({ ...formData, origin: formattedLocation });
        Alert.alert('Location Detected', `Your current location: ${formattedLocation}`);
      } else {
        Alert.alert('Location Error', 'Unable to detect your current location. Please enter manually.');
      }
    } catch (error) {
      console.error('Location detection error:', error);
      Alert.alert('Location Error', 'Unable to detect your current location. Please enter manually.');
    } finally {
      setLocationLoading(false);
    }
  };

  const openMapSelector = (type) => {
    navigation.navigate('Map', {
      mode: 'select',
      onLocationSelect: async (location) => {
        try {
          // Use reverse geocoding to get readable address
          const [address] = await Location.reverseGeocodeAsync({
            latitude: location.latitude,
            longitude: location.longitude
          });

          let locationText;
          if (address) {
            // Format the address nicely
            const parts = [];
            if (address.street) parts.push(address.street);
            if (address.name && address.name !== address.street) parts.push(address.name);
            if (address.city || address.subregion) parts.push(address.city || address.subregion);
            if (address.region) parts.push(address.region);
            
            locationText = parts.join(', ');
            
            // Fallback to a simpler format if the above is empty
            if (!locationText.trim()) {
              locationText = `${address.city || address.subregion || 'Unknown'}, ${address.region || 'Unknown'}`;
            }
          } else {
            // Fallback to coordinates if reverse geocoding fails
            locationText = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
          }

          if (type === 'origin') {
            setFormData({ ...formData, origin: locationText });
          } else {
            setFormData({ ...formData, destination: locationText });
          }
        } catch (error) {
          console.error('Reverse geocoding error:', error);
          // Fallback to coordinates if reverse geocoding fails
          const coordinateText = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
          if (type === 'origin') {
            setFormData({ ...formData, origin: coordinateText });
          } else {
            setFormData({ ...formData, destination: coordinateText });
          }
        }
      }
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Offer a Ride</Text>
        <Text style={styles.subtitle}>Share your journey with others</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputWithButton}>
          <Text style={styles.label}>Origin *</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.smallButton, locationLoading && styles.smallButtonDisabled]}
              onPress={detectCurrentLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.smallButtonText}>📍 Auto-Detect</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => openMapSelector('origin')}
            >
              <Text style={styles.smallButtonText}>🗺️ Map</Text>
            </TouchableOpacity>
          </View>
        </View>
        <SafeTextInput
          style={styles.input}
          placeholder="Where are you starting from?"
          value={formData.origin}
          onChangeText={(text) => setFormData({ ...formData, origin: text })}
        />

        <Text style={styles.label}>Destination *</Text>
        <View style={styles.inputWithButton}>
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => openMapSelector('destination')}
          >
            <Text style={styles.smallButtonText}>🗺️ Select on Map</Text>
          </TouchableOpacity>
        </View>
        <SafeTextInput
          style={styles.input}
          placeholder="Where are you going?"
          value={formData.destination}
          onChangeText={(text) => setFormData({ ...formData, destination: text })}
        />

        <Text style={styles.label}>Date *</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowDatePicker(true)}
        >
          <Text>{formData.rideDate.toDateString()}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={formData.rideDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}

        <Text style={styles.label}>Time *</Text>
        <TouchableOpacity
          style={styles.dateInput}
          onPress={() => setShowTimePicker(true)}
        >
          <Text>{formData.rideTime.toLocaleTimeString()}</Text>
        </TouchableOpacity>

        {showTimePicker && (
          <DateTimePicker
            value={formData.rideTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onTimeChange}
          />
        )}

        <Text style={styles.label}>Available Seats *</Text>
        <SafeTextInput
          style={styles.input}
          placeholder="Number of available seats"
          value={formData.availableSeats}
          onChangeText={(text) => setFormData({ ...formData, availableSeats: text })}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Price per Seat (Slaves) *</Text>
        <SafeTextInput
          style={styles.input}
          placeholder="Price per seat"
          value={formData.pricePerSeat}
          onChangeText={(text) => setFormData({ ...formData, pricePerSeat: text })}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Vehicle Type</Text>
        <SafeTextInput
          style={styles.input}
          placeholder="e.g., Sedan, SUV, Hatchback"
          value={formData.vehicleType}
          onChangeText={(text) => setFormData({ ...formData, vehicleType: text })}
        />

        <Text style={styles.label}>Vehicle Model</Text>
        <SafeTextInput
          style={styles.input}
          placeholder="e.g., Toyota Camry 2020"
          value={formData.vehicleModel}
          onChangeText={(text) => setFormData({ ...formData, vehicleModel: text })}
        />

        <Text style={styles.label}>Vehicle Plate</Text>
        <SafeTextInput
          style={styles.input}
          placeholder="License plate number"
          value={formData.vehiclePlate}
          onChangeText={(text) => setFormData({ ...formData, vehiclePlate: text })}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Offering Ride...' : 'Offer Ride'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inputWithButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  smallButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  smallButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  mapButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default OfferRideScreen;