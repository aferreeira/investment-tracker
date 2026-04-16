import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import api from '../services/axiosConfig';
import '../styles/App.css';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';
const socket = io(backendUrl);

function BrazilInvestment() {
  const [assets, setAssets] = useState([]);
  const [expanded, setExpanded] = useState({ FII: true, Ticker: true });

  useEffect(() => {
    (async () => {
      try {
        await api.post(`${backendUrl}/api/assets/bulk`);
        const response = await api.get(`${backendUrl}/api/assets?market=brazil`);
        setAssets(response.data);
      } catch (err) {
        console.error('Error loading assets:', err);
      }
    })();
  }, []);

  useEffect(() => {
    socket.on('assetAdded', newAsset => {
      if (newAsset.market === 'brazil' || !newAsset.market) {
        setAssets(prev => [...prev, newAsset]);
      }
    });
    socket.on('assetUpdated', updatedAsset => {
      if (updatedAsset.market === 'brazil' || !updatedAsset.market) {
        setAssets(prev =>
          prev.map(asset =>
            asset.ticker === updatedAsset.ticker ? updatedAsset : asset
          )
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

  const toggle = type => {
    setExpanded(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const grouped = assets.reduce((acc, a) => {
    const key = a.asset_type === 'Ticker' ? 'Ticker' : 'FII';
    acc[key].push(a);
    return acc;
  }, { FII: [], Ticker: [] });

  const totals = Object.fromEntries(
    Object.entries(grouped).map(([type, list]) => {
      const sum = list.reduce(
        (acc, a) => acc + Number(a.balance || 0),
        0
      );
      return [type, sum];
    })
  );

  const renderTable = list => (
    list.length ? (
      <div className="asset-list">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Quantity</th>
              <th>Avg Price</th>
              <th>Current Price</th>
              <th>Invested Value</th>
              <th>Balance</th>
              <th>Variation (%)</th>
              <th>DY Per Share</th>
              <th>Current DY Monthly (%)</th>
              <th>Current DY Annual (%)</th>
              <th>My DY Monthly (%)</th>
              <th>My DY Annual (%)</th>
            </tr>
          </thead>
          <tbody>
            {list.map(asset => {
              const variationNum = parseFloat(asset.variation) || 0;
              return (
                <tr key={asset.ticker}>
                  <td>{asset.ticker}</td>
                  <td>{asset.quantity}</td>
                  <td>{Number(asset.average_price).toFixed(2)}</td>
                  <td>{Number(asset.current_price).toFixed(2)}</td>
                  <td>{Number(asset.invested_value).toFixed(2)}</td>
                  <td>{Number(asset.balance).toFixed(2)}</td>
                  <td className={variationNum >= 0 ? 'positive' : 'negative'}>
                    {variationNum.toFixed(2)}%
                  </td>
                  <td>{Number(asset.dividend_per_share).toFixed(2)}</td>
                  <td>{Number(asset.current_monthly_dividend).toFixed(2)}%</td>
                  <td>{Number(asset.current_annual_dividend).toFixed(2)}%</td>
                  <td>{Number(asset.my_monthly_dividend).toFixed(2)}%</td>
                  <td>{Number(asset.my_annual_dividend).toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="empty">No assets in this category.</p>
    )
  );

  const totalInvested = assets.reduce((sum, a) => sum + (parseFloat(a.invested_value) || 0), 0);
  const totalBalance = assets.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
  const totalGain = totalBalance - totalInvested;
  const totalVariation = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(2) : 0;

  return (
    <div className="investment-container">
      <h1>Investment Tracker (Brazil)</h1>
      
      {/* Futuristic Summary Section */}
      <div style={{
        marginBottom: '30px',
        background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        borderRadius: '15px',
        padding: '30px',
        boxShadow: '0 20px 60px rgba(245, 87, 108, 0.3)',
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
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Saldo Atual</p>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '36px', fontWeight: '700', color: '#fff' }}>
                R$ {totalBalance.toFixed(2)}
              </h2>
              <div style={{
                height: '4px',
                background: 'linear-gradient(90deg, #f093fb, #f5576c)',
                borderRadius: '2px',
                marginTop: '12px'
              }} />
            </div>
            <p style={{ margin: '15px 0 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
              ↑ {((totalBalance / totalInvested - 1) * 100).toFixed(2)}% do investido
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
            <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Investido</p>
            <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: '#fff' }}>
              R$ {totalInvested.toFixed(2)}
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
            <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📈 Ganho/Perda</p>
            <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: totalGain >= 0 ? '#a8ff60' : '#ff6b6b' }}>
              {totalGain >= 0 ? '+' : ''} R$ {totalGain.toFixed(2)}
            </p>
          </div>

          {/* Card - Return % */}
          <div style={{
            background: totalVariation >= 0 
              ? 'linear-gradient(135deg, rgba(168, 255, 96, 0.2), rgba(255, 159, 64, 0.2))' 
              : 'linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 87, 87, 0.2))',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '500', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎯 Rentabilidade</p>
            <p style={{ margin: '0', fontSize: '28px', fontWeight: '700', color: totalVariation >= 0 ? '#a8ff60' : '#ff6b6b' }}>
              {totalVariation >= 0 ? '+' : ''}{totalVariation}%
            </p>
          </div>
        </div>
      </div>
      
      {['FII', 'Ticker'].map(type => (
        <div key={type} className="group">
          <h2 onClick={() => toggle(type)}>
            <span className="hdr‑chevron">{expanded[type] ? '▼' : '▶'}</span>
            <span className="hdr‑label">
              {type === 'FII' ? 'FIIs' : 'Ações'}
            </span>
            <span className="hdr‑count">
              {grouped[type]?.length || 0} Ativos
            </span>
            <span className="hdr‑totalvalue">
              Valor Total:
            </span>
            <small className="hdr‑total">
              R$ {totals[type]?.toFixed(2)}
            </small>
          </h2>
          {expanded[type] && renderTable(grouped[type] || [])}
        </div>
      ))}
    </div>
  );
}

export default BrazilInvestment;
