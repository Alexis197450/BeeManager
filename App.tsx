import React, { useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './app/contexts/AuthContext';

// ─── IMPORT SCREENS ───────────────────────────────────────────────────────
import LoginScreen          from './app/screens/LoginScreen';
import HomeScreen           from './app/screens/HomeScreen';
import HivesScreen          from './app/screens/HivesScreen';
import QueenScreen          from './app/screens/QueenScreen';
import ApiariesScreen       from './app/screens/ApiariesScreen';
import InspectionScreen     from './app/screens/InspectionScreen';
import HiveDetailScreen     from './app/screens/HiveDetailScreen';
import NucleusScreen        from './app/screens/NucleusScreen';

// Finance Screens
import FinanceScreen        from './app/screens/finance/FinanceScreen';
import CreateProductScreen  from './app/screens/finance/CreateProductScreen';
import AddProductionScreen  from './app/screens/finance/AddProductionScreen';
import AddSaleScreen        from './app/screens/finance/AddSaleScreen';
import AddExpenseScreen     from './app/screens/finance/AddExpenseScreen';
import AddAssetScreen       from './app/screens/finance/AddAssetScreen';
import ProductionCostScreen from './app/screens/finance/ProductionCostScreen';
import InspectionHistoryScreen from './app/screens/InspectionHistoryScreen';
import HarvestHistoryScreen    from './app/screens/HarvestHistoryScreen';

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────
export type RootStackParamList = {
  Login:         undefined;
  Home:          undefined;
  Hives:         undefined;
  Queen:         undefined;
  Nucleus:       undefined;
  Apiaries:      undefined;
  HiveDetail:    { hive_id: string; hive_name: string };
  Inspection:    { hive_id?: string; hive_name?: string; mode?: 'guided' | 'free' | 'manual'; autoRecord?: boolean; editInspection?: any };
  Finance:       undefined;
  CreateProduct: undefined;
  AddExpense:    { year: number };
  AddAsset:      undefined;
  AddProduction: { year: number };
  AddSale:       { year: number };
  ProductionCost:{ year: number };
  InspectionHistory: undefined;
  HarvestHistory:    undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <View style={{ flex: 1, backgroundColor: '#0E1320' }} />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle:      { backgroundColor: '#F5A623' },
        headerTintColor:  '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Home"       component={HomeScreen}       options={{ title: '🐝 BeeManager' }} />
          <Stack.Screen name="Hives"      component={HivesScreen}      options={{ title: '🏠 Κυψέλες' }} />
          <Stack.Screen name="Apiaries"   component={ApiariesScreen}   options={{ title: '📍 Μελισσοκομεία' }} />
          <Stack.Screen name="Queen"      component={QueenScreen}      options={{ title: '👑 Βασιλοτροφία' }} />
          <Stack.Screen name="Nucleus"    component={NucleusScreen}    options={{ title: '🐝 Παραφυάδες' }} />
          <Stack.Screen name="HiveDetail" component={HiveDetailScreen} options={{ title: '🐝 Κυψέλη' }} />
          <Stack.Screen name="InspectionHistory" component={InspectionHistoryScreen} options={{ title: '📋 Ιστορικό Επιθεωρήσεων' }} />
          <Stack.Screen name="HarvestHistory"    component={HarvestHistoryScreen}    options={{ title: '🍯 Ιστορικό Τρύγου' }} />

          {/* ── Finance ── */}
          <Stack.Screen name="Finance"        component={FinanceScreen}        options={{ title: '💰 Οικονομικά' }} />
          <Stack.Screen name="CreateProduct"  component={CreateProductScreen}  options={{ title: '➕ Νέο Προϊόν' }} />
          <Stack.Screen name="AddExpense"     component={AddExpenseScreen}     options={{ title: '💸 Έξοδα' }} />
          <Stack.Screen name="AddAsset"       component={AddAssetScreen}       options={{ title: '🏭 Πάγια' }} />
          <Stack.Screen name="AddSale"        component={AddSaleScreen}        options={{ headerShown: false }} />
          <Stack.Screen name="AddProduction"  component={AddProductionScreen}  options={{ headerShown: false }} />
          <Stack.Screen name="ProductionCost" component={ProductionCostScreen} options={{ headerShown: false }} />

          {/* ── Inspections ── */}
          <Stack.Screen name="Inspection" component={InspectionScreen} options={{ title: '🔍 Επιθεώρηση' }} />
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