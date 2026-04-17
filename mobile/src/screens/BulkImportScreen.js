import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import api from '../services/api';

const EXAMPLE_JSON = `[
  {
    "ticker": "AEM.TO",
    "quantity": 5,
    "averagePrice": 219.56,
    "platform": "WealthSimple",
    "market": "canada"
  }
]`;

export default function BulkImportScreen() {
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!jsonText.trim()) {
      Alert.alert('Empty', 'Please paste some JSON first');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const parsed = JSON.parse(jsonText);
      const payload = Array.isArray(parsed) ? { assets: parsed } : parsed;
      const { data } = await api.post('/api/assets/bulk', payload);
      setResult(data);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError('Invalid JSON format');
      } else {
        setError(e.response?.data?.error || 'Failed to import assets');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Bulk Import</Text>
        <Text style={styles.subtitle}>Paste your asset JSON below</Text>

        <TextInput
          style={styles.textArea}
          value={jsonText}
          onChangeText={setJsonText}
          placeholder={EXAMPLE_JSON}
          placeholderTextColor="#555"
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Importing...' : 'Import Assets'}</Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {result ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Import Result</Text>
            <Text style={styles.resultText}>{JSON.stringify(result, null, 2)}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  scroll: { padding: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 5, marginBottom: 20 },
  textArea: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#00d2ff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 15,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#1a1a2e', fontSize: 16, fontWeight: 'bold' },
  errorBox: {
    backgroundColor: '#3a1a1a',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#ff5252',
  },
  errorText: { color: '#ff5252', fontSize: 14 },
  resultBox: {
    backgroundColor: '#1a3a1a',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#00e676',
  },
  resultTitle: { color: '#00e676', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  resultText: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
