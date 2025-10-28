import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import SafeTextInput from '../components/SafeTextInput';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import SafeMapView, { Marker, PROVIDER_GOOGLE } from '../components/SafeMapView';

const SearchRidesScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    origin: '',
    destination: '',
    date: '',
    maxPrice: '',
    minSeats: '1'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'

  useEffect(() => {
    searchRides();
  }, []);

  const searchRides = async (useFilters = filters) => {
    try {
      setLoading(true);
      
      // Debug: Log current date and search parameters
      const currentDate = new Date().toISOString().split('T')[0];
      console.log('Searching rides with date >=', currentDate);
      console.log('Filters being used:', useFilters);
      
      let query = supabase
        .from('rides')
        .select(`*`)
        .eq('status', 'active')
        .gte('ride_date', currentDate)
        .order('ride_date', { ascending: true })
        .order('ride_time', { ascending: true });

      // Apply filters with flexible matching
      if (useFilters.origin) {
        query = query.ilike('origin', `%${useFilters.origin}%`);
      }
      if (useFilters.destination) {
        query = query.ilike('destination', `%${useFilters.destination}%`);
      }
      if (useFilters.date) {
        query = query.eq('ride_date', useFilters.date);
      }
      if (useFilters.maxPrice) {
        query = query.lte('price_per_seat', parseFloat(useFilters.maxPrice));
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch driver data for each ride
      const driverIds = [...new Set(data.map(ride => ride.driver_id))];
      const { data: driversData, error: driversError } = await supabase
        .from('users')
        .select('id, full_name, email, bio, average_rating')
        .in('id', driverIds);

      if (driversError) throw driversError;

      // Fetch bookings data for available seats calculation
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, ride_id, passenger_id, seats_booked, status')
        .in('ride_id', data.map(ride => ride.id))
        .in('status', ['pending', 'approved']);
      
      if (bookingsError) throw bookingsError;

      // Merge driver data and bookings with rides
      const ridesWithAllData = data.map(ride => ({
        ...ride,
        driver: driversData.find(d => d.id === ride.driver_id) || { full_name: 'Unknown', email: 'N/A', bio: '', average_rating: null },
        bookings: bookingsData ? bookingsData.filter(b => b.ride_id === ride.id) : []
      }));

      // Filter by available seats and search query
      let filteredRides = ridesWithAllData || [];
      
      // Filter by available seats
      if (useFilters.minSeats) {
        const minSeats = parseInt(useFilters.minSeats);
        filteredRides = filteredRides.filter(ride => {
          const confirmedSeats = ride.bookings?.reduce((sum, booking) =>
      (booking.status === 'approved' || booking.status === 'confirmed') ? sum + booking.seats_booked : sum, 0) || 0;
          const availableSeats = ride.available_seats - confirmedSeats;
          return availableSeats >= minSeats;
        });
      }

      // Filter by search query (origin, destination, or driver name) - more flexible matching
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredRides = filteredRides.filter(ride => {
          const originMatch = ride.origin.toLowerCase().includes(query);
          const destinationMatch = ride.destination.toLowerCase().includes(query);
          const driverNameMatch = ride.driver?.full_name?.toLowerCase().includes(query) || false;
          return originMatch || destinationMatch || driverNameMatch;
        });
      }

      // Debug: Log search results
      console.log('Search results:', {
        totalRides: data.length,
        afterDateFilter: ridesWithAllData.length,
        afterSeatFilter: filteredRides.length,
        searchQuery: searchQuery,
        filters: useFilters,
        userId: user.id
      });

      // Exclude rides created by the current user
      filteredRides = filteredRides.filter(ride => ride.driver_id !== user.id);

      setRides(filteredRides);
    } catch (error) {
      Alert.alert('Error', 'Failed to search rides');
      console.error('Error searching rides:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    searchRides();
  };

  const findSmartMatches = async () => {
    try {
      if (!filters.origin || !filters.destination) {
        Alert.alert('Missing Information', 'Please enter both origin and destination to find smart matches');
        return;
      }

      setLoading(true);
      
      // Get backend server URL (adjust this to your server IP)
      const BACKEND_URL = 'http://10.0.2.2:3000'; // For Android emulator
      // const BACKEND_URL = 'http://localhost:3000'; // For iOS simulator
      
      const requestBody = {
        origin: filters.origin,
        destination: filters.destination,
        departureDate: filters.date || new Date().toISOString().split('T')[0],
        seatsNeeded: parseInt(filters.minSeats) || 1,
        maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
        preferences: {
          preferVerifiedDrivers: true
        }
      };

      console.log('Calling smart matching API with:', requestBody);

      const response = await fetch(`${BACKEND_URL}/api/matching/find-best-rides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      console.log('Smart matching result:', result);

      if (result.success && result.data.allMatches.length > 0) {
        // Sort rides by matching score (already sorted by backend)
        setRides(result.data.allMatches);
        
        // Show alert with best match info
        const bestMatch = result.data.recommendedRide;
        if (bestMatch) {
          Alert.alert(
            '🎯 Best Match Found!',
            `${bestMatch.origin} → ${bestMatch.destination}\n` +
            `Driver: ${bestMatch.driver.full_name}\n` +
            `Price: $${bestMatch.price_per_seat}\n` +
            `Match Score: ${bestMatch.matchingScore.toFixed(0)}%\n\n` +
            `Why this match?\n${bestMatch.matchReason}`,
            [{ text: 'View All Matches', style: 'default' }]
          );
        }
      } else {
        Alert.alert('No Matches', result.message || 'No rides found matching your criteria');
        setRides([]);
      }
    } catch (error) {
      console.error('Error finding smart matches:', error);
      Alert.alert('Error', 'Failed to find smart matches. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setShowFilters(false);
    searchRides(filters);
  };

  const clearFilters = () => {
    setFilters({
      origin: '',
      destination: '',
      date: '',
      maxPrice: '',
      minSeats: '1'
    });
    setSearchQuery('');
    searchRides({ origin: '', destination: '', date: '', maxPrice: '', minSeats: '1' });
  };

  const debugShowAllRides = async () => {
    try {
      console.log('=== DEBUG: Showing all rides in database ===');
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('Debug error:', error);
        return;
      }
      
      console.log('All recent rides:', data);
      console.log('Current user ID:', user?.id);
      console.log('Current date:', new Date().toISOString().split('T')[0]);
      
      if (data && data.length > 0) {
        Alert.alert(
          'Debug Info',
          `Found ${data.length} rides in database. Check console for details.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Debug Info', 'No rides found in database');
      }
    } catch (error) {
      console.error('Debug error:', error);
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
    const bookedSeats = item.bookings?.reduce((sum, booking) =>
           (booking.status === 'approved' || booking.status === 'confirmed') ? sum + booking.seats_booked : sum, 0) || 0;0;
    const availableSeats = item.available_seats - bookedSeats;

    return (
      <TouchableOpacity
        style={styles.rideCard}
        onPress={() => navigation.navigate('RideDetails', { rideId: item.id })}
      >
        <View style={styles.rideHeader}>
          <Text style={styles.rideDate}>{formatDate(item.ride_date)}</Text>
          <View style={styles.seatsContainer}>
            <Text style={styles.availableSeats}>{availableSeats}</Text>
            <Text style={styles.totalSeats}>/{item.available_seats}</Text>
          </View>
        </View>

        {/* Show matching score if available (from smart match) */}
        {item.matchingScore && (
          <View style={[
            styles.matchBadge,
            item.matchingScore >= 85 ? styles.matchBadgeExcellent :
            item.matchingScore >= 70 ? styles.matchBadgeGood :
            item.matchingScore >= 50 ? styles.matchBadgeFair : styles.matchBadgePoor
          ]}>
            <Text style={styles.matchBadgeText}>
              🎯 {item.matchingScore.toFixed(0)}% Match
            </Text>
            {item.isRecommended && (
              <Text style={styles.recommendedText}> • BEST MATCH</Text>
            )}
          </View>
        )}

        <View style={styles.routeContainer}>
          <View style={styles.routeItem}>
            <View style={styles.routeDot} />
            <Text style={styles.locationText}>{item.origin}</Text>
          </View>
          
          <View style={styles.routeLine} />
          
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, styles.destinationDot]} />
            <Text style={styles.locationText}>{item.destination}</Text>
          </View>
        </View>

        <View style={styles.rideDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{formatTime(item.ride_time)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Price</Text>
            <Text style={styles.detailValue}>${item.price_per_seat}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Driver</Text>
            <Text style={styles.driverName}>{item.driver?.full_name || 'Unknown Driver'}</Text>
            {item.driver?.average_rating && item.driver.average_rating > 0 && (
              <Text style={styles.rating}>⭐ {item.driver.average_rating.toFixed(1)}</Text>
            )}
          </View>
        </View>

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => navigation.navigate('BookRide', { rideId: item.id })}
        >
          <Text style={styles.bookButtonText}>Book This Ride</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Searching rides...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find a Ride</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            style={[styles.filterButton, { marginRight: 8 }]}
            onPress={debugShowAllRides}
          >
            <Text style={styles.filterButtonText}>🐛 Debug</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text style={styles.filterButtonText}>🔍 Filters</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <SafeTextInput
          style={styles.searchInput}
          placeholder="Search by location or driver name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => searchRides()}
        />
        <TouchableOpacity style={styles.searchButton} onPress={() => searchRides()}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smartMatchButton} onPress={findSmartMatches}>
          <Text style={styles.smartMatchButtonText}>🎯 Smart</Text>
        </TouchableOpacity>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'list' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewModeButtonText, viewMode === 'list' && styles.viewModeButtonTextActive]}>
            List
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'map' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('map')}
        >
          <Text style={[styles.viewModeButtonText, viewMode === 'map' && styles.viewModeButtonTextActive]}>
            Map
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <SafeTextInput
              style={styles.filterInput}
              placeholder="Origin"
              value={filters.origin}
              onChangeText={(text) => setFilters({...filters, origin: text})}
            />
            <SafeTextInput
              style={styles.filterInput}
              placeholder="Destination"
              value={filters.destination}
              onChangeText={(text) => setFilters({...filters, destination: text})}
            />
          </View>
          <View style={styles.filterRow}>
            <SafeTextInput
              style={styles.filterInput}
              placeholder="Date (YYYY-MM-DD)"
              value={filters.date}
              onChangeText={(text) => setFilters({...filters, date: text})}
            />
            <SafeTextInput
              style={styles.filterInput}
              placeholder="Max Price"
              value={filters.maxPrice}
              onChangeText={(text) => setFilters({...filters, maxPrice: text})}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.filterRow}>
            <SafeTextInput
              style={styles.filterInput}
              placeholder="Min Seats"
              value={filters.minSeats}
              onChangeText={(text) => setFilters({...filters, minSeats: text})}
              keyboardType="numeric"
            />
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Results */}
      {viewMode === 'map' ? (
        Platform.OS === 'web' ? (
          // Web alternative - show list instead of map
          <View style={styles.webMapAlternative}>
            <Text style={styles.webMapTitle}>🗺️ Map View</Text>
            <Text style={styles.webMapDescription}>
              Interactive map is available on mobile devices
            </Text>
            <ScrollView style={styles.webMapList}>
              {rides.map((ride) => (
                <TouchableOpacity
                  key={ride.id}
                  style={styles.rideCard}
                  onPress={() => navigation.navigate('RideDetails', { rideId: ride.id })}
                >
                  <Text style={styles.rideRoute}>{ride.origin} → {ride.destination}</Text>
                  <Text style={styles.rideDate}>{new Date(ride.ride_date + 'T' + ride.ride_time).toLocaleString()}</Text>
                  <Text style={styles.ridePrice}>${ride.price_per_seat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          // Native map view
          SafeMapView && (
            <SafeMapView
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: 37.7749,
                longitude: -122.4194,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              {rides.map((ride) => (
                <Marker
                  key={ride.id}
                  coordinate={{
                    latitude: ride.origin_lat || 37.7749,
                    longitude: ride.origin_lng || -122.4194,
                  }}
                  title={`${ride.origin} → ${ride.destination}`}
                  description={`${formatDate(ride.ride_date)} at ${formatTime(ride.ride_time)} - $${ride.price_per_seat}`}
                  onCalloutPress={() => navigation.navigate('RideDetails', { rideId: ride.id })}
                />
              ))}
            </SafeMapView>
          )
        )
      ) : rides.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No rides found</Text>
          <Text style={styles.emptyText}>Try adjusting your search criteria</Text>
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
            <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rides}
          renderItem={renderRideItem}
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
  filterButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterButtonText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    marginRight: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  smartMatchButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  smartMatchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 4,
  },
  filterActions: {
    flexDirection: 'row',
    flex: 1,
    marginHorizontal: 4,
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 4,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginLeft: 4,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  map: {
    flex: 1,
  },
  viewModeContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  viewModeButtonText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  viewModeButtonTextActive: {
    color: '#fff',
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
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  availableSeats: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  totalSeats: {
    fontSize: 14,
    color: '#9ca3af',
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
  driverName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  rating: {
    fontSize: 12,
    color: '#f59e0b',
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 18,
  },
  bookButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  matchBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchBadgeExcellent: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
    borderWidth: 1,
  },
  matchBadgeGood: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
    borderWidth: 1,
  },
  matchBadgeFair: {
    backgroundColor: '#fed7aa',
    borderColor: '#f97316',
    borderWidth: 1,
  },
  matchBadgePoor: {
    backgroundColor: '#fecaca',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  matchBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  recommendedText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
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
  clearFiltersButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearFiltersButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  webMapAlternative: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webMapTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  webMapDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  webMapListContainer: {
    padding: 16,
    width: '100%',
  },
});

export default SearchRidesScreen;