const express = require('express');
const router = express.Router();

// Import supabase client
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Calculate matching score for a ride based on multiple factors
 * Higher score = better match
 */
function calculateMatchingScore(ride, searchParams, userPreferences = {}) {
  let score = 0;
  const weights = {
    price: 30,           // Price importance
    proximity: 25,       // How close pickup/dropoff points are
    seatsAvailable: 15,  // More available seats
    rating: 20,          // Driver rating
    departureTime: 10    // Departure time match
  };

  // 1. Price Score (lower price = higher score)
  const maxReasonablePrice = 1000; // Adjust based on your market
  const priceScore = Math.max(0, 100 - ((ride.price_per_seat / maxReasonablePrice) * 100));
  score += (priceScore * weights.price) / 100;

  // 2. Proximity Score (closer pickup/dropoff = higher score)
  let proximityScore = 100;
  if (searchParams.pickupLat && searchParams.pickupLon && ride.origin_lat && ride.origin_lng) {
    const pickupDistance = calculateDistance(
      searchParams.pickupLat,
      searchParams.pickupLon,
      ride.origin_lat,
      ride.origin_lng
    );
    // Penalize if pickup is more than 5km away
    proximityScore -= Math.min(pickupDistance * 10, 50);
  }
  
  if (searchParams.dropoffLat && searchParams.dropoffLon && ride.destination_lat && ride.destination_lng) {
    const dropoffDistance = calculateDistance(
      searchParams.dropoffLat,
      searchParams.dropoffLon,
      ride.destination_lat,
      ride.destination_lng
    );
    // Penalize if dropoff is more than 5km away
    proximityScore -= Math.min(dropoffDistance * 10, 50);
  }
  score += (Math.max(0, proximityScore) * weights.proximity) / 100;

  // 3. Seats Available Score (more seats = higher score, up to a limit)
  const seatsScore = Math.min((ride.available_seats / 4) * 100, 100);
  score += (seatsScore * weights.seatsAvailable) / 100;

  // 4. Driver Rating Score
  const driverRating = ride.driver_rating || 0;
  const ratingScore = (driverRating / 5) * 100; // Rating out of 5
  score += (ratingScore * weights.rating) / 100;

  // 5. Departure Time Score (closer to desired time = higher score)
  if (searchParams.desiredDepartureTime && ride.ride_date && ride.ride_time) {
    const rideDateTime = new Date(`${ride.ride_date}T${ride.ride_time}`);
    const desiredTime = new Date(searchParams.desiredDepartureTime);
    const timeDiff = Math.abs(rideDateTime - desiredTime);
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    // Perfect match within 30 minutes, decreasing score after that
    const timeScore = Math.max(0, 100 - (hoursDiff * 20));
    score += (timeScore * weights.departureTime) / 100;
  }

  // Apply user preferences
  if (userPreferences.preferWomenDrivers && ride.driver_gender === 'female') {
    score += 5; // Bonus for women drivers if preferred
  }

  if (userPreferences.preferVerifiedDrivers && ride.driver_verified) {
    score += 5; // Bonus for verified drivers
  }

  // Bonus for highly experienced drivers
  if (ride.driver_total_rides > 50) {
    score += 3;
  }

  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

/**
 * POST /api/matching/find-best-rides
 * Find and rank the best matching rides for a rider
 */
router.post('/find-best-rides', async (req, res) => {
  try {
    const {
      origin,
      destination,
      pickupLat,
      pickupLon,
      dropoffLat,
      dropoffLon,
      departureDate,
      desiredDepartureTime,
      seatsNeeded = 1,
      maxPrice,
      preferences = {}
    } = req.body;

    console.log('Finding best rides with params:', req.body);

    // Validate required fields
    if (!origin || !destination || !departureDate) {
      return res.status(400).json({
        success: false,
        error: 'Origin, destination, and departure date are required'
      });
    }

    // Build query
    let query = supabase
      .from('rides')
      .select(`
        *,
        driver:users!rides_driver_id_fkey(
          id,
          full_name,
          profile_image,
          phone,
          rating,
          total_rides,
          is_verified,
          gender
        )
      `)
      .eq('status', 'active')
      .gte('available_seats', seatsNeeded);

    // Filter by date
    const searchDate = new Date(departureDate);
    const dateStr = searchDate.toISOString().split('T')[0];
    query = query.eq('ride_date', dateStr);

    // Filter by price if specified
    if (maxPrice) {
      query = query.lte('price_per_seat', parseFloat(maxPrice));
    }

    const { data: rides, error } = await query;

    if (error) {
      console.error('Error fetching rides:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch available rides',
        details: error.message
      });
    }

    console.log(`Found ${rides?.length || 0} rides from database`);

    if (!rides || rides.length === 0) {
      return res.json({
        success: true,
        message: 'No matching rides found',
        data: {
          recommendedRide: null,
          allMatches: [],
          matchingCriteria: {
            origin,
            destination,
            departureDate,
            seatsNeeded,
            maxPrice: maxPrice || 'No limit',
            preferences
          }
        }
      });
    }

    // Filter rides by origin and destination (case-insensitive, partial match)
    const filteredRides = rides.filter(ride => {
      const originMatch = ride.origin?.toLowerCase().includes(origin.toLowerCase()) ||
                          origin.toLowerCase().includes(ride.origin?.toLowerCase());
      const destMatch = ride.destination?.toLowerCase().includes(destination.toLowerCase()) ||
                        destination.toLowerCase().includes(ride.destination?.toLowerCase());
      return originMatch && destMatch;
    });

    console.log(`${filteredRides.length} rides match origin/destination`);

    if (filteredRides.length === 0) {
      return res.json({
        success: true,
        message: 'No rides found for the specified route',
        data: {
          recommendedRide: null,
          allMatches: [],
          matchingCriteria: {
            origin,
            destination,
            departureDate,
            seatsNeeded,
            maxPrice: maxPrice || 'No limit',
            preferences
          }
        }
      });
    }

    // Calculate matching scores for each ride
    const searchParams = {
      pickupLat,
      pickupLon,
      dropoffLat,
      dropoffLon,
      desiredDepartureTime: desiredDepartureTime || departureDate
    };

    const rankedRides = filteredRides.map(ride => {
      // Add driver rating to ride object
      const rideWithRating = {
        ...ride,
        driver_rating: ride.driver?.rating || 0,
        driver_verified: ride.driver?.is_verified || false,
        driver_gender: ride.driver?.gender || 'not_specified',
        driver_total_rides: ride.driver?.total_rides || 0
      };

      const matchingScore = calculateMatchingScore(
        rideWithRating,
        searchParams,
        preferences
      );

      // Generate match reason based on strong points
      const reasons = [];
      if (ride.price_per_seat <= (maxPrice || 100)) {
        reasons.push('good price');
      }
      if (ride.driver?.rating >= 4.5) {
        reasons.push('highly rated driver');
      }
      if (ride.available_seats >= seatsNeeded) {
        reasons.push('enough seats');
      }
      if (ride.driver?.is_verified) {
        reasons.push('verified driver');
      }
      if (ride.driver?.total_rides > 50) {
        reasons.push('experienced driver');
      }

      const matchReason = reasons.length > 0 
        ? reasons.slice(0, 3).join(', ').replace(/,([^,]*)$/, ' and$1')
        : 'meets your search criteria';

      return {
        ...ride,
        matchingScore,
        matchReason,
        isRecommended: false, // Will be set for the best match
        matchingDetails: {
          pricePerSeat: ride.price_per_seat,
          availableSeats: ride.available_seats,
          driverRating: ride.driver?.rating || 0,
          driverTotalRides: ride.driver?.total_rides || 0,
          isVerified: ride.driver?.is_verified || false,
          departureTime: `${ride.ride_date} ${ride.ride_time}`,
          vehicleInfo: `${ride.vehicle_type || ''} ${ride.vehicle_model || ''}`.trim() || 'Not specified'
        }
      };
    });

    // Sort by matching score (highest first)
    rankedRides.sort((a, b) => b.matchingScore - a.matchingScore);

    // Mark the best match as recommended
    if (rankedRides.length > 0) {
      rankedRides[0].isRecommended = true;
    }

    // Get the best match
    const bestMatch = rankedRides[0];

    console.log(`Best match has score: ${bestMatch.matchingScore}`);

    res.json({
      success: true,
      message: `Found ${rankedRides.length} matching ride(s)`,
      data: {
        recommendedRide: bestMatch,
        allMatches: rankedRides,
        matchingCriteria: {
          origin,
          destination,
          departureDate,
          seatsNeeded,
          maxPrice: maxPrice || 'No limit',
          preferences
        }
      }
    });

  } catch (error) {
    console.error('Ride matching error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /api/matching/compare-rides
 * Compare specific rides side by side
 */
router.get('/compare-rides', async (req, res) => {
  try {
    const { rideIds } = req.query;

    if (!rideIds) {
      return res.status(400).json({
        success: false,
        error: 'Ride IDs are required'
      });
    }

    const idsArray = rideIds.split(',').map(id => id.trim());

    const { data: rides, error } = await supabase
      .from('rides')
      .select(`
        *,
        driver:users!rides_driver_id_fkey(
          id,
          full_name,
          profile_image,
          rating,
          total_rides,
          is_verified,
          gender
        )
      `)
      .in('id', idsArray);

    if (error) {
      console.error('Error fetching rides for comparison:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch rides',
        details: error.message
      });
    }

    // Create comparison data
    const comparison = rides.map(ride => ({
      rideId: ride.id,
      driver: {
        name: ride.driver?.full_name,
        rating: ride.driver?.rating || 0,
        totalRides: ride.driver?.total_rides || 0,
        isVerified: ride.driver?.is_verified || false
      },
      price: ride.price_per_seat,
      availableSeats: ride.available_seats,
      departureTime: `${ride.ride_date} ${ride.ride_time}`,
      vehicle: {
        type: ride.vehicle_type,
        model: ride.vehicle_model,
        plate: ride.vehicle_plate
      },
      route: {
        origin: ride.origin,
        destination: ride.destination
      }
    }));

    res.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error('Ride comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;
