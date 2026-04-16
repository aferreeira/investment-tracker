// BulkAssetsPage.js
import React, { useState } from 'react';
import api from '../services/axiosConfig';
import './BulkAssetsPage.css'; // Create this CSS file for custom styles if needed

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';

function BulkAssetsPage() {
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    try {
      const parsed = JSON.parse(jsonText);
      let payload = {};

      // Handle both array format and object format
      if (Array.isArray(parsed)) {
        // User pasted just an array: [{ ticker: "..." }, ...]
        payload = { assets: parsed, market: 'brazil' };
      } else if (parsed.assets) {
        // User pasted object format: { assets: [...], market: "canada" }
        payload = parsed;
      } else {
        setError('Invalid format: must be an array or object with assets array');
        return;
      }

      api.post(`${backendUrl}/api/assets/bulk`, payload)
        .then(response => {
          setResult(response.data);
          setError('');
        })
        .catch(err => {
          console.error('Error inserting assets:', err);
          setError(err.response?.data?.error || 'Error inserting assets');
          setResult(null);
        });
    } catch (e) {
      setError('Invalid JSON');
      setResult(null);
    }
  };

  return (
    <div className="bulk-assets-page">
      <h1>Import Assets via JSON</h1>
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder='Paste your JSON array here. Example:
[
  { "ticker": "BBAS3", "quantity": 10, "averagePrice": 25.50, "platform": "WealthSimple" },
  { "ticker": "PETR4", "quantity": 20, "averagePrice": 28.00, "platform": "WealthSimple" }
]

Or with market parameter:
{
  "assets": [
    { "ticker": "AEM.TO", "quantity": 5, "averagePrice": 219.56, "platform": "WealthSimple" },
    { "ticker": "AG.TO", "quantity": 41, "averagePrice": 28.64, "platform": "WealthSimple" }
  ],
  "market": "canada"
}'
      />
      <br />
      <button onClick={handleSubmit}>Import Assets</button>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="result">
          <h2>Import Result</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default BulkAssetsPage;
