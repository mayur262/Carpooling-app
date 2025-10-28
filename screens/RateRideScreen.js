import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import SafeTextInput from '../components/SafeTextInput';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

const RateRideScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { bookingId } = route.params;
  const [booking, setBooking] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBookingDetails();
  }, []);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          rides!inner(*)
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;
      
      // Fetch the other user's information (driver or passenger)
      const otherUserId = user.id === data.passenger_id ? data.rides.driver_id : data.passenger_id;
      
      const { data: otherUserData, error: userError } = await supabase
        .from('users')
        .select('id, full_name, email, average_rating')
        .eq('id', otherUserId)
        .single();

      if (userError) throw userError;

      const bookingWithUser = {
        ...data,
        other_user: otherUserData
      };
      
      setBooking(bookingWithUser);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch booking details');
      console.error('Error fetching booking details:', error);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const submitRating = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      
      if (!booking) {
        Alert.alert('Error', 'Booking data not available');
        return;
      }

      // Determine if user is rating as passenger or driver
      const isPassenger = user.id === booking.passenger_id;
      const ratingType = isPassenger ? 'passenger_to_driver' : 'driver_to_passenger';
      
      // Create the rating
      const { error: ratingError } = await supabase
        .from('ratings')
        .insert({
          ride_id: booking.ride_id,
          booking_id: bookingId,
          rater_id: user.id,
          ratee_id: booking.other_user.id,
          rating: rating,
          comment: comment.trim(),
          rating_type: ratingType
        });

      if (ratingError) throw ratingError;

      // Update the booking to mark as rated
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ is_rated: true })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      // Update the rated user's average rating
      await updateUserAverageRating(booking.other_user.id);

      Alert.alert(
        'Success',
        'Thank you for your rating!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit rating');
      console.error('Error submitting rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const updateUserAverageRating = async (userId) => {
    try {
      // Get all ratings for this user
      const { data: ratings, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('ratee_id', userId);

      if (error) throw error;

      if (ratings && ratings.length > 0) {
        const average = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        
        // Update user's average rating
        const { error: updateError } = await supabase
          .from('users')
          .update({ average_rating: average })
          .eq('id', userId);

        if (updateError) throw updateError;
      }
    } catch (error) {
      console.error('Error updating user average rating:', error);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            style={styles.starButton}
            onPress={() => setRating(star)}
          >
            <Text style={[styles.star, star <= rating && styles.starFilled]}>
              ⭐
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text>Loading booking details...</Text>
      </View>
    );
  }

  if (!booking) {
    return null;
  }

  const isPassenger = user.id === booking.passenger_id;
  const userType = isPassenger ? 'driver' : 'passenger';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rate Your Ride</Text>
        <Text style={styles.headerSubtitle}>
          How was your experience with {booking.other_user?.full_name || 'this user'}?
        </Text>
      </View>

      <View style={styles.content}>
        {/* Ride Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride Summary</Text>
          <View style={styles.infoCard}>
            <View style={styles.rideInfo}>
              <Text style={styles.rideDate}>
                {new Date(booking.rides.ride_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
              <Text style={styles.rideTime}>
                {booking.rides.ride_time}
              </Text>
              <View style={styles.routeContainer}>
                <Text style={styles.locationText}>From: {booking.rides.origin}</Text>
                <Text style={styles.locationText}>To: {booking.rides.destination}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Rating Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate this {userType}</Text>
          <View style={styles.ratingCard}>
            <Text style={styles.ratingLabel}>
              How would you rate {booking.other_user?.full_name || 'this user'}?
            </Text>
            {renderStars()}
            <Text style={styles.ratingText}>
              {rating === 0 && 'Tap a star to rate'}
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </Text>
          </View>
        </View>

        {/* Comment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Comments (Optional)</Text>
          <View style={styles.commentCard}>
            <SafeTextInput
              style={styles.commentInput}
              placeholder="Share your experience (optional)..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.characterCount}>
              {comment.length}/500
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
            onPress={submitRating}
            disabled={submitting || rating === 0}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Rating</Text>
            )}
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 10,
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
  rideInfo: {
    gap: 8,
  },
  rideDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  rideTime: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  routeContainer: {
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: '#4b5563',
  },
  ratingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingLabel: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 15,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  starButton: {
    paddingHorizontal: 8,
  },
  star: {
    fontSize: 32,
    color: '#d1d5db',
    opacity: 0.5,
  },
  starFilled: {
    color: '#fbbf24',
    opacity: 1,
  },
  ratingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 5,
  },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 5,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RateRideScreen;