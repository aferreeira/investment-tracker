// Backend API URL — update this to your machine's local IP when testing on a real device.
// "localhost" only works in iOS Simulator. For Android emulator, use 10.0.2.2.
// For a real phone on the same Wi-Fi, use your computer's LAN IP (e.g. 192.168.1.x).

import { Platform } from 'react-native';

const getBaseUrl = () => {
  const MANUAL_IP = 'http://10.0.0.168:9100'; // Set this if testing on a real device

  if (MANUAL_IP) return MANUAL_IP;

  if (Platform.OS === 'android') {
    // Android emulator maps 10.0.2.2 to host machine's localhost
    return 'http://10.0.2.2:9100';
  }

  // iOS simulator can use localhost
  return 'http://localhost:9100';
};

export const API_BASE_URL = getBaseUrl();

// Web client ID (same as your web frontend — used for token verification on the backend)
export const GOOGLE_WEB_CLIENT_ID = '';

// iOS client ID — created in Google Cloud Console for bundle ID "com.investmenttracker.mobile"
// TODO: Replace with the Client ID from Google Cloud Console for your development build
export const GOOGLE_IOS_CLIENT_ID = ''; // Paste your iOS client ID here
