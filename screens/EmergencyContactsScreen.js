import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Switch,
} from 'react-native';
import SafeTextInput from '../components/SafeTextInput';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';

const EmergencyContactsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    relationship: '',
  });
  const [saving, setSaving] = useState(false);

  // Phone validation function
  const validatePhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const { data, error } = await supabase
      .from('contacts')
      .select('id, user_id, name, phone, email, relationship, is_active, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Ensure all contacts have is_active as boolean
      const cleanedData = (data || []).map(contact => ({
        ...contact,
        is_active: Boolean(contact.is_active !== undefined ? contact.is_active : true)
      }));
      
      setContacts(cleanedData);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      Alert.alert('Error', 'Failed to fetch emergency contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated. Please login again.');
      return;
    }

    if (!formData.name.trim() || !formData.phone.trim()) {
      Alert.alert('Validation Error', 'Please enter both name and phone number');
      return;
    }

    if (!validatePhoneNumber(formData.phone)) {
      Alert.alert('Validation Error', 'Please enter a valid phone number');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.from('contacts').insert([
        {
          user_id: user.id,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          relationship: formData.relationship.trim() || null,
          is_active: true,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setModalVisible(false);
      setFormData({ name: '', phone: '', relationship: '' });
      fetchContacts();
      Alert.alert('Success', 'Emergency contact added successfully');
    } catch (error) {
      console.error('Error adding contact:', error);
      Alert.alert('Error', 'Failed to add emergency contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated. Please login again.');
      return;
    }

    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', contactId)
                .eq('user_id', user.id);

              if (error) throw error;
              fetchContacts();
              Alert.alert('Success', 'Contact deleted successfully');
            } catch (error) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', 'Failed to delete contact');
            }
          },
        },
      ]
    );
  };

  const toggleContactActive = async (contactId, isActive) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated. Please login again.');
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ is_active: !isActive })
        .eq('id', contactId)
        .eq('user_id', user.id);

      if (error) {
        if (error.code === '42703') { // Column doesn't exist
          Alert.alert('Info', 'Contact status feature is being set up. Please try again in a moment.');
        } else {
          throw error;
        }
        return;
      }
      fetchContacts();
    } catch (error) {
      console.error('Error updating contact status:', error);
      Alert.alert('Error', 'Failed to update contact status');
    }
  };

  const renderContact = ({ item }) => {
    // Safely convert is_active to boolean
    const isActive = Boolean(item.is_active !== undefined ? item.is_active : true);
    
    return (
      <View style={styles.contactItem}>
        <View style={styles.contactInfo}>
          <View style={styles.contactHeader}>
            <Text style={styles.contactName}>{item.name}</Text>
            <Switch
              value={isActive}
              onValueChange={() => toggleContactActive(item.id, isActive)}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={isActive ? '#3b82f6' : '#f4f3f4'}
            />
          </View>
          <Text style={styles.contactDetail}>📞 {item.phone}</Text>
          {item.relationship && (
            <Text style={styles.contactRelationship}>{item.relationship}</Text>
          )}
          <Text style={styles.contactDate}>
            Added: {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteContact(item.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF0000" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Emergency Contacts</Text>
        <Text style={styles.subtitle}>
          Add phone contacts for SOS SMS alerts
        </Text>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No emergency contacts added</Text>
          <Text style={styles.emptySubtext}>
            Add phone numbers for emergency SMS alerts
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.contactsList}
        />
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>+ Add Emergency Contact</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent  // Use shorthand to prevent Android boolean casting
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Emergency Contact</Text>

            <SafeTextInput
              style={styles.input}
              placeholder="Contact Name *"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />

            <SafeTextInput
              style={styles.input}
              placeholder="Phone Number * (e.g., +1234567890)"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              keyboardType="phone-pad"
            />

            <SafeTextInput
              style={styles.input}
              placeholder="Relationship (e.g., Parent, Friend)"
              value={formData.relationship}
              onChangeText={(text) => setFormData({ ...formData, relationship: text })}
            />

            <Text style={styles.helpText}>
              Enter a phone number for SMS alerts during emergencies.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddContact}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Contact</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  contactsList: {
    padding: 15,
  },
  contactItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  contactDetail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  contactRelationship: {
    fontSize: 13,
    color: '#888888',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  contactDate: {
    fontSize: 12,
    color: '#999999',
    marginTop: 5,
  },
  deleteButton: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#FF0000',
    margin: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#F9F9F9',
  },
  helpText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 20,
    lineHeight: 18,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  saveButton: {
    backgroundColor: '#FF0000',
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default EmergencyContactsScreen;