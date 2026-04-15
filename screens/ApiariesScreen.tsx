import { View, Text, StyleSheet } from 'react-native';

export default function ApiariesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.title}>Μελισσοκομεία</Text>
      <Text style={styles.subtitle}>Εδώ θα διαχειρίζεσαι τα μελισσοκομεία σου</Text>
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
  icon: { fontSize: 80 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F5A623',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginTop: 10,
  },
});