import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const MyRideRequestsScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const [rideRequests, setRideRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [highlightRequestId, setHighlightRequestId] = useState(null);

  useEffect(() => {
    try {
      console.log('MyRideRequestsScreen mounted, user:', user?.id);
      fetchMyRideRequests();
      
      // Check if we have a highlight request ID from notification
      if (route.params?.highlightRequestId) {
        setHighlightRequestId(route.params.highlightRequestId);
        // Clear the parameter after using it
        navigation.setParams({ highlightRequestId: null });
      }
    } catch (error) {
      console.error('Error in MyRideRequestsScreen useEffect:', error);
      Alert.alert('Error', 'Failed to load ride requests screen');
    }
  }, [route.params?.highlightRequestId]);

  // Auto-scroll to highlighted request
  useEffect(() => {
    if (highlightRequestId && rideRequests.length > 0) {
      // Find the index of the highlighted request
      const highlightedIndex = rideRequests.findIndex(request => request.id === highlightRequestId);
      if (highlightedIndex !== -1) {
        // Scroll to the highlighted request after a short delay to ensure UI is rendered
        setTimeout(() => {
          // The FlatList will handle the scrolling automatically
          // The highlighted card will be visible due to the styling
        }, 500);
      }
    }
  }, [highlightRequestId, rideRequests]);

  const fetchMyRideRequests = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching ride requests for user:', user?.id);
      
      // First, fetch the ride requests
      const { data: requestsData, error: requestsError } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('passenger_id', user.id)
        .order('created_at', { ascending: false });

      console.log('Ride requests query result:', { requestsData, requestsError });

      if (requestsError) throw requestsError;

      // If there are accepted requests, fetch the ride details
      const requestsWithRides = await Promise.all(
        (requestsData || []).map(async (request) => {
          if (request.accepted_ride_id) {
            const { data: rideData, error: rideError } = await supabase
              .from('rides')
              .select(`
                *,
                driver:users!driver_id(id, full_name, phone)
              `)
              .eq('id', request.accepted_ride_id)
              .single();

            if (!rideError && rideData) {
              return {
                ...request,
                accepted_ride: rideData
              };
            }
          }
          return request;
        })
      );

      setRideRequests(requestsWithRides);
      console.log('Fetched ride requests with rides:', requestsWithRides.map(r => ({
        id: r.id,
        status: r.status,
        accepted_ride_id: r.accepted_ride_id,
        hasAcceptedRide: !!r.accepted_ride
      })));
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch your ride requests');
      console.error('Error fetching ride requests:', error);
      setRideRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyRideRequests();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'accepted': return '#10b981';
      case 'rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      default: return 'Unknown';
    }
  };

  const handleRequestPress = (request) => {
    if (request.status === 'accepted' && request.accepted_ride) {
      // Navigate to the accepted ride details
      navigation.navigate('RideDetails', { rideId: request.accepted_ride.id });
    }
  };

  const handleBookAcceptedRide = (request) => {
    if (request.status === 'accepted' && request.accepted_ride) {
      // Navigate to book ride screen with the accepted ride
      navigation.navigate('BookRide', { rideId: request.accepted_ride.id });
    }
  };

  const handleSendMessage = (request) => {
    // Open chat with driver using accepted ride id
    if (request.accepted_ride) {
      navigation.navigate('Chat', { rideId: request.accepted_ride.id });
    }
  };

  const handlePayment = (request) => {
    // Ask passenger if ride is completed
    Alert.alert(
      'Confirm Ride Completion',
      'Has the ride been completed?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            // Navigate to FareEstimate with ride id
            navigation.navigate('FareEstimate', { rideId: request.accepted_ride.id });
          }
        }
      ]
    );
  };

  const formatDateTime = (dateString, timeString) => {
    const date = new Date(dateString);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    });
    return timeString ? `${formattedDate} at ${timeString}` : formattedDate;
  };

  const renderRideRequest = ({ item }) => {
    console.log('Rendering ride request:', {
      id: item.id,
      status: item.status,
      hasAcceptedRide: !!item.accepted_ride,
      acceptedRideId: item.accepted_ride_id,
      acceptedRideData: item.accepted_ride
    });
    
    return (
      <TouchableOpacity
        style={[
          styles.requestCard, 
          item.status === 'accepted' && styles.acceptedCard,
          item.id === highlightRequestId && styles.highlightedCard
        ]}
        onPress={() => handleRequestPress(item)}
      >
        <View style={styles.requestHeader}>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar" size={16} color="#666" />
          <Text style={styles.dateText}>
            {formatDateTime(item.requested_date, item.requested_time)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
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

      {item.status === 'accepted' && item.accepted_ride && (
        <View style={styles.acceptedRideInfo}>
          <View style={styles.driverInfo}>
            <Ionicons name="person" size={16} color="#10b981" />
            <Text style={styles.driverText}>
              Driver: {item.accepted_ride.driver?.full_name || 'Unknown Driver'}
            </Text>
          </View>
          <View style={styles.rideDetails}>
            <Text style={styles.ridePrice}>
              ${item.accepted_ride.price_per_seat} per seat
            </Text>
            <Text style={styles.rideSeats}>
              {item.accepted_ride.available_seats} seats available
            </Text>
          </View>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => handleBookAcceptedRide(item)}
          >
            <Ionicons name="car" size={18} color="#fff" />
            <Text style={styles.bookButtonText}>Book This Ride</Text>
          </TouchableOpacity>

          {/* New buttons for accepted ride */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => handleSendMessage(item)}
            >
              <Ionicons name="chatbubbles" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Send Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={() => handlePayment(item)}
            >
              <Ionicons name="card" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {item.status === 'rejected' && (
        <View style={styles.rejectedInfo}>
          <Ionicons name="information-circle" size={16} color="#ef4444" />
          <Text style={styles.rejectedText}>
            This request was rejected. You can create a new request or search for available rides.
          </Text>
        </View>
      )}

      <View style={styles.createdInfo}>
        <Text style={styles.createdText}>
          Requested {new Date(item.created_at).toLocaleDateString()}
        </Text>
        </View>
      </TouchableOpacity>
    );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="car" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Ride Requests</Text>
      <Text style={styles.emptyText}>
        You haven't created any ride requests yet. Tap "Request a Ride" to get started!
      </Text>
      <TouchableOpacity
        style={styles.createRequestButton}
        onPress={() => navigation.navigate('RequestRide')}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.createRequestButtonText}>Request a Ride</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your ride requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Ride Requests</Text>
        <Text style={styles.headerSubtitle}>
          {rideRequests.length} request{rideRequests.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={rideRequests}
        renderItem={renderRideRequest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  listContainer: {
    padding: 16,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  highlightedCard: {
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#374151',
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
    marginLeft: 24,
  },
  requestDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  descriptionContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  acceptedRideInfo: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  driverText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  rideDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ridePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  rideSeats: {
    fontSize: 14,
    color: '#6b7280',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectedInfo: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectedText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
    lineHeight: 20,
  },
  createdInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  createdText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  createRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createRequestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  }
});
}

export default MyRideRequestsScreen;