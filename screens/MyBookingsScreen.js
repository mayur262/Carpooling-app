import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSOS } from '../contexts/SOSContext';
import * as Location from 'expo-location';

const MyBookingsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { triggerSOS } = useSOS();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const fetchMyBookings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          rides!inner(*)
        `)
        .eq('passenger_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch driver information separately
      if (data && data.length > 0) {
        const driverIds = data.map(booking => booking.rides?.driver_id).filter(Boolean);
        const { data: driversData, error: driversError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', driverIds);
        
        if (driversError) throw driversError;
        
        // Merge driver data with bookings
        const bookingsWithDrivers = data.map(booking => ({
          ...booking,
          rides: {
            ...booking.rides,
            driver: driversData?.find(d => d.id === booking.rides?.driver_id) || { full_name: 'Unknown', email: 'N/A' }
          }
        }));
        
        setBookings(bookingsWithDrivers);
        
        // Fetch unread messages for all bookings
        const bookingIds = bookingsWithDrivers.map(b => b.id);
        if (bookingIds.length > 0) {
          await fetchUnreadMessages(bookingIds);
        }
      } else {
        setBookings(data || []);
      }

      if (error) throw error;
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch your bookings');
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyBookings();
  };

  const handlePayNow = async (booking) => {
    try {
      if (!(booking.status === 'approved' || booking.status === 'confirmed' || booking.status === 'completed')) {
        Alert.alert('Not Eligible', 'Only approved, confirmed, or completed bookings can be paid.');
        return;
      }
      if (booking.payment_status === 'paid') {
        Alert.alert('Already Paid', 'This booking has already been paid.');
        return;
      }

      // Show confirmation popup for drivers
      Alert.alert(
        'Confirm Ride Completion',
        'Has the ride been completed?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              // Navigate to fare estimate screen to show breakdown before payment
              navigation.navigate('FareEstimate', { 
                rideId: booking.ride_id, 
                bookingId: booking.id 
              });
            }
          }
        ]
      );
    } catch (err) {
      console.error('Payment error:', err);
      Alert.alert('Payment Failed', 'Unable to process payment right now.');
    }
  };

  const fetchUnreadMessages = async (bookingIds) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('booking_id, is_read, sender_id')
        .in('booking_id', bookingIds)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      if (error) throw error;

      // Count unread messages per booking
      const unreadCount = {};
      data.forEach(msg => {
        unreadCount[msg.booking_id] = (unreadCount[msg.booking_id] || 0) + 1;
      });
      
      setUnreadMessages(unreadCount);
    } catch (error) {
      console.error('Error fetching unread messages:', error);
    }
  };

  const confirmCompletion = async (booking) => {
    Alert.alert(
      'Confirm Ride Completion',
      'Did you complete this ride with the driver?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Confirm',
          onPress: async () => {
            try {
              // 1. Update booking status from pending_confirmation to completed
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

              // 5. refresh list
              fetchMyBookings();
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Could not confirm completion');
            }
          }
        }
      ]
    );
  };

  const cancelBooking = async (bookingId) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId)
                .eq('passenger_id', user.id);

              if (error) throw error;
              
              // Create notification for driver about cancellation
              try {
                const booking = bookings.find(b => b.id === bookingId);
                if (booking && booking.rides) {
                  await supabase.rpc('create_notification', {
                    target_user_id: booking.rides.driver_id,
                    notification_title: 'Booking Cancelled',
                    notification_message: `A passenger has cancelled their booking for your ride from ${booking.rides.origin} to ${booking.rides.destination}.`,
                    notification_type: 'booking',
                    related_uuid: bookingId
                  });
                }
              } catch (notificationError) {
                console.error('Error creating driver notification:', notificationError);
              }
              
              Alert.alert('Success', 'Booking cancelled successfully');
              fetchMyBookings();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel booking');
            }
          }
        }
      ]
    );
  };

  const handleSOS = async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Location permission is required to send SOS alert');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      // Show confirmation dialog
      Alert.alert(
        'Emergency SOS',
        'Are you sure you want to send an emergency alert? This will notify your emergency contacts.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send SOS',
            style: 'destructive',
            onPress: async () => {
              try {
                await triggerSOS(latitude, longitude);
                Alert.alert('SOS Sent', 'Emergency alert sent successfully to your contacts');
              } catch (error) {
                Alert.alert('SOS Failed', 'Failed to send emergency alert. Please try again.');
                console.error('SOS error:', error);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to get location for SOS');
      console.error('Location error:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'approved': return '#10b981';
      case 'cancelled': return '#ef4444';
      case 'completed': return '#6b7280';
      case 'pending_completion': return '#f59e0b'; // amber
      case 'pending_confirmation': return '#8b5cf6'; // purple for new status
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
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

  const renderBookingItem = ({ item }) => (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingDate}>{formatDateTime(item.created_at)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.payment_status === 'paid' ? 'completed' : item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.payment_status === 'paid' ? 'completed' : item.status) }]}>
            {item.payment_status === 'paid' ? 'Completed' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.rideInfo}>
        <Text style={styles.rideDate}>{formatDate(item.rides.ride_date)} at {formatTime(item.rides.ride_time)}</Text>
        
        <View style={styles.routeContainer}>
          <View style={styles.routeItem}>
            <View style={styles.routeDot} />
            <Text style={styles.locationText}>{item.rides.origin}</Text>
          </View>
          
          <View style={styles.routeLine} />
          
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, styles.destinationDot]} />
            <Text style={styles.locationText}>{item.rides.destination}</Text>
          </View>
        </View>

        <View style={styles.bookingDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Seats Booked</Text>
            <Text style={styles.detailValue}>{item.seats_booked}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Price per Seat</Text>
            <Text style={styles.detailValue}>${item.rides.price_per_seat}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Total Cost</Text>
            <Text style={styles.detailValue}>${item.rides.price_per_seat * item.seats_booked}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Payment</Text>
            <Text style={[
              styles.detailValue,
              item.payment_status === 'paid' ? styles.paidValue : styles.unpaidValue
            ]}>
              {item.payment_status === 'paid' ? 'Paid' : (item.payment_status === 'failed' ? 'Failed' : 'Pending')}
            </Text>
          </View>
        </View>

        <View style={styles.driverInfo}>
          <Text style={styles.driverLabel}>Driver</Text>
          <Text style={styles.driverName}>{item.rides.driver?.full_name || 'Unknown Driver'}</Text>
          <Text style={styles.driverContact}>{item.rides.driver?.email || 'No email available'}</Text>

        </View>

        {item.notes && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Your Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => navigation.navigate('RideDetails', { rideId: item.ride_id })}
        >
          <Text style={styles.actionButtonText}>View Ride</Text>
        </TouchableOpacity>

        {item.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => cancelBooking(item.id)}
          >
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {(item.status === 'approved' || item.status === 'confirmed' || item.status === 'completed') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={() => navigation.navigate('Chat', { 
              bookingId: item.id,
              otherUserName: item.rides.driver?.full_name || 'Driver' 
            })}
          >
            <Text style={styles.actionButtonText}>Send Message</Text>
            {unreadMessages[item.id] > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadMessages[item.id]}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {(item.status === 'approved' || item.status === 'confirmed' || item.status === 'completed') && item.payment_status !== 'paid' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.payButton]}
            onPress={() => handlePayNow(item)}
          >
            <Text style={styles.actionButtonText}>Pay Now</Text>
          </TouchableOpacity>
        )}

        {(item.status === 'pending_completion' || item.status === 'pending_confirmation') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={() => confirmCompletion(item)}
          >
            <Text style={styles.actionButtonText}>Confirm Completion</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading your bookings...</Text>
      </View>
    );
  }

  if (bookings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No bookings yet</Text>
        <Text style={styles.emptyText}>Start exploring available rides!</Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => navigation.navigate('SearchRides')}
        >
          <Text style={styles.searchButtonText}>Find a Ride</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Bookings</Text>
          <TouchableOpacity style={styles.sosButton} onPress={handleSOS}>
            <Text style={styles.sosButtonText}>SOS</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={bookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
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
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  sosButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sosButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rideInfo: {
    marginTop: 8,
  },
  rideDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
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
  bookingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  driverInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  driverLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  driverContact: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  notesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notesLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#2563eb',
  },
  cancelButton: {
    backgroundColor: '#ef4444',
  },
  contactButton: {
    backgroundColor: '#10b981',
  },
  payButton: {
    backgroundColor: '#f59e0b',
  },
  paidValue: {
    color: '#10b981',
  },
  unpaidValue: {
    color: '#f59e0b',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  unreadBadge: {
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 20,
  },
  searchButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default MyBookingsScreen;