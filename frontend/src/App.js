import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import LoginPage from './components/Auth/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import BrazilInvestment from './pages/BrazilInvestment';
import CanadaInvestment from './pages/CanadaInvestment';
import AssetTracker from './pages/AssetTracker'; // your new real‑time tracker
import BulkAssetsPage from './pages/BulkAssetsPage';
import ProfilePage from './components/Profile/ProfilePage';

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brazil"
          element={
            <ProtectedRoute>
              <BrazilInvestment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/canada"
          element={
            <ProtectedRoute>
              <CanadaInvestment />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bulk-assets"
          element={
            <ProtectedRoute>
              <BulkAssetsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assets"
          element={
            <ProtectedRoute>
              <AssetTracker />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/brazil" />} />
      </Routes>
    </>
  );
}

export default App;
