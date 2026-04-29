import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import BrazilScreen from '../screens/BrazilScreen';
import CanadaScreen from '../screens/CanadaScreen';
import BulkImportScreen from '../screens/BulkImportScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Brazil: '🇧🇷',
  Canada: '🇨🇦',
  Import: '📥',
  Profile: '👤',
};

function TabIcon({ name, focused }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {TAB_ICONS[name] || '📊'}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#333' },
        tabBarActiveTintColor: '#00d2ff',
        tabBarInactiveTintColor: '#888',
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Canada" component={CanadaScreen} options={{ title: 'Canada' }} />
      <Tab.Screen name="Brazil" component={BrazilScreen} options={{ title: 'Brazil' }} />
      <Tab.Screen name="Import" component={BulkImportScreen} options={{ title: 'Import' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' }}>
        <ActivityIndicator size="large" color="#00d2ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
