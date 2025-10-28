import { Platform, View, Text } from 'react-native';

// Web fallback components
const WebMapView = ({ style, children, ...props }) => (
  <View style={[style, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]} {...props}>
    <Text>Map not available on web</Text>
    {children}
  </View>
);

const WebMarker = ({ children }) => (
  <View>{children}</View>
);

// Use a more robust conditional loading approach
let MapViewComponent = WebMapView;
let MarkerComponent = WebMarker;
let ProviderGoogle = null;

if (Platform.OS !== 'web') {
  try {
    // Use dynamic import to avoid bundler parsing issues
    const maps = require('react-native-maps');
    MapViewComponent = maps.default;
    MarkerComponent = maps.Marker;
    ProviderGoogle = maps.PROVIDER_GOOGLE;
  } catch (error) {
    console.warn('Failed to load react-native-maps:', error);
  }
}

// Export the components
export const MapView = MapViewComponent;
export const Marker = MarkerComponent;
export const PROVIDER_GOOGLE = ProviderGoogle;

// Get functions for backward compatibility
export const getMapView = () => MapViewComponent;
export const getMarker = () => MarkerComponent;
export const getProvider = () => ProviderGoogle;