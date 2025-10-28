import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, ScrollView } from 'react-native';
import SafeTextInput from '../components/SafeTextInput';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

const ProfileScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState({
    full_name: user?.user_metadata?.name || '',
    bio: '',
    profile_pic: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
    
    // Set up focus listener to refresh profile when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfile();
    });

    return unsubscribe;
  }, [navigation]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // Only throw error if it's not the "no rows" error
        throw error;
      }
      
      if (data) {
        setProfile({
          full_name: data.full_name || '',
          bio: data.bio || '',
          profile_pic: data.profile_pic || '',
          rides_offered: data.rides_offered || 0,
          rides_taken: data.rides_taken || 0,
        });
      } else {
        // No profile found, create a default one
        const defaultProfile = {
          full_name: user?.user_metadata?.name || '',
          bio: '',
          profile_pic: '',
        };
        setProfile(defaultProfile);
        
        // Optionally create the profile in the database
        await supabase.from('users').upsert({
          id: user.id,
          full_name: defaultProfile.full_name,
          bio: defaultProfile.bio,
          profile_pic: defaultProfile.profile_pic,
          email: user.email,
          role: 'user',
          rides_offered: 0,
          rides_taken: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const updateProfile = async () => {
    try {
      setLoading(true);
      
      // Try to update with all fields first
      let updateData = {
        id: user.id,
        full_name: profile.full_name,
        bio: profile.bio,
        profile_pic: profile.profile_pic,
        email: user.email,
        role: 'user', // Default role
        rides_offered: profile.rides_offered || 0,
        rides_taken: profile.rides_taken || 0,
      };

      // Try the upsert
      let { error } = await supabase
        .from('users')
        .upsert(updateData);

      // If we get a schema cache error, try updating without the problematic columns
      if (error && error.message.includes('schema cache')) {
        console.log('Schema cache error detected, trying alternative update...');
        
        // Remove potentially problematic fields and try again
        const fallbackUpdateData = {
          id: user.id,
          full_name: profile.full_name,
          bio: profile.bio,
          profile_pic: profile.profile_pic,
          email: user.email,
        };

        // Try to update only the basic profile fields
        const fallbackResult = await supabase
          .from('users')
          .upsert(fallbackUpdateData);

        error = fallbackResult.error;
      }

      if (error) throw error;
      
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // Reset navigation stack and navigate to login
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerBackground}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
        
        {/* Profile Picture Section */}
        <View style={styles.profilePictureContainer}>
          <Image
            source={{
              uri: profile.profile_pic || 'https://via.placeholder.com/150',
            }}
            style={styles.profileImage}
          />
          <TouchableOpacity 
            style={styles.editPictureButton}
            onPress={() => {
              // Simple prompt for image URL
              Alert.prompt(
                'Profile Picture',
                'Enter image URL:',
                (text) => setProfile({ ...profile, profile_pic: text }),
                'plain-text',
                profile.profile_pic
              );
            }}
          >
            <Text style={styles.editPictureButtonText}>📷</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.userName}>{profile.full_name || 'Your Name'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.rides_offered}</Text>
              <Text style={styles.statLabel}>Rides Offered</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.rides_taken}</Text>
              <Text style={styles.statLabel}>Rides Taken</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Profile Form Section */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <SafeTextInput
            style={styles.input}
            placeholder="Enter your full name"
            value={profile.full_name}
            onChangeText={(text) => setProfile({ ...profile, full_name: text })}
            placeholderTextColor="#9ca3af"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Bio</Text>
          <SafeTextInput
            style={[styles.input, styles.bioInput]}
            placeholder="Tell us about yourself"
            value={profile.bio}
            onChangeText={(text) => setProfile({ ...profile, bio: text })}
            multiline
            numberOfLines={4}
            placeholderTextColor="#9ca3af"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Profile Picture URL (Optional)</Text>
          <SafeTextInput
            style={styles.input}
            placeholder="https://example.com/image.jpg"
            value={profile.profile_pic}
            onChangeText={(text) => setProfile({ ...profile, profile_pic: text })}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={updateProfile} 
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Updating Profile...' : 'Update Profile'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={() => navigation.navigate('EmergencyContacts')}
        >
          <Text style={styles.secondaryButtonText}>Emergency Contacts</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerSection: {
    backgroundColor: '#2563eb',
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: '#2563eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: '#e5e7eb',
  },
  editPictureButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10b981',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editPictureButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#e0e7ff',
    marginBottom: 20,
  },
  logoutButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsSection: {
    paddingHorizontal: 20,
    marginTop: -20,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 20,
  },
  formSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;