import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from './axiosConfig';
import './App.css';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';
const socket = io(backendUrl);

// Format currency with thousand separators
const formatCurrency = (value) => {
  if (!value || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parseFloat(value));
};

// Format price with thousand separators and preserve full precision, keeping at least .00
const formatPrice = (value, platform) => {
  if (!value || isNaN(value)) return '$0.00';
  const numValue = parseFloat(value);
  const fixed = numValue.toFixed(8); // Get 8 decimals
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '.00'); // Remove trailing zeros but keep at least .00
  const parts = trimmed.split('.');
  const integerPart = parseInt(parts[0]).toLocaleString('en-US');
  return `$${integerPart}.${parts[1]}`;
};

function CanadaInvestment() {
  const [assets, setAssets] = useState([]);
  const [expanded, setExpanded] = useState({ WealthSimple: true, NDAX: true, Manulife: true });
  const [platformSort, setPlatformSort] = useState({ WealthSimple: 'ticker', NDAX: 'ticker', Manulife: 'ticker' });
  const [platformSortOrder, setPlatformSortOrder] = useState({ WealthSimple: 'asc', NDAX: 'asc', Manulife: 'asc' });
  const [manualPrices, setManualPrices] = useState({});
  const [editingField, setEditingField] = useState(null); // {ticker, fieldType} where fieldType is 'quantity', 'averagePrice', or 'currentPrice'
  const [editingInputValue, setEditingInputValue] = useState('');
  const [lockedPrices, setLockedPrices] = useState({}); // {ticker: true/false}
  const [uploadMessage, setUploadMessage] = useState(''); // Message for upload/update feedback

  const updateAssetField = async (ticker, fieldType, newValue) => {
    try {
      const payload = { ticker };
      
      // Convert camelCase to snake_case for backend
      if (fieldType === 'quantity') {
        payload.quantity = parseFloat(newValue);
      } else if (fieldType === 'averagePrice') {
        payload.average_price = parseFloat(newValue);
      } else if (fieldType === 'currentPrice') {
        payload.current_price = parseFloat(newValue);
      }
      
      const response = await api.put(
        `${backendUrl}/api/assets/update-price`,
        payload
      );
      
      if (response.data) {
        setAssets(prev =>
          prev.map(asset =>
            asset.ticker === ticker 
              ? { ...asset, ...response.data }
              : asset
          )
        );
        const fieldLabels = { quantity: 'Quantity', averagePrice: 'Avg Price', currentPrice: 'Current Price' };
        setUploadMessage(`✓ Updated ${fieldLabels[fieldType]} for ${ticker}`);
        setTimeout(() => setUploadMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error updating asset field:', err);
      setUploadMessage(`✗ Error: ${err.response?.data?.error || 'Failed to update'}`);
    }
  };

  const handleEditFieldClick = (ticker, fieldType, currentValue) => {
    setEditingField({ ticker, fieldType });
    setEditingInputValue(currentValue.toString());
  };

  const handleSaveEditField = (ticker, fieldType) => {
    const numValue = parseFloat(editingInputValue);
    if (editingInputValue && numValue > 0) {
      updateAssetField(ticker, fieldType, editingInputValue);
      setEditingField(null);
      setEditingInputValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditingInputValue('');
  };

  const togglePriceLock = (ticker) => {
    setLockedPrices(prev => ({ ...prev, [ticker]: !prev[ticker] }));
  };

  // Auto-fetch prices on page load
  useEffect(() => {
    (async () => {
      try {
        // Load assets first
        const response = await api.get(`${backendUrl}/api/assets?market=canada`);
        setAssets(response.data);
        
        // Then fetch current prices from both Canadian stocks and NDAX cryptos
        if (response.data.length > 0) {
          try {
            // Fetch Canadian stock prices (WealthSimple, Manulife)
            const canadianPriceResponse = await api.post(`${backendUrl}/api/assets/update-canadian-prices`);
            let updatedAssets = [...response.data];
            
            // Merge Canadian stock prices
            if (canadianPriceResponse.data.assets && canadianPriceResponse.data.assets.length > 0) {
              const canadianMap = new Map(canadianPriceResponse.data.assets.map(a => [a.ticker, a]));
              updatedAssets = updatedAssets.map(asset => 
                canadianMap.get(asset.ticker) || asset
              );
            }
            
            // Fetch NDAX crypto prices
            try {
              const ndaxPriceResponse = await api.post(`${backendUrl}/api/assets/update-ndax-prices`);
              if (ndaxPriceResponse.data.assets && ndaxPriceResponse.data.assets.length > 0) {
                const ndaxMap = new Map(ndaxPriceResponse.data.assets.map(a => [a.ticker, a]));
                updatedAssets = updatedAssets.map(asset => 
                  ndaxMap.get(asset.ticker) || asset
                );
              }
            } catch (ndaxErr) {
              console.warn('Could not fetch NDAX prices:', ndaxErr.message);
            }
            
            setAssets(updatedAssets);
            
            // Show warning if some prices failed
            if (canadianPriceResponse.data.errors && canadianPriceResponse.data.errors.length > 0) {
              console.warn(`⚠️ Could not fetch prices for ${canadianPriceResponse.data.errors.length} assets (API limit or network issue)`);
            }
          } catch (priceErr) {
            console.warn('Could not fetch live prices:', priceErr.message);
            // Keep showing assets with stored/current prices
          }
        }
      } catch (err) {
        console.error('Error loading assets:', err);
      }
    })();
  }, []);

  useEffect(() => {
    socket.on('assetAdded', newAsset => {
      if (newAsset.market === 'canada') {
        setAssets(prev => [...prev, newAsset]);
      }
    });
    socket.on('assetUpdated', updatedAsset => {
      if (updatedAsset.market === 'canada') {
        setAssets(prev =>
          prev.map(asset => {
            if (asset.ticker === updatedAsset.ticker) {
              // If this asset's price is locked, keep the original price
              if (lockedPrices[asset.ticker]) {
                return asset; // Don't update locked assets
              }
              return updatedAsset;
            }
            return asset;
          })
        );
      }
    });
    socket.on('assetDeleted', deletedTicker => {
      setAssets(prev => prev.filter(a => a.ticker !== deletedTicker));
    });
    return () => {
      socket.off('assetAdded');
      socket.off('assetUpdated');
      socket.off('assetDeleted');
    };
  }, []);

  const toggle = platform => {
    setExpanded(prev => ({ ...prev, [platform]: !prev[platform] }));
  };

  const sortAssets = (list, platform) => {
    if (!list || list.length === 0) return list;
    
    const currentSort = platformSort[platform] || 'ticker';
    const currentOrder = platformSortOrder[platform] || 'asc';
    
    const sorted = [...list].sort((a, b) => {
      let aVal, bVal;
      
      // Map sort column names to asset properties
      const sortMap = {
        'ticker': (asset) => asset.ticker?.toUpperCase() || '',
        'quantity': (asset) => parseFloat(asset.quantity) || 0,
        'averagePrice': (asset) => parseFloat(asset.average_price) || 0,
        'currentPrice': (asset) => parseFloat(asset.current_price) || 0,
        'investedValue': (asset) => parseFloat(asset.invested_value) || 0,
        'balance': (asset) => parseFloat(asset.balance) || 0,
        'variation': (asset) => parseFloat(asset.variation) || 0,
        'capitalGain': (asset) => parseFloat(asset.balance || 0) - parseFloat(asset.invested_value || 0),
        'dividendPerShare': (asset) => parseFloat(asset.dividend_per_share) || 0,
        'currentMonthlyDividend': (asset) => parseFloat(asset.current_monthly_dividend) || 0,
        'currentAnnualDividend': (asset) => parseFloat(asset.current_annual_dividend) || 0,
      };
      
      const getter = sortMap[currentSort] || sortMap['ticker'];
      aVal = getter(a);
      bVal = getter(b);
      
      // Compare values
      if (aVal < bVal) return currentOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return currentOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  const grouped = assets.reduce((acc, a) => {
    const platform = a.platform || 'WealthSimple';
    if (!acc[platform]) acc[platform] = [];
    acc[platform].push(a);
    return acc;
  }, {});

  const totals = Object.fromEntries(
    Object.entries(grouped).map(([platform, list]) => {
      const sum = list.reduce((acc, a) => acc + Number(a.balance || 0), 0);
      return [platform, sum];
    })
  );

  // Calculate capital gain per platform
  const platformCapitalGains = Object.fromEntries(
    Object.entries(grouped).map(([platform, list]) => {
      const totalInvested = list.reduce((acc, a) => acc + parseFloat(a.invested_value || 0), 0);
      const totalBalance = list.reduce((acc, a) => acc + parseFloat(a.balance || 0), 0);
      const capitalGain = totalBalance - totalInvested;
      return [platform, capitalGain];
    })
  );

  // Calculate return percentage per platform
  const platformReturnPercentage = Object.fromEntries(
    Object.entries(grouped).map(([platform, list]) => {
      const totalInvested = list.reduce((acc, a) => acc + parseFloat(a.invested_value || 0), 0);
      const totalBalance = list.reduce((acc, a) => acc + parseFloat(a.balance || 0), 0);
      const returnPct = totalInvested > 0 ? ((totalBalance / totalInvested - 1) * 100).toFixed(2) : 0;
      return [platform, returnPct];
    })
  );

  const totalInvested = assets.reduce((sum, a) => sum + (parseFloat(a.invested_value) || 0), 0);
  const totalBalance = assets.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
  const totalGain = totalBalance - totalInvested;
  const totalVariation = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(2) : 0;

  const platforms = ['WealthSimple', 'NDAX', 'Manulife'];

  const renderSortButton = (column, label, platform) => {
    const isActive = platformSort[platform] === column;
    const arrow = !isActive ? '↕' : platformSortOrder[platform] === 'asc' ? '↑' : '↓';
    return (
      <span 
        onClick={() => {
          if (platformSort[platform] === column) {
            setPlatformSortOrder({ ...platformSortOrder, [platform]: platformSortOrder[platform] === 'asc' ? 'desc' : 'asc' });
          } else {
            setPlatformSort({ ...platformSort, [platform]: column });
            setPlatformSortOrder({ ...platformSortOrder, [platform]: 'asc' });
          }
        }}
        style={{ cursor: 'pointer', fontWeight: isActive ? 'bold' : 'normal', marginLeft: '4px', color: isActive ? '#0066cc' : '#666' }}
      >
        {label} {arrow}
      </span>
    );
  };

  const renderTable = (list, platform) => (
    list.length ? (
      <div className="asset-list">
        <table>
          <thead>
            <tr>
              <th>{renderSortButton('ticker', 'Ticker', platform)}</th>
              <th>{renderSortButton('quantity', 'Quantity', platform)}</th>
              <th>{renderSortButton('averagePrice', 'Avg Price', platform)}</th>
              <th>{renderSortButton('currentPrice', 'Current Price', platform)}</th>
              <th>{renderSortButton('investedValue', 'Invested Value', platform)}</th>
              <th>{renderSortButton('balance', 'Balance', platform)}</th>
              <th>{renderSortButton('variation', 'Variation (%)', platform)}</th>
              <th>{renderSortButton('capital_gain', 'Capital Gain', platform)}</th>
              <th>Current DY (Monthly)</th>
              <th>Current DY (Annual)</th>
            </tr>
          </thead>
          <tbody>
            {sortAssets(list, platform).map((asset) => {
              const variationNum = parseFloat(asset.variation) || 0;
              const quantity = parseFloat(asset.quantity);
              // Show more decimals for crypto/NDAX, fewer for regular stocks, remove all trailing zeros
              const quantityDisplay = (asset.platform === 'NDAX' ? quantity.toFixed(8) : quantity.toFixed(2)).replace(/\.?0+$/, '').replace(/\.$/, '');
              return (
                <tr key={asset.ticker}>
                  <td><strong>{asset.ticker}</strong></td>
                  <td style={{ position: 'relative' }}>
                    {editingField?.ticker === asset.ticker && editingField?.fieldType === 'quantity' ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={editingInputValue}
                          onChange={(e) => setEditingInputValue(e.target.value)}
                          step={asset.platform === 'NDAX' ? '0.00000001' : '1'}
                          min="0"
                          autoFocus
                          style={{
                            padding: '4px 6px',
                            border: '2px solid #28a745',
                            borderRadius: '3px',
                            fontSize: '13px',
                            width: '80px'
                          }}
                        />
                        <button
                          onClick={() => handleSaveEditField(asset.ticker, 'quantity')}
                          style={{
                            padding: '3px 6px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '3px 6px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span>{quantityDisplay}</span>
                        <button
                          onClick={() => handleEditFieldClick(asset.ticker, 'quantity', asset.quantity)}
                          style={{
                            padding: '2px 5px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.opacity = '1'}
                          onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ position: 'relative' }}>
                    {editingField?.ticker === asset.ticker && editingField?.fieldType === 'averagePrice' ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={editingInputValue}
                          onChange={(e) => setEditingInputValue(e.target.value)}
                          step="0.01"
                          min="0"
                          autoFocus
                          style={{
                            padding: '4px 6px',
                            border: '2px solid #28a745',
                            borderRadius: '3px',
                            fontSize: '13px',
                            width: '80px'
                          }}
                        />
                        <button
                          onClick={() => handleSaveEditField(asset.ticker, 'averagePrice')}
                          style={{
                            padding: '3px 6px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: '3px 6px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span>{formatPrice(asset.average_price)}</span>
                        <button
                          onClick={() => handleEditFieldClick(asset.ticker, 'averagePrice', asset.average_price)}
                          style={{
                            padding: '2px 5px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.opacity = '1'}
                          onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ position: 'relative', minWidth: '130px' }}>
                    <span>{formatPrice(asset.current_price)}</span>
                  </td>
                  <td>{formatCurrency(asset.invested_value)}</td>
                  <td>{formatCurrency(asset.balance)}</td>
                  <td className={variationNum >= 0 ? 'positive' : 'negative'}>
                    {variationNum.toFixed(2)}%
                  </td>
                  <td className={parseFloat(asset.balance) - parseFloat(asset.invested_value) >= 0 ? 'positive' : 'negative'}>
                    {formatCurrency(parseFloat(asset.balance) - parseFloat(asset.invested_value))}
                  </td>
                  <td>{parseFloat(asset.current_monthly_dividend || 0).toFixed(2)}%</td>
                  <td>{parseFloat(asset.current_annual_dividend || 0).toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="empty">No assets in this platform.</p>
    )
  );

  return (
    <div className="investment-container">
      <h1>Investment Tracker (Canada)</h1>
      
      {assets.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
          No assets imported yet. Use the Bulk Import option in the navbar to get started!
        </p>
      ) : (
        <>
          {/* Futuristic Summary Section */}
          <div style={{
            marginBottom: '30px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '15px',
            padding: '30px',
            boxShadow: '0 20px 60px rgba(102, 126, 234, 0.3)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Decorative background elements */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: '400px',
              height: '400px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              filter: 'blur(60px)'
            }} />

            <div style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: '25px',
              alignItems: 'start'
            }}>
              {/* Main Card - Current Balance */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                padding: '15px',
                gridRow: 'span 2',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Current Balance</p>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '36px', fontWeight: '700', color: '#fff' }}>
                    {formatCurrency(totalBalance)}
                  </h2>
                  <div style={{
                    height: '4px',
                    background: 'linear-gradient(90deg, #00ff88, #00d4ff)',
                    borderRadius: '2px',
                    marginTop: '12px'
                  }} />
                </div>
                <p style={{ margin: '15px 0 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  ↑ {((totalBalance / totalInvested - 1) * 100).toFixed(2)}% from invested
                </p>
              </div>

              {/* Card - Total Invested */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Invested</p>
                <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: '#fff' }}>
                  {formatCurrency(totalInvested)}
                </p>
              </div>

              {/* Card - Gain/Loss */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📈 Gain/Loss</p>
                <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: totalGain >= 0 ? '#00ff88' : '#ff6b6b' }}>
                  {totalGain >= 0 ? '+' : ''} {formatCurrency(totalGain)}
                </p>
              </div>

              {/* Card - Return % */}
              <div style={{
                background: totalVariation >= 0 
                  ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 212, 255, 0.2))' 
                  : 'linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 87, 87, 0.2))',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎯 Return</p>
                <p style={{ margin: '0', fontSize: '28px', fontWeight: '700', color: totalVariation >= 0 ? '#00ff88' : '#ff6b6b' }}>
                  {totalVariation >= 0 ? '+' : ''}{totalVariation}%
                </p>
              </div>
            </div>
          </div>

          {platforms.map(platform => (
            <div key={platform} className="group">
              <h2 onClick={() => toggle(platform)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="hdr‑chevron">{expanded[platform] ? '▼' : '▶'}</span>
                  <span className="hdr‑label">{platform === 'WealthSimple' ? 'WS' : platform}</span>
                  <span className="hdr‑count">({grouped[platform]?.length || 0} Assets)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '25px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 'normal', color: '#ccc' }}>Total Value:</span>
                    <span style={{ fontWeight: 'bold', color: '#fff', minWidth: '120px', textAlign: 'left' }}>{formatCurrency(totals[platform] || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontWeight: 'normal', color: '#ccc' }}>Capital Gain:</span>
                    <span style={{ 
                      fontWeight: 'bold',
                      color: platformCapitalGains[platform] >= 0 ? '#90EE90' : '#FF6B6B',
                      minWidth: '120px',
                      textAlign: 'left'
                    }}>
                      {platformCapitalGains[platform] >= 0 ? '+' : ''}{formatCurrency(platformCapitalGains[platform] || 0)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 'normal', color: '#ccc' }}>Return:</span>
                    <span style={{ 
                      fontWeight: 'bold',
                      color: platformReturnPercentage[platform] >= 0 ? '#00ff88' : '#ff6b6b',
                      minWidth: '70px',
                      textAlign: 'left'
                    }}>
                      {platformReturnPercentage[platform] >= 0 ? '+' : ''}{platformReturnPercentage[platform]}%
                    </span>
                  </div>
                </div>
              </h2>
              {expanded[platform] && renderTable(grouped[platform] || [], platform)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default CanadaInvestment;

