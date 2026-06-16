import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, RefreshControl, FlatList, Modal,
} from 'react-native';
import {
  getAllHarvests, updateHarvest, deleteHarvest, HarvestWithHive,
} from '../services/harvestService';
import { getHives } from '../services/inspectionService';
import { Hive } from '../types/inspectionTypes';

const fmtDate = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

export default function HarvestHistoryScreen({ navigation }: any) {
  const [harvests, setHarvests] = useState<HarvestWithHive[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterHiveId, setFilterHiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<HarvestWithHive | null>(null);
  const [editFrames, setEditFrames] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [hs, hvs] = await Promise.all([getAllHarvests(500), getHives()]);
      setHarvests(hs); setHives(hvs);
    } catch (e: any) {
      Alert.alert('Σφάλμα', e?.message ?? 'Αποτυχία φόρτωσης');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    const u = navigation.addListener('focus', load);
    return u;
  }, [navigation, load]);

  const filtered = useMemo(
    () => (filterHiveId ? harvests.filter(h => h.hive_id === filterHiveId) : harvests),
    [harvests, filterHiveId],
  );
  const totalFrames = useMemo(
    () => filtered.reduce((s, h) => s + (h.frames_harvested ?? 0), 0),
    [filtered],
  );

  const startEdit = (h: HarvestWithHive): void => {
    setEditing(h);
    setEditFrames(String(h.frames_harvested ?? ''));
    setEditDate(h.date.split('T')[0]);
    setEditNotes(h.notes ?? '');
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (!editing) return;
    const f = parseInt(editFrames, 10);
    if (isNaN(f) || f < 0) { Alert.alert('Σφάλμα', 'Εισάγαγε έγκυρο αριθμό πλαισίων'); return; }
    if (!editDate.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Σφάλμα', 'Ημερομηνία ΕΕΕΕ-ΜΜ-ΗΗ'); return; }
    setSaving(true);
    try {
      await updateHarvest(editing.id, {
        frames_harvested: f,
        date: new Date(editDate).toISOString(),
        notes: editNotes.trim() || null,
      });
      setEditing(null); load();
    } catch (e: any) {
      Alert.alert('Σφάλμα', e?.message);
    } finally { setSaving(false); }
  };

  const handleDelete = (h: HarvestWithHive): void => {
    Alert.alert('Διαγραφή', `Διαγραφή τρύγου κυψέλης ${h.hive_name} (${h.frames_harvested} πλαίσια);`,
      [
        { text: 'Άκυρο', style: 'cancel' },
        { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
          try { await deleteHarvest(h.id); load(); }
          catch (e: any) { Alert.alert('Σφάλμα', e?.message); }
        }},
      ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#D97706" /></View>;

  return (
    <View style={s.container}>
      <View style={s.summaryBar}>
        <View style={s.summary}><Text style={s.summaryLabel}>Καταχωρήσεις</Text><Text style={s.summaryValue}>{filtered.length}</Text></View>
        <View style={s.summary}><Text style={s.summaryLabel}>Σύνολο Πλαισίων</Text><Text style={s.summaryValue}>{totalFrames}</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ alignItems: 'center' }}>
        <TouchableOpacity style={[s.filterChip, !filterHiveId && s.filterChipOn]} onPress={() => setFilterHiveId(null)}>
          <Text style={[s.filterChipTxt, !filterHiveId && s.filterChipTxtOn]}>Όλες</Text>
        </TouchableOpacity>
        {hives.map(h => (
          <TouchableOpacity key={h.id}
            style={[s.filterChip, filterHiveId === h.id && s.filterChipOn]}
            onPress={() => setFilterHiveId(filterHiveId === h.id ? null : h.id)}>
            <Text style={[s.filterChipTxt, filterHiveId === h.id && s.filterChipTxtOn]}>🐝 {h.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={h => h.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#D97706" />}
        ListEmptyComponent={<Text style={s.empty}>Δεν υπάρχουν καταχωρήσεις τρύγου.</Text>}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => startEdit(item)} activeOpacity={0.7}>
            <View style={s.rowIcon}><Text style={{ fontSize: 22 }}>🍯</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowName}>Κυψέλη {item.hive_name}</Text>
              <Text style={s.rowMeta}>{fmtDate(item.date)}</Text>
              {item.notes ? <Text style={s.rowNotes} numberOfLines={2}>{item.notes}</Text> : null}
            </View>
            <View style={s.rowRight}>
              <Text style={s.rowFrames}>{item.frames_harvested}</Text>
              <Text style={s.rowFramesUnit}>πλαίσια</Text>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item)} style={s.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 18 }}>🗑️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.handle} />
            <Text style={s.modalTitle}>✏️ Επεξεργασία Τρύγου</Text>
            <Text style={s.modalSub}>Κυψέλη {editing?.hive_name}</Text>
            <Text style={s.label}>Πλαίσια</Text>
            <TextInput style={s.input} value={editFrames} onChangeText={setEditFrames} keyboardType="number-pad" />
            <Text style={s.label}>Ημερομηνία (ΕΕΕΕ-ΜΜ-ΗΗ)</Text>
            <TextInput style={s.input} value={editDate} onChangeText={setEditDate} maxLength={10} />
            <Text style={s.label}>Σημειώσεις</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} value={editNotes} onChangeText={setEditNotes} multiline />
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditing(null)}><Text style={s.cancelBtnTxt}>Ακύρωση</Text></TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>💾 Αποθήκευση</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryBar: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, gap: 16, borderBottomWidth: 1, borderBottomColor: '#F0E0B0' },
  summary: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#888' },
  summaryValue: { fontSize: 22, fontWeight: '800', color: '#D97706', marginTop: 4 },
  filterRow: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, maxHeight: 56, borderBottomWidth: 1, borderBottomColor: '#F0E0B0' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FEF3C7', marginRight: 8, borderWidth: 1, borderColor: '#FDE68A' },
  filterChipOn: { backgroundColor: '#D97706', borderColor: '#D97706' },
  filterChipTxt: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  filterChipTxtOn: { color: '#fff' },
  empty: { textAlign: 'center', color: '#888', padding: 40 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, elevation: 1 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  rowName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  rowNotes: { fontSize: 12, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },
  rowRight: { alignItems: 'center', minWidth: 60 },
  rowFrames: { fontSize: 22, fontWeight: '800', color: '#D97706' },
  rowFramesUnit: { fontSize: 11, color: '#888', marginTop: -2 },
  deleteBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827', textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 13, color: '#6B7280', marginTop: 10, marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: '#FAFAFA' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnTxt: { color: '#6B7280', fontWeight: '600' },
  saveBtn: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: '#D97706', alignItems: 'center' },
  saveBtnTxt: { color: '#fff', fontWeight: '700' },
});