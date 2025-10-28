// Mock implementation of react-native-maps for web
import { View, Text } from 'react-native';

export const PROVIDER_GOOGLE = null;

export const MapView = ({ children, style, ...props }) => (
  <View style={[{ backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }, style]}>
    <Text>Map View (Web)</Text>
    {children}
  </View>
);

export const Marker = ({ coordinate, title, description, pinColor }) => (
  <View style={{ backgroundColor: pinColor || 'red', padding: 10, borderRadius: 5 }}>
    <Text>{title || 'Marker'}</Text>
    {description && <Text>{description}</Text>}
  </View>
);

export default {
  PROVIDER_GOOGLE,
  MapView,
  Marker,
};