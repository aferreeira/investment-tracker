import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import './App.css';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';
const socket = io(backendUrl);

function BrazilInvestment() {
  const [assets, setAssets] = useState([]);

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

  return (
    <div className="investment-container">
      <h1>Rastreador de Investimentos (Brasil)</h1>

      <div className="asset-list">
        <h2>Ativos Adicionados</h2>
        <table>
          <thead>
            <tr>
              <th>Ativo</th>
              <th>Quantidade</th>
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
            {assets.length > 0 ? (
              assets.map((asset, index) => {
                const variacaoNum = parseFloat(asset.variacao) || 0;
                return (
                  <tr key={index}>
                    <td>{asset.ativo}</td>
                    <td>{asset.quantidade}</td>
                    <td>{asset.preco_medio}</td>
                    <td>{asset.preco_atual}</td>
                    <td>{asset.valor_investido}</td>
                    <td>{asset.saldo}</td>
                    <td className={variacaoNum >= 0 ? 'positive' : 'negative'}>
                      {variacaoNum.toFixed(2)}%
                    </td>
                    <td>{asset.dy_por_cota}</td>
                    <td>{parseFloat(asset.dy_atual_mensal).toFixed(2)}%</td>
                    <td>{parseFloat(asset.dy_atual_anual).toFixed(2)}%</td>
                    <td>{parseFloat(asset.dy_meu_mensal).toFixed(2)}%</td>
                    <td>{parseFloat(asset.dy_meu_anual).toFixed(2)}%</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="12">Nenhum ativo adicionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BrazilInvestment;
