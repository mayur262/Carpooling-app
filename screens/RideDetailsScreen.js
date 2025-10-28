import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import SafeMapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/SafeMapView';
import { useSOS } from '../contexts/SOSContext';

const RideDetailsScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { triggerSOS } = useSOS();
  const { rideId } = route.params;
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState(null);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [locationTracking, setLocationTracking] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});
  const [ratings, setRatings] = useState([]);
  const [showRatings, setShowRatings] = useState(false);

  // Fetch ratings for this ride
  const fetchRatings = async () => {
    try {
      console.log('Fetching ratings for ride:', rideId);
      
      // First, let's try a simple query without joins to see if ratings exist
      const { data: simpleRatingData, error: simpleRatingError } = await supabase
        .from('ratings')
        .select('*')
        .eq('ride_id', rideId);

      if (simpleRatingError) {
        console.error('Error fetching simple ratings:', simpleRatingError);
        console.error('Simple rating error details:', simpleRatingError.message, simpleRatingError.details, simpleRatingError.hint);
        return;
      }

      console.log('Simple ratings fetched:', simpleRatingData);

      if (simpleRatingData && simpleRatingData.length > 0) {
        // Now fetch user details for each rating
        const raterIds = simpleRatingData.map(r => r.rater_id);
        const rateeIds = simpleRatingData.map(r => r.ratee_id);
        const allUserIds = [...new Set([...raterIds, ...rateeIds])];

        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', allUserIds);

        if (usersError) {
          console.error('Error fetching user details:', usersError);
        } else {
          // Combine ratings with user details
          const ratingsWithUsers = simpleRatingData.map(rating => ({
            ...rating,
            reviewer: usersData.find(u => u.id === rating.rater_id) || { full_name: 'Unknown', email: 'N/A' },
            reviewee: usersData.find(u => u.id === rating.ratee_id) || { full_name: 'Unknown', email: 'N/A' }
          }));

          console.log('Ratings with users fetched successfully:', ratingsWithUsers);
          setRatings(ratingsWithUsers);
        }
      } else {
        console.log('No ratings found for this ride');
        setRatings([]);
      }
    } catch (error) {
      console.error('Error fetching ratings:', error);
    }
  };

  useEffect(() => {
    fetchRideDetails();
    fetchRatings();
    setupLocationTracking();
    
    return () => {
      if (locationSubscription) {
        locationSubscription.unsubscribe();
      }
    };
  }, []);

  const fetchRideDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('rides')
        .select(`*`).eq('id', rideId).single();

      if (error) throw error;

      // Fetch driver information separately
      const { data: driverData, error: driverError } = await supabase
        .from('users')
        .select('id, full_name, email, bio, average_rating')
        .eq('id', data.driver_id)
        .single();

      if (driverError) throw driverError;

      // Fetch bookings and passenger information separately
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`*`).eq('ride_id', rideId);

      if (bookingsError) throw bookingsError;

      // Fetch passenger data for each booking
      let bookingsWithPassengers = [];
      if (bookingsData && bookingsData.length > 0) {
        const passengerIds = bookingsData.map(b => b.passenger_id);
        const { data: passengersData, error: passengersError } = await supabase
          .from('users')
          .select('id, full_name, email, average_rating')
          .in('id', passengerIds);

        if (passengersError) throw passengersError;

        bookingsWithPassengers = bookingsData.map(booking => ({
          ...booking,
          passenger: passengersData.find(p => p.id === booking.passenger_id) || { full_name: 'Unknown', email: 'N/A', average_rating: null }
        }));
      }

      // Merge all data
      const rideWithDetails = {
        ...data,
        driver: driverData || { full_name: 'Unknown', email: 'N/A', bio: '', average_rating: null },
        bookings: bookingsWithPassengers
      };

      setRide(rideWithDetails);
      
      // Fetch unread messages for bookings
      if (bookingsWithPassengers.length > 0) {
        await fetchUnreadMessagesForBookings(bookingsWithPassengers.map(b => b.id));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch ride details');
      console.error('Error fetching ride details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadMessagesForBookings = async (bookingIds) => {
    if (!bookingIds.length) return;
    
    try {
      // Get unread messages for these bookings
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

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)
        .eq('driver_id', user.id); // Security check: Ensure the current user is the driver

      if (error) throw error;
      
      Alert.alert('Success', `Booking ${newStatus} successfully`);
      fetchRideDetails();
    } catch (error) {
      Alert.alert('Error', `Failed to ${newStatus} booking`);
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

  const handlePassengersPaid = async () => {
    try {
      Alert.alert(
        'Confirm Payment',
        'Have all passengers paid for this ride?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, All Paid',
            style: 'default',
            onPress: async () => {
              try {
                // Get all confirmed bookings for this ride
                const { data: bookings, error: bookingsError } = await supabase
                  .from('bookings')
                  .select('*')
                  .eq('ride_id', rideId)
                  .in('status', ['approved', 'confirmed']);

                if (bookingsError) throw bookingsError;

                if (!bookings || bookings.length === 0) {
                  Alert.alert('No Passengers', 'No confirmed bookings found for this ride.');
                  return;
                }

                // Update all bookings to completed and paid
                const bookingUpdates = bookings.map(async (booking) => {
                  console.log('Updating booking:', booking.id, 'with final fare:', ride.price_per_seat * booking.seats_booked);
                  return supabase
                    .from('bookings')
                    .update({
                      status: 'completed',
                      payment_status: 'paid',
                      final_fare: ride.price_per_seat * booking.seats_booked
                    })
                    .eq('id', booking.id);
                });

                const bookingResults = await Promise.all(bookingUpdates);
                
                // Check for any errors in booking updates
                const bookingErrors = bookingResults.filter(result => result.error);
                if (bookingErrors.length > 0) {
                  console.error('Booking update errors:', bookingErrors);
                  throw new Error(`Failed to update ${bookingErrors.length} bookings`);
                }

                // Update ride status to finished
                console.log('Updating ride status to finished for ride:', rideId);
                const { error: rideError } = await supabase
                  .from('rides')
                  .update({ status: 'finished' })
                  .eq('id', rideId);

                if (rideError) {
                  console.error('Ride update error:', rideError);
                  throw rideError;
                }
                console.log('Ride status updated successfully');

                // Increment ride counters for driver and passengers
                console.log('Incrementing rides_offered for driver:', ride.driver_id);
                const { error: driverCounterError } = await supabase
                  .rpc('increment_field', {
                    user_id: ride.driver_id,
                    field: 'rides_offered',
                    amount: 1
                  });

                if (driverCounterError) {
                  console.error('Driver counter error:', driverCounterError);
                  throw driverCounterError;
                }
                console.log('Driver counter incremented successfully');

                // Increment rides_taken for each passenger
                console.log('Incrementing rides_taken for passengers:', bookings.map(b => ({id: b.passenger_id, seats: b.seats_booked})));
                const passengerUpdates = bookings.map(booking =>
                  supabase
                    .rpc('increment_field', {
                      user_id: booking.passenger_id,
                      field: 'rides_taken',
                      amount: booking.seats_booked
                    })
                );

                const passengerResults = await Promise.all(passengerUpdates);
                
                // Check for any errors in passenger updates
                const passengerErrors = passengerResults.filter(result => result.error);
                if (passengerErrors.length > 0) {
                  console.error('Passenger counter errors:', passengerErrors);
                  throw new Error(`Failed to update ${passengerErrors.length} passenger counters`);
                }
                console.log('All passenger counters incremented successfully');

                Alert.alert(
                  'Success',
                  'Ride marked as completed. All passengers have been charged.',
                  [{ text: 'OK', onPress: () => navigation.navigate('MyRides') }]
                );
              } catch (error) {
                const errorMessage = error.message || 'Failed to complete ride. Please try again.';
                Alert.alert('Error', errorMessage);
                console.error('Error completing ride:', error);
                console.error('Error details:', error.message, error.details, error.hint);
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to process payment confirmation');
      console.error('Error in handlePassengersPaid:', error);
    }
  };

  const setupLocationTracking = async () => {
    try {
      // Check if user is driver or passenger
      if (!ride) return;
      
      const isDriver = ride.driver_id === user.id;
      const isPassenger = ride.bookings?.some(b => b.passenger_id === user.id && (b.status === 'approved' || b.status === 'confirmed'));
      
      if (!isDriver && !isPassenger) return;

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required for live tracking');
        return;
      }

      if (isDriver) {
        // Start location tracking for driver
        startDriverLocationTracking();
      } else if (isPassenger) {
        // Subscribe to driver location updates for passenger
        subscribeToDriverLocation();
      }
    } catch (error) {
      console.error('Error setting up location tracking:', error);
    }
  };

  const startDriverLocationTracking = async () => {
    try {
      setLocationTracking(true);
      
      // Watch location updates
      const locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        async (location) => {
          const { latitude, longitude } = location.coords;
          setDriverLocation({ latitude, longitude });
          
          // Update location in database
          try {
            const { error } = await supabase
              .from('live_locations')
              .upsert({
                ride_id: rideId,
                user_id: user.id,
                latitude,
                longitude,
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'ride_id,user_id'
              });

            if (error) throw error;
          } catch (error) {
            console.error('Error updating location:', error);
          }
        }
      );

      // Store subscription for cleanup
      setLocationSubscription(locationWatcher);
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setLocationTracking(false);
    }
  };

  const subscribeToDriverLocation = () => {
    try {
      // Subscribe to realtime updates for driver's location
      const subscription = supabase
        .channel(`driver-location-${rideId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'live_locations',
            filter: `ride_id=eq.${rideId}`
          },
          (payload) => {
            if (payload.new) {
              setDriverLocation({
                latitude: payload.new.latitude,
                longitude: payload.new.longitude
              });
            }
          }
        )
        .subscribe();

      setLocationSubscription(subscription);
    } catch (error) {
      console.error('Error subscribing to driver location:', error);
    }
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

  const isDriver = ride.driver_id === user.id;
  const availableSeats = ride.available_seats - (ride.bookings?.reduce((sum, booking) => 
    (booking.status === 'approved' || booking.status === 'confirmed') ? sum + booking.seats_booked : sum, 0) || 0);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.sosButton}
            onPress={handleSOS}
          >
            <Text style={styles.sosButtonText}>🚨 SOS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ride Info */}
      <View style={styles.section}>
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
            <Text style={styles.detailValue}>{availableSeats}/{ride.available_seats}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Price per Seat</Text>
            <Text style={styles.detailValue}>${ride.price_per_seat}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={[styles.detailValue, { color: ride.status === 'active' ? '#10b981' : '#6b7280' }]}>
              {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Live Location Map */}
      {ride.status === 'active' && (ride.driver_id === user.id || ride.bookings?.some(b => b.passenger_id === user.id && (b.status === 'approved' || b.status === 'confirmed'))) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Location</Text>
          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              // Web alternative - show location info without map
              <View style={styles.webLocationContainer}>
                <Text style={styles.webLocationTitle}>📍 Location Tracking</Text>
                {driverLocation ? (
                  <View style={styles.webLocationInfo}>
                    <Text style={styles.webLocationText}>
                      Latitude: {driverLocation.latitude.toFixed(6)}
                    </Text>
                    <Text style={styles.webLocationText}>
                      Longitude: {driverLocation.longitude.toFixed(6)}
                    </Text>
                    <Text style={styles.webLocationStatus}>
                      🟢 Driver location available
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.webLocationStatus}>
                    📍 Waiting for driver location...
                  </Text>
                )}
              </View>
            ) : (
              // Native map view
              SafeMapView && (
                <SafeMapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={{
                    latitude: driverLocation?.latitude || 37.7749,
                    longitude: driverLocation?.longitude || -122.4194,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                  }}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                >
                  {driverLocation && (
                    <Marker
                      coordinate={{
                        latitude: driverLocation.latitude,
                        longitude: driverLocation.longitude,
                      }}
                      title="Driver Location"
                      description="Current position"
                      pinColor="#2563eb"
                    />
                  )}
                </SafeMapView>
              )
            )}
            {ride.driver_id === user.id && (
              <View style={styles.trackingStatus}>
                <Text style={styles.trackingStatusText}>
                  {locationTracking ? '📍 Location sharing active' : '📍 Tap to start location sharing'}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Driver Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Driver Information</Text>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{ride.driver?.full_name || 'Unknown Driver'}</Text>
          <Text style={styles.driverEmail}>{ride.driver?.email || 'No email available'}</Text>
          
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

      {/* Bookings */}
      {isDriver && ride.bookings && ride.bookings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bookings ({ride.bookings.length})</Text>
          {ride.bookings.map((booking) => (
            <View key={booking.id} style={styles.bookingItem}>
              <View style={styles.bookingHeader}>
                <Text style={styles.passengerName}>{booking.passenger?.full_name || 'Unknown Passenger'}</Text>
                <Text style={styles.bookingDate}>{formatDateTime(booking.created_at)}</Text>
              </View>
              <View style={styles.bookingDetails}>
                <Text style={styles.bookingInfo}>Seats: {booking.seats_booked}</Text>
                <Text style={[styles.bookingStatus, { color: (booking.status === 'approved' || booking.status === 'confirmed') ? '#10b981' : '#f59e0b' }]}>
                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </Text>
              </View>
              
              {booking.status === 'pending' && (
                <View style={styles.bookingActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => updateBookingStatus(booking.id, 'confirmed')}
                  >
                    <Text style={styles.actionButtonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => updateBookingStatus(booking.id, 'rejected')}
                  >
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Send Message button for all approved/confirmed bookings */}
              {(booking.status === 'approved' || booking.status === 'confirmed') && (
                <View style={styles.bookingActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.messageButton]}
                    onPress={() => navigation.navigate('Chat', { 
                      bookingId: booking.id, 
                      otherUserName: booking.passenger?.full_name || 'Passenger' 
                    })}
                  >
                    <Text style={styles.actionButtonText}>Send Message</Text>
                    {unreadMessages[booking.id] > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unreadMessages[booking.id]}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Ratings Section */}
      {ratings.length > 0 && (
        <View style={styles.section}>
          <View style={styles.ratingsHeader}>
            <Text style={styles.sectionTitle}>Ratings & Reviews</Text>
            <TouchableOpacity
              onPress={() => setShowRatings(!showRatings)}
              style={styles.toggleButton}
            >
              <Text style={styles.toggleButtonText}>
                {showRatings ? 'Hide' : 'Show'} ({ratings.length})
              </Text>
            </TouchableOpacity>
          </View>
          
          {showRatings && (
            <View style={styles.ratingsContainer}>
              {ratings.map((rating) => (
                <View key={rating.id} style={styles.ratingItem}>
                  <View style={styles.ratingHeader}>
                    <Text style={styles.ratingReviewer}>
                      {rating.reviewer?.full_name || 'Anonymous'}
                    </Text>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text
                          key={star}
                          style={[
                            styles.star,
                            star <= rating.rating ? styles.starFilled : styles.starEmpty
                          ]}
                        >
                          ★
                        </Text>
                      ))}
                    </View>
                  </View>
                  
                  <Text style={styles.ratingReviewee}>
                    Rated: {rating.reviewee?.full_name || 'User'}
                  </Text>
                  
                  {rating.comment && (
                    <Text style={styles.ratingComment}>
                      "{rating.comment}"
                    </Text>
                  )}
                  
                  <Text style={styles.ratingDate}>
                    {formatDateTime(rating.created_at)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Action Buttons Section */}
      <View style={styles.actionSection}>
        {/* Send Message button for passengers */}
        {!isDriver && ride.status === 'active' && (
          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => {
              const booking = ride.bookings?.find(b => b.passenger_id === user.id && (b.status === 'approved' || b.status === 'confirmed'));
              if (booking) {
                navigation.navigate('Chat', { 
                  bookingId: booking.id, 
                  otherUserName: ride.driver?.full_name || 'Driver' 
                });
              } else {
                Alert.alert('No Booking', 'You need to have an approved or confirmed booking to send messages.');
              }
            }}
          >
            <Text style={styles.actionButtonText}>Send Message</Text>
          </TouchableOpacity>
        )}

        {/* Rate Driver button for passengers when ride is completed */}
        {!isDriver && ride.status === 'finished' && (
          <TouchableOpacity
            style={styles.rateButton}
            onPress={() => {
              const booking = ride.bookings?.find(b => b.passenger_id === user.id && b.status === 'completed');
              if (booking) {
                if (!booking.is_rated) {
                  navigation.navigate('RateRide', { bookingId: booking.id });
                } else {
                  Alert.alert('Already Rated', 'You have already rated this ride.');
                }
              } else {
                Alert.alert('No Completed Booking', 'You need to have a completed booking to rate this ride.');
              }
            }}
          >
            <Text style={styles.actionButtonText}>Rate Driver</Text>
          </TouchableOpacity>
        )}

        {/* Mark as Completed button for drivers */}
        {isDriver && ride.status === 'active' && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => {
              Alert.alert(
                'Complete Ride',
                'How would you like to complete this ride?',
                [
                  {
                    text: 'Passengers Paid',
                    onPress: () => handlePassengersPaid(),
                    style: 'default'
                  },
                  {
                    text: 'Calculate Fare',
                    onPress: () => navigation.navigate('FareEstimate', { rideId: ride.id }),
                    style: 'default'
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel'
                  }
                ]
              );
            }}
          >
            <Text style={styles.completeButtonText}>Mark as Completed</Text>
          </TouchableOpacity>
        )}
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
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  timeText: {
    fontSize: 16,
    color: '#6b7280',
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
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    marginRight: 12,
  },
  destinationDot: {
    backgroundColor: '#ef4444',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#e5e7eb',
    marginLeft: 5,
    marginVertical: 2,
  },
  locationText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  driverInfo: {
    marginBottom: 16,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  driverEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  driverBio: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  vehicleInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  vehicleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  vehicleText: {
    fontSize: 14,
    color: '#6b7280',
    marginVertical: 2,
  },
  descriptionContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  bookingItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  bookingDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  bookingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingInfo: {
    fontSize: 14,
    color: '#6b7280',
  },
  bookingStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  bookingActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  messageButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row'
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center'
  },
  actionSection: {
    padding: 16,
  },
  contactButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  rateButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 12,
  },
  map: {
    flex: 1,
  },
  trackingStatus: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 8,
  },
  trackingStatusText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    justifyContent: 'center'
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  webLocationContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  webLocationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  webLocationInfo: {
    alignItems: 'center',
  },
  webLocationText: {
    fontSize: 14,
    color: '#6b7280',
    marginVertical: 2,
  },
  webLocationStatus: {
    fontSize: 14,
    color: '#10b981',
    marginTop: 8,
    fontWeight: '500',
  },
  ratingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  ratingsContainer: {
    marginTop: 8,
  },
  ratingItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingReviewer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  ratingReviewee: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  ratingStars: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 16,
    marginHorizontal: 1,
  },
  starFilled: {
    color: '#fbbf24',
  },
  starEmpty: {
    color: '#d1d5db',
  },
  ratingComment: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    marginVertical: 6,
    lineHeight: 20,
  },
  ratingDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});

export default RideDetailsScreen;