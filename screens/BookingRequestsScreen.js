import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

const BookingRequestsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    if (user) {
      fetchMyRides();
    }
  }, [user]);

  useEffect(() => {
    if (rides.length > 0) {
      fetchBookingRequests();
    }
  }, [rides]);

  const fetchMyRides = async () => {
    try {
      console.log('Starting fetchMyRides...');
      console.log('User:', user?.id);
      
      if (!user?.id) {
        console.log('No user found');
        Alert.alert('Error', 'No user found. Please log in again.');
        setLoading(false);
        return;
      }

      console.log('Fetching rides for driver ID:', user.id);
      
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .order('ride_date', { ascending: false });

      console.log('Rides query result:', { data, error, userId: user.id });

      if (error) {
        console.error('Error fetching rides:', error);
        Alert.alert('Database Error', `Failed to fetch rides: ${error.message}`);
        throw error;
      }

      console.log('Fetched rides:', data);
      setRides(data || []);
    } catch (error) {
      console.error('Error in fetchMyRides:', error);
      Alert.alert('Error', 'Failed to load your rides. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingRequests = async () => {
    try {
      setBookingLoading(true);
      const rideIds = rides.map(ride => ride.id);
      
      if (rideIds.length === 0) {
        setBookingRequests([]);
        return;
      }

      console.log('Fetching booking requests for ride IDs:', rideIds);
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          passengers:passenger_id(full_name),
          rides:ride_id(origin, destination, ride_date, ride_time)
        `)
        .in('ride_id', rideIds)
        .eq('status', 'pending');

      console.log('Booking requests result:', { data, error });
      if (error) throw error;

      setBookingRequests(data || []);
    } catch (error) {
      console.error('Error fetching booking requests:', error);
      Alert.alert('Error', 'Failed to load booking requests');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleBookingAction = async (bookingId, action) => {
    try {
      setProcessingId(bookingId);
      
      const status = action === 'accept' ? 'confirmed' : 'rejected';
      
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId);

      if (error) throw error;

      Alert.alert(
        'Success',
        `Booking ${action === 'accept' ? 'accepted' : 'rejected'} successfully`
      );
      
      fetchBookingRequests();
    } catch (error) {
      console.error(`Error ${action}ing booking:`, error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      Alert.alert('Error', `Failed to ${action} booking: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const renderRide = ({ item }) => (
    <View style={styles.rideCard}>
      <Text style={styles.rideTitle}>{item.origin} → {item.destination}</Text>
      <Text style={styles.rideTime}>{new Date(item.ride_date).toLocaleDateString()} at {item.ride_time}</Text>
      <Text style={styles.rideSeats}>Available seats: {item.available_seats}</Text>
      <TouchableOpacity
        style={styles.completeButton}
        onPress={() => {
          Alert.alert(
            'Complete Ride',
            'Are you sure you want to mark this ride as completed?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, Complete',
                onPress: () => {
                  navigation.navigate('FareEstimate', { rideId: item.id });
                }
              }
            ]
          );
        }}
      >
        <Text style={styles.completeButtonText}>Mark as Completed</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBookingRequest = ({ item }) => (
    <View style={styles.bookingCard}>
      <Text style={styles.bookingTitle}>
        {item.passengers?.full_name || 'Passenger'} - {item.seats_booked} seat(s)
      </Text>
      <Text style={styles.bookingRide}>
        {item.rides.origin} → {item.rides.destination}
      </Text>
      <View style={styles.bookingActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleBookingAction(item.id, 'accept')}
          disabled={processingId === item.id}
        >
          {processingId === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Accept</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleBookingAction(item.id, 'reject')}
          disabled={processingId === item.id}
        >
          {processingId === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionButtonText}>Reject</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading booking requests...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>My Rides</Text>
      <FlatList
        data={rides}
        renderItem={renderRide}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No rides created yet</Text>}
        style={{ flex: 1 }}
      />
      
      <Text style={styles.sectionTitle}>Booking Requests</Text>
      {bookingLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Loading booking requests...</Text>
        </View>
      )}
      
      <FlatList
        data={bookingLoading ? [] : bookingRequests}
        renderItem={renderBookingRequest}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={!bookingLoading && <Text style={styles.emptyText}>No booking requests</Text>}
        style={{ flex: 1 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', margin: 15 },
  rideCard: { backgroundColor: '#fff', margin: 10, padding: 15, borderRadius: 10, elevation: 2 },
  rideTitle: { fontSize: 18, fontWeight: 'bold' },
  rideTime: { color: '#666', marginVertical: 5 },
  rideSeats: { marginBottom: 10 },
  completeButton: { backgroundColor: '#28a745', padding: 10, borderRadius: 8, alignItems: 'center' },
  completeButtonText: { color: '#fff', fontWeight: 'bold' },
  bookingCard: { backgroundColor: '#f9f9f9', margin: 10, padding: 15, borderRadius: 10, elevation: 1 },
  bookingTitle: { fontSize: 16, fontWeight: 'bold' },
  bookingRide: { color: '#666', marginVertical: 5 },
  bookingActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  actionButton: { padding: 10, borderRadius: 8, flex: 1, marginHorizontal: 5, alignItems: 'center' },
  acceptButton: { backgroundColor: '#28a745' },
  rejectButton: { backgroundColor: '#dc3545' },
  actionButtonText: { color: '#fff', fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#666', marginVertical: 20 }
});

export default BookingRequestsScreen;
