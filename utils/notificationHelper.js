/**
 * Notification Helper - Easy integration for sending notifications
 * Import this file anywhere you need to send notifications
 */

// Read API URL from environment variable
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Send booking status update notification
 */
export const notifyBookingUpdate = async (bookingId, status, recipientId) => {
  try {
    const response = await fetch(`${API_URL}/api/notifications/booking-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, status, recipientId })
    });
    const result = await response.json();
    console.log('Booking notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending booking notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send chat message notification
 */
export const notifyChatMessage = async (recipientId, senderName, message, bookingId, senderId) => {
  try {
    const response = await fetch(`${API_URL}/api/notifications/chat-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId, senderName, message, bookingId, senderId })
    });
    const result = await response.json();
    console.log('Chat notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending chat notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send SOS alert notification
 */
export const notifySOSAlert = async (userId, userName, location, bookingId) => {
  try {
    const response = await fetch(`${API_URL}/api/notifications/sos-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, location, bookingId })
    });
    const result = await response.json();
    console.log('SOS notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending SOS notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send ride reminder notification
 */
export const notifyRideReminder = async (userId, rideDetails, minutesBefore = 15) => {
  try {
    const response = await fetch(`${API_URL}/api/notifications/ride-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, rideDetails, minutesBefore })
    });
    const result = await response.json();
    console.log('Reminder notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending reminder:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send custom notification
 */
export const notifyCustom = async (userId, title, body, data = {}) => {
  try {
    const response = await fetch(`${API_URL}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, data })
    });
    const result = await response.json();
    console.log('Custom notification sent:', result);
    return result;
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Schedule ride reminder 15 minutes before departure
 */
export const scheduleRideReminder = async (ride, userId) => {
  try {
    const rideDateTime = new Date(`${ride.ride_date}T${ride.ride_time}`);
    const reminderTime = new Date(rideDateTime.getTime() - 15 * 60000); // 15 mins before
    const now = new Date();

    // Only schedule if ride is in the future
    if (reminderTime > now) {
      const delay = reminderTime.getTime() - now.getTime();
      
      setTimeout(async () => {
        await notifyRideReminder(userId, ride, 15);
      }, delay);
      
      console.log(`Ride reminder scheduled for ${reminderTime.toLocaleString()}`);
      return { success: true, scheduledFor: reminderTime };
    } else {
      console.log('Ride is too soon to schedule reminder');
      return { success: false, error: 'Ride is too soon' };
    }
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    return { success: false, error: error.message };
  }
};

export default {
  notifyBookingUpdate,
  notifyChatMessage,
  notifySOSAlert,
  notifyRideReminder,
  notifyCustom,
  scheduleRideReminder,
};
