import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import SOSButton from '../components/SOSButton';
import CompactSOSButton from '../components/CompactSOSButton';
import FareEstimator from '../components/FareEstimator';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState({ rides_offered: 0, rides_taken: 0, average_rating: 0 });

  useEffect(() => {
    fetchUnreadNotifications();
    fetchUserStats();
    
    // Set up focus listener to refresh stats when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUserStats();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    fetchUnreadNotifications();
    fetchUserStats();
    
    // Set up focus listener to refresh stats when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUserStats();
    });

    return unsubscribe;
  }, [navigation]);

  const fetchUnreadNotifications = async () => {
    try {
      // Temporarily commented out due to missing notifications table
      // const { count, error } = await supabase
      //   .from('notifications')
      //   .select('*', { count: 'exact', head: true })
      //   .eq('user_id', user.id)
      //   .eq('is_read', false);

      // if (error) throw error;
      // setUnreadCount(count || 0);
      
      // For now, just set unread count to 0
      setUnreadCount(0);
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      setUnreadCount(0);
    }
  };

  const fetchUserStats = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('rides_offered, rides_taken, average_rating')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      setStats({
        rides_offered: data.rides_offered || 0,
        rides_taken: data.rides_taken || 0,
        average_rating: data.average_rating ? parseFloat(data.average_rating).toFixed(1) : 0,
      });
    } catch (e) {
      console.warn('stats fetch failed', e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Professional Header with Gradient */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <Text style={styles.greetingText}>Good {getTimeOfDay()}</Text>
            <Text style={styles.userName}>
              {user?.user_metadata?.name || user?.email?.split('@')[0]}
            </Text>
          </View>
          
          <View style={styles.headerActions}>
            <CompactSOSButton 
              onPress={() => navigation.navigate('EmergencyContacts')}
              style={styles.sosButton}
            />
            <TouchableOpacity 
              style={styles.headerIcon}
              onPress={() => navigation.navigate('GlobalChat')}
            >
              <Text style={styles.headerIconText}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerIcon, unreadCount > 0 && styles.headerIconActive]} 
              onPress={() => navigation.navigate('Notifications')}
            >
              <Text style={styles.headerIconText}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.profileIconText}>👤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* User Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.rides_offered}</Text>
            <Text style={styles.statLabel}>Offered</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.rides_taken}</Text>
            <Text style={styles.statLabel}>Taken</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>⭐ {stats.average_rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Main Actions with Modern Cards */}
      <View style={styles.mainSection}>
        <Text style={styles.sectionTitle}>What would you like to do?</Text>
        
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={styles.primaryActionCard}
            onPress={() => navigation.navigate('OfferRide')} 
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#4f46e5', '#7c3aed']}
              style={styles.cardGradient}
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardIcon}>🚗</Text>
                <Text style={styles.cardTitle}>Offer a Ride</Text>
                <Text style={styles.cardSubtitle}>Share your journey and earn</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.primaryActionCard}
            onPress={() => navigation.navigate('SearchRides')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#059669', '#10b981']}
              style={styles.cardGradient}
            >
              <View style={styles.cardContent}>
                <Text style={styles.cardIcon}>🔍</Text>
                <Text style={styles.cardTitle}>Find a Ride</Text>
                <Text style={styles.cardSubtitle}>Get affordable transport</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Secondary Action */}
        <TouchableOpacity 
          style={styles.secondaryActionCard}
          onPress={() => navigation.navigate('RequestRide')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#d97706', '#f59e0b']}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <Text style={styles.cardIcon}>📍</Text>
              <Text style={styles.cardTitle}>Request a Ride</Text>
              <Text style={styles.cardSubtitle}>Post your travel needs</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Fare Estimator Section */}
      <FareEstimator />

      {/* Quick Access with Modern Design */}
      <View style={styles.quickAccessSection}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('MyRides')}
          >
            <View style={styles.quickActionIconContainer}>
              <Text style={styles.quickActionIcon}>🚗</Text>
            </View>
            <Text style={styles.quickActionText}>My Rides</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('MyBookings')}
          >
            <View style={styles.quickActionIconContainer}>
              <Text style={styles.quickActionIcon}>📅</Text>
            </View>
            <Text style={styles.quickActionText}>Bookings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('BookingRequests')}
          >
            <View style={styles.quickActionIconContainer}>
              <Text style={styles.quickActionIcon}>📬</Text>
            </View>
            <Text style={styles.quickActionText}>Requests</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('MyRideRequests')}
          >
            <View style={styles.quickActionIconContainer}>
              <Text style={styles.quickActionIcon}>📝</Text>
            </View>
            <Text style={styles.quickActionText}>My Needs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('PassengerBookings')}
          >
            <View style={styles.quickActionIconContainer}>
              <Text style={styles.quickActionIcon}>🚙</Text>
            </View>
            <Text style={styles.quickActionText}>My Trips</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('DriverRideRequests')}
          >
            <View style={styles.quickActionIconContainer}>
              <Text style={styles.quickActionIcon}>🙋</Text>
            </View>
            <Text style={styles.quickActionText}>Ride Needs</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Professional Safety Banner */}
      <View style={styles.safetySection}>
        <View style={styles.safetyCard}>
          <View style={styles.safetyIconContainer}>
            <Text style={styles.safetyIcon}>🛡️</Text>
          </View>
          <View style={styles.safetyContent}>
            <Text style={styles.safetyTitle}>Verified & Secure</Text>
            <Text style={styles.safetyText}>All users are verified for your safety and peace of mind</Text>
          </View>
        </View>
      </View>

      {/* Floating SOS Button */}
      <View style={styles.floatingSOSContainer}>
        <SOSButton 
          compact={false}
          showConfirmation={true}
          onSuccess={() => {
            console.log('SOS alert sent successfully');
          }}
          onError={(error) => {
            console.error('SOS alert failed:', error);
          }}
        />
      </View>
    </ScrollView>
  );
};

// Helper function for greeting
const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  // Professional Header Styles
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  userInfo: {
    flex: 1,
  },
  greetingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
    fontWeight: '400',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerIconActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  headerIconText: {
    fontSize: 18,
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileIconText: {
    fontSize: 20,
    color: '#fff',
  },
  sosButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Main Actions
  mainSection: {
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 15,
  },
  primaryActionCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  secondaryActionCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  cardGradient: {
    padding: 24,
    minHeight: 140,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    fontWeight: '500',
  },
  
  // Quick Access
  quickAccessSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionItem: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  quickActionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionIcon: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Safety Section
  safetySection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  safetyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  safetyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  safetyIcon: {
    fontSize: 24,
  },
  safetyContent: {
    flex: 1,
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  safetyText: {
    fontSize: 14,
    color: '#3730a3',
    lineHeight: 20,
  },
  
  // Notification Badge
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Floating SOS
  floatingSOSContainer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 1000,
  },
});

export default HomeScreen;
