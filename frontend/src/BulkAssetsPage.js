// BulkAssetsPage.js
import React, { useState } from 'react';
import axios from 'axios';
import './BulkAssetsPage.css'; // Create this CSS file for custom styles if needed

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7000';

function BulkAssetsPage() {
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    try {
      const assets = JSON.parse(jsonText);
      axios.post(`${backendUrl}/api/assets/bulk`, { assets })
        .then(response => {
          setResult(response.data);
          setError('');
        })
        .catch(err => {
          console.error('Error inserting assets:', err);
          setError('Error inserting assets');
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
        placeholder='Paste your JSON here. Example:
[
  { "ativo": "RBFF11", "quantidade": 37, "precoMedio": 46.24 },
  { "ativo": "CACR11", "quantidade": 18, "precoMedio": 81.42 }
]'
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
