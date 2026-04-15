import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from './screens/HomeScreen';
import HivesScreen from './screens/HivesScreen';
import QueenScreen from './screens/QueenScreen';
import FinanceScreen from './screens/FinanceScreen';
import ApiariesScreen from './screens/ApiariesScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#F5A623' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: '🐝 BeeManager' }} />
        <Stack.Screen name="Hives" component={HivesScreen} options={{ title: '🏠 Κυψέλες' }} />
        <Stack.Screen name="Queen" component={QueenScreen} options={{ title: '👑 Βασιλοτροφία' }} />
        <Stack.Screen name="Finance" component={FinanceScreen} options={{ title: '💰 Οικονομικά' }} />
        <Stack.Screen name="Apiaries" component={ApiariesScreen} options={{ title: '📍 Μελισσοκομεία' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}