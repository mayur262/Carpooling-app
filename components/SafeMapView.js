import React from 'react';
import { MapView as NativeMapView, Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Platform } from 'react-native';

// A safe wrapper for MapView to prevent boolean casting errors on Android
const SafeMapView = (props) => {
  const {
    showsUserLocation,
    showsMyLocationButton,
    showsCompass,
    showsTraffic,
    ...rest
  } = props;

  // Ensure boolean props are strictly booleans
  const safeProps = {
    ...rest,
    showsUserLocation: showsUserLocation === true,
    showsMyLocationButton: showsMyLocationButton === true,
    showsCompass: showsCompass === true,
    showsTraffic: showsTraffic === true,
  };

  // Use PROVIDER_GOOGLE for consistency, especially if using Google Maps features
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    safeProps.provider = PROVIDER_GOOGLE;
  }

  return <NativeMapView {...safeProps} />;
};

// Export Marker and Polyline so they can be used with SafeMapView
export { Marker, Polyline, PROVIDER_GOOGLE };
export default SafeMapView;
