import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import './App.css';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';
const socket = io(backendUrl);

function BrazilInvestment() {
  const [assets, setAssets] = useState([]);
  const [expanded, setExpanded] = useState({ FII: true, Ticker: true });

  useEffect(() => {
    (async () => {
      try {
        await axios.post(`${backendUrl}/api/assets/bulk`);
        const response = await axios.get(`${backendUrl}/api/assets?market=brazil`);
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
            asset.ativo === updatedAsset.ativo ? updatedAsset : asset
          )
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

  const toggle = type => {
    setExpanded(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const grouped = assets.reduce((acc, a) => {
    const key = a.ticker_type === 'Ticker' ? 'Ticker' : 'FII';
    acc[key].push(a);
    return acc;
  }, { FII: [], Ticker: [] });

  const totals = Object.fromEntries(
    Object.entries(grouped).map(([type, list]) => {
      const sum = list.reduce(
        (acc, a) => acc + Number(a.saldo || 0),
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
              <th>Ativo</th>
              <th>Qtd</th>
              <th>Preço Médio</th>
              <th>Preço Atual</th>
              <th>Valor Investido</th>
              <th>Saldo</th>
              <th>Variação (%)</th>
              <th>DY por Cota</th>
              <th>DY% Atual Mensal</th>
              <th>DY% Atual Anual</th>
              <th>DY% Meu Mensal</th>
              <th>DY% Meu Anual</th>
            </tr>
          </thead>
          <tbody>
            {list.map(asset => {
              const variacaoNum = parseFloat(asset.variacao) || 0;
              return (
                <tr key={asset.ativo}>
                  <td>{asset.ativo}</td>
                  <td>{asset.quantidade}</td>
                  <td>{Number(asset.preco_medio).toFixed(2)}</td>
                  <td>{Number(asset.preco_atual).toFixed(2)}</td>
                  <td>{Number(asset.valor_investido).toFixed(2)}</td>
                  <td>{Number(asset.saldo).toFixed(2)}</td>
                  <td className={variacaoNum >= 0 ? 'positive' : 'negative'}>
                    {variacaoNum.toFixed(2)}%
                  </td>
                  <td>{Number(asset.dy_por_cota).toFixed(2)}</td>
                  <td>{Number(asset.dy_atual_mensal).toFixed(2)}%</td>
                  <td>{Number(asset.dy_atual_anual).toFixed(2)}%</td>
                  <td>{Number(asset.dy_meu_mensal).toFixed(2)}%</td>
                  <td>{Number(asset.dy_meu_anual).toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="empty">Nenhum ativo nesta categoria.</p>
    )
  );

  const totalInvested = assets.reduce((sum, a) => sum + (parseFloat(a.valor_investido) || 0), 0);
  const totalBalance = assets.reduce((sum, a) => sum + (parseFloat(a.saldo) || 0), 0);
  const totalGain = totalBalance - totalInvested;
  const totalVariation = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(2) : 0;

  return (
    <div className="investment-container">
      <h1>Rastreador de Investimentos (Brasil)</h1>
      
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
