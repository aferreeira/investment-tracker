import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BrazilInvestment from './BrazilInvestment';
import CanadaInvestment from './CanadaInvestment';
import AssetTracker from './AssetTracker'; // your new real‑time tracker

function App() {
  return (
    <Routes>
      <Route path="/brazil" element={<BrazilInvestment />} />
      <Route path="/canada" element={<CanadaInvestment />} />
      <Route path="/assets" element={<AssetTracker />} />
      <Route path="*" element={<Navigate to="/assets" />} />
    </Routes>
  );
}

export default App;
