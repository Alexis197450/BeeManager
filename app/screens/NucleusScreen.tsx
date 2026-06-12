// app/screens/NucleusScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { supabase } from '../supabase';

const C = {
  primary: '#F59E0B', primaryDark: '#D97706', primaryLight: '#FEF3C7',
  bg: '#FFFBF0', card: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', textSub: '#6B7280', textLight: '#9CA3AF',
  green: '#16A34A', greenLight: '#DCFCE7',
  red: '#DC2626', redLight: '#FEE2E2',
  blue: '#2563EB', blueLight: '#DBEAFE',
};

type HiveType = 'nucleus' | 'mating' | 'q8';

const HIVE_TYPE_LABELS: Record<HiveType, string> = {
  nucleus: '🐝 Παραφυάδες',
  mating:  '💑 Κυψελίδια Σύζευξης',
  q8:      '🔬 Q8',
};

const HIVE_TYPE_COLORS: Record<HiveType, string> = {
  nucleus: '#F59E0B',
  mating:  '#8B5CF6',
  q8:      '#06B6D4',
};

const QUEEN_BREEDS = [
  'Μακεδονική', 'Κεκροπία', 'Καρνιόλα', 'Καυκάσια',
  'Ιταλική', 'Βουκελία', 'Τοπική', 'Άλλη',
];

const QUEEN_ORIGINS = [
  'Βασιλοτροφία', 'Ορφάνιας', 'Σμηνουργίας', 'Αγορά', 'Δώρο',
];

interface Colony {
  id: string;
  name: string;
  hive_type: HiveType;
  status: string;
  queen_breed: string | null;
  queen_origin: string | null;
  queen_year: number | null;
  notes: string | null;
  parent_hive_id: string | null;
  method_origin: string | null;
  created_at: string;
  // Για nucleus — αριθμός πλαισίων
  population_frames?: number | null;
}

export default function NucleusScreen({ navigation }: any) {
  const [activeTab, setActiveTab]     = useState<HiveType>('nucleus');
  const [colonies, setColonies]       = useState<Colony[]>([]);
  const [loading, setLoading]         = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Colony | null>(null);

  // Form state
  const [name,         setName]         = useState('');
  const [queenBreed,   setQueenBreed]   = useState('');
  const [queenOrigin,  setQueenOrigin]  = useState('');
  const [queenYear,    setQueenYear]    = useState('');
  const [frames,       setFrames]       = useState('');
  const [notes,        setNotes]        = useState('');

  useEffect(() => { fetchColonies(); }, [activeTab]);

  async function fetchColonies() {
    setLoading(true);
    const { data } = await supabase
      .from('hives')
      .select('*')
      .eq('hive_type', activeTab)
      .eq('status', 'active')
      .order('name');
    setColonies((data ?? []) as Colony[]);
    setLoading(false);
  }

  function openAddModal() {
    setEditingItem(null);
    setName(''); setQueenBreed(''); setQueenOrigin('');
    setQueenYear(''); setFrames(''); setNotes('');
    setModalVisible(true);
  }

  function openEditModal(item: Colony) {
    setEditingItem(item);
    setName(item.name);
    setQueenBreed(item.queen_breed ?? '');
    setQueenOrigin(item.queen_origin ?? '');
    setQueenYear(item.queen_year ? String(item.queen_year) : '');
    setFrames(item.population_frames ? String(item.population_frames) : '');
    setNotes(item.notes ?? '');
    setModalVisible(true);
  }

  async function saveColony() {
    if (!name.trim()) { Alert.alert('Σφάλμα', 'Βάλε όνομα.'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload: any = {
      name: name.trim(),
      hive_type: activeTab,
      type: activeTab,
      status: 'active',
      queen_breed:  queenBreed  || null,
      queen_origin: queenOrigin || null,
      queen_year:   queenYear   ? parseInt(queenYear)  : null,
      notes:        notes       || null,
      user_id:      user.id,
    };

    // Αριθμός πλαισίων μόνο για nucleus
    if (activeTab === 'nucleus' && frames) {
      payload.population_strength = null; // δεν χρησιμοποιούμε αυτό εδώ
    }

    if (editingItem) {
      const { error } = await supabase.from('hives').update(payload).eq('id', editingItem.id);
      if (error) { Alert.alert('Σφάλμα', error.message); return; }
    } else {
      const { error } = await supabase.from('hives').insert(payload);
      if (error) { Alert.alert('Σφάλμα', error.message); return; }
    }

    setModalVisible(false);
    fetchColonies();
  }

  async function deleteColony(id: string) {
    Alert.alert('Διαγραφή', 'Είσαι σίγουρος;', [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
        await supabase.from('hives').update({ status: 'deleted' }).eq('id', id);
        fetchColonies();
      }},
    ]);
  }

  async function transferToProduction(item: Colony) {
    Alert.alert(
      '🔄 Μεταφορά σε Παραγωγικό',
      `Θέλεις να μεταφέρεις "${item.name}" στα παραγωγικά μελίσσια;`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        { text: 'Μεταφορά', onPress: async () => {
          await supabase.from('hives').update({
            hive_type: 'production',
            type: 'Langstroth',
          }).eq('id', item.id);
          fetchColonies();
          Alert.alert('✅', `Η "${item.name}" μεταφέρθηκε στα παραγωγικά.`);
        }},
      ],
    );
  }

  const tabColor = HIVE_TYPE_COLORS[activeTab];

  return (
    <View style={s.container}>
      {/* Tabs */}
      <View style={s.tabs}>
        {(Object.keys(HIVE_TYPE_LABELS) as HiveType[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && { backgroundColor: HIVE_TYPE_COLORS[tab], borderColor: HIVE_TYPE_COLORS[tab] }]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabTxt, activeTab === tab && { color: '#fff', fontWeight: '700' }]}>
              {HIVE_TYPE_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Add button */}
      <TouchableOpacity style={[s.addBtn, { backgroundColor: tabColor }]} onPress={openAddModal} activeOpacity={0.85}>
        <Text style={s.addBtnTxt}>+ Νέο {activeTab === 'nucleus' ? 'Παραφυάδα' : activeTab === 'mating' ? 'Κυψελίδιο' : 'Q8'}</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color={tabColor} style={{ marginTop: 40 }} />
      ) : colonies.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>{activeTab === 'nucleus' ? '🐝' : activeTab === 'mating' ? '💑' : '🔬'}</Text>
          <Text style={s.emptyText}>Δεν υπάρχουν {HIVE_TYPE_LABELS[activeTab]}</Text>
        </View>
      ) : (
        <FlatList
          data={colonies}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[s.card, { borderLeftColor: tabColor }]}>
              <View style={s.cardHeader}>
                <Text style={s.cardName}>{item.name}</Text>
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.actionBtn} onPress={() => openEditModal(item)}>
                    <Text style={s.actionBtnTxt}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#DCFCE7' }]} onPress={() => transferToProduction(item)}>
                    <Text style={s.actionBtnTxt}>🔄</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.redLight }]} onPress={() => deleteColony(item.id)}>
                    <Text style={s.actionBtnTxt}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {item.queen_breed  && <Text style={s.cardDetail}>🐝 Φυλή: {item.queen_breed}</Text>}
              {item.queen_origin && <Text style={s.cardDetail}>👑 Προέλευση: {item.queen_origin}</Text>}
              {item.queen_year   && <Text style={s.cardDetail}>📅 Έτος βασίλισσας: {item.queen_year}</Text>}
              {item.notes        && <Text style={s.cardNote}>{item.notes}</Text>}
              <Text style={s.cardDate}>
                Δημιουργία: {new Date(item.created_at).toLocaleDateString('el-GR')}
              </Text>
            </View>
          )}
        />
      )}

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <ScrollView style={s.modalContent}>
            <Text style={s.modalTitle}>
              {editingItem ? 'Επεξεργασία' : 'Νέο'} {HIVE_TYPE_LABELS[activeTab]}
            </Text>

            <TextInput
              style={s.inp}
              placeholder="Όνομα / Κωδικός"
              value={name}
              onChangeText={setName}
              placeholderTextColor={C.textLight}
            />

            <Text style={s.lbl}>Φυλή Βασίλισσας</Text>
            <View style={s.chips}>
              {QUEEN_BREEDS.map(b => (
                <TouchableOpacity
                  key={b}
                  style={[s.chip, queenBreed === b && { backgroundColor: C.primaryLight, borderColor: C.primary }]}
                  onPress={() => setQueenBreed(b)}
                >
                  <Text style={[s.chipTxt, queenBreed === b && { color: C.primaryDark, fontWeight: '700' }]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.lbl}>Προέλευση Βασίλισσας</Text>
            <View style={s.chips}>
              {QUEEN_ORIGINS.map(o => (
                <TouchableOpacity
                  key={o}
                  style={[s.chip, queenOrigin === o && { backgroundColor: C.primaryLight, borderColor: C.primary }]}
                  onPress={() => setQueenOrigin(o)}
                >
                  <Text style={[s.chipTxt, queenOrigin === o && { color: C.primaryDark, fontWeight: '700' }]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.lbl}>Έτος Βασίλισσας</Text>
            <TextInput
              style={s.inp}
              placeholder="π.χ. 2024"
              value={queenYear}
              onChangeText={setQueenYear}
              keyboardType="numeric"
              placeholderTextColor={C.textLight}
            />

            {activeTab === 'nucleus' && (
              <>
                <Text style={s.lbl}>Αριθμός Πλαισίων</Text>
                <TextInput
                  style={s.inp}
                  placeholder="π.χ. 4"
                  value={frames}
                  onChangeText={setFrames}
                  keyboardType="numeric"
                  placeholderTextColor={C.textLight}
                />
              </>
            )}

            <Text style={s.lbl}>Σημειώσεις</Text>
            <TextInput
              style={[s.inp, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Ελεύθερες παρατηρήσεις..."
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholderTextColor={C.textLight}
            />

            <TouchableOpacity style={[s.saveBtn, { backgroundColor: tabColor }]} onPress={saveColony}>
              <Text style={s.saveBtnTxt}>{editingItem ? 'Αποθήκευση Αλλαγών' : 'Αποθήκευση'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={s.cancelBtnTxt}>Ακύρωση</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 16 },
  tabs:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab:       { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', backgroundColor: C.card },
  tabTxt:    { fontSize: 11, color: C.textSub, fontWeight: '500', textAlign: 'center' },
  addBtn:    { borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 16 },
  addBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 60, marginBottom: 12 },
  emptyText: { fontSize: 16, color: C.textSub },
  card:      { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, elevation: 2 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardName:    { fontSize: 16, fontWeight: '700', color: C.text, flex: 1 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn:   { padding: 6, borderRadius: 8, backgroundColor: C.primaryLight },
  actionBtnTxt:{ fontSize: 16 },
  cardDetail:  { fontSize: 13, color: C.textSub, marginBottom: 3 },
  cardNote:    { fontSize: 13, color: C.text, fontStyle: 'italic', marginTop: 4 },
  cardDate:    { fontSize: 11, color: C.textLight, marginTop: 6 },
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  modalContent:  { backgroundColor: C.card, borderRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 20, textAlign: 'center' },
  lbl:           { fontSize: 13, fontWeight: '600', color: C.textSub, marginBottom: 8, marginTop: 12 },
  inp:           { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 15, color: C.text, backgroundColor: '#FAFAFA', marginBottom: 4 },
  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: '#F9FAFB' },
  chipTxt:       { fontSize: 13, color: C.textSub },
  saveBtn:       { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16, marginBottom: 8 },
  saveBtnTxt:    { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn:     { padding: 14, alignItems: 'center', marginBottom: 20 },
  cancelBtnTxt:  { color: C.textSub, fontSize: 15 },
});