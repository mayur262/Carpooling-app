import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text, Platform } from 'react-native';
import * as Location from 'expo-location';
import SafeMapView, { Marker, PROVIDER_GOOGLE } from '../components/SafeMapView';

const MapScreen = ({ navigation, route }) => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const { mode, onLocationSelect } = route.params || {};

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      
      if (mode === 'select') {
        setIsSelecting(true);
      }
    })();
  }, []);

  const handleMapPress = (event) => {
    if (isSelecting) {
      const { coordinate } = event.nativeEvent;
      setSelectedLocation(coordinate);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedLocation && onLocationSelect) {
      onLocationSelect(selectedLocation);
      navigation.goBack();
    }
  };

  const handleUseCurrentLocation = () => {
    if (location && onLocationSelect) {
      onLocationSelect(location.coords);
      navigation.goBack();
    }
  };

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webMapContainer}>
          <Text style={styles.webMapTitle}>📍 Select Location</Text>
          <Text style={styles.webMapDescription}>
            Interactive map is available on mobile devices
          </Text>
          <View style={styles.webLocationInfo}>
            <Text style={styles.webLocationTitle}>Current Location:</Text>
            {location ? (
              <>
                <Text style={styles.webLocationText}>
                  Latitude: {location.coords.latitude.toFixed(6)}
                </Text>
                <Text style={styles.webLocationText}>
                  Longitude: {location.coords.longitude.toFixed(6)}
                </Text>
              </>
            ) : (
              <Text style={styles.webLocationText}>
                No location available
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.webConfirmButton}
            onPress={handleUseCurrentLocation}
          >
            <Text style={styles.webConfirmButtonText}>Use Current Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {SafeMapView && (
        <SafeMapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
          onPress={handleMapPress}
        >
          {selectedLocation && (
            <Marker
              coordinate={selectedLocation}
              pinColor="#2563eb"
              title="Selected Location"
              description="Tap to confirm this location"
            />
          )}
        </SafeMapView>
      )}
      
      {isSelecting && (
        <View style={styles.selectionContainer}>
          <View style={styles.selectionInfo}>
            <Text style={styles.selectionText}>
              {selectedLocation ? 'Location selected!' : 'Tap on the map to select a location'}
            </Text>
          </View>
          {selectedLocation && (
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmSelection}>
              <Text style={styles.confirmButtonText}>Confirm Location</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: 'red',
  },
  selectionContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  selectionInfo: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#4ECDC4',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  webMapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  webMapTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 16,
  },
  webMapDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  webLocationInfo: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 20,
  },
  webLocationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  webLocationText: {
    fontSize: 16,
    color: '#6b7280',
    marginVertical: 4,
  },
  webConfirmButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  webConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MapScreen;