import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

const PassengerBookingsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [unreadMessages, setUnreadMessages] = useState({}); // all, upcoming, completed, cancelled

  useEffect(() => {
    fetchPassengerBookings();
  }, [filter]);

  const fetchPassengerBookings = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('bookings')
        .select(`
          *,
          rides!inner(*)
        `)
        .eq('passenger_id', user.id);

      // Apply filters
      if (filter === 'upcoming') {
        query = query.in('status', ['pending', 'approved']);
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed');
      } else if (filter === 'cancelled') {
        query = query.eq('status', 'cancelled');
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch driver information separately
      if (data && data.length > 0) {
        const driverIds = data.map(booking => booking.rides.driver_id);
        const { data: driversData, error: driversError } = await supabase
          .from('users')
          .select('id, full_name, email, average_rating')
          .in('id', driverIds);
        
        if (driversError) throw driversError;
        
        // Merge driver data with bookings
        const bookingsWithDrivers = data.map(booking => ({
          ...booking,
          rides: {
            ...booking.rides,
            driver: driversData.find(d => d.id === booking.rides.driver_id) || { full_name: 'Unknown', email: 'N/A', average_rating: null }
          }
        }));
        
        setBookings(bookingsWithDrivers);
        // Fetch unread messages for all bookings
        const bookingIds = bookingsWithDrivers.map(b => b.id);
        await fetchUnreadMessages(bookingIds);
      } else {
        setBookings(data || []);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch your bookings');
      console.error('Error fetching passenger bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUnreadMessages = async (bookingIds) => {
    if (!bookingIds.length) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('messages')
        .select('booking_id, sender_id')
        .in('booking_id', bookingIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

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

  const onRefresh = () => {
    setRefreshing(true);
    fetchPassengerBookings();
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

      // Show confirmation popup for riders
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

  const cancelBooking = async (bookingId) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
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
              
              Alert.alert('Success', 'Booking cancelled successfully');
              fetchPassengerBookings();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel booking');
              console.error('Error cancelling booking:', error);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'approved': return '#10b981';
      case 'cancelled': return '#ef4444';
      case 'completed': return '#6b7280';
      case 'pending_completion': return '#f59e0b';
      case 'pending_confirmation': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'approved': return '✅';
      case 'cancelled': return '❌';
      case 'completed': return '✨';
      default: return '•';
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

  const isUpcoming = (booking) => {
    const rideDate = new Date(booking.rides.ride_date);
    const today = new Date();
    return rideDate >= today && (booking.status === 'pending' || booking.status === 'approved' || booking.status === 'confirmed');
  };

  const renderBookingItem = ({ item }) => (
    <View style={[
      styles.bookingCard,
      isUpcoming(item) && styles.upcomingCard
    ]}>
      <View style={styles.bookingHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.statusIcon}>{getStatusIcon(item.status)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        <Text style={styles.bookingDate}>{formatDateTime(item.created_at)}</Text>
      </View>

      <View style={styles.rideInfo}>
        <Text style={styles.rideDateTime}>
              {formatDate(item.rides.ride_date)} at {formatTime(item.rides.ride_time)}
            </Text>
        
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
            <Text style={styles.detailLabel}>Seats</Text>
            <Text style={styles.detailValue}>{item.seats_booked}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Price/Seat</Text>
            <Text style={styles.detailValue}>${item.rides.price_per_seat}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={[styles.detailValue, styles.totalValue]}>
              ${item.rides.price_per_seat * item.seats_booked}
            </Text>
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
          {item.rides.driver?.average_rating && (
            <Text style={styles.driverRating}>⭐ {item.rides.driver.average_rating.toFixed(1)}</Text>
          )}
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => navigation.navigate('BookingDetails', { bookingId: item.id })}
        >
          <Text style={styles.actionButtonText}>View Details</Text>
        </TouchableOpacity>

        {item.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => cancelBooking(item.id)}
          >
            <Text style={styles.actionButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {(item.status === 'approved' || item.status === 'confirmed' || item.status === 'completed' || item.status === 'pending_completion' || item.status === 'pending_confirmation') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={() => navigation.navigate('Chat', { 
            bookingId: item.id, 
            otherUserName: item.rides.driver?.full_name || 'Driver' 
          })}
          >
            <Text style={styles.actionButtonText}>Message</Text>
            {unreadMessages[item.id] > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadMessages[item.id]}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {(item.status === 'pending_completion' || item.status === 'pending_confirmation') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.contactButton]}
            onPress={async () => {
              try {
                // Update booking status to completed
                const { error } = await supabase
                  .from('bookings')
                  .update({ status: 'completed' })
                  .eq('id', item.id);

                if (error) throw error;

                // Increment rides_taken for passenger and rides_offered for driver
                await supabase.rpc('increment_rides_taken', { user_id: user.id });
                await supabase.rpc('increment_rides_offered', { user_id: item.rides.driver_id });

                // Navigate to rate ride screen
                navigation.navigate('RateRide', { bookingId: item.id });
                
                // Refresh bookings
                fetchPassengerBookings();
              } catch (error) {
                Alert.alert('Error', 'Failed to confirm completion');
                console.error('Error confirming completion:', error);
              }
            }}
          >
            <Text style={styles.actionButtonText}>Confirm Completion</Text>
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

        {item.status === 'completed' && !item.is_rated && (
          <TouchableOpacity
            style={[styles.actionButton, styles.rateButton]}
            onPress={() => navigation.navigate('RateRide', { bookingId: item.id })}
          >
            <Text style={styles.actionButtonText}>Rate</Text>
          </TouchableOpacity>
        )}

        {item.status === 'completed' && item.is_rated && (
          <View style={[styles.ratedBadge]}>
            <Text style={styles.ratedText}>✅ Rated</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text>Loading your bookings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerSubtitle}>
          {bookings.length} total booking{bookings.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['all', 'upcoming', 'completed', 'cancelled'].map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[
              styles.filterButton,
              filter === filterOption && styles.filterButtonActive
            ]}
            onPress={() => setFilter(filterOption)}
          >
            <Text style={[
              styles.filterButtonText,
              filter === filterOption && styles.filterButtonTextActive
            ]}>
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {bookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No bookings found</Text>
          <Text style={styles.emptyText}>
            {filter === 'all' 
              ? 'Start exploring available rides to make your first booking!'
              : `No ${filter} bookings found.`
            }
          </Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => navigation.navigate('SearchRides')}
          >
            <Text style={styles.searchButtonText}>Find a Ride</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#e0e7ff',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
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
  upcomingCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  rideInfo: {
    marginTop: 8,
  },
  rideDateTime: {
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
  totalValue: {
    color: '#10b981',
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
  driverRating: {
    fontSize: 14,
    color: '#f59e0b',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 2,
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
  rateButton: {
    backgroundColor: '#f59e0b',
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
    fontSize: 12,
  },
  ratedBadge: {
    backgroundColor: '#10b98120',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  ratedText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
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

export default PassengerBookingsScreen;