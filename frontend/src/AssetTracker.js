// src/AssetTracker.js
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:6000';
const socket = io(backendUrl); // Now using the environment variable

function AssetTracker() {
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ ativo: '', quantidade: '', precoMedio: '' });

  // Load initial data.
  useEffect(() => {
    axios.get(`${backendUrl}/api/assets`)
      .then(response => setAssets(response.data))
      .catch(err => console.error(err));
  }, []);

  // Listen for real-time updates.
  useEffect(() => {
    socket.on('assetAdded', newAsset => {
      setAssets(prevAssets => [...prevAssets, newAsset]);
    });
    socket.on('assetUpdated', updatedAsset => {
      setAssets(prevAssets => prevAssets.map(asset =>
        asset.ativo === updatedAsset.asset
          ? { ...asset, preco_atual: updatedAsset.precoAtual, dy_por_cota: updatedAsset.dyPorCota }
          : asset
      ));
    });

    // Clean up on unmount.
    return () => {
      socket.off('assetAdded');
      socket.off('assetUpdated');
    };
  }, []);

  // Handle form changes.
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Submit the form to add a new asset.
  const handleSubmit = (e) => {
    e.preventDefault();
    axios.post(`${backendUrl}/api/assets`, {
      ativo: form.ativo,
      quantidade: parseInt(form.quantidade),
      precoMedio: parseFloat(form.precoMedio)
    })
      .then(response => {
        // Optionally update local state or rely on the socket event.
        setForm({ ativo: '', quantidade: '', precoMedio: '' });
      })
      .catch(err => console.error(err));
  };

  return (
    <div>
      <h1>Asset Tracker</h1>
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="ativo"
          placeholder="Asset Code"
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
        <button type="submit">Add Asset</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Ativo</th>
            <th>Quantidade</th>
            <th>Preço Médio</th>
            <th>Preço Atual</th>
            <th>DY por Cota</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset, index) => (
            <tr key={index}>
              <td>{asset.ativo}</td>
              <td>{asset.quantidade}</td>
              <td>{asset.preco_medio}</td>
              <td>{asset.preco_atual || '-'}</td>
              <td>{asset.dy_por_cota || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AssetTracker;
