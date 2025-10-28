import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import SafeTextInput from '../components/SafeTextInput';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

const ChatScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { bookingId, otherUserName } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const flatListRef = useRef(null);
  const subscriptionRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isReconnectingRef = useRef(false);

  useEffect(() => {
    fetchMessages();
    setupRealtimeSubscription();

    // Mark messages as read when component mounts
    setTimeout(() => {
      markMessagesAsRead();
    }, 1000);

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (global.backgroundRefreshInterval) {
        clearInterval(global.backgroundRefreshInterval);
        global.backgroundRefreshInterval = null;
      }
      isReconnectingRef.current = false;
    };
  }, [bookingId, user?.id]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(full_name, id)
        `)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Mark messages as read after loading
      setTimeout(() => {
        markMessagesAsRead();
      }, 500);
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    try {
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Unsubscribe from any existing subscription first
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      console.log('Setting up realtime subscription for booking:', bookingId);
      console.log('Current user ID:', user?.id);
      
      // Set up periodic background refresh to catch missed messages
      const backgroundRefresh = setInterval(() => {
        console.log('Background refresh: checking for new messages');
        fetchMessages();
      }, 10000); // Refresh every 10 seconds

      // Store interval reference for cleanup
      if (global.backgroundRefreshInterval) {
        clearInterval(global.backgroundRefreshInterval);
      }
      global.backgroundRefreshInterval = backgroundRefresh;
      
      // Create a more robust subscription with presence tracking
      subscriptionRef.current = supabase
        .channel(`booking:${bookingId}:messages`)
        .on('presence', { event: 'sync' }, () => {
          console.log('Presence synced for booking:', bookingId);
          const state = subscriptionRef.current.presenceState();
          console.log('Current presence state:', state);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('User joined channel:', key, newPresences);
          setConnectionStatus('connected');
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('User left channel:', key, leftPresences);
        })
        .subscribe(async (status) => {
          console.log('Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            // Track that this user is in the chat
            await subscriptionRef.current.track({
              user_id: user.id,
              booking_id: bookingId,
              joined_at: new Date().toISOString()
            });
            console.log('Presence tracking started for user:', user.id);
            setConnectionStatus('connected');
          }
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `booking_id=eq.${bookingId}`
          },
          async (payload) => {
            console.log('=== REALTIME EVENT RECEIVED ===');
            console.log('Full payload:', JSON.stringify(payload, null, 2));
            console.log('Event type:', payload.eventType);
            console.log('Table:', payload.table);
            console.log('Schema:', payload.schema);
            
            const newMessage = payload.new;
            console.log('New message received via realtime:', newMessage);
            console.log('Message booking_id:', newMessage.booking_id);
            console.log('Current booking_id:', bookingId);
            console.log('Message sender_id:', newMessage.sender_id);
            console.log('Current user_id:', user?.id);
            
            // Only process messages for this booking
            if (newMessage.booking_id !== bookingId) {
              console.log('Message filtered out - wrong booking ID');
              return;
            }
            
            // Fetch complete message data with sender info
            try {
              const { data: completeMessage, error } = await supabase
                .from('messages')
                .select(`
                  *,
                  sender:sender_id(full_name, id)
                `)
                .eq('id', newMessage.id)
                .single();

              if (error) {
                console.error('Error fetching complete message:', error);
                // Fallback to basic message if fetch fails
                const messageWithBasicSender = {
                  ...newMessage,
                  sender: { full_name: 'Unknown', id: newMessage.sender_id }
                };
                
                setMessages(prevMessages => {
                  const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
                  if (!messageExists) {
                    console.log('Adding fallback message to state');
                    return [...prevMessages, messageWithBasicSender];
                  }
                  console.log('Message already exists, skipping');
                  return prevMessages;
                });
              } else if (completeMessage) {
                console.log('Complete message fetched:', completeMessage);
                setMessages(prevMessages => {
                  const messageExists = prevMessages.some(msg => msg.id === completeMessage.id);
                  if (!messageExists) {
                    console.log('Adding complete message to state');
                    return [...prevMessages, completeMessage];
                  }
                  console.log('Message already exists, skipping');
                  return prevMessages;
                });
              }
            } catch (fetchError) {
              console.error('Exception fetching message details:', fetchError);
              // Fallback to basic message
              const messageWithBasicSender = {
                ...newMessage,
                sender: { full_name: 'Unknown', id: newMessage.sender_id }
              };
              
              setMessages(prevMessages => {
                const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
                if (!messageExists) {
                  return [...prevMessages, messageWithBasicSender];
                }
                return prevMessages;
              });
            }
            
            scrollToBottom();
            
            // Mark new message as read if it's not from current user
            if (newMessage.sender_id !== user.id) {
              console.log('Marking new message as read');
              setTimeout(() => {
                markMessagesAsRead();
              }, 300);
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          console.log('Realtime presence synced for booking:', bookingId);
        })
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            isReconnectingRef.current = false; // Reset reconnection flag on successful connection
            console.log('Successfully subscribed to messages for booking:', bookingId);
            
            // Track presence and test subscription
            subscriptionRef.current.track({ 
              user_id: user?.id, 
              booking_id: bookingId,
              joined_at: new Date().toISOString()
            });
            
            // Send a test presence event to verify subscription
            console.log('Testing subscription with presence event...');
            
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus('error');
            console.error('Channel error occurred');
          } else if (status === 'TIMED_OUT') {
            setConnectionStatus('timeout');
            console.error('Subscription timed out');
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected');
            console.log('Subscription closed');
            
            // Only attempt reconnection if not already reconnecting
            if (!isReconnectingRef.current) {
              isReconnectingRef.current = true;
              console.log('Scheduling reconnection attempt in 5 seconds...');
              
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isReconnectingRef.current) {
                  console.log('Attempting reconnection...');
                  setupRealtimeSubscription();
                }
              }, 5000); // Wait 5 seconds before reconnecting
            }
          }
        });
    } catch (error) {
      console.error('Error setting up subscription:', error);
      setConnectionStatus('error');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      console.log('=== SENDING MESSAGE ===');
      console.log('Booking ID:', bookingId);
      console.log('Sender ID:', user.id);
      console.log('Message content:', newMessage.trim());
      
      const { data: insertedMessage, error } = await supabase
        .from('messages')
        .insert({
          booking_id: bookingId,
          sender_id: user.id,
          content: newMessage.trim(),
          message_type: 'text',
          is_read: false
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }
      
      console.log('Message inserted successfully:', insertedMessage);
      console.log('=== MESSAGE SENT ===');
      
      setNewMessage('');
      
      // Immediately add the message to local state for instant feedback
      if (insertedMessage) {
        const optimisticMessage = {
          ...insertedMessage,
          sender: { full_name: user.user_metadata?.name || 'You', id: user.id }
        };
        
        setMessages(prevMessages => {
          const messageExists = prevMessages.some(msg => msg.id === insertedMessage.id);
          if (!messageExists) {
            return [...prevMessages, optimisticMessage];
          }
          return prevMessages;
        });
        
        // Force immediate scroll to bottom
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
      
      // Background refresh to ensure consistency
      setTimeout(() => {
        fetchMessages();
      }, 500);
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      if (!user) return;

      // First, get unread messages
      const { data: unreadMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id')
        .eq('booking_id', bookingId)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      if (fetchError) throw fetchError;
      
      if (unreadMessages && unreadMessages.length > 0) {
        const messageIds = unreadMessages.map(msg => msg.id);
        
        const { error } = await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', messageIds);

        if (error) throw error;
        console.log(`Marked ${messageIds.length} messages as read`);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const debugRealtime = async () => {
    console.log('=== Realtime Debug Info ===');
    console.log('Current user ID:', user?.id);
    console.log('Booking ID:', bookingId);
    console.log('Connection status:', connectionStatus);
    console.log('Subscription ref:', subscriptionRef.current);
    console.log('Current messages count:', messages.length);
    
    // Test if we can manually fetch recent messages
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(full_name, id)
        `)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('Recent messages (manual fetch):', data);
      console.log('Manual fetch error:', error);
    } catch (testError) {
      console.error('Manual fetch failed:', testError);
    }
    
    // Test real-time subscription health
    try {
      // Check if we can subscribe to a test channel
      const testChannel = supabase.channel('test-channel');
      testChannel.subscribe((status) => {
        console.log('Test channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Test channel subscription successful');
          testChannel.unsubscribe();
        }
      });
    } catch (testError) {
      console.error('Test channel subscription failed:', testError);
    }
    
    // Test sending a test message
    try {
      const testMessage = {
        booking_id: bookingId,
        sender_id: user?.id,
        content: 'Test message from debug function',
        message_type: 'text'
      };
      
      console.log('Test message payload:', testMessage);
      
      // Just log what we would send, don't actually send it
      console.log('Ready to send test message - use regular send function to test');
    } catch (testError) {
      console.error('Test message preparation failed:', testError);
    }
    
    console.log('=== End Debug Info ===');
    
    // Show alert with debug summary
    Alert.alert(
      'Debug Info',
      `Connection: ${connectionStatus}\nMessages: ${messages.length}\nBooking: ${bookingId}\nUser: ${user?.id || 'Not logged in'}`,
      [{ text: 'OK' }]
    );
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_id === user.id;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myMessageTime : styles.otherMessageTime
          ]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{otherUserName || 'Chat'}</Text>
        <View style={styles.connectionIndicator}>
          <View style={[
            styles.connectionDot,
            connectionStatus === 'connected' && styles.connectionDotConnected,
            connectionStatus === 'connecting' && styles.connectionDotConnecting,
            (connectionStatus === 'error' || connectionStatus === 'timeout' || connectionStatus === 'disconnected') && styles.connectionDotError
          ]} />
          <Text style={styles.connectionText}>
            {connectionStatus === 'connected' ? 'Connected' : 
             connectionStatus === 'connecting' ? 'Connecting...' :
             connectionStatus === 'error' ? 'Connection Error' :
             connectionStatus === 'timeout' ? 'Connection Timeout' :
             'Disconnected'}
          </Text>
        </View>
        <TouchableOpacity style={styles.debugButton} onPress={debugRealtime}>
          <Text style={styles.debugButtonText}>Debug</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToBottom}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Start the conversation!</Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <SafeTextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          <Text style={styles.sendButtonText}>{sending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  },
  header: {
    backgroundColor: '#2563eb',
    padding: 16,
    paddingTop: 40,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionDotConnected: {
    backgroundColor: '#10b981',
  },
  connectionDotConnecting: {
    backgroundColor: '#f59e0b',
  },
  connectionDotError: {
    backgroundColor: '#ef4444',
  },
  connectionText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  debugButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  myMessageBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 16,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#374151',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  myMessageTime: {
    color: '#e0e7ff',
  },
  otherMessageTime: {
    color: '#9ca3af',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 80,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ChatScreen;