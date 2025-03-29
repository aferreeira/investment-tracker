import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import './App.css'; // or './BrazilInvestment.css'

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';
const socket = io(backendUrl);

function BrazilInvestment() {
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ ativo: '', quantidade: '', precoMedio: '' });

  useEffect(() => {
    axios.get(`${backendUrl}/api/assets`)
      .then(response => setAssets(response.data))
      .catch(err => console.error('Error fetching assets:', err));
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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    axios.post(`${backendUrl}/api/assets`, {
      ativo: form.ativo,
      quantidade: parseInt(form.quantidade, 10),
      precoMedio: parseFloat(form.precoMedio)
    })
      .then(() => {
        setForm({ ativo: '', quantidade: '', precoMedio: '' });
      })
      .catch(err => console.error('Error adding asset:', err));
  };

  // Example delete function if you have a DELETE endpoint
  const deleteAsset = (ativo) => {
    axios.delete(`${backendUrl}/api/assets/${ativo}`)
      .then(() => {
        setAssets(prev => prev.filter(a => a.ativo !== ativo));
      })
      .catch(err => console.error('Error deleting asset:', err));
  };

  const extractTickers = () => {
    axios.post(`${backendUrl}/api/extract-tickers`)
      .then(response => {
        console.log('Scrape response:', response.data);
        // Optionally refresh your assets or show a success message here
      })
      .catch(err => console.error('Error extracting tickers:', err));
  };

  return (
    <div className="investment-container">
      <h1>Rastreador de Investimentos (Brasil)</h1>

      <div className="asset-form">
        <h2>Adicionar Ativo</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="ativo"
            placeholder="Código do Ativo"
            value={form.ativo}
            onChange={handleChange}
            required
          />
          <input
            type="number"
            name="quantidade"
            placeholder="Quantidade"
            value={form.quantidade}
            onChange={handleChange}
            required
          />
          <input
            type="number"
            step="0.01"
            name="precoMedio"
            placeholder="Preço Médio"
            value={form.precoMedio}
            onChange={handleChange}
            required
          />
          <button type="submit">Adicionar Ativo</button>
        </form>
      </div>

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
              <th>Ações</th>
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

                    <td>
                      <button onClick={() => deleteAsset(asset.ativo)}>Excluir</button>
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
      <button onClick={extractTickers}>Importar da Carteira</button>
    </div>
  );
}

export default BrazilInvestment;
