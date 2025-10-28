import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import SafeTextInput from '../components/SafeTextInput';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

const BookRideScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { rideId } = route.params;
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seats, setSeats] = useState('1');
  const [notes, setNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    fetchRideDetails();
  }, []);

  const fetchRideDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('rides')
        .select(`*`)
        .eq('id', rideId)
        .single();

      if (error) throw error;

      // Fetch driver information
      const { data: driverData, error: driverError } = await supabase
        .from('users')
        .select('id, full_name, email, bio, average_rating')
        .eq('id', data.driver_id)
        .single();
      
      if (driverError) throw driverError;
      
      // Fetch bookings for this ride
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, passenger_id, seats_booked, status')
        .eq('ride_id', rideId);
      
      if (bookingsError) throw bookingsError;
      
      // Merge driver and bookings data with ride
      const rideWithDetails = {
        ...data,
        driver: driverData || { full_name: 'Unknown', email: 'N/A', bio: '', average_rating: null },
        bookings: bookingsData || []
      };
      
      setRide(rideWithDetails);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch ride details');
      console.error('Error fetching ride details:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateConfirmedSeats = (bookings) => {
    return bookings?.reduce(
      (sum, booking) =>
        (booking.status === 'approved' || booking.status === 'confirmed')
          ? sum + booking.seats_booked
          : sum,
      0
    ) || 0;
  };

  const handleBooking = async () => {
    if (!seats || parseInt(seats) < 1) {
      Alert.alert('Error', 'Please enter a valid number of seats');
      return;
    }

    const numSeats = parseInt(seats);
    const confirmedSeats = calculateConfirmedSeats(ride.bookings);
    const availableSeats = ride.available_seats - confirmedSeats;

    if (numSeats > availableSeats) {
      Alert.alert('Error', `Only ${availableSeats} seats available`);
      return;
    }

    try {
      setBookingLoading(true);
      
      // Ensure user profile exists
      const { data: userProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!userProfile) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            full_name: user.user_metadata?.name || 'User',
            email: user.email,
            bio: '',
            role: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (profileError) {
          throw new Error('Failed to create user profile. Please try again.');
        }
      }
      
      // Check if booking already exists
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('ride_id', rideId)
        .eq('passenger_id', user.id)
        .single();

      if (existingBooking) {
        Alert.alert('Error', 'You already have a booking for this ride');
        return;
      }

      // Create booking
      const totalPrice = numSeats * ride.price_per_seat;
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .insert({
          ride_id: rideId,
          passenger_id: user.id,
          seats_booked: numSeats,
          total_price: totalPrice,
          status: 'pending'
          // booking_notes: notes.trim() // enable if column exists
        })
        .select()
        .single();

      if (error) throw error;
      
      // Notify driver
      try {
        await supabase.rpc('create_notification', {
          target_user_id: ride.driver_id,
          notification_title: 'New Booking Request',
          notification_message: `${user.user_metadata?.name || 'A passenger'} has requested to book ${numSeats} seat(s) for your ride from ${ride.origin} to ${ride.destination}`,
          notification_type: 'booking',
          related_uuid: bookingData.id
        });
      } catch (notificationError) {
        console.error('Error creating driver notification:', notificationError);
      }
      
      Alert.alert(
        'Success',
        'Your booking request has been sent to the driver',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Detailed booking error:', error);
      Alert.alert('Error', `Failed to create booking: ${error.message || error}`);
    } finally {
      setBookingLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric',
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading ride details...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Ride not found</Text>
      </View>
    );
  }

  const confirmedSeats = calculateConfirmedSeats(ride.bookings);
  const availableSeats = ride.available_seats - confirmedSeats;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Book Ride</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Ride Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ride Details</Text>
        
        <View style={styles.dateTimeContainer}>
          <Text style={styles.dateText}>{formatDate(ride.ride_date)}</Text>
          <Text style={styles.timeText}>{formatTime(ride.ride_time)}</Text>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routeItem}>
            <View style={styles.routeDot} />
            <Text style={styles.locationText}>{ride.origin}</Text>
          </View>
          
          <View style={styles.routeLine} />
          
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, styles.destinationDot]} />
            <Text style={styles.locationText}>{ride.destination}</Text>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Available Seats</Text>
            <Text style={[styles.detailValue, { color: availableSeats > 0 ? '#10b981' : '#ef4444' }]}>
              {availableSeats}/{ride.available_seats}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Price per Seat</Text>
            <Text style={styles.detailValue}>${ride.price_per_seat}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Total Cost</Text>
            <Text style={styles.detailValue}>${ride.price_per_seat * parseInt(seats || 1)}</Text>
          </View>
        </View>
      </View>

      {/* Driver Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Driver Information</Text>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{ride.driver?.full_name || 'Unknown Driver'}</Text>
          <Text style={styles.driverEmail}>{ride.driver?.email || 'No email available'}</Text>
          
          {ride.driver?.average_rating && (
            <Text style={styles.rating}>⭐ {ride.driver.average_rating.toFixed(1)} rating</Text>
          )}
          {ride.driver?.bio && (
            <Text style={styles.driverBio}>{ride.driver.bio}</Text>
          )}
        </View>

        {ride.vehicle_type && (
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleLabel}>Vehicle</Text>
            <Text style={styles.vehicleText}>
              {ride.vehicle_type}{ride.vehicle_model && ` • ${ride.vehicle_model}`}
            </Text>
            {ride.vehicle_color && (
              <Text style={styles.vehicleText}>Color: {ride.vehicle_color}</Text>
            )}
            {ride.vehicle_plate && (
              <Text style={styles.vehicleText}>Plate: {ride.vehicle_plate}</Text>
            )}
          </View>
        )}

        {ride.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>Additional Information</Text>
            <Text style={styles.descriptionText}>{ride.description}</Text>
          </View>
        )}
      </View>

      {/* Booking Form */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Booking Details</Text>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Number of Seats *</Text>
          <SafeTextInput
            style={styles.input}
            placeholder="Enter number of seats"
            value={seats}
            onChangeText={setSeats}
            keyboardType="numeric"
            maxLength={1}
          />
          <Text style={styles.helpText}>Maximum {availableSeats} seats available</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Notes for Driver (Optional)</Text>
          <SafeTextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any special requests or notes for the driver..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.bookButton, (!seats || parseInt(seats) < 1 || parseInt(seats) > availableSeats) && styles.disabledButton]}
          onPress={handleBooking}
          disabled={bookingLoading || !seats || parseInt(seats) < 1 || parseInt(seats) > availableSeats}
        >
          {bookingLoading ? (
            <Text style={styles.bookButtonText}>Booking...</Text>
          ) : (
            <Text style={styles.bookButtonText}>
              Book Ride - ${ride.price_per_seat * parseInt(seats || 1)}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Your booking request will be sent to the driver for approval. You'll be notified once it's confirmed.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2563eb', padding: 20, paddingTop: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  backButton: { padding: 8 },
  backButtonText: { color: '#fff', fontSize: 16 },
  section: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 12 },
  dateTimeContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  dateText: { fontSize: 18, fontWeight: '600', color: '#374151' },
  timeText: { fontSize: 16, color: '#6b7280' },
  routeContainer: { marginVertical: 8 },
  routeItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  routeDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10b981', marginRight: 12 },
  destinationDot: { backgroundColor: '#ef4444' },
  routeLine: { width: 2, height: 16, backgroundColor: '#e5e7eb', marginLeft: 5, marginVertical: 2 },
  locationText: { fontSize: 16, color: '#374151', flex: 1 },
  detailsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  detailItem: { alignItems: 'center' },
  detailLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '600', color: '#374151' },
  driverInfo: { marginBottom: 16 },
  driverName: { fontSize: 16, fontWeight: '600', color: '#374151' },
  driverEmail: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  driverPhone: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  rating: { fontSize: 14, color: '#f59e0b', marginTop: 4 },
  driverBio: { fontSize: 14, color: '#6b7280', marginTop: 8, fontStyle: 'italic' },
  vehicleInfo: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  vehicleLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  vehicleText: { fontSize: 14, color: '#6b7280', marginVertical: 2 },
  descriptionContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  descriptionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  descriptionText: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  textArea: { height: 80, textAlignVertical: 'top' },
  helpText: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  bookButton: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  disabledButton: { backgroundColor: '#9ca3af' },
  bookButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disclaimer: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 12, lineHeight: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default BookRideScreen;
