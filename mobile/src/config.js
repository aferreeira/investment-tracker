// Backend API URL and Google OAuth credentials are loaded from environment variables
// See .env.local.example for configuration

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getBaseUrl = () => {
  // Try to get from app.json extra (set via .env)
  const envUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (envUrl) return envUrl;

  // Fallback based on platform
  if (Platform.OS === 'android') {
    // Android emulator maps 10.0.2.2 to host machine's localhost
    return 'http://10.0.2.2:9100';
  }

  // iOS simulator can use localhost
  return 'http://localhost:9100';
};

export const API_BASE_URL = getBaseUrl();

// Google OAuth credentials from environment variables
export const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleWebClientId || 'NOT_SET';
export const GOOGLE_IOS_CLIENT_ID = Constants.expoConfig?.extra?.googleIosClientId || 'NOT_SET';
