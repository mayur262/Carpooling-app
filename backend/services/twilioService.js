const twilio = require('twilio');

class TwilioService {
  constructor() {
    this.initialize();
  }

  initialize() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    // Initialize Twilio client only if credentials are provided and valid
    this.client = null;
    if (this.accountSid && this.authToken && this.phoneNumber && 
        this.accountSid !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' && 
        this.accountSid.startsWith('AC') && 
        this.phoneNumber.startsWith('+')) {
      try {
        this.client = twilio(this.accountSid, this.authToken);
        console.log('Twilio client initialized successfully');
      } catch (error) {
        console.warn('Twilio client initialization failed:', error.message);
      }
    } else {
      console.warn('Twilio credentials not properly configured');
      if (this.accountSid === 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
        console.warn('Twilio Account SID is still set to placeholder value');
      }
      if (this.phoneNumber === '+1234567890') {
        console.warn('Twilio phone number is still set to placeholder value');
      }
    }
  }

  /**
   * Send SOS SMS to emergency contacts
   * @param {string} userName - Name of the user sending SOS
   * @param {Array} contacts - Array of contact objects with phone numbers
   * @param {number} latitude - User's current latitude
   * @param {number} longitude - User's current longitude
   * @param {string} userPhone - User's phone number (optional)
   * @returns {Promise<Object>} - Result of SMS sending operation
   */
  async sendSOSAlert(userName, contacts, latitude, longitude, userPhone = null) {
    if (!this.client) {
      throw new Error('Twilio service not configured');
    }
    try {
      if (!contacts || contacts.length === 0) {
        throw new Error('No emergency contacts found');
      }

      // Create location object for message creation
      const location = { latitude, longitude, accuracy: 10 };
      
      // Create SMS message
      const message = this.createSOSMessage(userName, location, userPhone);

      // Send SMS to all contacts
      const results = await Promise.allSettled(
        contacts.map(async (contact) => {
          if (!contact.phone) {
            console.log(`Skipping contact ${contact.name} - no phone number`);
            return { contact: contact.name, status: 'skipped', reason: 'No phone number' };
          }

          try {
            const result = await this.client.messages.create({
              body: message,
              from: this.phoneNumber,
              to: this.formatPhoneNumber(contact.phone)
            });

            console.log(`SMS sent to ${contact.name} (${contact.phone}): ${result.sid}`);
            return { contact: contact.name, phone: contact.phone, status: 'sent', messageId: result.sid };
          } catch (error) {
            console.error(`Failed to send SMS to ${contact.name}:`, error.message);
            return { contact: contact.name, phone: contact.phone, status: 'failed', error: error.message };
          }
        })
      );

      // Process results
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'sent');
      const failed = results.filter(r => r.status === 'fulfilled' && r.value.status === 'failed');
      const skipped = results.filter(r => r.status === 'fulfilled' && r.value.status === 'skipped');

      return {
        success: successful.length > 0,
        totalContacts: contacts.length,
        successful: successful.length,
        failed: failed.length,
        skipped: skipped.length,
        results: results.map(r => r.value || r.reason)
      };

    } catch (error) {
      console.error('Error sending SOS alert:', error);
      throw new Error(`Failed to send SOS alert: ${error.message}`);
    }
  }

  /**
   * Create the SOS message content
   */
  createSOSMessage(userName, location) {
    const { latitude, longitude, accuracy } = location;
    const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
    const timestamp = new Date().toLocaleString();
    
    return `🚨 URGENT: EMERGENCY SOS ALERT 🚨\n\n👤 PERSON IN DISTRESS: ${userName}\n⏰ TIME: ${timestamp}\n📍 LOCATION: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}\n📏 ACCURACY: ±${accuracy}m\n\n🗺️ GOOGLE MAPS: ${mapsLink}\n\n⚠️ THIS IS AN AUTOMATED EMERGENCY ALERT\n📱 Sent via ShareMyRide - Please respond immediately!\n\n---\nIf you cannot reach ${userName}, consider contacting local authorities.`;
  }

  /**
   * Format phone number for Twilio (ensure it starts with + and country code)
   */
  formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 1 (US country code) and has 11 digits, add +
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    
    // If it has 10 digits, assume US number and add +1
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    // If it already starts with +, return as is
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Otherwise, assume it's already properly formatted
    return phone;
  }

  /**
   * Send test SMS (for development/testing)
   */
  async sendTestSMS(to, message) {
    if (!this.client) {
      throw new Error('Twilio service not configured');
    }
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: this.formatPhoneNumber(to)
      });

      return {
        success: true,
        messageId: result.sid,
        message: 'Test SMS sent successfully'
      };
    } catch (error) {
      console.error('Error sending test SMS:', error);
      throw new Error(`Failed to send test SMS: ${error.message}`);
    }
  }

  /**
   * Reinitialize the service (useful after environment changes)
   */
  reinitialize() {
    console.log('Reinitializing Twilio service...');
    this.initialize();
  }

  /**
   * Validate Twilio configuration
   */
  validateConfig() {
    const errors = [];
    
    if (!this.accountSid) {
      errors.push('TWILIO_ACCOUNT_SID is not set');
    } else if (!this.accountSid.startsWith('AC')) {
      errors.push('TWILIO_ACCOUNT_SID must start with "AC"');
    }
    
    if (!this.authToken) {
      errors.push('TWILIO_AUTH_TOKEN is not set');
    }
    
    if (!this.phoneNumber) {
      errors.push('TWILIO_PHONE_NUMBER is not set');
    } else if (!this.phoneNumber.startsWith('+')) {
      errors.push('TWILIO_PHONE_NUMBER must start with "+"');
    }
    
    if (errors.length > 0) {
      throw new Error(`Twilio configuration errors: ${errors.join(', ')}`);
    }

    return true;
  }
}

module.exports = new TwilioService();