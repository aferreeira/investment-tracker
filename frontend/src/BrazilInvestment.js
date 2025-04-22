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
        const response = await axios.get(`${backendUrl}/api/assets`);
        setAssets(response.data);
      } catch (err) {
        console.error('Error loading assets:', err);
      }
    })();
  }, []);

  useEffect(() => {
    socket.on('assetAdded', newAsset => {
      setAssets(prev => [...prev, newAsset]);
    });
    socket.on('assetUpdated', updatedAsset => {
      setAssets(prev =>
        prev.map(asset =>
          asset.ativo === updatedAsset.ativo ? updatedAsset : asset
        )
      );
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
    // Normalize ticker_type to 'Ticker' or 'FII'
    const key = a.ticker_type && a.ticker_type.toLowerCase() === 'ticker' ? 'Ticker' : 'FII';
    acc[key].push(a);
    return acc;
  }, { FII: [], Ticker: [] });

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

  return (
    <div className="investment-container">
      <h1>Rastreador de Investimentos (Brasil)</h1>
      {['FII', 'Ticker'].map(type => (
        <div key={type} className="group">
          <h2 onClick={() => toggle(type)}>
            {type === 'FII' ? 'FIIs' : 'Ações'} ({grouped[type]?.length || 0})
            <span className="chevron">{expanded[type] ? '▼' : '▶'}</span>
          </h2>
          {expanded[type] && renderTable(grouped[type] || [])}
        </div>
      ))}
    </div>
  );
}

export default BrazilInvestment;
