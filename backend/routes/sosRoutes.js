const express = require('express');
const { supabase } = require('../config/supabase');
const twilioService = require('../services/twilioService');
const router = express.Router();

/**
 * POST /api/sos/trigger
 * Trigger SOS alert - sends SMS to all emergency contacts
 * 
 * Body: {
 *   latitude: number,
 *   longitude: number,
 *   userPhone?: string (optional)
 * }
 */
router.post('/trigger', async (req, res) => {
  try {
    const { latitude, longitude, userPhone } = req.body;
    const userId = req.user?.id;

    // Validate input
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    // Validate coordinates
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates format'
      });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinate range'
      });
    }

    // Get user information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // Get emergency contacts for the user
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, name, phone, email')
      .eq('user_id', userId)
      .not('phone', 'is', null); // Only get contacts with phone numbers

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch emergency contacts'
      });
    }

    if (!contacts || contacts.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No emergency contacts with phone numbers found'
      });
    }

    // Create SOS event record
    const { data: sosEvent, error: sosError } = await supabase
      .from('sos_events')
      .insert({
        user_id: userId,
        latitude: latitude,
        longitude: longitude,
        status: 'active'
      })
      .select()
      .single();

    if (sosError) {
      console.error('Error creating SOS event:', sosError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create SOS event'
      });
    }

    // Send SMS alerts
    let smsResult;
    try {
      smsResult = await twilioService.sendSOSAlert(
        userData.full_name || 'ShareMyRide User',
        contacts,
        latitude,
        longitude,
        userPhone
      );
    } catch (smsError) {
      console.error('Error sending SMS:', smsError);
      
      // Update SOS event status to failed
      await supabase
        .from('sos_events')
        .update({ status: 'failed' })
        .eq('id', sosEvent.id);

      return res.status(500).json({
        success: false,
        error: 'Failed to send SMS alerts',
        details: smsError.message
      });
    }

    // Update SOS event with SMS results
    const { error: updateError } = await supabase
      .from('sos_events')
      .update({
        status: smsResult.success ? 'sent' : 'partially_sent',
        sms_results: smsResult
      })
      .eq('id', sosEvent.id);

    if (updateError) {
      console.error('Error updating SOS event:', updateError);
    }

    // Return success response
    res.json({
      success: true,
      message: 'SOS alerts sent successfully',
      data: {
        sosEventId: sosEvent.id,
        totalContacts: smsResult.totalContacts,
        successful: smsResult.successful,
        failed: smsResult.failed,
        skipped: smsResult.skipped,
        location: {
          latitude,
          longitude,
          mapsLink: `https://www.google.com/maps?q=${latitude},${longitude}`
        }
      }
    });

  } catch (error) {
    console.error('SOS trigger error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /api/sos/history
 * Get user's SOS history
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { data: sosEvents, error } = await supabase
      .from('sos_events')
      .select(`
        *,
        user:users!user_id(full_name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching SOS history:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch SOS history'
      });
    }

    res.json({
      success: true,
      data: sosEvents || []
    });

  } catch (error) {
    console.error('SOS history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * POST /api/sos/resolve/:id
 * Mark an SOS event as resolved
 */
router.post('/resolve/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Verify the SOS event belongs to the user
    const { data: existingEvent, error: fetchError } = await supabase
      .from('sos_events')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingEvent) {
      return res.status(404).json({
        success: false,
        error: 'SOS event not found'
      });
    }

    // Update the status to resolved
    const { data: updatedEvent, error: updateError } = await supabase
      .from('sos_events')
      .update({ status: 'resolved' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error resolving SOS event:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to resolve SOS event'
      });
    }

    res.json({
      success: true,
      message: 'SOS event resolved successfully',
      data: updatedEvent
    });

  } catch (error) {
    console.error('SOS resolve error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;