import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './app/contexts/AuthContext';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import AddExpenseScreen from './app/screens/finance/AddExpenseScreen';
import AddAssetScreen from './app/screens/finance/AddAssetScreen';


// ─── IMPORT SCREENS ───────────────────────────────────────────────────────
import LoginScreen from './app/screens/LoginScreen';
import HomeScreen from './app/screens/HomeScreen';
import HivesScreen from './app/screens/HivesScreen';
import QueenScreen from './app/screens/QueenScreen';
import ApiariesScreen from './app/screens/ApiariesScreen'; // Διορθωμένο Path
import InspectionScreen from './app/screens/InspectionScreen';
import ListeningScreen from './app/screens/ListeningScreen';

// Finance Screens
import FinanceScreen from './app/screens/finance/FinanceScreen';
import CreateProductScreen from './app/screens/finance/CreateProductScreen';

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Hives: undefined;
  Queen: undefined;
  Apiaries: undefined;
  Inspection: { hive_id: string; hive_name: string; mode: 'guided' | 'free' };
  Listening: { apiary_id?: string; apiary_name?: string };
  Finance: undefined;
  CreateProduct: undefined;
  AddExpense: { year: number };
  AddAsset: undefined;
  AddProduction: { year: number };
  AddSale: { year: number };
};

const Stack = createStackNavigator<RootStackParamList>();

// ─── PLACEHOLDER FOR PENDING SCREENS ──────────────────────────────────────
const PlaceholderScreen = ({ route }: any) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E7' }}>
    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{route.name}</Text>
    <Text style={{ color: '#888' }}>Η οθόνη αυτή θα υλοποιηθεί σύντομα</Text>
  </View>
);

// ─── NAVIGATOR ────────────────────────────────────────────────────────────
function AppNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    initExecutorch({ resourceFetcher: ExpoResourceFetcher });
  }, []);

  if (loading) return <View style={{ flex: 1, backgroundColor: '#0E1320' }} />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#F5A623' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: '🐝 BeeManager' }} />
          <Stack.Screen name="Hives" component={HivesScreen} options={{ title: '🏠 Κυψέλες' }} />
          <Stack.Screen name="Apiaries" component={ApiariesScreen} options={{ title: '📍 Μελισσοκομεία' }} />
          <Stack.Screen name="Queen" component={QueenScreen} options={{ title: '👑 Βασιλοτροφία' }} />
          <Stack.Screen name="Finance" component={FinanceScreen} options={{ title: '💰 Οικονομικά' }} />
          <Stack.Screen name="CreateProduct" component={CreateProductScreen} options={{ title: '➕ Νέο Προϊόν' }} />
          

          
          {/* Finance Child Screens (Using Placeholders for now) */}

<Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: '💸 Έξοδα' }} />
<Stack.Screen name="AddAsset" component={AddAssetScreen} options={{ title: '🏭 Πάγια' }} />
<Stack.Screen name="AddProduction" component={PlaceholderScreen} options={{ title: '📈 Νέα Παραγωγή' }} />
<Stack.Screen name="AddSale" component={PlaceholderScreen} options={{ title: '💳 Νέα Πώληση' }} />

          <Stack.Screen name="Inspection" component={InspectionScreen} options={{ title: '🔍 Επιθεώρηση' }} />
          <Stack.Screen name="Listening" component={ListeningScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}