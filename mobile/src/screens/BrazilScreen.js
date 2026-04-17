import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import api from '../services/api';

const formatCurrency = (value, currency = 'BRL') => {
  const num = parseFloat(value);
  if (!num || isNaN(num)) return 'R$ 0,00';
  return num.toLocaleString('pt-BR', { style: 'currency', currency });
};

export default function BrazilScreen() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({ FII: true, Ticker: true });

  const fetchAssets = useCallback(async () => {
    try {
      const { data } = await api.get('/api/assets?market=brazil');
      setAssets(data);
    } catch (err) {
      console.error('Error loading Brazil assets:', err);
      if (err.response?.status === 401) {
        console.error('❌ Authentication failed - check if user is logged in');
      }
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

  const grouped = assets.reduce(
    (acc, a) => {
      const key = a.ticker_type === 'Ticker' ? 'Ticker' : 'FII';
      acc[key].push(a);
      return acc;
    },
    { FII: [], Ticker: [] }
  );

  const totals = Object.fromEntries(
    Object.entries(grouped).map(([type, list]) => [
      type,
      list.reduce((sum, a) => sum + Number(a.saldo || 0), 0),
    ])
  );

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);

  const renderAssetRow = ({ item: asset }) => {
    const variation = parseFloat(asset.variacao) || 0;
    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <Text style={styles.ticker}>{asset.ativo}</Text>
          <Text style={[styles.variation, variation >= 0 ? styles.positive : styles.negative]}>
            {variation.toFixed(2)}%
          </Text>
        </View>

        <View style={styles.rowDetails}>
          <View style={styles.detailCol}>
            <Text style={styles.label}>Qty</Text>
            <Text style={styles.value}>{asset.quantidade}</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.label}>Avg Price</Text>
            <Text style={styles.value}>{formatCurrency(asset.preco_medio)}</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.label}>Current</Text>
            <Text style={styles.value}>{formatCurrency(asset.preco_atual)}</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.label}>Balance</Text>
            <Text style={[styles.value, styles.bold]}>{formatCurrency(asset.saldo)}</Text>
          </View>
        </View>

        <View style={styles.rowDetails}>
          <View style={styles.detailCol}>
            <Text style={styles.label}>DY/share</Text>
            <Text style={styles.value}>{formatCurrency(asset.dy_por_cota)}</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.label}>DY% Mo</Text>
            <Text style={styles.value}>
              {parseFloat(asset.dy_atual_mensal || 0).toFixed(2)}%
            </Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.label}>DY% Yr</Text>
            <Text style={styles.value}>
              {parseFloat(asset.dy_atual_anual || 0).toFixed(2)}%
            </Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.label}>My DY% Yr</Text>
            <Text style={styles.value}>
              {parseFloat(asset.dy_meu_anual || 0).toFixed(2)}%
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

  const sections = ['FII', 'Ticker'];

  return (
    <FlatList
      style={styles.container}
      data={[{ key: 'summary' }, ...sections.map((s) => ({ key: s }))]}
      keyExtractor={(item) => item.key}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00d2ff" />}
      renderItem={({ item }) => {
        if (item.key === 'summary') {
          return (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Brazil Portfolio</Text>
              <Text style={styles.summaryTotal}>{formatCurrency(grandTotal)}</Text>
              <View style={styles.summaryRow}>
                {sections.map((type) => (
                  <View key={type} style={styles.summaryCol}>
                    <Text style={styles.summaryLabel}>{type}</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(totals[type] || 0)}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }

        const type = item.key;
        const list = grouped[type] || [];
        return (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setExpanded((prev) => ({ ...prev, [type]: !prev[type] }))}
            >
              <Text style={styles.sectionTitle}>
                {type} ({list.length})
              </Text>
              <Text style={styles.sectionTotal}>{formatCurrency(totals[type] || 0)}</Text>
              <Text style={styles.chevron}>{expanded[type] ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            {expanded[type] &&
              list.map((asset) => (
                <View key={asset.ativo}>{renderAssetRow({ item: asset })}</View>
              ))}
          </View>
        );
      }}
    />
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
});
