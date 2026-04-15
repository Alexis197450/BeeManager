import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

export default function HomeScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🐝</Text>
      <Text style={styles.title}>BeeManager</Text>
      <Text style={styles.subtitle}>Διαχείριση Μελισσοκομείου</Text>

      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Hives')}>
          <Text style={styles.menuIcon}>🏠</Text>
          <Text style={styles.menuText}>Κυψέλες</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Queen')}>
          <Text style={styles.menuIcon}>👑</Text>
          <Text style={styles.menuText}>Βασιλοτροφία</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Finance')}>
          <Text style={styles.menuIcon}>💰</Text>
          <Text style={styles.menuText}>Οικονομικά</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Apiaries')}>
          <Text style={styles.menuIcon}>📍</Text>
          <Text style={styles.menuText}>Μελισσοκομεία</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { fontSize: 80 },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F5A623',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 40,
  },
  menuContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
  },
  menuButton: {
    backgroundColor: '#fff',
    width: 140,
    height: 140,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  menuIcon: { fontSize: 40 },
  menuText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
});