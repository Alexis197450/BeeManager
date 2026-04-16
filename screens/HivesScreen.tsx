import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { supabase } from '../supabase';

export default function HivesScreen() {
  const [hives, setHives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newHiveName, setNewHiveName] = useState('');
  const [newHiveType, setNewHiveType] = useState('Langstroth');
  const [newHiveNotes, setNewHiveNotes] = useState('');
  const [newHivePurchaseYear, setNewHivePurchaseYear] = useState('');

  useEffect(() => {
    fetchHives();
  }, []);

  async function fetchHives() {
    const { data } = await supabase.from('hives').select('*');
    if (data) setHives(data);
    setLoading(false);
  }

  async function addHive() {
    if (!newHiveName.trim()) {
      Alert.alert('Σφάλμα', 'Βάλε όνομα για την κυψέλη!');
      return;
    }
    const { error } = await supabase.from('hives').insert({
      name: newHiveName,
      type: newHiveType,
      notes: newHiveNotes,
      purchase_year: newHivePurchaseYear ? parseInt(newHivePurchaseYear) : null,
    });
    if (!error) {
      setModalVisible(false);
      setNewHiveName('');
      setNewHiveType('Langstroth');
      setNewHiveNotes('');
      setNewHivePurchaseYear('');
      fetchHives();
    }
  }

  const hiveTypes = ['Langstroth', 'Dadant', 'Άλλο'];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.addButtonText}>+ Νέα Κυψέλη</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#F5A623" />
      ) : hives.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyText}>Δεν έχεις κυψέλες ακόμα</Text>
          <Text style={styles.emptySubtext}>Πάτα "Νέα Κυψέλη" για να ξεκινήσεις</Text>
        </View>
      ) : (
        <FlatList
          data={hives}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.hiveCard}>
              <Text style={styles.hiveIcon}>🐝</Text>
              <View style={styles.hiveInfo}>
                <Text style={styles.hiveName}>{item.name}</Text>
                <Text style={styles.hiveType}>{item.type}</Text>
                {item.purchase_year ? <Text style={styles.hiveNotes}>Έτος αγοράς: {item.purchase_year}</Text> : null}
                {item.notes ? <Text style={styles.hiveNotes}>{item.notes}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Νέα Κυψέλη</Text>

            <TextInput
              style={styles.input}
              placeholder="Όνομα / Κωδικός (π.χ. Κυψέλη 1)"
              value={newHiveName}
              onChangeText={setNewHiveName}
            />

            <Text style={styles.label}>Τύπος Κυψέλης</Text>
            <View style={styles.typeContainer}>
              {hiveTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, newHiveType === type && styles.typeButtonActive]}
                  onPress={() => setNewHiveType(type)}
                >
                  <Text style={[styles.typeButtonText, newHiveType === type && styles.typeButtonTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Χρονολογία αγοράς (π.χ. 2023)"
              value={newHivePurchaseYear}
              onChangeText={setNewHivePurchaseYear}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Σημειώσεις (προαιρετικό)"
              value={newHiveNotes}
              onChangeText={setNewHiveNotes}
              multiline
            />

            <TouchableOpacity style={styles.saveButton} onPress={addHive}>
              <Text style={styles.saveButtonText}>Αποθήκευση</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Ακύρωση</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E7',
    padding: 20,
  },
  addButton: {
    backgroundColor: '#F5A623',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: { fontSize: 60 },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  hiveCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
  },
  hiveIcon: { fontSize: 40, marginRight: 15 },
  hiveInfo: { flex: 1 },
  hiveName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  hiveType: {
    fontSize: 14,
    color: '#F5A623',
    marginTop: 3,
  },
  hiveNotes: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  typeButton: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#F5A623',
    borderColor: '#F5A623',
  },
  typeButtonText: {
    color: '#888',
    fontSize: 14,
  },
  typeButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  saveButton: {
    backgroundColor: '#F5A623',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 16,
  },
});