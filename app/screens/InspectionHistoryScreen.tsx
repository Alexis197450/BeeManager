import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import {
  getAllInspections, deleteInspection, getHives, InspectionWithHive,
} from '../services/inspectionService';
import { Hive } from '../types/inspectionTypes';

const fmtDate = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

export default function InspectionHistoryScreen({ navigation }: any) {
  const [inspections, setInspections] = useState<InspectionWithHive[]>([]);
  const [hives, setHives] = useState<Hive[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterHiveId, setFilterHiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ins, hvs] = await Promise.all([getAllInspections(500), getHives()]);
      setInspections(ins); setHives(hvs);
    } catch (e: any) {
      Alert.alert('Σφάλμα', e?.message ?? 'Αποτυχία φόρτωσης');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    const u = navigation.addListener('focus', load);
    return u;
  }, [navigation, load]);

  const filtered = useMemo(
    () => (filterHiveId ? inspections.filter(i => i.hive_id === filterHiveId) : inspections),
    [inspections, filterHiveId],
  );
  const urgentCount = useMemo(() => filtered.filter(i => i.urgent).length, [filtered]);

  const handleEdit = (insp: InspectionWithHive): void => {
  navigation.navigate('Inspection', {
    hive_id: insp.hive_id,
    hive_name: insp.hive_name,
    mode: 'manual',
    editInspection: {
      ...insp,
      hive_name: insp.hive_name, // explicit γιατί είναι computed
    },
  });
};

  const handleDelete = (i: InspectionWithHive): void => {
    Alert.alert('Διαγραφή', `Διαγραφή επιθεώρησης κυψέλης ${i.hive_name};`,
      [
        { text: 'Άκυρο', style: 'cancel' },
        { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
          try { await deleteInspection(i.id); load(); }
          catch (e: any) { Alert.alert('Σφάλμα', e?.message); }
        }},
      ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#F5A623" /></View>;

  return (
    <View style={s.container}>
      <View style={s.summaryBar}>
        <View style={s.summary}><Text style={s.summaryLabel}>Καταχωρήσεις</Text><Text style={s.summaryValue}>{filtered.length}</Text></View>
        <View style={s.summary}><Text style={s.summaryLabel}>Επείγουσες</Text><Text style={[s.summaryValue, { color: '#DC2626' }]}>{urgentCount}</Text></View>
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
        keyExtractor={i => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#F5A623" />}
        ListEmptyComponent={<Text style={s.empty}>Δεν υπάρχουν επιθεωρήσεις.</Text>}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const isDead = item.population_frames === 0;
          return (
            <TouchableOpacity style={s.row} onPress={() => handleEdit(item)} activeOpacity={0.7}>
              <View style={[s.rowIcon, isDead && { backgroundColor: '#FEE2E2' }]}>
                <Text style={{ fontSize: 22 }}>{isDead ? '💀' : '🐝'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.rowTop}>
                  <Text style={s.rowName}>Κυψέλη {item.hive_name}</Text>
                  {item.urgent ? (<View style={s.urgBadge}><Text style={s.urgBadgeTxt}>⚠️ Επείγον</Text></View>) : null}
                </View>
                <Text style={s.rowMeta}>{fmtDate(item.date)}</Text>
                <View style={s.rowStats}>
                  <Text style={s.rowStat}>👥 {item.population_frames ?? '—'}</Text>
                  <Text style={s.rowStat}>🥚 {item.brood_frames ?? '—'}</Text>
                  <Text style={s.rowStat}>🍯 {item.honey_frames ?? '—'}</Text>
                  {item.queen_present === false ? <Text style={[s.rowStat, { color: '#DC2626' }]}>❌ βασ.</Text> : null}
                </View>
                {item.notes ? <Text style={s.rowNotes} numberOfLines={2}>{item.notes}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleDelete(item)} style={s.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBF0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryBar: { flexDirection: 'row', backgroundColor: '#fff', padding: 16, gap: 16, borderBottomWidth: 1, borderBottomColor: '#F0E0B0' },
  summary: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#888' },
  summaryValue: { fontSize: 22, fontWeight: '800', color: '#F5A623', marginTop: 4 },
  filterRow: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, maxHeight: 56, borderBottomWidth: 1, borderBottomColor: '#F0E0B0' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FEF3C7', marginRight: 8, borderWidth: 1, borderColor: '#FDE68A' },
  filterChipOn: { backgroundColor: '#F5A623', borderColor: '#F5A623' },
  filterChipTxt: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  filterChipTxtOn: { color: '#fff' },
  empty: { textAlign: 'center', color: '#888', padding: 40 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, elevation: 1 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  urgBadge: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  urgBadgeTxt: { fontSize: 10, color: '#DC2626', fontWeight: '700' },
  rowMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  rowStats: { flexDirection: 'row', gap: 12, marginTop: 6 },
  rowStat: { fontSize: 12, color: '#374151', fontWeight: '600' },
  rowNotes: { fontSize: 12, color: '#9CA3AF', marginTop: 4, fontStyle: 'italic' },
  deleteBtn: { padding: 8 },
});