import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import notificationService from '../services/notificationService';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

const NotificationSettingsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    bookingUpdates: true,
    chatMessages: true,
    rideReminders: true,
    sosAlerts: true,
    promotions: false,
  });
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermissionStatus();
    loadSettings();
  }, []);

  const checkPermissionStatus = async () => {
    const status = await notificationService.getPermissionStatus();
    setPermissionStatus(status);
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();

      if (data?.notification_preferences) {
        // Convert all values to actual booleans to prevent casting errors
        const prefs = data.notification_preferences;
        setSettings({
          bookingUpdates: Boolean(prefs.bookingUpdates),
          chatMessages: Boolean(prefs.chatMessages),
          rideReminders: Boolean(prefs.rideReminders),
          sosAlerts: Boolean(prefs.sosAlerts),
          promotions: Boolean(prefs.promotions),
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      // Ensure all values are strictly booleans before saving
      const cleanSettings = {
        bookingUpdates: Boolean(newSettings.bookingUpdates),
        chatMessages: Boolean(newSettings.chatMessages),
        rideReminders: Boolean(newSettings.rideReminders),
        sosAlerts: Boolean(newSettings.sosAlerts),
        promotions: Boolean(newSettings.promotions),
      };

      const { error } = await supabase
        .from('users')
        .update({ notification_preferences: cleanSettings })
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const toggleSetting = (key) => {
    // Ensure we're toggling a boolean value
    const currentValue = Boolean(settings[key]);
    const newSettings = { ...settings, [key]: !currentValue };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const requestPermission = async () => {
    const token = await notificationService.registerForPushNotifications(user.id);
    if (token) {
      Alert.alert('Success', 'Notifications enabled!');
      checkPermissionStatus();
    }
  };

  const testNotification = async () => {
    await notificationService.sendLocalNotification(
      'Test Notification 🔔',
      'This is a test notification from ShareMyRide!',
      { test: true }
    );
    Alert.alert('Success', 'Test notification sent!');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
      </View>

      {/* Permission Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permission Status</Text>
        <View style={styles.permissionCard}>
          <Ionicons 
            name={permissionStatus === 'granted' ? 'checkmark-circle' : 'alert-circle'} 
            size={32} 
            color={permissionStatus === 'granted' ? '#10b981' : '#f59e0b'} 
          />
          <View style={styles.permissionInfo}>
            <Text style={styles.permissionStatus}>
              {permissionStatus === 'granted' ? 'Enabled ✓' : 'Disabled'}
            </Text>
            <Text style={styles.permissionDescription}>
              {permissionStatus === 'granted' 
                ? 'You will receive push notifications' 
                : 'Enable to receive important updates'}
            </Text>
            {permissionStatus !== 'granted' && (
              <TouchableOpacity style={styles.enableButton} onPress={requestPermission}>
                <Text style={styles.enableButtonText}>Enable Notifications</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Notification Types */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Types</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="calendar" size={24} color="#2563eb" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Booking Updates</Text>
              <Text style={styles.settingDescription}>
                Notifications about booking status changes
              </Text>
            </View>
          </View>
          <Switch
            value={Boolean(settings.bookingUpdates)}
            onValueChange={() => toggleSetting('bookingUpdates')}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={Boolean(settings.bookingUpdates) ? '#2563eb' : '#f3f4f6'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="chatbubble" size={24} color="#10b981" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Chat Messages</Text>
              <Text style={styles.settingDescription}>
                New message notifications
              </Text>
            </View>
          </View>
          <Switch
            value={Boolean(settings.chatMessages)}
            onValueChange={() => toggleSetting('chatMessages')}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={Boolean(settings.chatMessages) ? '#2563eb' : '#f3f4f6'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="alarm" size={24} color="#f59e0b" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Ride Reminders</Text>
              <Text style={styles.settingDescription}>
                Reminders before your scheduled rides
              </Text>
            </View>
          </View>
          <Switch
            value={Boolean(settings.rideReminders)}
            onValueChange={() => toggleSetting('rideReminders')}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={Boolean(settings.rideReminders) ? '#2563eb' : '#f3f4f6'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="alert-circle" size={24} color="#ef4444" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>SOS Alerts</Text>
              <Text style={styles.settingDescription}>
                Emergency notifications (Always recommended)
              </Text>
            </View>
          </View>
          <Switch
            value={Boolean(settings.sosAlerts)}
            onValueChange={() => toggleSetting('sosAlerts')}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={Boolean(settings.sosAlerts) ? '#2563eb' : '#f3f4f6'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="pricetag" size={24} color="#8b5cf6" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Promotions</Text>
              <Text style={styles.settingDescription}>
                Special offers and updates
              </Text>
            </View>
          </View>
          <Switch
            value={Boolean(settings.promotions)}
            onValueChange={() => toggleSetting('promotions')}
            trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
            thumbColor={Boolean(settings.promotions) ? '#2563eb' : '#f3f4f6'}
          />
        </View>
      </View>

      {/* Test Notification */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.testButton} onPress={testNotification}>
          <Ionicons name="notifications" size={24} color="#2563eb" />
          <Text style={styles.testButtonText}>Send Test Notification</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          You can change these settings anytime. Emergency alerts are highly recommended for safety.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 16,
    color: '#1f2937',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  permissionInfo: {
    flex: 1,
    marginLeft: 16,
  },
  permissionStatus: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  enableButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  enableButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 8,
  },
  footer: {
    padding: 16,
    marginTop: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationSettingsScreen;
