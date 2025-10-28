import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SOSProvider } from './contexts/SOSContext';
import { StripeProvider, stripeConfig } from './utils/StripeService';
import notificationService from './services/notificationService';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import OfferRideScreen from './screens/OfferRideScreen';
import MyRidesScreen from './screens/MyRidesScreen';
import RideDetailsScreen from './screens/RideDetailsScreen';
import SearchRidesScreen from './screens/SearchRidesScreen';
import BookRideScreen from './screens/BookRideScreen';
import MyBookingsScreen from './screens/MyBookingsScreen';
import BookingRequestsScreen from './screens/BookingRequestsScreen';
import BookingDetailsScreen from './screens/BookingDetailsScreen';
import PassengerBookingsScreen from './screens/PassengerBookingsScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import ChatScreen from './screens/ChatScreen';
import GlobalChatScreen from './screens/GlobalChatScreen';
import RateRideScreen from './screens/RateRideScreen';
import MapScreen from './screens/MapScreen';
import RequestRideScreen from './screens/RequestRideScreen';
import DriverRideRequestsScreen from './screens/DriverRideRequestsScreen';
import MyRideRequestsScreen from './screens/MyRideRequestsScreen';
import FareEstimateScreen from './screens/FareEstimateScreen';
import EmergencyContactsScreen from './screens/EmergencyContactsScreen';
import NotificationSettingsScreen from './screens/NotificationSettingsScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { user, loading } = useAuth();
  const navigationRef = useRef();

  useEffect(() => {
    // Register for push notifications when user logs in
    if (user?.id) {
      console.log('Registering for push notifications...');
      notificationService.registerForPushNotifications(user.id);
    }

    // Setup notification listeners
    if (navigationRef.current) {
      notificationService.setupNotificationListeners(navigationRef.current);
    }

    // Cleanup on unmount
    return () => {
      notificationService.removeNotificationListeners();
    };
  }, [user]);

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator>
        {user ? (
          // User is signed in
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="OfferRide" component={OfferRideScreen} />
          <Stack.Screen name="MyRides" component={MyRidesScreen} />
          <Stack.Screen name="RideDetails" component={RideDetailsScreen} />
          <Stack.Screen name="SearchRides" component={SearchRidesScreen} />
          <Stack.Screen name="BookRide" component={BookRideScreen} />
          <Stack.Screen name="MyBookings" component={MyBookingsScreen} />
          <Stack.Screen name="BookingRequests" component={BookingRequestsScreen} />
          <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
          <Stack.Screen name="PassengerBookings" component={PassengerBookingsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
          <Stack.Screen name="GlobalChat" component={GlobalChatScreen} options={{ title: 'Messages' }} />
          <Stack.Screen name="RateRide" component={RateRideScreen} options={{ title: 'Rate Ride' }} />
          <Stack.Screen name="Map" component={MapScreen} options={{ title: 'Select Location' }} />
          <Stack.Screen name="RequestRide" component={RequestRideScreen} options={{ title: 'Request a Ride' }} />
          <Stack.Screen name="DriverRideRequests" component={DriverRideRequestsScreen} options={{ title: 'Ride Requests' }} />
          <Stack.Screen name="MyRideRequests" component={MyRideRequestsScreen} options={{ title: 'My Ride Requests' }} />
          <Stack.Screen name="FareEstimate" component={FareEstimateScreen} options={{ title: 'Fare Estimate' }} />
          <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} options={{ title: 'Emergency Contacts' }} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notifications' }} />
          </>
        ) : (
          // User is not signed in
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SOSProvider>
        <StripeProvider
          publishableKey={stripeConfig.publishableKey}
          merchantIdentifier={stripeConfig.merchantIdentifier}
          urlScheme="sharemyride"
        >
          <AppNavigator />
        </StripeProvider>
      </SOSProvider>
    </AuthProvider>
  );
}
