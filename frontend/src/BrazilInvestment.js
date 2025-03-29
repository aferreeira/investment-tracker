// src/BrazilInvestment.js
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import './App.css';

// Use the environment variable for backend URL or fallback to localhost
const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';
// Establish socket connection to the backend
const socket = io(backendUrl);

function BrazilInvestment() {
  // State to store assets retrieved from the database
  const [assets, setAssets] = useState([]);
  // State for the add asset form (user-provided fields)
  const [form, setForm] = useState({ ativo: '', quantidade: '', precoMedio: '' });

  // Fetch assets from the backend when the component mounts
  useEffect(() => {
    axios.get(`${backendUrl}/api/assets`)
      .then(response => setAssets(response.data))
      .catch(err => console.error('Error fetching assets:', err));
  }, []);

  // Listen for real-time events from the backend
  useEffect(() => {
    socket.on('assetAdded', newAsset => {
      setAssets(prevAssets => [...prevAssets, newAsset]);
    });
    socket.on('assetUpdated', updatedAsset => {
      setAssets(prevAssets =>
        prevAssets.map(asset =>
          asset.ativo === updatedAsset.asset
            ? { ...asset,
                preco_atual: updatedAsset.precoAtual,
                dy_por_cota: updatedAsset.dyPorCota,
                valor_investido: updatedAsset.valorInvestido,
                saldo: updatedAsset.saldo,
                variacao: updatedAsset.variacao,
                dy_atual_mensal: updatedAsset.dyAtualMensal,
                dy_atual_anual: updatedAsset.dyAtualAnual,
                dy_meu_mensal: updatedAsset.dyMeuMensal,
                dy_meu_anual: updatedAsset.dyMeuAnual }
            : asset
        )
      );
    });
    return () => {
      socket.off('assetAdded');
      socket.off('assetUpdated');
    };
  }, []);

  // Handle changes in the form inputs
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Submit the add asset form
  const handleSubmit = (e) => {
    e.preventDefault();
    // Send the new asset to the backend. Only Ativo, Quantidade, and Preço Médio are provided.
    axios.post(`${backendUrl}/api/assets`, {
      ativo: form.ativo,
      quantidade: parseInt(form.quantidade, 10),
      precoMedio: parseFloat(form.precoMedio)
    })
      .then(response => {
        // Clear the form after successful submission.
        setForm({ ativo: '', quantidade: '', precoMedio: '' });
      })
      .catch(err => console.error('Error adding asset:', err));
  };

  // Delete asset function
  const deleteAsset = (ativo) => {
    axios.delete(`${backendUrl}/api/assets/${ativo}`)
      .then(response => {
        // Update the local state to remove the deleted asset.
        setAssets(prev => prev.filter(asset => asset.ativo !== ativo));
      })
      .catch(err => console.error('Error deleting asset:', err));
  };

  return (
    <div className="investment-container">
      <h1>Rastreador de Investimentos (Brasil)</h1>
      
      {/* Section for adding a new asset */}
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

      {/* Section for listing assets from the database */}
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
              assets.map((asset, index) => (
                <tr key={index}>
                  <td>{asset.ativo}</td>
                  <td>{asset.quantidade}</td>
                  <td>{asset.preco_medio}</td>
                  <td>{asset.preco_atual || '-'}</td>
                  <td>{asset.valor_investido || '-'}</td>
                  <td>{asset.saldo || '-'}</td>
                  <td>{asset.variacao ? Number(asset.variacao).toFixed(2) + '%' : '-'}</td>
                  <td>{asset.dy_por_cota || '-'}</td>
                  <td>{asset.dy_atual_mensal ? Number(asset.dy_atual_mensal).toFixed(2) + '%' : '-'}</td>
                  <td>{asset.dy_atual_anual ? Number(asset.dy_atual_anual).toFixed(2) + '%' : '-'}</td>
                  <td>{asset.dy_meu_mensal ? Number(asset.dy_meu_mensal).toFixed(2) + '%' : '-'}</td>
                  <td>{asset.dy_meu_anual ? Number(asset.dy_meu_anual).toFixed(2) + '%' : '-'}</td>
                  <td>
                    <button onClick={() => deleteAsset(asset.ativo)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))
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
