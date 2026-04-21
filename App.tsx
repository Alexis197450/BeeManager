import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, StackScreenProps } from '@react-navigation/stack';
import { View, Text } from 'react-native';
import { AuthProvider, useAuth } from './AuthContext';
import HomeScreen from './screens/HomeScreen';
import HivesScreen from './screens/HivesScreen';
import QueenScreen from './screens/QueenScreen';
import FinanceScreen from './app/screens/finance/FinanceScreen';
import ApiariesScreen from './screens/ApiariesScreen';
import InspectionScreen from './screens/InspectionScreen';
import LoginScreen from './screens/LoginScreen';
import ListeningScreen from './screens/ListeningScreen';
import { initExecutorch } from 'react-native-executorch';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import CreateProductScreen from './app/screens/finance/CreateProductScreen.tsx';

// ─── TYPE DEFINITIONS ─────────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Hives: undefined;
  Queen: undefined;
  Apiaries: undefined;
  Inspection: {
    hive_id: string;
    hive_name: string;
    mode: 'guided' | 'free';
  };
  Listening: {
    apiary_id?: string;
    apiary_name?: string;
  };
  
  // ✅ FINANCE MODULE SCREENS
  Finance: undefined;
  CreateProduct: undefined;
  AddExpense: { year: number };
  AddAsset: undefined;
  AddProduction: { year: number };
  AddSale: { year: number };
};

const Stack = createStackNavigator<RootStackParamList>();

// ─── PLACEHOLDER SCREENS (TODO - Create these later) ─────────────────────

// Temporary placeholders until screens are created
const PlaceholderScreen = ({ route }: any) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text>{route.name} - Screen Coming Soon</Text>
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
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          {/* Main Screens */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: '🐝 BeeManager' }}
          />
          <Stack.Screen
            name="Hives"
            component={HivesScreen}
            options={{ title: '🏠 Κυψέλες' }}
          />
          <Stack.Screen
            name="Queen"
            component={QueenScreen}
            options={{ title: '👑 Βασιλοτροφία' }}
          />
          
          {/* ✅ Finance Module - Main Screen */}
          <Stack.Screen
            name="Finance"
            component={FinanceScreen}
            options={{ title: '💰 Οικονομικά' }}
          />
          
          {/* ⏳ Finance Module - Child Screens (TODO) */}
          <Stack.Screen
            name="CreateProduct"
            component={PlaceholderScreen}
            options={{ title: '➕ Νέο Προϊόν' }}
          />
          <Stack.Screen
            name="AddExpense"
            component={PlaceholderScreen}
            options={{ title: '💸 Νέο Έξοδο' }}
          />
          <Stack.Screen
            name="AddAsset"
            component={PlaceholderScreen}
            options={{ title: '🏭 Νέο Πάγιο' }}
          />
          <Stack.Screen
            name="AddProduction"
            component={PlaceholderScreen}
            options={{ title: '📈 Νέα Παραγωγή' }}
          />
          <Stack.Screen
            name="AddSale"
            component={PlaceholderScreen}
            options={{ title: '💳 Νέα Πώληση' }}
          />
          
          {/* Other Main Screens */}
          <Stack.Screen
            name="Apiaries"
            component={ApiariesScreen}
            options={{ title: '📍 Μελισσοκομεία' }}
          />
          <Stack.Screen
            name="Inspection"
            component={InspectionScreen}
            options={{ title: '🔍 Επιθεώρηση' }}
          />
          <Stack.Screen
            name="Listening"
            component={ListeningScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}