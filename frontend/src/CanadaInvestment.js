import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import './App.css';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';
const socket = io(backendUrl);

function CanadaInvestment() {
  const [assets, setAssets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [expanded, setExpanded] = useState({ WealthSimple: true, NDAX: true, Manulife: true });
  const [platformSort, setPlatformSort] = useState({ WealthSimple: 'ativo', NDAX: 'ativo', Manulife: 'ativo' });
  const [platformSortOrder, setPlatformSortOrder] = useState({ WealthSimple: 'asc', NDAX: 'asc', Manulife: 'asc' });
  const [manualPrices, setManualPrices] = useState({});
  const [editingField, setEditingField] = useState(null); // {ticker, fieldType} where fieldType is 'quantidade', 'preco_medio', or 'preco_atual'
  const [editingInputValue, setEditingInputValue] = useState('');
  const [lockedPrices, setLockedPrices] = useState({}); // {ticker: true/false}

  const updateAssetField = async (ticker, fieldType, newValue) => {
    try {
      const payload = { ativo: ticker };
      
      if (fieldType === 'quantidade') {
        payload.quantidade = parseFloat(newValue);
      } else if (fieldType === 'preco_medio') {
        payload.preco_medio = parseFloat(newValue);
      } else if (fieldType === 'preco_atual') {
        payload.preco_atual = parseFloat(newValue);
      }
      
      const response = await axios.put(
        `${backendUrl}/api/assets/update-price`,
        payload
      );
      
      if (response.data) {
        setAssets(prev =>
          prev.map(asset =>
            asset.ativo === ticker 
              ? { ...asset, ...response.data }
              : asset
          )
        );
        const fieldLabels = { quantidade: 'Quantity', preco_medio: 'Avg Price', preco_atual: 'Current Price' };
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
        const response = await axios.get(`${backendUrl}/api/assets?market=canada`);
        setAssets(response.data);
        
        // Then fetch current prices from both Canadian stocks and NDAX cryptos
        if (response.data.length > 0) {
          try {
            // Fetch Canadian stock prices (WealthSimple, Manulife)
            const canadianPriceResponse = await axios.post(`${backendUrl}/api/assets/update-canadian-prices`);
            let updatedAssets = [...response.data];
            
            // Merge Canadian stock prices
            if (canadianPriceResponse.data.assets && canadianPriceResponse.data.assets.length > 0) {
              const canadianMap = new Map(canadianPriceResponse.data.assets.map(a => [a.ativo, a]));
              updatedAssets = updatedAssets.map(asset => 
                canadianMap.get(asset.ativo) || asset
              );
            }
            
            // Fetch NDAX crypto prices
            try {
              const ndaxPriceResponse = await axios.post(`${backendUrl}/api/assets/update-ndax-prices`);
              if (ndaxPriceResponse.data.assets && ndaxPriceResponse.data.assets.length > 0) {
                const ndaxMap = new Map(ndaxPriceResponse.data.assets.map(a => [a.ativo, a]));
                updatedAssets = updatedAssets.map(asset => 
                  ndaxMap.get(asset.ativo) || asset
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
            if (asset.ativo === updatedAsset.ativo) {
              // If this asset's price is locked, keep the original price
              if (lockedPrices[asset.ativo]) {
                return asset; // Don't update locked assets
              }
              return updatedAsset;
            }
            return asset;
          })
        );
      }
    });
    socket.on('assetDeleted', deletedAtivo => {
      setAssets(prev => prev.filter(a => a.ativo !== deletedAtivo));
    });
    return () => {
      socket.off('assetAdded');
      socket.off('assetUpdated');
      socket.off('assetDeleted');
    };
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('market', 'canada');

      const response = await axios.post(
        `${backendUrl}/api/assets/upload-csv`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setUploadMessage(`✓ Successfully imported ${response.data.count} assets from WealthSimple`);
      setAssets(response.data.assets);
      
      // Reset file input
      event.target.value = '';
      
      // Clear message after 5 seconds
      setTimeout(() => setUploadMessage(''), 5000);
    } catch (err) {
      console.error('Error uploading file:', err);
      setUploadMessage(`✗ Error: ${err.response?.data?.error || 'Failed to upload CSV'}`);
    } finally {
      setUploading(false);
    }
  };



  const toggle = platform => {
    setExpanded(prev => ({ ...prev, [platform]: !prev[platform] }));
  };

  const sortAssets = (list, platform) => {
    if (!list || list.length === 0) return list;
    
    const currentSort = platformSort[platform] || 'ativo';
    const currentOrder = platformSortOrder[platform] || 'asc';
    
    const sorted = [...list].sort((a, b) => {
      let aVal, bVal;
      
      // Map sort column names to asset properties
      const sortMap = {
        'ativo': (asset) => asset.ativo?.toUpperCase() || '',
        'quantidade': (asset) => parseFloat(asset.quantidade) || 0,
        'preco_medio': (asset) => parseFloat(asset.preco_medio) || 0,
        'preco_atual': (asset) => parseFloat(asset.preco_atual) || 0,
        'valor_investido': (asset) => parseFloat(asset.valor_investido) || 0,
        'saldo': (asset) => parseFloat(asset.saldo) || 0,
        'variacao': (asset) => parseFloat(asset.variacao) || 0,
        'dy_por_cota': (asset) => parseFloat(asset.dy_por_cota) || 0,
        'dy_atual_mensal': (asset) => parseFloat(asset.dy_atual_mensal) || 0,
        'dy_atual_anual': (asset) => parseFloat(asset.dy_atual_anual) || 0,
      };
      
      const getter = sortMap[currentSort] || sortMap['ativo'];
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
      const sum = list.reduce((acc, a) => acc + Number(a.saldo || 0), 0);
      return [platform, sum];
    })
  );

  // Calculate capital gain per platform
  const platformCapitalGains = Object.fromEntries(
    Object.entries(grouped).map(([platform, list]) => {
      const totalInvested = list.reduce((acc, a) => acc + parseFloat(a.valor_investido || 0), 0);
      const totalBalance = list.reduce((acc, a) => acc + parseFloat(a.saldo || 0), 0);
      const capitalGain = totalBalance - totalInvested;
      return [platform, capitalGain];
    })
  );

  const totalInvested = assets.reduce((sum, a) => sum + (parseFloat(a.valor_investido) || 0), 0);
  const totalBalance = assets.reduce((sum, a) => sum + (parseFloat(a.saldo) || 0), 0);
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
              <th>{renderSortButton('ativo', 'Ticker', platform)}</th>
              <th>{renderSortButton('quantidade', 'Quantity', platform)}</th>
              <th>{renderSortButton('preco_medio', 'Avg Price', platform)}</th>
              <th>{renderSortButton('preco_atual', 'Current Price', platform)}</th>
              <th>{renderSortButton('valor_investido', 'Invested Value', platform)}</th>
              <th>{renderSortButton('saldo', 'Balance', platform)}</th>
              <th>{renderSortButton('variacao', 'Variation (%)', platform)}</th>
              <th>Capital Gain</th>
              <th>Current DY (Monthly)</th>
              <th>Current DY (Annual)</th>
            </tr>
          </thead>
          <tbody>
            {sortAssets(list, platform).map((asset) => {
              const variacaoNum = parseFloat(asset.variacao) || 0;
              const quantity = parseFloat(asset.quantidade);
              // Show more decimals for crypto/NDAX, fewer for regular stocks
              const quantityDisplay = asset.platform === 'NDAX' ? quantity.toFixed(8) : quantity.toFixed(0);
              return (
                <tr key={asset.ativo}>
                  <td><strong>{asset.ativo}</strong></td>
                  <td style={{ position: 'relative' }}>
                    {editingField?.ticker === asset.ativo && editingField?.fieldType === 'quantidade' ? (
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
                          onClick={() => handleSaveEditField(asset.ativo, 'quantidade')}
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
                          onClick={() => handleEditFieldClick(asset.ativo, 'quantidade', asset.quantidade)}
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
                    {editingField?.ticker === asset.ativo && editingField?.fieldType === 'preco_medio' ? (
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
                          onClick={() => handleSaveEditField(asset.ativo, 'preco_medio')}
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
                        <span>${parseFloat(asset.preco_medio).toFixed(2)}</span>
                        <button
                          onClick={() => handleEditFieldClick(asset.ativo, 'preco_medio', asset.preco_medio)}
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
                    <span>${parseFloat(asset.preco_atual).toFixed(2)}</span>
                  </td>
                  <td>${parseFloat(asset.valor_investido).toFixed(2)}</td>
                  <td>${parseFloat(asset.saldo).toFixed(2)}</td>
                  <td className={variacaoNum >= 0 ? 'positive' : 'negative'}>
                    {variacaoNum.toFixed(2)}%
                  </td>
                  <td className={parseFloat(asset.saldo) - parseFloat(asset.valor_investido) >= 0 ? 'positive' : 'negative'}>
                    ${(parseFloat(asset.saldo) - parseFloat(asset.valor_investido)).toFixed(2)}
                  </td>
                  <td>{parseFloat(asset.dy_atual_mensal || 0).toFixed(2)}%</td>
                  <td>{parseFloat(asset.dy_atual_anual || 0).toFixed(2)}%</td>
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
      
      <div style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-block' }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
          />
          {uploading && <span style={{ marginLeft: '10px' }}>Uploading...</span>}
        </label>


      </div>

      {uploadMessage && (
        <p style={{
          marginTop: '10px',
          padding: '8px 12px',
          borderRadius: '3px',
          backgroundColor: uploadMessage.includes('✓') ? '#d4edda' : '#f8d7da',
          color: uploadMessage.includes('✓') ? '#155724' : '#721c24',
          fontSize: '12px'
        }}>
          {uploadMessage}
        </p>
      )}

      {assets.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
          No assets imported yet. Upload a CSV file to get started!
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
                padding: '25px',
                gridRow: 'span 2',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Current Balance</p>
                  <h2 style={{ margin: '0 0 8px 0', fontSize: '36px', fontWeight: '700', color: '#fff' }}>
                    ${totalBalance.toFixed(2)}
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
                  ${totalInvested.toFixed(2)}
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
                  {totalGain >= 0 ? '+' : ''} ${totalGain.toFixed(2)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '30px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 'normal', color: '#ccc' }}>Total Value:</span>
                    <span style={{ fontWeight: 'bold', color: '#fff' }}>${totals[platform]?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 'normal', color: '#ccc' }}>Capital Gain:</span>
                    <span style={{ 
                      fontWeight: 'bold',
                      color: platformCapitalGains[platform] >= 0 ? '#90EE90' : '#FF6B6B'
                    }}>
                      {platformCapitalGains[platform] >= 0 ? '+' : ''}${platformCapitalGains[platform]?.toFixed(2) || '0.00'}
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

