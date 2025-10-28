import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

const BookingDetailsScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { bookingId } = route.params;
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchBookingDetails();
  }, []);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      console.log('Fetching booking details for ID:', bookingId);
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, rides!inner(*)`)
        .eq('id', bookingId)
        .single();

      console.log('Booking query result:', { data, error });

      if (error) {
        console.error('Booking query error:', error);
        throw error;
      }

      // Fetch passenger and driver information separately
      console.log('Fetching user details for passenger:', data.passenger_id, 'and driver:', data.rides.driver_id);
      
      const [{ data: passengerData, error: passengerError }, { data: driverData, error: driverError }] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, email, average_rating, bio')
          .eq('id', data.passenger_id)
          .single(),
        supabase
          .from('users')
          .select('id, full_name, email, average_rating')
          .eq('id', data.rides.driver_id)
          .single()
      ]);
      
      console.log('User queries result:', { passengerData, passengerError, driverData, driverError });
      
      if (passengerError) {
        console.error('Passenger query error:', passengerError);
        throw passengerError;
      }
      if (driverError) {
        console.error('Driver query error:', driverError);
        throw driverError;
      }
      
      // Merge all data
      const bookingWithDetails = {
        ...data,
        passenger: passengerData || { full_name: 'Unknown', email: 'N/A', average_rating: null, bio: '' },
        rides: {
          ...data.rides,
          driver: driverData || { full_name: 'Unknown', email: 'N/A', average_rating: null }
        }
      };
      
      console.log('Final booking details:', bookingWithDetails);
      setBooking(bookingWithDetails);
    } catch (error) {
      console.error('Error in fetchBookingDetails:', error);
      Alert.alert('Error', `Failed to fetch booking details: ${error.message}`);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (newStatus) => {
    try {
      setProcessing(true);
      
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      // If accepting, update available seats
      if (newStatus === 'approved') {
        const { error: rideError } = await supabase
          .from('rides')
          .update({ 
            available_seats: booking.rides.available_seats - booking.seats_booked 
          })
          .eq('id', booking.ride_id);

        if (rideError) throw rideError;
      }

      Alert.alert('Success', `Booking ${newStatus} successfully`);
      fetchBookingDetails();
    } catch (error) {
      Alert.alert('Error', `Failed to update booking status`);
      console.error('Error updating booking status:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    const actionText = newStatus === 'approved' ? 'Accept' : 
                      newStatus === 'rejected' ? 'Reject' : 
                      newStatus === 'cancelled' ? 'Cancel' : 'Complete';

    Alert.alert(
      `${actionText} Booking`,
      `Are you sure you want to ${actionText.toLowerCase()} this booking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Yes, ${actionText}`,
          style: newStatus === 'rejected' || newStatus === 'cancelled' ? 'destructive' : 'default',
          onPress: () => updateBookingStatus(newStatus)
        }
      ]
    );
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

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    });
  };

  const confirmCompletion = async () => {
    Alert.alert(
      'Confirm Ride Completion',
      'Did you complete this ride with the driver?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Confirm',
          onPress: async () => {
            try {
              // 1. mark booking completed
              const { error } = await supabase
                .from('bookings')
                .update({ status: 'completed' })
                .eq('id', booking.id)
                .eq('passenger_id', user.id);
              if (error) throw error;

              // 2. bump passenger rides_taken
              await supabase.rpc('increment_field', {
                user_id: user.id,
                field: 'rides_taken',
                amount: 1
              });

              // 3. bump driver rides_offered
              await supabase.rpc('increment_field', {
                user_id: booking.rides.driver_id,
                field: 'rides_offered',
                amount: 1
              });

              // 4. open rating screen
              navigation.navigate('RateRide', { bookingId: booking.id });

              // 5. reload booking details
              fetchBookingDetails();
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Could not confirm completion');
            }
          }
        }
      ]
    );
  };

  const handlePayNow = async () => {
    try {
      if (!(booking.status === 'approved' || booking.status === 'confirmed' || booking.status === 'completed')) {
        Alert.alert('Not Eligible', 'Only approved, confirmed, or completed bookings can be paid.');
        return;
      }
      if (booking.payment_status === 'paid') {
        Alert.alert('Already Paid', 'This booking has already been paid.');
        return;
      }

      // If ride is not completed but payment is being made, auto-complete it
      if (booking.status !== 'completed') {
        // Auto-complete the ride when payment is initiated
        const { error: completeError } = await supabase
          .from('bookings')
          .update({ status: 'completed' })
          .eq('id', booking.id);

        if (completeError) {
          console.error('Auto-completion error:', completeError);
          Alert.alert('Error', 'Failed to complete ride. Please try again.');
          return;
        }

        // Update ride status to finished
        const { error: rideError } = await supabase
          .from('rides')
          .update({ status: 'finished' })
          .eq('id', booking.ride_id);

        if (rideError) {
          console.error('Ride status update error:', rideError);
        }

        // Increment ride counters for both driver and passenger
        const { error: incrementError } = await supabase.rpc('increment_field', {
          user_id: booking.passenger_id,
          field_name: 'rides_taken',
        });

        if (incrementError) {
          console.error('Passenger increment error:', incrementError);
        }

        const { error: driverIncrementError } = await supabase.rpc('increment_field', {
          user_id: booking.rides.driver_id,
          field_name: 'rides_offered',
        });

        if (driverIncrementError) {
          console.error('Driver increment error:', driverIncrementError);
        }

        // Refresh booking data
        const { data: updatedBooking, error: refreshError } = await supabase
          .from('bookings')
          .select(`
            *,
            rides!inner(*, driver:users!rides_driver_id_fkey(*)),
            passenger:users!bookings_passenger_id_fkey(*)
          `)
          .eq('id', booking.id)
          .single();

        if (!refreshError && updatedBooking) {
          setBooking(updatedBooking);
        }
      }

      navigation.navigate('FareEstimate', { 
        rideId: booking.ride_id, 
        bookingId: booking.id,
        passengerId: booking.passenger_id,
        driverId: booking.rides.driver_id,
        seatsBooked: booking.seats_booked,
        pricePerSeat: booking.rides.price_per_seat,
        totalAmount: booking.rides.price_per_seat * booking.seats_booked,
        bookingStatus: 'completed', // Now completed
      });
    } catch (err) {
      console.error('Payment error:', err);
      Alert.alert('Payment Failed', 'Unable to process payment right now.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

  if (!booking) {
    return null;
  }

  const isDriver = user.id === booking.rides.driver_id;
  const isPassenger = user.id === booking.passenger_id;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={[styles.statusBadge, { backgroundColor: 
          booking.status === 'pending' ? '#f59e0b20' :
          (booking.status === 'approved' || booking.status === 'confirmed') ? '#10b98120' :
          booking.status === 'rejected' ? '#ef444420' :
          booking.status === 'cancelled' ? '#6b728020' :
          '#6b728020'
        }]}>
          <Text style={[styles.statusText, { color: 
            booking.status === 'pending' ? '#f59e0b' :
            (booking.status === 'approved' || booking.status === 'confirmed') ? '#10b981' :
            booking.status === 'rejected' ? '#ef4444' :
            booking.status === 'cancelled' ? '#6b7280' :
            booking.status === 'pending_completion' ? '#f59e0b' :
        booking.status === 'pending_confirmation' ? '#8b5cf6' :
            '#6b7280'
          }]}>
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {/* Ride Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride Information</Text>
          
          <View style={styles.infoCard}>
            <Text style={styles.rideDate}>
              {formatDate(booking.rides.ride_date)} at {formatTime(booking.rides.ride_time)}
            </Text>
            
            <View style={styles.routeContainer}>
              <View style={styles.routeItem}>
                <View style={styles.routeDot} />
                <Text style={styles.locationText}>{booking.rides.origin}</Text>
              </View>
              
              <View style={styles.routeLine} />
              
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, styles.destinationDot]} />
                <Text style={styles.locationText}>{booking.rides.destination}</Text>
              </View>
            </View>

            <View style={styles.rideDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vehicle</Text>
                <Text style={styles.detailValue}>{booking.rides.vehicle_model}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>License Plate</Text>
                <Text style={styles.detailValue}>{booking.rides.vehicle_plate}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Available Seats</Text>
                <Text style={styles.detailValue}>{booking.rides.available_seats}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Booking Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.bookingDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Booking Date</Text>
                <Text style={styles.detailValue}>{formatDateTime(booking.created_at)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Seats Booked</Text>
                <Text style={styles.detailValue}>{booking.seats_booked}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Price per Seat</Text>
                <Text style={styles.detailValue}>${booking.rides.price_per_seat}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Amount</Text>
                <Text style={[styles.detailValue, styles.totalAmount]}>
                  ${booking.rides.price_per_seat * booking.seats_booked}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payment</Text>
                <Text style={[
                  styles.detailValue,
                  booking.payment_status === 'paid' ? styles.paidValue : styles.unpaidValue
                ]}>
                  {booking.payment_status === 'paid' ? 'Paid' : (booking.payment_status === 'failed' ? 'Failed' : 'Pending')}
                </Text>
              </View>
            </View>

            {booking.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{booking.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Driver Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Information</Text>
          
          <View style={styles.infoCard}>
            <Text style={styles.personName}>{booking.rides.driver?.full_name || 'Unknown Driver'}</Text>
            <Text style={styles.personContact}>{booking.rides.driver?.email || 'No email available'}</Text>

            {booking.rides.driver?.average_rating && (
              <Text style={styles.ratingText}>⭐ {booking.rides.driver.average_rating.toFixed(1)}</Text>
            )}
          </View>
        </View>

        {/* Passenger Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Passenger Information</Text>
          
          <View style={styles.infoCard}>
            <Text style={styles.personName}>{booking.passenger?.full_name || 'Unknown Passenger'}</Text>
            <Text style={styles.personContact}>{booking.passenger?.email || 'No email available'}</Text>

            {booking.passenger?.average_rating && (
              <Text style={styles.ratingText}>⭐ {booking.passenger.average_rating.toFixed(1)}</Text>
            )}
            {booking.passenger?.bio && (
              <Text style={styles.bioText}>{booking.passenger.bio}</Text>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          {isDriver && booking.status === 'pending' && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleStatusChange('rejected')}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Reject Booking</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleStatusChange('approved')}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Accept Booking</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {isPassenger && booking.status === 'pending' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleStatusChange('cancelled')}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Cancel Booking</Text>
              )}
            </TouchableOpacity>
          )}

          {(booking.status === 'approved' || booking.status === 'confirmed' || booking.status === 'completed') && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.contactButton]}
                onPress={() => {
                  const otherUserId = isDriver ? booking.passenger_id : booking.rides.driver_id;
                  const otherUserName = isDriver ? booking.passenger?.full_name || 'Passenger' : booking.rides.driver?.full_name || 'Driver';
                  navigation.navigate('Chat', { 
                    bookingId: booking.id, 
                    otherUserName: otherUserName 
                  });
                }}
              >
                <Text style={styles.actionButtonText}>Send Message</Text>
              </TouchableOpacity>

              {!isDriver && (booking.status === 'approved' || booking.status === 'confirmed' || booking.status === 'completed') && booking.payment_status !== 'paid' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.payButton]}
                  onPress={handlePayNow}
                >
                  <Text style={styles.actionButtonText}>Pay Now</Text>
                </TouchableOpacity>
              )}

              {!isDriver && (booking.status === 'pending_completion' || booking.status === 'pending_confirmation') && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.contactButton]}
                  onPress={confirmCompletion}
                >
                  <Text style={styles.actionButtonText}>Confirm Completion</Text>
                </TouchableOpacity>
              )}

              {isDriver && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.completeButton]}
                  onPress={() => handleStatusChange('completed')}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Mark as Completed</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {booking.status === 'completed' && !booking.is_rated && (
            <TouchableOpacity
              style={[styles.actionButton, styles.rateButton]}
              onPress={() => navigation.navigate('RateRide', { bookingId: booking.id })}
            >
              <Text style={styles.actionButtonText}>Rate This Ride</Text>
            </TouchableOpacity>
          )}

          {booking.status === 'completed' && booking.is_rated && (
            <View style={[styles.infoCard, { alignItems: 'center' }]}>
              <Text style={styles.sectionTitle}>✅ Ride Rated</Text>
              <Text style={{ color: '#6b7280', marginTop: 5 }}>
                You have already rated this ride
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  routeContainer: {
    marginVertical: 8,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 12,
  },
  destinationDot: {
    backgroundColor: '#ef4444',
  },
  routeLine: {
    width: 1,
    height: 16,
    backgroundColor: '#e5e7eb',
    marginLeft: 3.5,
    marginVertical: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  rideDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  totalAmount: {
    color: '#10b981',
    fontSize: 16,
  },
  bookingDetails: {
    marginTop: 12,
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  personName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  personContact: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#f59e0b',
    marginTop: 4,
  },
  bioText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
  },
  contactButton: {
    backgroundColor: '#2563eb',
  },
  completeButton: {
    backgroundColor: '#8b5cf6',
  },
  rateButton: {
    backgroundColor: '#f59e0b',
  },
  payButton: {
    backgroundColor: '#f59e0b',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  paidValue: {
    color: '#10b981',
  },
  unpaidValue: {
    color: '#f59e0b',
  },
});

export default BookingDetailsScreen;