import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePayment } from '../utils/StripeService';
import SafeCardField from '../components/SafeCardField';
import { useStripe } from '../utils/StripeWebCompat';

const FareEstimateScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { rideId, bookingId } = route.params;
  const [ride, setRide] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [fareFinalized, setFareFinalized] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const { confirmPayment } = useStripe();
  const { processPayment } = usePayment();

  useEffect(() => {
    fetchRideDetails();
  }, []);

  const fetchRideDetails = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching ride details for rideId:', rideId);
      
      // Fetch ride details with driver and vehicle information
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select(`
          *,
          driver:users!rides_driver_id_fkey(
            id,
            full_name
          )
        `)
        .eq('id', rideId)
        .single();

      if (rideError) {
        console.error('Ride fetch error:', rideError);
        throw rideError;
      }
      
      console.log('Ride data fetched:', rideData);

      // Fetch all approved/confirmed/pending_confirmation bookings for this ride
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          passenger:users!bookings_passenger_id_fkey(
            id,
            full_name
          )
        `)
        .eq('ride_id', rideId)
        .in('status', ['approved', 'confirmed', 'pending_confirmation', 'completed']);

      if (bookingsError) {
        console.error('Bookings fetch error:', bookingsError);
        throw bookingsError;
      }
      
      console.log('Bookings data fetched:', bookingsData);

      if (!rideData) {
        throw new Error('No ride found with the provided ID');
      }

      // Check if ride is in a valid status for fare calculation
      if (rideData.status === 'completed') {
        throw new Error('This ride has already been completed');
      }
      
      if (rideData.status === 'cancelled') {
        throw new Error('This ride has been cancelled');
      }

      setRide(rideData);
      
      // If no bookings found, check if this ride was created from a ride request
      let finalBookings = bookingsData || [];
      if (!finalBookings.length) {
        console.log('No bookings found, checking for ride requests...');
        const { data: rideRequestData, error: rideRequestError } = await supabase
          .from('ride_requests')
          .select(`
            *,
            passenger:users!passenger_id(
              id,
              full_name
            )
          `)
          .eq('accepted_ride_id', rideId)
          .eq('status', 'accepted');

        if (rideRequestError) {
          console.error('Ride request fetch error:', rideRequestError);
        } else if (rideRequestData && rideRequestData.length > 0) {
          console.log('Found accepted ride request:', rideRequestData);
          // Convert ride request to a mock booking format for fare calculation
          finalBookings = rideRequestData.map(request => ({
            id: `request_${request.id}`, // Create temporary ID
            ride_id: rideId,
            passenger_id: request.passenger_id,
            passenger: request.passenger,
            seats_booked: request.number_of_passengers,
            status: 'confirmed', // Treat as confirmed for fare calculation
            created_at: request.created_at,
            // Mock booking fields
            total_price: request.max_price_per_person * request.number_of_passengers,
            final_fare: null,
            fare_breakdown: null,
            payment_status: null,
            notes: 'Converted from ride request'
          }));
        }
      }
      
      setBookings(finalBookings);
      
      // Check if current user is the driver
      setIsDriver(rideData.driver_id === user.id);
    } catch (error) {
      console.error('Error fetching ride details:', error);
      Alert.alert('Error', `Failed to load ride details: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePassengerPayment = async () => {
    try {
      setProcessing(true);
      
      // Find the current user's booking
      const userBooking = bookings.find(b => b.passenger_id === user.id);
      if (!userBooking) {
        Alert.alert('Error', 'No booking found for current user');
        return;
      }

      const fareCalculation = calculateFare();
      const passengerFare = fareCalculation.breakdown.find(
        item => item.bookingId === userBooking.id
      );

      if (!passengerFare) {
        Alert.alert('Error', 'Fare calculation not found');
        return;
      }

      // Show payment modal instead of direct processing
      setShowPaymentModal(true);
      
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Payment Failed', 'Unable to process payment right now.');
    } finally {
      setProcessing(false);
    }
  };

  const processStripePayment = async () => {
    try {
      setProcessing(true);
      
      // Find the current user's booking
      const userBooking = bookings.find(b => b.passenger_id === user.id);
      if (!userBooking) {
        Alert.alert('Error', 'No booking found for current user');
        return;
      }

      const fareCalculation = calculateFare();
      const passengerFare = fareCalculation.breakdown.find(
        item => item.bookingId === userBooking.id
      );

      if (!passengerFare) {
        Alert.alert('Error', 'Fare calculation not found');
        return;
      }

      // Process payment through Stripe
      const paymentResult = await processPayment(
        passengerFare.totalFare,
        userBooking.id,
        `Ride payment for ${passengerFare.seatsBooked} seat(s)`
      );

      if (paymentResult.success) {
        // Update booking with payment status - use safe update approach
        const updatePayload = {};
        
        // Try to add payment_status if column exists
        try {
          updatePayload.payment_status = 'paid';
          updatePayload.final_fare = passengerFare.totalFare;
          updatePayload.fare_breakdown = {
            price_per_seat: ride.price_per_seat,
            seats_booked: passengerFare.seatsBooked,
            ride_fare: passengerFare.rideFare,
            platform_fee: passengerFare.platformFee,
            total_fare: passengerFare.totalFare
          };

          let { error } = await supabase
            .from('bookings')
            .update(updatePayload)
            .eq('id', userBooking.id)
            .eq('passenger_id', user.id);

          if (error) {
            // Fallback: update only with basic fields that should exist
            console.log('Full update failed, trying fallback update:', error.message);
            const paidNote = `Paid on ${new Date().toLocaleString()} - ₹${passengerFare.totalFare.toFixed(2)}`;
            const { error: fallbackError } = await supabase
              .from('bookings')
              .update({
                notes: userBooking.notes ? `${userBooking.notes}\n${paidNote}` : paidNote
              })
              .eq('id', userBooking.id)
              .eq('passenger_id', user.id);
            
            if (fallbackError) {
              console.error('Fallback update also failed:', fallbackError);
              throw fallbackError;
            }
          }
        } catch (updateError) {
          console.error('Update error:', updateError);
          // Final fallback: just update notes
          const paidNote = `Paid on ${new Date().toLocaleString()} - ₹${passengerFare.totalFare.toFixed(2)}`;
          const { error: notesError } = await supabase
            .from('bookings')
            .update({
              notes: userBooking.notes ? `${userBooking.notes}\n${paidNote}` : paidNote
            })
            .eq('id', userBooking.id)
            .eq('passenger_id', user.id);
          
          if (notesError) throw notesError;
        }

        setShowPaymentModal(false);
        Alert.alert(
          'Payment Successful',
          `Payment of ₹${passengerFare.totalFare.toFixed(2)} has been processed successfully.`,
          [{ text: 'OK', onPress: () => navigation.navigate('MyBookings') }]
        );
      } else {
        Alert.alert('Payment Failed', paymentResult.error || 'Payment processing failed. Please try again.');
      }
    } catch (error) {
      console.error('Error processing Stripe payment:', error);
      Alert.alert('Payment Failed', 'Unable to process payment right now. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const calculateFare = () => {
    if (!ride || !bookings.length) return { totalFare: 0, breakdown: [] };

    const platformFee = 5; // Fixed platform fee per booking (₹5)

    const breakdown = bookings.map(booking => {
      // Calculate fare based on driver's price per seat × seats booked + platform fee
      const rideFare = ride.price_per_seat * booking.seats_booked;
      const totalPassengerFare = rideFare + platformFee;

      return {
        bookingId: booking.id,
        passengerId: booking.passenger_id,
        passengerName: booking.passenger?.full_name || 'Unknown Passenger',
        seatsBooked: booking.seats_booked,
        pricePerSeat: ride.price_per_seat,
        rideFare: rideFare,
        platformFee: platformFee,
        totalFare: totalPassengerFare,
        isRideRequest: booking.isRideRequest || false,
        requestId: booking.requestId || null
      };
    });

    const totalFare = breakdown.reduce((sum, item) => sum + item.totalFare, 0);

    return {
      totalFare,
      breakdown,
      platformFee
    };
  };

  const calculateDistance = (origin, destination) => {
    // Mock distance calculation - in real app, use geocoding API
    // This is a simplified mock calculation
    const mockDistances = {
      'Downtown': { 'Airport': 15, 'University': 8, 'Mall': 12 },
      'Airport': { 'Downtown': 15, 'University': 20, 'Mall': 18 },
      'University': { 'Downtown': 8, 'Airport': 20, 'Mall': 5 },
      'Mall': { 'Downtown': 12, 'Airport': 18, 'University': 5 }
    };

    // Extract key locations from origin and destination
    const originKey = extractLocationKey(origin);
    const destKey = extractLocationKey(destination);

    if (mockDistances[originKey] && mockDistances[originKey][destKey]) {
      return mockDistances[originKey][destKey];
    }

    // Default mock distance if locations not found
    return 10; // Default 10 miles
  };

  const extractLocationKey = (location) => {
    const keywords = ['Downtown', 'Airport', 'University', 'Mall'];
    for (let keyword of keywords) {
      if (location.toLowerCase().includes(keyword.toLowerCase())) {
        return keyword;
      }
    }
    return 'Downtown'; // Default
  };

  const handlePaymentComplete = async () => {
    try {
      setProcessing(true);
      
      // Get all bookings for this ride that need to be marked as paid
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('ride_id', rideId)
        .in('status', ['approved', 'confirmed', 'pending_confirmation']);

      if (bookingsError) throw bookingsError;

      if (!bookings || bookings.length === 0) {
        Alert.alert('No Passengers', 'No confirmed bookings found for this ride.');
        return;
      }

      // Update all bookings to completed and paid
      const bookingUpdates = bookings.map(booking =>
        supabase
          .from('bookings')
          .update({
            status: 'completed',
            payment_status: 'paid',
            final_fare: ride.price_per_seat * booking.seats_booked
          })
          .eq('id', booking.id)
      );

      await Promise.all(bookingUpdates);

      // Update ride status to finished
      const { error: rideError } = await supabase
        .from('rides')
        .update({ status: 'finished' })
        .eq('id', rideId);

      if (rideError) throw rideError;

      // Increment ride counters for driver and passengers
      const { error: driverCounterError } = await supabase
        .rpc('increment_field', {
          user_id: ride.driver_id,
          field_name: 'rides_offered',
          increment_by: 1
        });

      if (driverCounterError) throw driverCounterError;

      // Increment rides_taken for each passenger
      const passengerUpdates = bookings.map(booking =>
        supabase
          .rpc('increment_field', {
            user_id: booking.passenger_id,
            field_name: 'rides_taken',
            increment_by: booking.seats_booked
          })
      );

      await Promise.all(passengerUpdates);

      Alert.alert(
        'Success',
        'Payment confirmed. All passengers have been marked as paid.',
        [{ text: 'OK', onPress: () => navigation.navigate('MyRides') }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm payment. Please try again.');
      console.error('Error confirming payment:', error);
    } finally {
      setProcessing(false);
    }
  };

  const finalizeCharges = async () => {
    try {
      setProcessing(true);
      const fareCalculation = calculateFare();

      // 1.  Update each booking with fare + set status completed + bump passenger counters
      const passengerBookingIds = [];   // collect ids so we can open rating later
      for (const passengerFare of fareCalculation.breakdown) {
        // Check if this is a real booking or a ride request
        if (passengerFare.isRideRequest) {
          // This is a ride request, we need to create a proper booking first
          const { data: bookingData, error: bookingError } = await supabase
            .from('bookings')
            .insert({
              ride_id: rideId,
              passenger_id: passengerFare.passengerId,
              seats_booked: passengerFare.seatsBooked,
              status: 'pending_confirmation',
              final_fare: passengerFare.totalFare,
              fare_breakdown: {
                price_per_seat: ride.price_per_seat,
                seats_booked: passengerFare.seatsBooked,
                ride_fare: passengerFare.rideFare,
                platform_fee: passengerFare.platformFee,
                total_fare: passengerFare.totalFare
              },
              payment_status: 'pending'
            })
            .select()
            .single();

          if (bookingError) throw bookingError;
          
          // Store the new booking ID
          passengerBookingIds.push(bookingData.id);
          
          // Update the ride request to mark it as having a booking
          await supabase
            .from('ride_requests')
            .update({ booking_id: bookingData.id })
            .eq('id', passengerFare.requestId);
        } else {
          // This is an existing booking, update it
          const updatePayload = {
            final_fare: passengerFare.totalFare,
            fare_breakdown: {
              price_per_seat: ride.price_per_seat,
              seats_booked: passengerFare.seatsBooked,
              ride_fare: passengerFare.rideFare,
              platform_fee: passengerFare.platformFee,
              total_fare: passengerFare.totalFare
            },
            payment_status: 'pending',
            status: 'pending_confirmation'     // Rider must confirm before payment
          };

          let { error } = await supabase
            .from('bookings')
            .update(updatePayload)
            .eq('id', passengerFare.bookingId);

          if (error) {
            // Retry without payment_status if column doesn't exist
            const msg = (error.message || '').toLowerCase();
            if (msg.includes('payment_status') && msg.includes('does not exist')) {
              const { error: retryError } = await supabase
                .from('bookings')
                .update({
                  final_fare: passengerFare.totalFare,
                  fare_breakdown: {
                    price_per_seat: ride.price_per_seat,
                    seats_booked: passengerFare.seatsBooked,
                    ride_fare: passengerFare.rideFare,
                    platform_fee: passengerFare.platformFee,
                    total_fare: passengerFare.totalFare
                  },
                  status: 'pending_confirmation'   // rider must confirm
                })
                .eq('id', passengerFare.bookingId);
              if (retryError) throw retryError;
            } else {
              throw error;
            }
          }

          // Store booking id so we can open rating later (after rider confirms)
          passengerBookingIds.push(passengerFare.bookingId);
        }
      }

      // 2.  Save total earnings and mark ride as finished
      const { error: rideError } = await supabase
        .from('rides')
        .update({ 
          total_earnings: fareCalculation.totalFare,
          status: 'finished'  // Mark ride as finished when driver finalizes charges
        })
        .eq('id', rideId);

      if (rideError) throw rideError;

      // 3.  Stay on screen; rider will confirm completion and then pay
      setFareFinalized(true);
      Alert.alert(
        'Charges Finalized',
        `Fare locked. Ask riders to confirm completion and review you before payment. Total to collect: ₹${fareCalculation.totalFare.toFixed(2)}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error finalizing charges:', error);
      Alert.alert('Error', 'Failed to finalize charges');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text>Loading fare estimate...</Text>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Ride not found</Text>
        <Text style={styles.errorDetail}>Unable to load ride details. The ride may have been removed or you may not have access to it.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!bookings.length) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No passengers found</Text>
        <Text style={styles.errorDetail}>This ride has no confirmed bookings or accepted ride requests to calculate fares for. Passengers may need to complete their booking first.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fareCalculation = calculateFare();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fare Estimate</Text>
        <Text style={styles.headerSubtitle}>
          {bookingId ? 'Review fare breakdown and complete payment' : 'Review and confirm payment'}
        </Text>
      </View>

      {/* Ride Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ride Summary</Text>
        <View style={styles.infoCard}>
          <View style={styles.rideInfo}>
            <Text style={styles.rideDate}>
              {new Date(ride.ride_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
            <Text style={styles.rideTime}>{ride.ride_time}</Text>
            <View style={styles.routeContainer}>
              <Text style={styles.locationText}>From: {ride.origin}</Text>
              <Text style={styles.locationText}>To: {ride.destination}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Fare Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fare Breakdown</Text>
        <View style={styles.infoCard}>
          <View style={styles.fareBreakdown}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Price per seat:</Text>
              <Text style={styles.fareValue}>₹{ride.price_per_seat.toFixed(2)}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Platform fee:</Text>
              <Text style={styles.fareValue}>₹{fareCalculation.platformFee.toFixed(2)}</Text>
            </View>
            <View style={styles.fareDivider} />
            <View style={styles.fareRow}>
              <Text style={styles.fareTotalLabel}>Total per booking:</Text>
              <Text style={styles.fareTotalValue}>
                ₹{(ride.price_per_seat + fareCalculation.platformFee).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Passenger Fares */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Passenger Charges</Text>
        {fareCalculation.breakdown.map((passengerFare, index) => (
          <View key={index} style={styles.passengerCard}>
            <View style={styles.passengerHeader}>
              <Text style={styles.passengerName}>{passengerFare.passengerName}</Text>
              <Text style={styles.seatsInfo}>({passengerFare.seatsBooked} seat{passengerFare.seatsBooked > 1 ? 's' : ''})</Text>
            </View>
            <View style={styles.passengerFareBreakdown}>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Price per seat × {passengerFare.seatsBooked}:</Text>
                <Text style={styles.fareValue}>₹{passengerFare.pricePerSeat.toFixed(2)} × {passengerFare.seatsBooked} = ₹{passengerFare.rideFare.toFixed(2)}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Platform fee:</Text>
                <Text style={styles.fareValue}>₹{passengerFare.platformFee.toFixed(2)}</Text>
              </View>
              <View style={styles.fareDivider} />
              <View style={styles.fareRow}>
                <Text style={styles.fareTotalLabel}>Total:</Text>
                <Text style={styles.fareTotalValue}>₹{passengerFare.totalFare.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Total Summary */}
      <View style={styles.section}>
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Collection:</Text>
            <Text style={styles.totalValue}>₹{fareCalculation.totalFare.toFixed(2)}</Text>
          </View>
          <Text style={styles.totalNote}>
            This amount will be processed and distributed to passengers for payment
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        {isDriver ? (
          fareFinalized ? (
            // Driver view after fare is finalized - show payment complete button
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handlePaymentComplete}
              disabled={Boolean(processing)}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  Payment Complete - ₹{fareCalculation.totalFare.toFixed(2)}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            // Driver view - read only before fare is finalized
            <View style={styles.driverMessageCard}>
              <Text style={styles.driverMessageText}>
                Waiting for passenger to confirm and pay.
              </Text>
            </View>
          )
        ) : bookingId ? (
          // Passenger payment flow
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handlePassengerPayment}
            disabled={Boolean(processing)}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.confirmButtonText}>
                Pay Now - ₹{fareCalculation.totalFare.toFixed(2)}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          // Driver finalize charges flow
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={finalizeCharges}
            disabled={Boolean(processing)}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.confirmButtonText}>
                Finalize Charges - ₹{fareCalculation.totalFare.toFixed(2)}
              </Text>
            )}
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={Boolean(processing)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Stripe Payment Modal */}
      <Modal
        visible={Boolean(showPaymentModal)}
        transparent  // Use shorthand to prevent Android boolean casting
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Complete Payment</Text>
            <Text style={styles.modalSubtitle}>
              Enter your card details to process the payment
            </Text>
            
            <SafeCardField
              postalCodeEnabled={false}
              placeholder={{
                number: '4242 4242 4242 4242',
              }}
              cardStyle={{
                backgroundColor: '#FFFFFF',
                textColor: '#000000',
                borderColor: '#d1d5db',
                borderWidth: 1,
                borderRadius: 8,
              }}
              style={styles.cardField}
              onCardChange={(cardDetails) => {
                setCardComplete(Boolean(cardDetails.complete));
              }}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setShowPaymentModal(false)}
                disabled={Boolean(processing)}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmModalButton, (!cardComplete || processing) && styles.disabledButton]}
                onPress={processStripePayment}
                disabled={Boolean(!cardComplete || processing)}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmModalButtonText}>
                    Pay ₹{bookings.find(b => b.passenger_id === user?.id) && 
                      calculateFare().breakdown.find(item => item.bookingId === bookings.find(b => b.passenger_id === user?.id).id)?.totalFare.toFixed(2)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rideInfo: {
    marginBottom: 12,
  },
  rideDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  rideTime: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  routeContainer: {
    marginVertical: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    marginVertical: 2,
  },
  distanceText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  timeText: {
    fontSize: 14,
    color: '#6b7280',
  },
  fareBreakdown: {
    marginBottom: 8,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  fareLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  fareValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  fareTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  fareTotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  fareDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  passengerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  passengerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  seatsInfo: {
    fontSize: 14,
    color: '#6b7280',
  },
  passengerFareBreakdown: {
    marginTop: 8,
  },
  totalCard: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  totalNote: {
    fontSize: 12,
    color: '#e0e7ff',
    textAlign: 'center',
    marginTop: 8,
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  confirmButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  driverMessageCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  driverMessageText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelModalButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  confirmModalButton: {
    backgroundColor: '#10b981',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  cancelModalButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmModalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default FareEstimateScreen;