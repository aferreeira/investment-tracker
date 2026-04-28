import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { setAuthExpiredHandler } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Register handler so the Axios interceptor can trigger logout when refresh fails
  useEffect(() => {
    setAuthExpiredHandler(() => setUser(null));
  }, []);

  // Check for existing session on app launch
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('accessToken');
        const stored = await SecureStore.getItemAsync('user');
        if (token && stored) {
          setUser(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Failed to restore session:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const register = async (email, password, firstName, lastName) => {
    const { data } = await api.post('/api/auth/register', {
      email,
      password,
      firstName,
      lastName,
    });
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const loginWithGoogle = async (idToken) => {
    const { data } = await api.post('/api/auth/google', { googleToken: idToken });
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {
      // Ignore — we clear local state regardless
    }
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
