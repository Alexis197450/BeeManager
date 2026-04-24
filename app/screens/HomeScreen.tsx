import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen({ navigation }: any) {
  const { signOut, user, fullName } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🐝</Text>
      <Text style={styles.title}>BeeManager</Text>
      <Text style={styles.subtitle}>Γεια σου, {fullName ?? user?.email}</Text>

      <View style={styles.menuContainer}>

        <TouchableOpacity style={[styles.menuButton, styles.menuButtonPrimary]}
          onPress={() => navigation.navigate('Listening', { apiary_name: 'Μελισσοκομείο' })}>
          <Text style={styles.menuIcon}>🎙️</Text>
          <Text style={[styles.menuText, { color: '#fff' }]}>Έναρξη Επιθεώρησης</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton}
          onPress={() => navigation.navigate('Hives')}>
          <Text style={styles.menuIcon}>🏠</Text>
          <Text style={styles.menuText}>Κυψέλες</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton}
          onPress={() => navigation.navigate('Apiaries')}>
          <Text style={styles.menuIcon}>📍</Text>
          <Text style={styles.menuText}>Μελισσοκομεία</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton}
          onPress={() => navigation.navigate('Queen')}>
          <Text style={styles.menuIcon}>👑</Text>
          <Text style={styles.menuText}>Βασιλοτροφία</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton}
          onPress={() => navigation.navigate('Finance')}>
          <Text style={styles.menuIcon}>💰</Text>
          <Text style={styles.menuText}>Οικονομικά</Text>
        </TouchableOpacity>

      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
        <Text style={styles.logoutText}>Αποσύνδεση</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo:     { fontSize: 80 },
  title:    { fontSize: 32, fontWeight: 'bold', color: '#F5A623', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 40 },

  menuContainer: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 20,
  },
  menuButton: {
    backgroundColor: '#fff', width: 140, height: 140,
    borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 5,
  },
  menuButtonPrimary: {
    backgroundColor: '#F5A623', width: 300, height: 100,
  },
  menuIcon: { fontSize: 40 },
  menuText: { fontSize: 15, fontWeight: 'bold', color: '#333', marginTop: 8, textAlign: 'center' },

  logoutBtn:  { marginTop: 40, padding: 12 },
  logoutText: { color: '#aaa', fontSize: 14, textDecorationLine: 'underline' },
});