import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function DriverRideRequestsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [rideRequests, setRideRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRideRequests();
  }, []);

  const fetchRideRequests = async () => {
    try {
      console.log('Fetching ride requests for user:', user?.id);
      
      // First fetch the ride requests (excluding current user's own requests)
      const { data: requestsData, error: requestsError } = await supabase
        .from('ride_requests')
        .select(`*`)
        .eq('status', 'pending')
        .neq('passenger_id', user.id) // Don't show current user's own requests
        .order('created_at', { ascending: false });

      console.log('Ride requests raw data:', requestsData);
      console.log('Ride requests error:', requestsError);

      if (requestsError) {
        console.error('Ride requests fetch error:', requestsError);
        throw requestsError;
      }

      if (requestsData && requestsData.length > 0) {
        console.log('Found ride requests, fetching passenger data...');
        
        // Fetch passenger information separately
        const passengerIds = requestsData.map(request => request.passenger_id);
        console.log('Passenger IDs:', passengerIds);
        
        const { data: passengersData, error: passengersError } = await supabase
          .from('users')
          .select('id, full_name, phone_number, profile_pic')
          .in('id', passengerIds);

        console.log('Passengers data:', passengersData);
        console.log('Passengers error:', passengersError);

        if (passengersError) {
          console.error('Passengers fetch error:', passengersError);
          throw passengersError;
        }

        // Combine the data
        const requestsWithPassengers = requestsData.map(request => ({
          ...request,
          passenger: passengersData.find(p => p.id === request.passenger_id) || {
            id: request.passenger_id,
            full_name: 'Unknown User',
            phone_number: 'N/A',
            profile_pic: null
          }
        }));

        console.log('Final combined data:', requestsWithPassengers);
        setRideRequests(requestsWithPassengers);
      } else {
        console.log('No ride requests found');
        setRideRequests([]);
      }
    } catch (error) {
      console.error('Detailed error fetching ride requests:', error);
      Alert.alert('Error', `Failed to fetch ride requests: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRideRequests();
  };

  const handleAcceptRequest = async (request) => {
    // Prevent accepting own requests
    if (request.passenger_id === user.id) {
      Alert.alert('Error', 'You cannot accept your own ride request.');
      return;
    }

    Alert.alert(
      'Accept Ride Request',
      `Do you want to accept this ride request from ${request.passenger.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              // Ensure driver profile exists before creating ride
              const { data: driverProfile } = await supabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .single();

              if (!driverProfile) {
                // Create driver profile if it doesn't exist
                const { error: profileError } = await supabase
                  .from('users')
                  .insert({
                    id: user.id,
                    full_name: user.user_metadata?.name || 'Driver',
                    email: user.email,
                    bio: '',
                    role: 'driver',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });

                if (profileError) {
                  throw new Error('Failed to create driver profile. Please try again.');
                }
              }

              // Update the ride request status
              const { error: updateError } = await supabase
                .from('ride_requests')
                .update({
                  status: 'accepted',
                  accepted_by_driver: user.id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', request.id);

              if (updateError) throw updateError;

              // Create a ride offer that matches this request
              const { data: rideData, error: rideError } = await supabase
                .from('rides')
                .insert([
                  {
                    driver_id: user.id,
                    origin: request.origin,
                    origin_coordinates: request.origin_coordinates, // Keep same format as stored in ride_requests
                    destination: request.destination,
                    destination_coordinates: request.destination_coordinates, // Keep same format as stored in ride_requests
                    ride_date: request.requested_date,
                    ride_time: request.requested_time || '09:00:00',
                    available_seats: request.number_of_passengers,
                    price_per_seat: request.max_price_per_person || 20.00,
                    description: `Ride accepted from ${request.passenger.full_name}'s request`,
                    status: 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }
                ])
                .select()
                .single();

              if (rideError) throw rideError;

              // Update the ride request with the accepted ride ID
              const { error: finalUpdateError } = await supabase
                .from('ride_requests')
                .update({ accepted_ride_id: rideData.id })
                .eq('id', request.id);

              if (finalUpdateError) throw finalUpdateError;

              // Create notification for passenger
              try {
                await supabase.rpc('create_notification', {
                  target_user_id: request.passenger_id,
                  notification_title: 'Ride Request Accepted',
                  notification_message: `Your ride request from ${request.origin} to ${request.destination} has been accepted by ${user.user_metadata?.name || request.passenger?.full_name || 'a driver'}. A matching ride offer has been created for you.`,
                  notification_type: 'booking',
                  related_uuid: request.id
                });
              } catch (notificationError) {
                console.error('Error creating passenger notification:', notificationError);
              }

              Alert.alert('Success', 'Ride request accepted! A matching ride offer has been created.');
              fetchRideRequests(); // Refresh the list
              
              // Navigate to the newly created ride
              navigation.navigate('RideDetails', { rideId: rideData.id });
              
            } catch (error) {
              console.error('Detailed error accepting ride request:', error);
              if (error.message?.includes('foreign key constraint') || error.message?.includes('rides_driver_id_fkey')) {
                Alert.alert('Error', 'Driver profile not found. Please ensure your profile is complete before accepting ride requests.');
              } else {
                Alert.alert('Error', 'Failed to accept ride request. Please try again.');
              }
            }
          }
        }
      ]
    );
  };

  const handleRejectRequest = async (request) => {
    // Prevent rejecting own requests
    if (request.passenger_id === user.id) {
      Alert.alert('Error', 'You cannot reject your own ride request.');
      return;
    }

    Alert.alert(
      'Reject Ride Request',
      'Are you sure you want to reject this ride request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('ride_requests')
                .update({ 
                  status: 'rejected',
                  updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

              if (error) throw error;

              // Create notification for passenger
              try {
                await supabase.rpc('create_notification', {
                  target_user_id: request.passenger_id,
                  notification_title: 'Ride Request Rejected',
                  notification_message: `Your ride request from ${request.origin} to ${request.destination} has been rejected by ${user.user_metadata?.name || request.passenger?.full_name || 'a driver'}. You can try posting another request or search for available rides.`,
                  notification_type: 'booking',
                  related_uuid: request.id
                });
              } catch (notificationError) {
                console.error('Error creating passenger notification:', notificationError);
              }

              Alert.alert('Success', 'Ride request rejected.');
              fetchRideRequests(); // Refresh the list
              
            } catch (error) {
              Alert.alert('Error', 'Failed to reject ride request.');
            }
          }
        }
      ]
    );
  };

  const renderRideRequest = ({ item }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>{item.passenger?.full_name || 'Unknown Passenger'}</Text>
          <Text style={styles.requestDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.routeInfo}>
        <View style={styles.routeItem}>
          <Ionicons name="radio-button-on" size={16} color="#4CAF50" />
          <Text style={styles.routeText} numberOfLines={2}>{item.origin}</Text>
        </View>
        <View style={styles.routeDivider} />
        <View style={styles.routeItem}>
          <Ionicons name="location" size={16} color="#F44336" />
          <Text style={styles.routeText} numberOfLines={2}>{item.destination}</Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar" size={16} color="#666" />
          <Text style={styles.detailText}>{new Date(item.requested_date).toLocaleDateString()}</Text>
        </View>
        {item.requested_time && (
          <View style={styles.detailItem}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.detailText}>{item.requested_time}</Text>
          </View>
        )}
        <View style={styles.detailItem}>
          <Ionicons name="people" size={16} color="#666" />
          <Text style={styles.detailText}>{item.number_of_passengers} passenger{item.number_of_passengers > 1 ? 's' : ''}</Text>
        </View>
        {item.max_price_per_person && (
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={16} color="#666" />
            <Text style={styles.detailText}>Up to ${item.max_price_per_person}</Text>
          </View>
        )}
        {item.flexible_time && (
          <View style={styles.detailItem}>
            <Ionicons name="options" size={16} color="#666" />
            <Text style={styles.detailText}>Flexible time</Text>
          </View>
        )}
      </View>

      {item.description ? (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionLabel}>Notes:</Text>
          <Text style={styles.descriptionText}>{item.description}</Text>
        </View>
      ) : null}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAcceptRequest(item)}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={[styles.actionButtonText, styles.acceptButtonText]}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleRejectRequest(item)}
        >
          <Ionicons name="close" size={18} color="#666" />
          <Text style={[styles.actionButtonText, styles.rejectButtonText]}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="car" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Ride Requests</Text>
      <Text style={styles.emptyText}>
        There are currently no pending ride requests available.
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={fetchRideRequests}>
        <Ionicons name="refresh" size={18} color="#007AFF" />
        <Text style={styles.refreshButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading ride requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ride Requests</Text>
        <Text style={styles.headerSubtitle}>
          {rideRequests.length} pending request{rideRequests.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={rideRequests}
        renderItem={renderRideRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  requestDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#856404',
  },
  routeInfo: {
    marginBottom: 12,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  routeText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  routeDivider: {
    width: 1,
    height: 8,
    backgroundColor: '#ddd',
    marginLeft: 8,
    marginVertical: 2,
  },
  requestDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  descriptionContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  acceptButtonText: {
    color: '#fff',
  },
  rejectButtonText: {
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  refreshButtonText: {
    color: '#007AFF',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
});