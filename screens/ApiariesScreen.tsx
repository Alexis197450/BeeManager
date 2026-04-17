import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../supabase';

export default function ApiariesScreen() {
  const [apiaries, setApiaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingApiary, setEditingApiary] = useState<any>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [forage, setForage] = useState('');
  const [notes, setNotes] = useState('');
  const [arrivedAt, setArrivedAt] = useState('');
  const [departedAt, setDepartedAt] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => { fetchApiaries(); }, []);

  async function fetchApiaries() {
    const { data } = await supabase.from('apiaries').select('*');
    if (data) setApiaries(data);
    setLoading(false);
  }

  async function getGPS() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Σφάλμα', 'Δεν δόθηκε άδεια για GPS!');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      Alert.alert('✅ GPS', `Τοποθεσία καταγράφηκε!\n${loc.coords.latitude.toFixed(6)}, ${loc.coords.longitude.toFixed(6)}`);
    } catch {
      Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η λήψη GPS!');
    } finally {
      setGpsLoading(false);
    }
  }

  function openAddModal() {
    setEditingApiary(null);
    setName('');
    setLocation('');
    setForage('');
    setNotes('');
    setArrivedAt('');
    setDepartedAt('');
    setLatitude(null);
    setLongitude(null);
    setModalVisible(true);
  }

  function openEditModal(apiary: any) {
    setEditingApiary(apiary);
    setName(apiary.name);
    setLocation(apiary.location || '');
    setForage(apiary.forage || '');
    setNotes(apiary.notes || '');
    setArrivedAt(apiary.arrived_at || '');
    setDepartedAt(apiary.departed_at || '');
    setLatitude(apiary.latitude || null);
    setLongitude(apiary.longitude || null);
    setModalVisible(true);
  }

  async function saveApiary() {
    if (!name.trim()) {
      Alert.alert('Σφάλμα', 'Βάλε όνομα για το μελισσοκομείο!');
      return;
    }
    const apiaryData = {
      name,
      location,
      forage,
      notes,
      latitude,
      longitude,
    };
    if (editingApiary) {
      await supabase.from('apiaries').update(apiaryData).eq('id', editingApiary.id);
    } else {
      await supabase.from('apiaries').insert(apiaryData);
    }
    setModalVisible(false);
    fetchApiaries();
  }

  async function deleteApiary(id: string) {
    Alert.alert(
      'Διαγραφή Μελισσοκομείου',
      'Είσαι σίγουρος; Η ενέργεια δεν αναιρείται!',
      [
        { text: 'Ακύρωση', style: 'cancel' },
        { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
          await supabase.from('apiaries').delete().eq('id', id);
          fetchApiaries();
        }},
      ]
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
        <Text style={styles.addButtonText}>+ Νέο Μελισσοκομείο</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#F5A623" />
      ) : apiaries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyText}>Δεν έχεις μελισσοκομεία ακόμα</Text>
          <Text style={styles.emptySubtext}>Πάτα "Νέο Μελισσοκομείο" για να ξεκινήσεις</Text>
        </View>
      ) : (
        <FlatList
          data={apiaries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.apiaryCard}>
              <Text style={styles.apiaryIcon}>📍</Text>
              <View style={styles.apiaryInfo}>
                <Text style={styles.apiaryName}>{item.name}</Text>
                {item.location ? <Text style={styles.apiaryDetail}>📌 {item.location}</Text> : null}
                {item.forage ? <Text style={styles.apiaryDetail}>🌸 Νομή: {item.forage}</Text> : null}
                {item.arrived_at ? <Text style={styles.apiaryDetail}>📅 Άφιξη: {item.arrived_at}</Text> : null}
                {item.departed_at ? <Text style={styles.apiaryDetail}>📅 Αναχώρηση: {item.departed_at}</Text> : null}
                {item.latitude ? <Text style={styles.apiaryDetail}>🗺️ GPS: {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}</Text> : null}
                {item.notes ? <Text style={styles.apiaryNotes}>{item.notes}</Text> : null}
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item)}>
                  <Text style={styles.editButtonText}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteApiary(item.id)}>
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingApiary ? 'Επεξεργασία Μελισσοκομείου' : 'Νέο Μελισσοκομείο'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Όνομα μελισσοκομείου"
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={styles.input}
              placeholder="Τοποθεσία (π.χ. Χαλκιδική)"
              value={location}
              onChangeText={setLocation}
            />

            <TextInput
              style={styles.input}
              placeholder="Νομή (π.χ. Θυμάρι, Ελάτη)"
              value={forage}
              onChangeText={setForage}
            />

            <TextInput
              style={styles.input}
              placeholder="Ημερομηνία Άφιξης (π.χ. 2025-04-01)"
              value={arrivedAt}
              onChangeText={setArrivedAt}
            />

            <TextInput
              style={styles.input}
              placeholder="Ημερομηνία Αναχώρησης (προαιρετικό)"
              value={departedAt}
              onChangeText={setDepartedAt}
            />

            <TouchableOpacity
              style={[styles.gpsButton, gpsLoading && styles.gpsButtonLoading]}
              onPress={getGPS}
              disabled={gpsLoading}
            >
              <Text style={styles.gpsButtonText}>
                {gpsLoading ? '📡 Λήψη GPS...' : latitude ? `✅ GPS: ${latitude.toFixed(4)}, ${longitude?.toFixed(4)}` : '📡 Καταγραφή GPS Τοποθεσίας'}
              </Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Σημειώσεις (προαιρετικό)"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveApiary}>
              <Text style={styles.saveButtonText}>
                {editingApiary ? 'Αποθήκευση Αλλαγών' : 'Αποθήκευση'}
              </Text>
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
  container: { flex: 1, backgroundColor: '#FFF8E7', padding: 20 },
  addButton: { backgroundColor: '#F5A623', padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 20 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 60 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 15 },
  emptySubtext: { fontSize: 14, color: '#888', marginTop: 8 },
  apiaryCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  apiaryIcon: { fontSize: 40, marginRight: 15 },
  apiaryInfo: { flex: 1 },
  apiaryName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  apiaryDetail: { fontSize: 14, color: '#666', marginTop: 3 },
  apiaryNotes: { fontSize: 13, color: '#888', marginTop: 3 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  editButton: { padding: 8, borderRadius: 8, backgroundColor: '#FFF3E0' },
  editButtonText: { fontSize: 20 },
  deleteButton: { padding: 8, borderRadius: 8, backgroundColor: '#FFEBEE' },
  deleteButtonText: { fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25, maxHeight: '90%' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 15 },
  gpsButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  gpsButtonLoading: { backgroundColor: '#888' },
  gpsButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  saveButton: { backgroundColor: '#F5A623', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { padding: 15, alignItems: 'center', marginBottom: 20 },
  cancelButtonText: { color: '#888', fontSize: 16 },
});