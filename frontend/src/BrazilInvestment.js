import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import './App.css'; // or './BrazilInvestment.css'

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';
const socket = io(backendUrl);

function BrazilInvestment() {
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        axios.post(`${backendUrl}/api/extract-tickers`)
          .then(response => {
            console.log('Scrape response:', response.data);
          })
          .catch(err => console.error('Error extracting tickers:', err));
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
          asset.ativo === updatedAsset.asset ? { ...asset, ...updatedAsset } : asset
        )
      );
    });
    // If you have assetDeleted or other events, handle them similarly

    return () => {
      socket.off('assetAdded');
      socket.off('assetUpdated');
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
            {assets.length ? (
              assets.map((asset, index) => {
                // Convert string to number (Postgres might return them as strings)
                const variacaoNum = asset.variacao ? Number(asset.variacao) : null;
                
                return (
                  <tr key={index}>
                    <td>{asset.ativo}</td>
                    <td>{asset.quantidade}</td>
                    <td>{asset.preco_medio}</td>
                    <td>{asset.preco_atual || '-'}</td>
                    <td>{asset.valor_investido || '-'}</td>
                    <td>{asset.saldo || '-'}</td>
                    
                    {/* Color-coded Variation */}
                    <td className={variacaoNum >= 0 ? 'positive' : 'negative'}>
                      {variacaoNum !== null ? variacaoNum.toFixed(2) + '%' : '-'}
                    </td>

                    <td>{asset.dy_por_cota || '-'}</td>
                    <td>
                      {asset.dy_atual_mensal
                        ? Number(asset.dy_atual_mensal).toFixed(2) + '%'
                        : '-'}
                    </td>
                    <td>
                      {asset.dy_atual_anual
                        ? Number(asset.dy_atual_anual).toFixed(2) + '%'
                        : '-'}
                    </td>
                    <td>
                      {asset.dy_meu_mensal
                        ? Number(asset.dy_meu_mensal).toFixed(2) + '%'
                        : '-'}
                    </td>
                    <td>
                      {asset.dy_meu_anual
                        ? Number(asset.dy_meu_anual).toFixed(2) + '%'
                        : '-'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="13">Nenhum ativo adicionado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* <button onClick={extractTickers}>Importar da Carteira</button> */}
    </div>
  );
}

export default BrazilInvestment;
