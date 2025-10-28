import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import SafeTextInput from './SafeTextInput';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';

const FareEstimator = () => {
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropLocation, setDropLocation] = useState(null);
  const [distance, setDistance] = useState(0);
  const [totalFare, setTotalFare] = useState(0);
  const [farePerPerson, setFarePerPerson] = useState(0);
  const [numPassengers, setNumPassengers] = useState('3');
  const [loading, setLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState(null);
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [mapMode, setMapMode] = useState('pickup'); // 'pickup' or 'drop'
  const [mapRegion, setMapRegion] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  // Function to get address from coordinates (simplified)
  const getLocationName = async (lat, lng) => {
    try {
      // In a real app, you would use a reverse geocoding service here
      // For now, return a formatted coordinate string with additional info
      const latStr = lat.toFixed(4);
      const lngStr = lng.toFixed(4);
      
      // Add some basic location context based on coordinates
      if (lat >= 28.0 && lat <= 29.0 && lng >= 76.0 && lng <= 77.5) {
        return `Delhi Area (${latStr}, ${lngStr})`;
      } else if (lat >= 19.0 && lat <= 20.0 && lng >= 72.0 && lng <= 73.5) {
        return `Mumbai Area (${latStr}, ${lngStr})`;
      } else if (lat >= 12.5 && lat <= 13.5 && lng >= 77.5 && lng <= 78.5) {
        return `Bangalore Area (${latStr}, ${lngStr})`;
      }
      
      return `Location (${latStr}, ${lngStr})`;
    } catch (error) {
      return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  };

  // Haversine formula to calculate distance
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate fare
  const calculateFare = (distanceInKm, passengers) => {
    const baseFare = 5;
    const ratePerKm = 5;
    const numPassengers = parseInt(passengers) || 3;

    const totalFare = baseFare + distanceInKm * ratePerKm;
    const farePerPerson = totalFare / numPassengers;

    return { totalFare, farePerPerson };
  };

  // Request location permission and get current location
  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const locationName = await getLocationName(location.coords.latitude, location.coords.longitude);

      setPickupLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        name: locationName,
      });

      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to get your current location.');
    } finally {
      setLoading(false);
    }
  };

  // Open map modal
  const openMapModal = (mode) => {
    setMapMode(mode);
    setMapModalVisible(true);
  };

  // Handle map press for pickup or drop
  const handleMapPress = async (event) => {
    const { coordinate } = event.nativeEvent;
    const locationName = await getLocationName(coordinate.latitude, coordinate.longitude);

    if (mapMode === 'pickup') {
      setPickupLocation({
        lat: coordinate.latitude,
        lng: coordinate.longitude,
        name: locationName,
      });
    } else {
      setDropLocation({
        lat: coordinate.latitude,
        lng: coordinate.longitude,
        name: locationName,
      });
    }

    setMapModalVisible(false);
  };

  // Use current location inside map modal
  const useCurrentLocationForMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const locationName = await getLocationName(location.coords.latitude, location.coords.longitude);

      if (mapMode === 'pickup') {
        setPickupLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          name: locationName,
        });
      } else {
        setDropLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          name: locationName,
        });
      }

      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      setMapModalVisible(false);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to get current location.');
    }
  };

  // Recalculate fare when locations or passengers change
  useEffect(() => {
    if (pickupLocation && dropLocation) {
      const dist = calculateDistance(pickupLocation.lat, pickupLocation.lng, dropLocation.lat, dropLocation.lng);
      setDistance(dist);
      const { totalFare, farePerPerson } = calculateFare(dist, numPassengers);
      setTotalFare(totalFare);
      setFarePerPerson(farePerPerson);
    }
  }, [pickupLocation, dropLocation, numPassengers]);

  // Handle passenger input
  const handlePassengerChange = (text) => {
    if (text === '' || /^[1-9]$/.test(text) || /^[1-9][0-9]$/.test(text)) {
      setNumPassengers(text);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fare Estimator</Text>

      {/* Pickup */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pickup Location</Text>
        <TouchableOpacity style={styles.mapButton} onPress={() => openMapModal('pickup')}>
          <Text style={styles.mapButtonText}>📍 Select Pickup on Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Getting Location...' : 'Use Current Location'}</Text>
        </TouchableOpacity>
        {pickupLocation && (
          <View style={styles.locationDisplayContainer}>
            <View style={styles.locationPin}>
              <Text style={styles.locationPinText}>📍</Text>
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationName}>{pickupLocation.name}</Text>
              <Text style={styles.locationCoordinates}>
                {pickupLocation.lat.toFixed(6)}, {pickupLocation.lng.toFixed(6)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Drop */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Drop Location</Text>
        <TouchableOpacity style={styles.mapButton} onPress={() => openMapModal('drop')}>
          <Text style={styles.mapButtonText}>📍 Select Drop on Map</Text>
        </TouchableOpacity>
        {dropLocation && (
          <View style={styles.locationDisplayContainer}>
            <View style={styles.locationPin}>
              <Text style={styles.locationPinText}>📍</Text>
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationName}>{dropLocation.name}</Text>
              <Text style={styles.locationCoordinates}>
                {dropLocation.lat.toFixed(6)}, {dropLocation.lng.toFixed(6)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Passengers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Number of Passengers</Text>
        <View style={styles.passengerInputContainer}>
          <SafeTextInput
            style={styles.passengerInput}
            value={numPassengers}
            onChangeText={handlePassengerChange}
            keyboardType="numeric"
            placeholder="3"
            maxLength={2}
          />
        </View>
      </View>

      {/* Fare */}
      {pickupLocation && dropLocation && (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsTitle}>Fare Estimate</Text>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Distance:</Text>
            <Text style={styles.resultValue}>{distance.toFixed(2)} km</Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Total Fare:</Text>
            <Text style={styles.resultValue}>₹{totalFare.toFixed(2)}</Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Fare per Person:</Text>
            <Text style={styles.resultValue}>₹{farePerPerson.toFixed(2)}</Text>
          </View>
          <Text style={styles.noteText}>Base fare: ₹5 + ₹5/km • Shared among {numPassengers || 3} passengers</Text>
        </View>
      )}

      {/* Map Modal */}
      <Modal animationType="slide" transparent={false} visible={mapModalVisible} onRequestClose={() => setMapModalVisible(false)}>
        <View style={styles.mapModalContainer}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>{mapMode === 'pickup' ? 'Select Pickup Location' : 'Select Drop Location'}</Text>
            <TouchableOpacity style={styles.mapCloseButton} onPress={() => setMapModalVisible(false)}>
              <Text style={styles.mapCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <MapView
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton
          >
            {pickupLocation && <Marker coordinate={{ latitude: pickupLocation.lat, longitude: pickupLocation.lng }} title="Pickup" pinColor="#10b981" />}
            {dropLocation && <Marker coordinate={{ latitude: dropLocation.lat, longitude: dropLocation.lng }} title="Drop" pinColor="#ef4444" />}
          </MapView>
          <View style={styles.mapControls}>
            <Text style={styles.mapInstruction}>Tap anywhere on the map to select {mapMode === 'pickup' ? 'pickup' : 'drop'} location</Text>
            <TouchableOpacity style={styles.mapControlButton} onPress={useCurrentLocationForMap}>
              <Text style={styles.mapControlButtonText}>📍 Use Current Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapControlButton} onPress={() => setMapModalVisible(false)}>
              <Text style={styles.mapControlButtonText}>✓ Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginHorizontal: 20, marginVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#1e293b', marginBottom: 20, textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  locationButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  coordinatesContainer: { marginTop: 8, padding: 8, backgroundColor: '#f3f4f6', borderRadius: 6 },
  coordinatesText: { fontSize: 12, color: '#6b7280', fontFamily: 'monospace' },
  locationDisplayContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  locationPin: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  locationPinText: { fontSize: 16 },
  locationDetails: { flex: 1 },
  locationName: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 2 },
  locationCoordinates: { fontSize: 12, color: '#6b7280', fontFamily: 'monospace' },
  errorText: { color: '#dc2626', fontSize: 14, marginTop: 8 },
  mapButton: { backgroundColor: '#10b981', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  mapButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  passengerInputContainer: { flexDirection: 'row', alignItems: 'center' },
  passengerInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, width: 60, textAlign: 'center' },
  resultsSection: { backgroundColor: '#f9fafb', padding: 16, borderRadius: 8, marginTop: 16 },
  resultsTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 12, textAlign: 'center' },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resultLabel: { fontSize: 14, color: '#6b7280' },
  resultValue: { fontSize: 16, fontWeight: '600', color: '#374151' },
  noteText: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  mapModalContainer: { flex: 1, backgroundColor: '#fff' },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  mapTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  mapCloseButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  mapCloseButtonText: { fontSize: 18, color: '#374151' },
  map: { flex: 1 },
  mapControls: { backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  mapControlButton: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  mapControlButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  mapInstruction: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
});

export default FareEstimator;
