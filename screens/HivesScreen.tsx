import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { supabase } from '../supabase';
import { useLock } from '../hooks/useLock';
import { useAuth } from '../AuthContext';

export default function HivesScreen({ navigation }: any) {
  const { user } = useAuth();
  const { isLockedByOther, isLockedByMe, getLockStatus } = useLock();

  const [hives, setHives] = useState<any[]>([]);
  const [lockLabels, setLockLabels] = useState<{ [id: string]: string | null }>({});
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHive, setEditingHive] = useState<any>(null);
  const [newHiveName, setNewHiveName] = useState('');
  const [newHiveType, setNewHiveType] = useState('Langstroth');
  const [newHiveFloor, setNewHiveFloor] = useState('');
  const [newHiveBroodBox, setNewHiveBroodBox] = useState('Κλασσική Langstroth');
  const [newHiveNotes, setNewHiveNotes] = useState('');
  const [newHivePurchaseYear, setNewHivePurchaseYear] = useState('');

  useEffect(() => { fetchHives(); }, []);

  async function fetchHives() {
    const { data } = await supabase
      .from('hives')
      .select('*')
      .order('name');
    if (data) {
      setHives(data);
      // Φόρτωσε lock labels για κλειδωμένες κυψέλες
      const labels: { [id: string]: string | null } = {};
      for (const hive of data) {
        if (hive.locked_by) {
          labels[hive.id] = await getLockStatus(hive.locked_by, hive.locked_at);
        }
      }
      setLockLabels(labels);
    }
    setLoading(false);
  }

  function openAddModal() {
    setEditingHive(null);
    setNewHiveName('');
    setNewHiveType('Langstroth');
    setNewHiveFloor('');
    setNewHiveBroodBox('Κλασσική Langstroth');
    setNewHiveNotes('');
    setNewHivePurchaseYear('');
    setModalVisible(true);
  }

  function openEditModal(hive: any) {
    setEditingHive(hive);
    setNewHiveName(hive.name);
    setNewHiveType(hive.type);
    setNewHiveFloor(hive.floor_type || '');
    setNewHiveBroodBox(hive.brood_box_type || 'Κλασσική Langstroth');
    setNewHiveNotes(hive.notes || '');
    setNewHivePurchaseYear(hive.purchase_year ? String(hive.purchase_year) : '');
    setModalVisible(true);
  }

  async function saveHive() {
    if (!newHiveName.trim()) {
      Alert.alert('Σφάλμα', 'Βάλε όνομα για την κυψέλη!');
      return;
    }
    if (editingHive) {
      const { error } = await supabase.from('hives').update({
        name: newHiveName,
        type: newHiveType,
        floor_type: newHiveFloor,
        brood_box_type: newHiveBroodBox,
        notes: newHiveNotes,
        purchase_year: newHivePurchaseYear ? parseInt(newHivePurchaseYear) : null,
      }).eq('id', editingHive.id);
      if (!error) { setModalVisible(false); fetchHives(); }
    } else {
      const { error } = await supabase.from('hives').insert({
        name: newHiveName,
        type: newHiveType,
        floor_type: newHiveFloor,
        brood_box_type: newHiveBroodBox,
        notes: newHiveNotes,
        purchase_year: newHivePurchaseYear ? parseInt(newHivePurchaseYear) : null,
      });
      if (!error) { setModalVisible(false); fetchHives(); }
    }
  }

  async function deleteHive(id: string) {
    Alert.alert(
      'Διαγραφή Κυψέλης',
      'Είσαι σίγουρος; Η ενέργεια δεν αναιρείται!',
      [
        { text: 'Ακύρωση', style: 'cancel' },
        { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
          await supabase.from('hives').delete().eq('id', id);
          fetchHives();
        }},
      ]
    );
  }

  function handleHivePress(item: any) {
    // Αν είναι κλειδωμένη από άλλον → εμφάνισε μήνυμα
    if (isLockedByOther(item.locked_by, item.locked_at)) {
      const label = lockLabels[item.id] ?? 'Άλλος χρήστης';
      Alert.alert(
        '🔒 Κυψέλη σε επιθεώρηση',
        `Αυτή η κυψέλη επιθεωρείται από ${label.replace('🔒 ', '')}.\n\nΑποδεσμεύεται αυτόματα μετά από 30 λεπτά.`,
        [{ text: 'OK' }]
      );
      return;
    }
    // Αλλιώς πήγαινε στην επιθεώρηση
    navigation.navigate('Inspection', {
      hive_id: item.id,
      hive_name: item.name,
    });
  }

  const isClassic = newHiveBroodBox === 'Κλασσική Langstroth' || newHiveBroodBox === 'Κλασσική Dadant';
  const hiveTypes = ['Langstroth', 'Dadant', 'Πλαστική'];
  const broodBoxTypes = ['Κλασσική Langstroth', 'Κλασσική Dadant', 'Με κινητό πάτο', 'Πλαστική'];
  const floorTypes = ['Αεριζόμενος πλαστικός', 'Πλαστικός κλειστός', 'Ξύλινος'];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
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
          renderItem={({ item }) => {
            const lockedByOther = isLockedByOther(item.locked_by, item.locked_at);
            const lockedByMe    = isLockedByMe(item.locked_by);
            const lockLabel     = lockLabels[item.id];

            return (
              <TouchableOpacity
                style={[
                  styles.hiveCard,
                  lockedByOther && styles.hiveCardLocked,
                  lockedByMe    && styles.hiveCardLockedByMe,
                ]}
                onPress={() => handleHivePress(item)}
              >
                <Text style={styles.hiveIcon}>🐝</Text>

                <View style={styles.hiveInfo}>
                  <View style={styles.hiveNameRow}>
                    <Text style={styles.hiveName}>{item.name}</Text>
                    {/* Lock indicator */}
                    {lockLabel && (
                      <Text style={[
                        styles.lockBadge,
                        lockedByMe ? styles.lockBadgeMe : styles.lockBadgeOther,
                      ]}>
                        {lockLabel}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.hiveType}>{item.type}</Text>
                  {item.brood_box_type ? <Text style={styles.hiveNotes}>Γονοφωλιά: {item.brood_box_type}</Text> : null}
                  {item.floor_type     ? <Text style={styles.hiveNotes}>Πάτος: {item.floor_type}</Text> : null}
                  {item.purchase_year  ? <Text style={styles.hiveNotes}>Έτος αγοράς: {item.purchase_year}</Text> : null}
                  {item.notes          ? <Text style={styles.hiveNotes}>{item.notes}</Text> : null}
                </View>

                {/* Εμφάνισε edit/delete μόνο αν δεν είναι κλειδωμένη από άλλον */}
                {!lockedByOther && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={(e) => { e.stopPropagation(); openEditModal(item); }}
                    >
                      <Text style={styles.editButtonText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={(e) => { e.stopPropagation(); deleteHive(item.id); }}
                    >
                      <Text style={styles.deleteButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal προσθήκης/επεξεργασίας */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingHive ? 'Επεξεργασία Κυψέλης' : 'Νέα Κυψέλη'}
            </Text>

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

            <Text style={styles.label}>Τύπος Γονοφωλιάς</Text>
            <View style={styles.typeContainer}>
              {broodBoxTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeButton, newHiveBroodBox === type && styles.typeButtonActive]}
                  onPress={() => {
                    setNewHiveBroodBox(type);
                    if (type === 'Κλασσική Langstroth' || type === 'Κλασσική Dadant') {
                      setNewHiveFloor('');
                    }
                  }}
                >
                  <Text style={[styles.typeButtonText, newHiveBroodBox === type && styles.typeButtonTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {!isClassic && (
              <>
                <Text style={styles.label}>Τύπος Πάτου</Text>
                <View style={styles.typeContainer}>
                  {floorTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeButton, newHiveFloor === type && styles.typeButtonActive]}
                      onPress={() => setNewHiveFloor(type)}
                    >
                      <Text style={[styles.typeButtonText, newHiveFloor === type && styles.typeButtonTextActive]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="Χρονολογία αγοράς (π.χ. 2023)"
              value={newHivePurchaseYear}
              onChangeText={setNewHivePurchaseYear}
              keyboardType="numeric"
            />

            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              placeholder="Σημειώσεις (προαιρετικό)"
              value={newHiveNotes}
              onChangeText={setNewHiveNotes}
              multiline
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveHive}>
              <Text style={styles.saveButtonText}>
                {editingHive ? 'Αποθήκευση Αλλαγών' : 'Αποθήκευση'}
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
  container:       { flex: 1, backgroundColor: '#FFF8E7', padding: 20 },
  addButton:       { backgroundColor: '#F5A623', padding: 15, borderRadius: 15, alignItems: 'center', marginBottom: 20 },
  addButtonText:   { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  emptyContainer:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon:       { fontSize: 60 },
  emptyText:       { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 15 },
  emptySubtext:    { fontSize: 14, color: '#888', marginTop: 8 },

  hiveCard:          { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  hiveCardLocked:    { backgroundColor: '#FFF3F3', borderWidth: 1, borderColor: '#FFCDD2' },
  hiveCardLockedByMe:{ backgroundColor: '#F3FFF3', borderWidth: 1, borderColor: '#C8E6C9' },

  hiveNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  hiveIcon:    { fontSize: 40, marginRight: 15 },
  hiveInfo:    { flex: 1 },
  hiveName:    { fontSize: 18, fontWeight: 'bold', color: '#333' },
  hiveType:    { fontSize: 14, color: '#F5A623', marginTop: 3 },
  hiveNotes:   { fontSize: 13, color: '#888', marginTop: 3 },

  lockBadge:      { fontSize: 11, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  lockBadgeOther: { backgroundColor: '#FFCDD2', color: '#C62828' },
  lockBadgeMe:    { backgroundColor: '#C8E6C9', color: '#2E7D32' },

  actionButtons:    { flexDirection: 'row', gap: 8 },
  editButton:       { padding: 8, borderRadius: 8, backgroundColor: '#FFF3E0' },
  editButtonText:   { fontSize: 20 },
  deleteButton:     { padding: 8, borderRadius: 8, backgroundColor: '#FFEBEE' },
  deleteButtonText: { fontSize: 20 },

  label:               { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  typeContainer:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  typeButton:          { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  typeButtonActive:    { backgroundColor: '#F5A623', borderColor: '#F5A623' },
  typeButtonText:      { color: '#888', fontSize: 14 },
  typeButtonTextActive:{ color: '#fff', fontWeight: 'bold' },

  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent:  { backgroundColor: '#fff', borderRadius: 20, padding: 25, maxHeight: '80%' },
  modalTitle:    { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  input:         { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 15 },
  saveButton:    { backgroundColor: '#F5A623', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  saveButtonText:{ color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton:  { padding: 15, alignItems: 'center', marginBottom: 20 },
  cancelButtonText: { color: '#888', fontSize: 16 },
});