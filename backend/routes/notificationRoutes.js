const express = require('express');
const router = express.Router();
const { Expo } = require('expo-server-sdk');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const expo = new Expo();

/**
 * Send push notification to specific user
 */
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    // Get user's push token
    const { data: user, error } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single();

    if (error || !user?.push_token) {
      console.log('No push token found for user:', userId);
      return { success: false, error: 'No push token' };
    }

    const pushToken = user.push_token;

    // Validate token
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error('Invalid Expo push token:', pushToken);
      return { success: false, error: 'Invalid token' };
    }

    // Create message
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: data.channelId || 'default',
    };

    // Send notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending chunk:', error);
      }
    }

    console.log('Push notification sent:', tickets);
    return { success: true, tickets };

  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * POST /api/notifications/send
 * Send notification to user
 */
router.post('/send', async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        error: 'userId, title, and body are required'
      });
    }

    const result = await sendPushNotification(userId, title, body, data);
    
    res.json(result);
  } catch (error) {
    console.error('Error in send notification route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/booking-update
 * Send booking status update notification
 */
router.post('/booking-update', async (req, res) => {
  try {
    const { bookingId, status, recipientId } = req.body;

    const statusMessages = {
      'pending': '📋 Booking Request Received',
      'confirmed': '✅ Booking Confirmed!',
      'approved': '✅ Booking Approved!',
      'active': '🚗 Ride is Now Active',
      'completed': '🎉 Ride Completed',
      'cancelled': '❌ Booking Cancelled'
    };

    const title = statusMessages[status] || 'Booking Update';
    const body = `Your ride booking status is now: ${status}`;

    const result = await sendPushNotification(recipientId, title, body, {
      screen: 'BookingDetails',
      bookingId,
      channelId: 'booking'
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending booking notification:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/chat-message
 * Send new message notification
 */
router.post('/chat-message', async (req, res) => {
  try {
    const { recipientId, senderName, message, bookingId, senderId } = req.body;

    const title = senderName || 'New Message';
    const body = message.length > 100 ? message.substring(0, 100) + '...' : message;

    const result = await sendPushNotification(recipientId, title, body, {
      screen: 'Chat',
      bookingId,
      otherUserId: senderId,
      otherUserName: senderName,
      channelId: 'chat'
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending chat notification:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/sos-alert
 * Send emergency SOS notification
 */
router.post('/sos-alert', async (req, res) => {
  try {
    const { userId, userName, location, bookingId } = req.body;

    // Get all emergency contacts for this user
    const { data: contacts, error } = await supabase
      .from('emergency_contacts')
      .select('contact_user_id, contact_phone, contact_name')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    const title = '🚨 EMERGENCY ALERT';
    const body = `${userName} has triggered an SOS alert. Location: ${location}`;

    const results = [];
    
    // Send to emergency contacts who have user accounts
    if (contacts && contacts.length > 0) {
      for (const contact of contacts) {
        if (contact.contact_user_id) {
          const result = await sendPushNotification(contact.contact_user_id, title, body, {
            screen: 'SOS',
            bookingId,
            urgency: 'critical',
            channelId: 'sos'
          });
          results.push({ contact: contact.contact_name, ...result });
        }
      }
    }

    res.json({
      success: true,
      sentTo: results.length,
      results
    });

  } catch (error) {
    console.error('Error sending SOS notification:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/ride-reminder
 * Send ride reminder notification
 */
router.post('/ride-reminder', async (req, res) => {
  try {
    const { userId, rideDetails, minutesBefore } = req.body;

    const title = '🔔 Ride Reminder';
    const body = `Your ride from ${rideDetails.origin} to ${rideDetails.destination} starts in ${minutesBefore} minutes!`;

    const result = await sendPushNotification(userId, title, body, {
      screen: 'RideDetails',
      rideId: rideDetails.id,
      channelId: 'booking'
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/notifications/batch-send
 * Send notification to multiple users
 */
router.post('/batch-send', async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'userIds must be a non-empty array'
      });
    }

    const results = [];
    
    for (const userId of userIds) {
      const result = await sendPushNotification(userId, title, body, data);
      results.push({ userId, ...result });
    }

    res.json({
      success: true,
      total: userIds.length,
      results
    });

  } catch (error) {
    console.error('Error sending batch notifications:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;
