import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import api from '../services/api';

const formatCurrency = (value) => {
  const num = parseFloat(value);
  if (!num || isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatPrice = (value) => {
  if (!value || isNaN(value)) return '$0.00';
  const num = parseFloat(value);
  const fixed = num.toFixed(8);
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '.00');
  const parts = trimmed.split('.');
  const integerPart = parseInt(parts[0]).toLocaleString('en-US');
  return `$${integerPart}.${parts[1]}`;
};

export default function CanadaScreen() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({ WealthSimple: true, NDAX: true, Manulife: true });
  const [editModal, setEditModal] = useState(null); // { ticker, field, currentValue }
  const [editValue, setEditValue] = useState('');

  const fetchAssets = useCallback(async () => {
    try {
      const { data } = await api.get('/api/assets?market=canada');
      setAssets(data);

      // Fetch live prices in background
      try {
        const [canadianRes, ndaxRes] = await Promise.allSettled([
          api.post('/api/assets/update-canadian-prices'),
          api.post('/api/assets/update-ndax-prices'),
        ]);

        let updated = [...data];

        if (canadianRes.status === 'fulfilled' && canadianRes.value.data.assets) {
          const map = new Map(canadianRes.value.data.assets.map((a) => [a.ticker, a]));
          updated = updated.map((a) => map.get(a.ticker) || a);
        }
        if (ndaxRes.status === 'fulfilled' && ndaxRes.value.data.assets) {
          const map = new Map(ndaxRes.value.data.assets.map((a) => [a.ticker, a]));
          updated = updated.map((a) => map.get(a.ticker) || a);
        }

        setAssets(updated);
      } catch (priceErr) {
        console.warn('Could not fetch live prices:', priceErr.message);
      }
    } catch (err) {
      console.error('Error loading Canada assets:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssets();
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    const numValue = parseFloat(editValue);
    if (isNaN(numValue) || numValue <= 0) {
      Alert.alert('Invalid', 'Please enter a valid positive number');
      return;
    }

    try {
      const payload = { ticker: editModal.ticker };
      
      // Convert camelCase to snake_case for backend
      if (editModal.field === 'quantity') {
        payload.quantity = numValue;
      } else if (editModal.field === 'averagePrice') {
        payload.average_price = numValue;
      } else if (editModal.field === 'currentPrice') {
        payload.current_price = numValue;
      }

      const { data } = await api.put('/api/assets/update-price', payload);
      if (data) {
        setAssets((prev) => prev.map((a) => (a.ticker === editModal.ticker ? { ...a, ...data } : a)));
      }
      setEditModal(null);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update');
    }
  };

  const openEdit = (ticker, field, currentValue) => {
    setEditModal({ ticker, field });
    setEditValue(String(currentValue || ''));
  };

  const grouped = assets.reduce((acc, a) => {
    const platform = a.platform || 'WealthSimple';
    if (!acc[platform]) acc[platform] = [];
    acc[platform].push(a);
    return acc;
  }, {});

  const totalInvested = assets.reduce((sum, a) => sum + (parseFloat(a.invested_value) || 0), 0);
  const totalBalance = assets.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
  const totalGain = totalBalance - totalInvested;
  const totalVariation = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(2) : '0.00';

  const platforms = ['WealthSimple', 'NDAX', 'Manulife'];

  const renderAssetRow = (asset) => {
    const variation = parseFloat(asset.variation) || 0;
    const capitalGain = parseFloat(asset.balance || 0) - parseFloat(asset.invested_value || 0);

    return (
      <View key={asset.ticker} style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.ticker}>{asset.ticker}</Text>
          <Text style={[styles.variation, variation >= 0 ? styles.positive : styles.negative]}>
            {variation.toFixed(2)}%
          </Text>
        </View>

        <View style={styles.rowDetails}>
          <TouchableOpacity
            style={styles.detailCol}
            onPress={() => openEdit(asset.ticker, 'quantity', asset.quantity)}
          >
            <Text style={styles.label}>Qty ✎</Text>
            <Text style={styles.value}>
              {asset.platform === 'NDAX'
                ? parseFloat(asset.quantity).toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
                : parseFloat(asset.quantity).toFixed(2).replace(/\.?0+$/, '')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.detailCol}
            onPress={() => openEdit(asset.ticker, 'averagePrice', asset.average_price)}
          >
            <Text style={styles.label}>Avg ✎</Text>
            <Text style={styles.value}>{formatPrice(asset.average_price)}</Text>
          </TouchableOpacity>
          <View style={styles.detailCol}>
            <Text style={styles.label}>Current</Text>
            <Text style={styles.value}>{formatPrice(asset.current_price)}</Text>
          </View>
        </View>

        <View style={styles.rowDetails}>
          <View style={styles.detailCol}>
            <Text style={styles.label}>Invested</Text>
            <Text style={styles.value}>{formatCurrency(asset.invested_value)}</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.label}>Balance</Text>
            <Text style={[styles.value, styles.bold]}>{formatCurrency(asset.balance)}</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.label}>Gain</Text>
            <Text style={[styles.value, capitalGain >= 0 ? styles.positive : styles.negative]}>
              {formatCurrency(capitalGain)}
            </Text>
          </View>
        </View>

        <View style={styles.rowDetails}>
          <View style={styles.detailCol}>
            <Text style={styles.label}>DY Mo</Text>
            <Text style={styles.value}>
              {parseFloat(asset.current_monthly_dividend || 0).toFixed(2)}%
            </Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.label}>DY Yr</Text>
            <Text style={styles.value}>
              {parseFloat(asset.current_annual_dividend || 0).toFixed(2)}%
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00d2ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[{ key: 'summary' }, ...platforms.map((p) => ({ key: p }))]}
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00d2ff" />}
        renderItem={({ item }) => {
          if (item.key === 'summary') {
            return (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Canada Portfolio</Text>
                <Text style={styles.summaryTotal}>{formatCurrency(totalBalance)}</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Invested</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(totalInvested)}</Text>
                  </View>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Gain</Text>
                    <Text
                      style={[styles.summaryValue, totalGain >= 0 ? styles.positive : styles.negative]}
                    >
                      {formatCurrency(totalGain)}
                    </Text>
                  </View>
                  <View style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>Return</Text>
                    <Text
                      style={[
                        styles.summaryValue,
                        parseFloat(totalVariation) >= 0 ? styles.positive : styles.negative,
                      ]}
                    >
                      {totalVariation}%
                    </Text>
                  </View>
                </View>
              </View>
            );
          }

          const platform = item.key;
          const list = grouped[platform] || [];
          if (list.length === 0) return null;

          const platformInvested = list.reduce((s, a) => s + (parseFloat(a.invested_value) || 0), 0);
          const platformBalance = list.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);

          return (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setExpanded((prev) => ({ ...prev, [platform]: !prev[platform] }))}
              >
                <Text style={styles.sectionTitle}>
                  {platform} ({list.length})
                </Text>
                <Text style={styles.sectionTotal}>{formatCurrency(platformBalance)}</Text>
                <Text style={styles.chevron}>{expanded[platform] ? '▼' : '▶'}</Text>
              </TouchableOpacity>
              {expanded[platform] && list.map(renderAssetRow)}
            </View>
          );
        }}
      />

      {/* Edit Modal */}
      <Modal visible={!!editModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Edit {editModal?.field === 'quantity' ? 'Quantity' : 'Average Price'}
            </Text>
            <Text style={styles.modalTicker}>{editModal?.ticker}</Text>
            <TextInput
              style={styles.modalInput}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setEditModal(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSaveEdit}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  summaryCard: {
    margin: 15,
    padding: 20,
    borderRadius: 15,
    backgroundColor: '#667eea',
  },
  summaryTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  summaryTotal: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  summaryCol: { alignItems: 'center' },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  summaryValue: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 2 },
  section: { marginHorizontal: 15, marginBottom: 15 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1 },
  sectionTotal: { color: '#00d2ff', fontSize: 14, fontWeight: '600', marginRight: 10 },
  chevron: { color: '#888', fontSize: 14 },
  row: {
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  ticker: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  variation: { fontSize: 14, fontWeight: '600' },
  positive: { color: '#00e676' },
  negative: { color: '#ff5252' },
  rowDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailCol: { flex: 1, alignItems: 'center' },
  label: { color: '#888', fontSize: 11, marginBottom: 2 },
  value: { color: '#ccc', fontSize: 13 },
  bold: { fontWeight: 'bold', color: '#fff' },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#16213e',
    borderRadius: 15,
    padding: 25,
    width: '80%',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  modalTicker: { color: '#00d2ff', fontSize: 16, textAlign: 'center', marginTop: 5, marginBottom: 20 },
  modalInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#333', marginRight: 10 },
  cancelBtnText: { color: '#ccc', fontWeight: '600' },
  saveBtn: { backgroundColor: '#00d2ff' },
  saveBtnText: { color: '#1a1a2e', fontWeight: 'bold' },
});
