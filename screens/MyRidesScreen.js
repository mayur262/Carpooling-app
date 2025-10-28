import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSOS } from '../contexts/SOSContext';
import * as Location from 'expo-location';

const MyRidesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { triggerSOS } = useSOS();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});

  useEffect(() => {
    fetchMyRides();
  }, []);

  const fetchMyRides = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          bookings(
            id,
            passenger_id,
            seats_booked,
            status,
            passengers:users!passenger_id(full_name, email)
          )
        `)
        .eq('driver_id', user.id)
        .order('ride_date', { ascending: false })
        .order('ride_time', { ascending: false });

      if (error) throw error;
      setRides(data || []);
      
      // Fetch unread messages for all rides
      const rideIds = data.map(ride => ride.id);
      await fetchUnreadMessages(rideIds);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch your rides');
      console.error('Error fetching rides:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUnreadMessages = async (rideIds) => {
    if (!rideIds.length) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all bookings for these rides
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, ride_id')
        .in('ride_id', rideIds);

      if (bookingsError) throw bookingsError;

      if (bookingsData.length === 0) return;

      const bookingIds = bookingsData.map(b => b.id);

      // Get unread messages for these bookings
      const { data, error } = await supabase
        .from('messages')
        .select('booking_id, sender_id')
        .in('booking_id', bookingIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Count unread messages per ride
      const unreadCount = {};
      data.forEach(msg => {
        const booking = bookingsData.find(b => b.id === msg.booking_id);
        if (booking) {
          unreadCount[booking.ride_id] = (unreadCount[booking.ride_id] || 0) + 1;
        }
      });
      
      setUnreadMessages(unreadCount);
    } catch (error) {
      console.error('Error fetching unread messages:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyRides();
  };

  const deleteRide = async (rideId) => {
    Alert.alert(
      'Delete Ride',
      'Are you sure you want to delete this ride? This will also cancel all bookings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('rides')
                .delete()
                .eq('id', rideId)
                .eq('driver_id', user.id);

              if (error) throw error;
              
              Alert.alert('Success', 'Ride deleted successfully');
              fetchMyRides();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete ride');
            }
          }
        }
      ]
    );
  };

  const cancelRide = async (rideId) => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride? This will cancel all bookings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Attempting to cancel ride:', rideId, 'for user:', user.id);
              
              // First, check if the ride exists and belongs to the user
              const { data: rideCheck, error: checkError } = await supabase
                .from('rides')
                .select('id, status')
                .eq('id', rideId)
                .eq('driver_id', user.id)
                .single();

              if (checkError || !rideCheck) {
                console.error('Ride not found or does not belong to user:', checkError);
                Alert.alert('Error', 'Ride not found or you do not have permission to cancel it');
                return;
              }

              if (rideCheck.status === 'cancelled') {
                Alert.alert('Info', 'This ride is already cancelled');
                return;
              }

              const { error } = await supabase
                .from('rides')
                .update({ status: 'cancelled' })
                .eq('id', rideId)
                .eq('driver_id', user.id);

              if (error) {
                console.error('Supabase update error:', error);
                throw error;
              }
              
              Alert.alert('Success', 'Ride cancelled successfully');
              fetchMyRides();
            } catch (error) {
              console.error('Error cancelling ride:', error);
              Alert.alert('Error', `Failed to cancel ride: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#6b7280';
      case 'finished': return '#8b5cf6'; // Purple for finished rides
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const handleSOS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required to send SOS alert');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      
      Alert.alert(
        'Emergency SOS',
        'Are you sure you want to send an emergency alert to your emergency contacts?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Alert',
            style: 'destructive',
            onPress: async () => {
              try {
                await triggerSOS(
                  location.coords.latitude,
                  location.coords.longitude,
                  user.phone
                );
                Alert.alert('Success', 'Emergency alert sent to your contacts');
              } catch (error) {
                Alert.alert('Error', 'Failed to send emergency alert. Please try again.');
                console.error('SOS Error:', error);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to get location for emergency alert');
      console.error('Location Error:', error);
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

  const renderRideItem = ({ item }) => {
    // Determine if ride should be shown as "Completed"
    const isFullyCompleted = (item.status === 'finished' && 
      item.bookings?.every(booking => booking.status === 'completed')) ||
      (item.status === 'active' && item.bookings?.length > 0 && 
       item.bookings?.every(booking => booking.payment_status === 'paid'));
    
    const displayStatus = isFullyCompleted ? 'completed' : item.status;
    const displayStatusText = isFullyCompleted ? 'Completed' : 
      item.status === 'finished' ? 'Finished' : 
      item.status.charAt(0).toUpperCase() + item.status.slice(1);

    return (
    <View style={styles.rideCard}>
      <View style={styles.rideHeader}>
        <Text style={styles.rideDate}>{formatDate(item.ride_date)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(displayStatus) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(displayStatus) }]}>
            {displayStatusText}
          </Text>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routeDot} />
        <Text style={styles.locationText}>{item.origin}</Text>
      </View>

      <View style={styles.routeLine} />

      <View style={styles.routeContainer}>
        <View style={[styles.routeDot, styles.destinationDot]} />
        <Text style={styles.locationText}>{item.destination}</Text>
      </View>

      <View style={styles.rideDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Time</Text>
          <Text style={styles.detailValue}>{formatTime(item.ride_time)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Seats</Text>
          <Text style={styles.detailValue}>{item.available_seats}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.detailValue}>${item.price_per_seat}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Bookings</Text>
          <Text style={styles.detailValue}>{item.bookings?.length || 0}</Text>
        </View>
      </View>

      {item.vehicle_model && (
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleText}>
              {item.vehicle_type} • {item.vehicle_model}
            </Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        {item.status === 'active' && !isFullyCompleted && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.viewButton]}
              onPress={() => navigation.navigate('RideDetails', { rideId: item.id })}
            >
              <Text style={styles.actionButtonText}>View Details</Text>
              {unreadMessages[item.id] > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadMessages[item.id]}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => cancelRide(item.id)}
            >
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        
        {item.status === 'active' && isFullyCompleted && (
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => navigation.navigate('RideDetails', { rideId: item.id })}
          >
            <Text style={styles.actionButtonText}>View Details</Text>
            {unreadMessages[item.id] > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadMessages[item.id]}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        
        {item.status === 'cancelled' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteRide(item.id)}
          >
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        )}

        {(displayStatus === 'completed' || item.status === 'finished') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => navigation.navigate('RideDetails', { rideId: item.id })}
          >
            <Text style={styles.actionButtonText}>View Details</Text>
            {unreadMessages[item.id] > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadMessages[item.id]}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading your rides...</Text>
      </View>
    );
  }

  if (rides.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No rides yet</Text>
        <Text style={styles.emptyText}>Start offering rides to earn money!</Text>
        <TouchableOpacity
          style={styles.offerButton}
          onPress={() => navigation.navigate('OfferRide')}
        >
          <Text style={styles.offerButtonText}>Offer Your First Ride</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Rides</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.sosButton}
            onPress={handleSOS}
          >
            <Text style={styles.sosButtonText}>🚨 SOS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('OfferRide')}
          >
            <Text style={styles.addButtonText}>+ Offer Ride</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rides}
        renderItem={renderRideItem}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sosButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  sosButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  rideCard: {
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
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rideDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
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
  routeContainer: {
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
  vehicleInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  vehicleText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
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
    backgroundColor: '#f59e0b',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
  offerButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  offerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default MyRidesScreen;