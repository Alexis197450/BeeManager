import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../supabase'; // Διορθωμένο Import

export default function ApiariesScreen() {
  const [apiaries, setApiaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingApiary, setEditingApiary] = useState<any>(null);
  
  // Form States
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
    setLoading(true);
    const { data, error } = await supabase.from('apiaries').select('*').order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Σφάλμα', 'Αποτυχία φόρτωσης μελισσοκομείων');
    } else {
      setApiaries(data || []);
    }
    setLoading(false);
  }

  async function getGPS() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Σφάλμα', 'Δεν δόθηκε άδεια για πρόσβαση στην τοποθεσία');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
    } catch (err) {
      Alert.alert('Σφάλμα', 'Αποτυχία λήψης GPS');
    } finally {
      setGpsLoading(false);
    }
  }

  const saveApiary = async () => {
    if (!name.trim()) {
      Alert.alert('Προσοχή', 'Το όνομα είναι υποχρεωτικό');
      return;
    }

    const payload = {
      name,
      location,
      forage,
      notes,
      arrived_at: arrivedAt || null,
      departed_at: departedAt || null,
      latitude,
      longitude,
      user_id: (await supabase.auth.getUser()).data.user?.id
    };

    let error;
    if (editingApiary) {
      const { error: err } = await supabase.from('apiaries').update(payload).eq('id', editingApiary.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('apiaries').insert(payload);
      error = err;
    }

    if (error) {
      Alert.alert('Σφάλμα', 'Η αποθήκευση απέτυχε');
    } else {
      setModalVisible(false);
      fetchApiaries();
    }
  };

  const deleteApiary = (id: string) => {
    Alert.alert('Διαγραφή', 'Είσαι σίγουρος;', [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
          await supabase.from('apiaries').delete().eq('id', id);
          fetchApiaries();
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={() => { setEditingApiary(null); setModalVisible(true); }}>
        <Text style={styles.addButtonText}>+ Νέο Μελισσοκομείο</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#F5A623" />
      ) : (
        <FlatList
          data={apiaries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.apiaryCard}>
              <View style={styles.apiaryInfo}>
                <Text style={styles.apiaryName}>📍 {item.name}</Text>
                {item.forage && <Text style={styles.apiaryDetail}>🌸 Νομή: {item.forage}</Text>}
                {item.location && <Text style={styles.apiaryDetail}>📌 {item.location}</Text>}
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity onPress={() => { setEditingApiary(item); setModalVisible(true); setName(item.name); }}>
                  <Text style={{ fontSize: 20 }}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteApiary(item.id)}>
                  <Text style={{ fontSize: 20 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={modalVisible} animationType="slide">
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Text style={styles.modalTitle}>{editingApiary ? 'Επεξεργασία' : 'Νέο Μελισσοκομείο'}</Text>
          <TextInput style={styles.input} placeholder="Όνομα" value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Τοποθεσία" value={location} onChangeText={setLocation} />
          <TextInput style={styles.input} placeholder="Νομή (π.χ. Θυμάρι)" value={forage} onChangeText={setForage} />
          
          <TouchableOpacity style={styles.gpsButton} onPress={getGPS} disabled={gpsLoading}>
            <Text style={styles.gpsButtonText}>{gpsLoading ? '📡 Λήψη...' : '📡 Καταγραφή GPS'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveButton} onPress={saveApiary}>
            <Text style={styles.saveButtonText}>Αποθήκευση</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={styles.cancelButtonText}>Ακύρωση</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7', padding: 20 },
  addButton: { backgroundColor: '#F5A623', padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 20 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  apiaryCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', elevation: 2 },
  apiaryInfo: { flex: 1 },
  apiaryName: { fontSize: 18, fontWeight: 'bold' },
  apiaryDetail: { color: '#666', marginTop: 4 },
  actionButtons: { flexDirection: 'row', gap: 15, alignItems: 'center' },
  modalContent: { padding: 25, backgroundColor: '#fff', flexGrow: 1 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 15 },
  gpsButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  gpsButtonText: { color: '#fff', fontWeight: 'bold' },
  saveButton: { backgroundColor: '#F5A623', padding: 15, borderRadius: 10, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: 'bold' },
  cancelButtonText: { textAlign: 'center', color: '#888', marginTop: 15 }
});