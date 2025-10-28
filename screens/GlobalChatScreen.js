import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import SafeTextInput from '../components/SafeTextInput';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';

const GlobalChatScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [userNames, setUserNames] = useState({});

  useEffect(() => {
    fetchUsers();
    fetchConversations();
  }, []);

  // Fetch user names for conversations
  useEffect(() => {
    const fetchUserNames = async () => {
      const names = {};
      for (const conversation of conversations) {
        if (conversation.userId && !userNames[conversation.userId]) {
          const { data } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', conversation.userId)
            .single();
          if (data) {
            names[conversation.userId] = data.full_name || 'User';
          }
        }
      }
      if (Object.keys(names).length > 0) {
        setUserNames(prev => ({ ...prev, ...names }));
      }
    };

    if (conversations.length > 0) {
      fetchUserNames();
    }
  }, [conversations]);

  // Fetch users you can chat with
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: passengerBookings, error: passengerError } = await supabase
        .from('bookings')
        .select('id, passenger_id, ride_id')
        .eq('passenger_id', user.id);
      if (passengerError) throw passengerError;

      const { data: driverRides, error: driverError } = await supabase
        .from('rides')
        .select('id, driver_id')
        .eq('driver_id', user.id);
      if (driverError) throw driverError;

      const driverRideIds = driverRides?.map(ride => ride.id) || [];
      const { data: driverBookings, error: driverBookingsError } = await supabase
        .from('bookings')
        .select('id, passenger_id, ride_id')
        .in('ride_id', driverRideIds);
      if (driverBookingsError) throw driverBookingsError;

      const bookings = [
        ...(passengerBookings || []),
        ...(driverBookings || [])
      ];

      const bookingIds = bookings?.map(b => b.id) || [];
      const { data: bookingMessages, error: messagesError } = await supabase
        .from('messages')
        .select('sender_id, booking_id')
        .in('booking_id', bookingIds);
      if (messagesError) throw messagesError;

      const userIds = new Set();
      bookingMessages?.forEach(msg => {
        if (msg.sender_id !== user.id) userIds.add(msg.sender_id);
      });

      if (userIds.size === 0) {
        setUsers([]);
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', Array.from(userIds));
      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      setUsers(usersData || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to fetch conversation partners: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch recent conversations
  const fetchConversations = async () => {
    try {
      const { data: passengerBookings, error: passengerError } = await supabase
        .from('bookings')
        .select('id, passenger_id, ride_id')
        .eq('passenger_id', user.id);
      if (passengerError) throw passengerError;

      const { data: driverRides, error: driverError } = await supabase
        .from('rides')
        .select('id, driver_id')
        .eq('driver_id', user.id);
      if (driverError) throw driverError;

      const driverRideIds = driverRides?.map(ride => ride.id) || [];
      const { data: driverBookings, error: driverBookingsError } = await supabase
        .from('bookings')
        .select('id, passenger_id, ride_id')
        .in('ride_id', driverRideIds);
      if (driverBookingsError) throw driverBookingsError;

      const allBookings = [
        ...(passengerBookings || []),
        ...(driverBookings || [])
      ];
      if (allBookings.length === 0) {
        setConversations([]);
        return;
      }

      const bookingIds = allBookings.map(b => b.id);
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id, booking_id, content, is_read, created_at')
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false })
        .limit(100);
      if (messagesError) throw messagesError;

      const rideIds = allBookings.map(b => b.ride_id);
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('id, driver_id')
        .in('id', rideIds);
      if (ridesError) throw ridesError;

      const conversationsMap = new Map();
      if (messagesData) {
        messagesData.forEach(message => {
          const booking = allBookings.find(b => b.id === message.booking_id);
          if (!booking) return;

          const ride = ridesData?.find(r => r.id === booking.ride_id);
          if (!ride) return;

          let otherUserId;
          if (message.sender_id === booking.passenger_id) {
            otherUserId = ride.driver_id;
          } else {
            otherUserId = booking.passenger_id;
          }

          if (otherUserId && otherUserId !== user.id) {
            const existing = conversationsMap.get(otherUserId);
            if (!existing || message.created_at > existing.lastMessage.created_at) {
              conversationsMap.set(otherUserId, {
                userId: otherUserId,
                lastMessage: message,
                unreadCount: message.is_read || message.sender_id === user.id ? 0 : 1
              });
            }
          }
        });
      }

      setConversations(Array.from(conversationsMap.values()));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    }
  };

  // Start conversation with user
  const startConversation = async (otherUserId) => {
    try {
      const { data: passengerBookings } = await supabase
        .from('bookings')
        .select('id, passenger_id, ride_id')
        .eq('passenger_id', user.id);

      const { data: driverRides } = await supabase
        .from('rides')
        .select('id, driver_id')
        .eq('driver_id', user.id);

      const driverRideIds = driverRides?.map(ride => ride.id) || [];
      const { data: driverBookings } = await supabase
        .from('bookings')
        .select('id, passenger_id, ride_id')
        .in('ride_id', driverRideIds);

      let bookingId;

      if (passengerBookings?.length > 0) {
        const passengerRideIds = passengerBookings.map(b => b.ride_id);
        const { data: rides } = await supabase
          .from('rides')
          .select('id, driver_id')
          .in('id', passengerRideIds);

        const foundRide = rides?.find(ride => ride.driver_id === otherUserId);
        if (foundRide) {
          const foundBooking = passengerBookings.find(b => b.ride_id === foundRide.id);
          if (foundBooking) bookingId = foundBooking.id;
        }
      }

      if (!bookingId && driverBookings?.length > 0) {
        const foundBooking = driverBookings.find(b => b.passenger_id === otherUserId);
        if (foundBooking) bookingId = foundBooking.id;
      }

      if (!bookingId) {
        Alert.alert('No Booking Found', 'You can only message users you have booked rides with.');
        return;
      }

      const { data: otherUserData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', otherUserId)
        .single();

      navigation.navigate('Chat', {
        bookingId: bookingId,
        otherUserName: otherUserData?.full_name || 'Unknown User',
        otherUserId: otherUserId
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation: ' + error.message);
    }
  };

  const renderConversation = ({ item }) => {
    const userName = userNames[item.userId] || 'Unknown User';
    return (
      <TouchableOpacity 
        style={styles.conversationItem} 
        onPress={() => startConversation(item.userId)}
      >
        <View style={styles.conversationAvatar}>
          <Text style={styles.conversationAvatarText}>{userName.charAt(0)}</Text>
        </View>
        <View style={styles.conversationInfo}>
          <Text style={styles.conversationName}>{userName}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage.content}
          </Text>
        </View>
        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
          </View>
        )}
        <Text style={styles.chatIcon}>💬</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <View style={styles.searchContainer}>
        <SafeTextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {conversations.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Conversations</Text>
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.userId}
            style={styles.conversationList}
          />
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyText}>
            When you message someone through your bookings, the conversation will appear here.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  searchContainer: { padding: 20, backgroundColor: '#fff' },
  searchInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 20,
    marginBottom: 10,
  },
  conversationList: { backgroundColor: '#fff' },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  conversationAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  conversationAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  conversationInfo: { flex: 1 },
  conversationName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  lastMessage: { fontSize: 14, color: '#64748b', marginTop: 2 },
  chatIcon: { fontSize: 20, color: '#3b82f6' },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  unreadBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 8 },
  emptyText: { textAlign: 'center', color: '#6b7280', lineHeight: 20 },
});

export default GlobalChatScreen;
