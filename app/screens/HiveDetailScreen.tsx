// app/screens/HiveDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../supabase';

const C = {
  primary: '#F59E0B', primaryDark: '#D97706',
  bg: '#FFFBF0', card: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', textSub: '#6B7280', textLight: '#9CA3AF',
  green: '#16A34A', greenLight: '#DCFCE7',
  red: '#DC2626', redLight: '#FEE2E2',
  dark: '#1E293B',
};

function Row({ label, value, urgent }: { label: string; value: string | null | undefined; urgent?: boolean }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, urgent && { color: C.red, fontWeight: '700' }]}>{value}</Text>
    </View>
  );
}

export default function HiveDetailScreen({ route, navigation }: any) {
  const { hive_id, hive_name } = route.params ?? {};
  const [lastInspection, setLastInspection] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: `🐝 Κυψέλη ${hive_name}` });
    fetchLastInspection();
  }, []);

  async function fetchLastInspection() {
    const { data } = await supabase
      .from('inspections')
      .select('*')
      .eq('hive_id', hive_id)
      .order('date', { ascending: false })
      .limit(1)
      .single();
    setLastInspection(data ?? null);
    setLoading(false);
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('el-GR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* Κουμπί νέας επιθεώρησης */}
      <TouchableOpacity
        style={s.btnInspect}
        onPress={() => navigation.navigate('Inspection', { hive_id, hive_name })}
        activeOpacity={0.85}
      >
        <Text style={s.btnInspectText}>🎙️ Νέα Επιθεώρηση</Text>
      </TouchableOpacity>

      {/* Τελευταία επιθεώρηση */}
      <View style={s.card}>
        <Text style={s.cardTitle}>📋 Τελευταία Επιθεώρηση</Text>

        {loading ? (
          <ActivityIndicator color={C.primary} />
        ) : !lastInspection ? (
          <Text style={s.noData}>Δεν υπάρχει καταγεγραμμένη επιθεώρηση</Text>
        ) : (
          <>
            <Row label="Ημερομηνία" value={formatDate(lastInspection.date)} />

            {/* Πληθυσμός */}
            {lastInspection.population_frames !== null && (
              <Row label="Πλαίσια πληθυσμού" value={`${lastInspection.population_frames} πλαίσια`} />
            )}
            {lastInspection.population_strength && (
              <Row label="Δύναμη" value={lastInspection.population_strength} />
            )}

            {/* Γόνος */}
            {lastInspection.brood_frames !== null && (
              <Row label="Πλαίσια γόνου" value={`${lastInspection.brood_frames} πλαίσια`} />
            )}

            {/* Μέλι */}
            {lastInspection.honey_frames !== null && (
              <Row label="Πλαίσια μελιού" value={`${lastInspection.honey_frames} πλαίσια`} />
            )}

            {/* Βασίλισσα */}
            {lastInspection.queen_present !== null && (
              <Row
                label="Βασίλισσα"
                value={lastInspection.queen_present ? '✅ Παρούσα' : '❌ Απούσα'}
              />
            )}
            {lastInspection.queen_status && (
              <Row label="Κατάσταση βασίλισσας" value={lastInspection.queen_status} />
            )}

            {/* Βασιλικά κελιά */}
            {lastInspection.queen_cells !== null && lastInspection.queen_cells > 0 && (
              <Row label="Βασιλικά κελιά" value={`${lastInspection.queen_cells}`} />
            )}

            {/* Ιδιοσυγκρασία */}
            {lastInspection.temperament && (
              <Row label="Ιδιοσυγκρασία" value={lastInspection.temperament} />
            )}

            {/* Σμηνουργία */}
            {lastInspection.has_swarmed === true && (
              <Row label="Σμηνουργία" value="⚠️ Ναι" urgent />
            )}

            {/* Τροφοδότηση */}
            {lastInspection.feeding_type && lastInspection.feeding_type !== 'καμία' && (
              <Row label="Τροφοδότηση" value={lastInspection.feeding_type} />
            )}

            {/* Επείγον */}
            {lastInspection.urgent === true && (
              <View style={s.urgentBadge}>
                <Text style={s.urgentText}>⚠️ ΕΠΕΙΓΟΝ</Text>
              </View>
            )}

            {/* Σημειώσεις */}
            {lastInspection.notes && (
              <View style={s.notesBox}>
                <Text style={s.notesLabel}>📝 Σημειώσεις</Text>
                <Text style={s.notesText}>{lastInspection.notes}</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Κουμπί ιστορικού */}
      <TouchableOpacity
        style={s.btnHistory}
        onPress={() => navigation.navigate('InspectionHistory', { hive_id, hive_name })}
        activeOpacity={0.85}
      >
        <Text style={s.btnHistoryText}>📅 Ιστορικό Επιθεωρήσεων</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  content:      { padding: 16 },
  btnInspect:   {
    backgroundColor: C.red, borderRadius: 16, padding: 18,
    alignItems: 'center', marginBottom: 16, elevation: 4,
  },
  btnInspectText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  card:         {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    marginBottom: 16, elevation: 2,
  },
  cardTitle:    { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 14,
                  borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 10 },
  noData:       { color: C.textLight, textAlign: 'center', paddingVertical: 20 },
  row:          { flexDirection: 'row', justifyContent: 'space-between',
                  paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel:     { fontSize: 14, color: C.textSub, flex: 1 },
  rowValue:     { fontSize: 14, fontWeight: '600', color: C.text, flex: 1, textAlign: 'right' },
  urgentBadge:  { backgroundColor: C.redLight, borderRadius: 8, padding: 10,
                  alignItems: 'center', marginTop: 12 },
  urgentText:   { color: C.red, fontWeight: '800', fontSize: 15 },
  notesBox:     { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginTop: 12 },
  notesLabel:   { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 6 },
  notesText:    { fontSize: 14, color: C.text, lineHeight: 20 },
  btnHistory:   {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.primary,
  },
  btnHistoryText: { fontSize: 15, fontWeight: '700', color: C.primaryDark },
});
