import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/auth/profile', {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
      });
      setMessage('Profile updated successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>First Name</Text>
        <TextInput
          style={styles.input}
          value={form.firstName}
          onChangeText={(v) => setForm({ ...form, firstName: v })}
          placeholder="First Name"
          placeholderTextColor="#555"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Last Name</Text>
        <TextInput
          style={styles.input}
          value={form.lastName}
          onChangeText={(v) => setForm({ ...form, lastName: v })}
          placeholder="Last Name"
          placeholderTextColor="#555"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={form.phone}
          onChangeText={(v) => setForm({ ...form, phone: v })}
          placeholder="Phone Number"
          placeholderTextColor="#555"
          keyboardType="phone-pad"
        />
      </View>

      {message ? <Text style={styles.success}>{message}</Text> : null}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { padding: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  email: { color: '#888', fontSize: 14 },
  fieldGroup: { marginBottom: 15 },
  label: { color: '#888', fontSize: 13, marginBottom: 6, marginLeft: 4 },
  input: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  success: {
    color: '#00e676',
    textAlign: 'center',
    marginVertical: 10,
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#00d2ff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#1a1a2e', fontSize: 16, fontWeight: 'bold' },
  logoutButton: {
    backgroundColor: '#333',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#ff5252',
  },
  logoutButtonText: { color: '#ff5252', fontSize: 16, fontWeight: '600' },
});
