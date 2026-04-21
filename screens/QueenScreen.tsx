// screens/QueenScreen.tsx — BeeManager v3.1
// Βασιλοτροφία: Βασίλισσες & Βασιλικός Πολτός
// ✨ v3.1: auto-focus ημερομηνία, αρίθμηση μελισσιού, φυλή βασίλισσας

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, FlatList, Keyboard,
} from 'react-native';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Purpose = 'queens' | 'royal_jelly';
type Method  = 'starter' | 'starter_finisher';
type SubView = 'home' | 'method_select' | 'date_select' | 'calendar' | 'history';

const QUEEN_BREEDS = [
  'Μακεδονική',
  'Μπάκφαστ',
  'Κεκροπία',
  'Κάρνικα',
  'Λιγκούστικα',
  'Άλλη',
] as const;

type QueenBreed = typeof QUEEN_BREEDS[number] | '';

interface QueenRearing {
  id: string;
  purpose: Purpose;
  method: Method;
  start_date: string;
  notes: string | null;
  completed_steps: number[];
  created_at: string;
  // ✨ νέα πεδία — βεβαιώσου ότι υπάρχουν στο Supabase schema
  hive_number_start?: string | null;
  hive_number_finisher?: string | null;
  queen_breed?: string | null;
}

interface Step {
  day: number;
  action: string;
  important: boolean;
}

// ─── ΧΡΟΝΟΔΙΑΓΡΑΜΜΑΤΑ ────────────────────────────────────────────────────────

const STEPS_STARTER: Step[] = [
  { day: -30, action: 'Κηφηνοτροφία',                                                            important: false },
  { day: -15, action: 'Τάισμα στα μελίσσια που θα χρησιμοποιήσουμε ως Έναρξης',                important: false },
  { day:  -6, action: 'Αφαιρούμε τις Βασίλισσες από τα Μελίσσια Έναρξης',                      important: true  },
  { day:  -5, action: 'Προσθέτουμε ένα Μαύρο Πλαίσιο σε Επιλεγμένο Μελίσσι',                  important: false },
  { day:   0, action: 'Εμβολιασμός',                                                             important: true  },
  { day:  +4, action: 'Έλεγχος για Σφραγισμένα Β.Κ. και καταστροφή αυτών',                     important: true  },
  { day: +10, action: 'Μεταφέρουμε τα Σφραγισμένα Βασιλικά Κελιά στα Κυψελίδια ή Παραφυάδες', important: true  },
  { day: +12, action: 'Έλεγχος για Εκκόλαψη της Βασίλισσας',                                   important: true  },
  { day: +25, action: 'Έλεγχος για Ωοτοκία και Σφραγισμένο Γόνο',                              important: true  },
];

const STEPS_STARTER_FINISHER: Step[] = [
  { day: -30, action: 'Κηφηνοτροφία',                                                            important: false },
  { day: -15, action: 'Τάισμα στα μελίσσια που θα χρησιμοποιήσουμε ως Έναρξης',                important: false },
  { day:  -6, action: 'Αφαιρούμε τις Βασίλισσες από τα Μελίσσια Έναρξης',                      important: true  },
  { day:  -5, action: 'Προσθέτουμε ένα Μαύρο Πλαίσιο σε Επιλεγμένο Μελίσσι',                  important: false },
  { day:   0, action: 'Εμβολιασμός & Προετοιμασία Μελισσιών Αποπεράτωσης',                     important: true  },
  { day:  +1, action: 'Μεταφορά Βασιλικών Κελιών από Μελίσσια Έναρξης στα Αποπεράτωσης',     important: true  },
  { day:  +4, action: 'Έλεγχος για Σφραγισμένα Β.Κ. και καταστροφή αυτών',                     important: true  },
  { day: +10, action: 'Μεταφέρουμε τα Σφραγισμένα Βασιλικά Κελιά στα Κυψελίδια ή Παραφυάδες', important: true  },
  { day: +12, action: 'Έλεγχος για Εκκόλαψη της Βασίλισσας',                                   important: true  },
  { day: +25, action: 'Έλεγχος για Ωοτοκία και Σφραγισμένο Γόνο',                              important: true  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('el-GR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

function isPast(dateStr: string): boolean {
  return dateStr < new Date().toISOString().split('T')[0];
}

function purposeLabel(p: Purpose): string {
  return p === 'queens' ? '👑 Βασίλισσες' : '🍯 Βασιλικός Πολτός';
}

function methodLabel(m: Method): string {
  return m === 'starter' ? 'Μελίσσι Έναρξης' : 'Έναρξης + Αποπεράτωσης';
}

// ─── BREED PICKER MODAL ───────────────────────────────────────────────────────

interface BreedPickerProps {
  visible: boolean;
  selected: QueenBreed;
  onSelect: (v: QueenBreed) => void;
  onClose: () => void;
}


function BreedPickerModal({ visible, selected, onSelect, onClose }: BreedPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={() => { Keyboard.dismiss(); onClose(); }} />
      <View style={pickerStyles.sheet}>
        <View style={pickerStyles.handle} />
        <Text style={pickerStyles.title}>Φυλή Βασίλισσας</Text>
        <FlatList
          data={QUEEN_BREEDS}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[pickerStyles.option, selected === item && pickerStyles.optionSelected]}
              onPress={() => { Keyboard.dismiss(); onSelect(item); onClose(); }}
            >
              <Text style={[pickerStyles.optionText, selected === item && pickerStyles.optionTextSelected]}>
                {item}
              </Text>
              {selected === item && <Text style={pickerStyles.check}>✓</Text>}
            </TouchableOpacity>
          )}
        />
<TouchableOpacity style={pickerStyles.cancelBtn} onPress={() => { Keyboard.dismiss(); onClose(); }}>
            <Text style={pickerStyles.cancelText}>Ακύρωση</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:      { backgroundColor: '#182035', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  handle:     { width: 40, height: 4, backgroundColor: '#2A3A5A', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:      { color: '#E8ECF4', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  option:     { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, marginBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0E1320' },
  optionSelected: { backgroundColor: '#1A2D1A', borderWidth: 1, borderColor: '#22C55E' },
  optionText: { color: '#9CA3AF', fontSize: 16 },
  optionTextSelected: { color: '#22C55E', fontWeight: '700' },
  check:      { color: '#22C55E', fontSize: 16, fontWeight: '700' },
  cancelBtn:  { marginTop: 8, padding: 16, alignItems: 'center' },
  cancelText: { color: '#6B7280', fontSize: 15 },
});

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function QueenScreen() {
  const { user } = useAuth();

  const [view, setView]           = useState<SubView>('home');
  const [purpose, setPurpose]     = useState<Purpose>('queens');
  const [method, setMethod]       = useState<Method>('starter');
  const [startDate, setStartDate] = useState('');
  const [dateDay, setDateDay]     = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateYear, setDateYear]   = useState('');
  const [notes, setNotes]         = useState('');
  const [records, setRecords]     = useState<QueenRearing[]>([]);
  const [activeRecord, setActiveRecord] = useState<QueenRearing | null>(null);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);

  // ✨ νέα πεδία
  const [hiveNumberStart,    setHiveNumberStart]    = useState('');
  const [hiveNumberFinisher, setHiveNumberFinisher] = useState('');
  const [queenBreed,         setQueenBreed]         = useState<QueenBreed>('');
  const [breedModalVisible,  setBreedModalVisible]  = useState(false);

  // ✨ refs για auto-focus ημερομηνίας
  const monthRef = useRef<TextInput>(null);
  const yearRef  = useRef<TextInput>(null);

  // ── LOAD ─────────────────────────────────────────────────────────────────────

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('queen_rearing')
      .select('*')
      .order('start_date', { ascending: false });
    setRecords((data ?? []) as QueenRearing[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // ── DATE PARSING με auto-focus ───────────────────────────────────────────────

  const handleDay = (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 2);
    setDateDay(v);
    if (v.length === 2) monthRef.current?.focus();
    rebuildDate(v, dateMonth, dateYear);
  };

  const handleMonth = (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 2);
    setDateMonth(v);
    if (v.length === 2) yearRef.current?.focus();
    rebuildDate(dateDay, v, dateYear);
  };

  const handleYear = (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 4);
    setDateYear(v);
    rebuildDate(dateDay, dateMonth, v);
  };

  const rebuildDate = (d: string, m: string, y: string) => {
    if (d.length >= 1 && m.length >= 1 && y.length === 4) {
      const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      setStartDate(!isNaN(Date.parse(iso)) ? iso : '');
    } else {
      setStartDate('');
    }
  };

  const resetDateFields = () => {
    setDateDay(''); setDateMonth(''); setDateYear('');
    setStartDate('');
    setHiveNumberStart(''); setHiveNumberFinisher('');
    setQueenBreed(''); setNotes('');
  };

  // ── SAVE ─────────────────────────────────────────────────────────────────────

  const saveCycle = async () => {
    if (!startDate) { Alert.alert('Σφάλμα', 'Επίλεξε ημερομηνία έναρξης'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('queen_rearing')
        .insert([{
          user_id:               user?.id,
          purpose,
          method,
          start_date:            startDate,
          notes:                 notes.trim() || null,
          completed_steps:       [],
          hive_number_start:     hiveNumberStart.trim() || null,
          hive_number_finisher:  method === 'starter_finisher'
                                   ? (hiveNumberFinisher.trim() || null)
                                   : null,
          queen_breed:           queenBreed || null,
        }])
        .select()
        .single();

      if (error) throw error;
      setActiveRecord(data as QueenRearing);
      setView('calendar');
      loadRecords();
      resetDateFields();
    } catch (e: any) {
      Alert.alert('Σφάλμα', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── TOGGLE STEP ──────────────────────────────────────────────────────────────

  const toggleStep = async (record: QueenRearing, stepIndex: number) => {
    const completed = record.completed_steps ?? [];
    const newCompleted = completed.includes(stepIndex)
      ? completed.filter(i => i !== stepIndex)
      : [...completed, stepIndex];

    const { data, error } = await supabase
      .from('queen_rearing')
      .update({ completed_steps: newCompleted })
      .eq('id', record.id)
      .select()
      .single();

    if (!error && data) {
      const updated = data as QueenRearing;
      setActiveRecord(updated);
      setRecords(prev => prev.map(r => r.id === record.id ? updated : r));
    }
  };

  // ── DELETE ────────────────────────────────────────────────────────────────────

  const deleteRecord = (id: string) => {
    Alert.alert('Διαγραφή', 'Να διαγραφεί αυτός ο κύκλος βασιλοτροφίας;', [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
        await supabase.from('queen_rearing').delete().eq('id', id);
        loadRecords();
        if (activeRecord?.id === id) { setActiveRecord(null); setView('home'); }
      }},
    ]);
  };

  const steps = method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  // ── HOME ──────────────────────────────────────────────────────────────────────
  if (view === 'home') {
    const today = new Date().toISOString().split('T')[0];
    const activeRecords = records.filter(r => {
      const rSteps = r.method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;
      return addDays(r.start_date, rSteps[rSteps.length - 1].day) >= today;
    });

    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <Text style={s.title}>👑 Βασιλοτροφία</Text>

        <View style={s.row}>
          <TouchableOpacity
            style={[s.purposeCard, { borderColor: HONEY }]}
            onPress={() => { setPurpose('queens'); setView('method_select'); }}
          >
            <Text style={s.purposeIcon}>👑</Text>
            <Text style={s.purposeTitle}>Βασίλισσες</Text>
            <Text style={s.purposeDesc}>Νέος κύκλος παραγωγής βασιλισσών</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.purposeCard, { borderColor: '#F5C842' }]}
            onPress={() => { setPurpose('royal_jelly'); setView('method_select'); }}
          >
            <Text style={s.purposeIcon}>🍯</Text>
            <Text style={s.purposeTitle}>Βασιλικός Πολτός</Text>
            <Text style={s.purposeDesc}>Νέος κύκλος παραγωγής πολτού</Text>
          </TouchableOpacity>
        </View>

        {activeRecords.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>🟢 Ενεργοί Κύκλοι</Text>
            {activeRecords.map(r => {
              const rSteps = r.method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={s.recordCard}
                  onPress={() => { setActiveRecord(r); setMethod(r.method); setView('calendar'); }}
                >
                  <View style={s.recordHeader}>
                    <Text style={s.recordPurpose}>{purposeLabel(r.purpose)}</Text>
                    <Text style={s.recordMethod}>{methodLabel(r.method)}</Text>
                  </View>
                  <Text style={s.recordDate}>Έναρξη: {formatDate(r.start_date)}</Text>
                  {r.hive_number_start && (
                    <Text style={s.recordMeta}>
                      🐝 Κυψέλη Έναρξης: #{r.hive_number_start}
                      {r.hive_number_finisher ? `  •  Αποπεράτωσης: #${r.hive_number_finisher}` : ''}
                    </Text>
                  )}
                  {r.queen_breed && (
                    <Text style={s.recordMeta}>👑 Φυλή: {r.queen_breed}</Text>
                  )}
                  <View style={s.progressBar}>
                    <View style={[s.progressFill, {
                      width: `${Math.round((r.completed_steps.length / rSteps.length) * 100)}%`,
                    }]} />
                  </View>
                  <Text style={s.progressText}>
                    {r.completed_steps.length} / {rSteps.length} βήματα
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={s.historyBtn} onPress={() => setView('history')}>
          <Text style={s.historyBtnText}>📋 Ιστορικό κύκλων</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── METHOD SELECT ─────────────────────────────────────────────────────────────
  if (view === 'method_select') {
    return (
      <View style={s.container}>
        <TouchableOpacity style={s.backRow} onPress={() => setView('home')}>
          <Text style={s.backText}>← Πίσω</Text>
        </TouchableOpacity>
        <Text style={s.title}>{purposeLabel(purpose)}</Text>
        <Text style={s.subtitle}>Επίλεξε μέθοδο βασιλοτροφίας</Text>

        <TouchableOpacity
          style={[s.methodCard, { borderColor: HONEY }]}
          onPress={() => { setMethod('starter'); resetDateFields(); setView('date_select'); }}
        >
          <Text style={s.methodIcon}>🐝</Text>
          <Text style={s.methodTitle}>Μελίσσι Έναρξης</Text>
          <Text style={s.methodDesc}>Ένα μελίσσι αναλαμβάνει όλη τη διαδικασία βασιλοτροφίας</Text>
          <Text style={s.methodDuration}>⏱ 55 ημέρες</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.methodCard, { borderColor: PURPLE }]}
          onPress={() => { setMethod('starter_finisher'); resetDateFields(); setView('date_select'); }}
        >
          <Text style={s.methodIcon}>🐝🐝</Text>
          <Text style={s.methodTitle}>Έναρξης + Αποπεράτωσης</Text>
          <Text style={s.methodDesc}>Δύο μελίσσια — ένα για έναρξη και ένα για αποπεράτωση</Text>
          <Text style={s.methodDuration}>⏱ 55 ημέρες</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── DATE SELECT ───────────────────────────────────────────────────────────────
  if (view === 'date_select') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={s.backRow} onPress={() => setView('method_select')}>
          <Text style={s.backText}>← Πίσω</Text>
        </TouchableOpacity>
        <Text style={s.title}>Ημερομηνία Εμβολιασμού</Text>
        <Text style={s.subtitle}>Day 0 — {methodLabel(method)}</Text>

        {/* ── Ημερομηνία Έναρξης ── */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>Ημερομηνία έναρξης</Text>
          <View style={s.dateRow}>
            {/* ΗΗ */}
            <View style={s.dateFieldWrap}>
              <Text style={s.dateFieldLabel}>Ημέρα</Text>
              <TextInput
                style={s.dateField}
                value={dateDay}
                onChangeText={handleDay}
                placeholder="ΗΗ"
                placeholderTextColor={MUTED}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
              />
            </View>
            <Text style={s.dateSep}>/</Text>
            {/* ΜΜ */}
            <View style={s.dateFieldWrap}>
              <Text style={s.dateFieldLabel}>Μήνας</Text>
              <TextInput
                ref={monthRef}
                style={s.dateField}
                value={dateMonth}
                onChangeText={handleMonth}
                placeholder="ΜΜ"
                placeholderTextColor={MUTED}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
              />
            </View>
            <Text style={s.dateSep}>/</Text>
            {/* ΕΕΕΕ */}
            <View style={[s.dateFieldWrap, { flex: 2 }]}>
              <Text style={s.dateFieldLabel}>Έτος</Text>
              <TextInput
                ref={yearRef}
                style={s.dateField}
                value={dateYear}
                onChangeText={handleYear}
                placeholder="ΕΕΕΕ"
                placeholderTextColor={MUTED}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="done"
              />
            </View>
          </View>
          {startDate ? (
            <Text style={s.dateParsed}>✅ {formatDate(startDate)}</Text>
          ) : (dateDay || dateMonth || dateYear) ? (
            <Text style={s.dateInvalid}>⚠️ Μη έγκυρη ημερομηνία</Text>
          ) : null}
        </View>

        {/* ── Αρίθμηση Μελισσιού Έναρξης ── */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>Αριθμός Μελισσιού Έναρξης</Text>
          <TextInput
            style={s.textInput}
            value={hiveNumberStart}
            onChangeText={setHiveNumberStart}
            placeholder="π.χ. 12"
            placeholderTextColor={MUTED}
            keyboardType="number-pad"
          />
        </View>

        {/* ── Αρίθμηση Μελισσιού Αποπεράτωσης (μόνο για starter_finisher) ── */}
        {method === 'starter_finisher' && (
          <View style={s.card}>
            <Text style={s.fieldLabel}>Αριθμός Μελισσιού Αποπεράτωσης</Text>
            <TextInput
              style={s.textInput}
              value={hiveNumberFinisher}
              onChangeText={setHiveNumberFinisher}
              placeholder="π.χ. 27"
              placeholderTextColor={MUTED}
              keyboardType="number-pad"
            />
          </View>
        )}

        {/* ── Φυλή Βασίλισσας ── */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>Φυλή Βασίλισσας</Text>
          <TouchableOpacity
            style={s.breedSelector}
            onPress={() => setBreedModalVisible(true)}
          >
            <Text style={[s.breedSelectorText, !queenBreed && { color: MUTED }]}>
              {queenBreed || '— Επιλογή φυλής —'}
            </Text>
            <Text style={s.breedArrow}>▾</Text>
          </TouchableOpacity>
        </View>

        {/* ── Preview κύκλου ── */}
        {startDate && (
          <View style={s.previewCard}>
            <Text style={s.previewTitle}>Προεπισκόπηση κύκλου</Text>
            {steps.slice(0, 3).map((step, i) => (
              <View key={i} style={s.previewRow}>
                <Text style={s.previewDate}>{formatDate(addDays(startDate, step.day))}</Text>
                <Text style={s.previewAction} numberOfLines={2}>{step.action}</Text>
              </View>
            ))}
            <Text style={s.previewMore}>+{steps.length - 3} ακόμη ενέργειες...</Text>
          </View>
        )}

        {/* ── Σημειώσεις ── */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>Σημειώσεις (προαιρετικό)</Text>
          <TextInput
            style={[s.textInput, { minHeight: 80, textAlignVertical: 'top', textAlign: 'left' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="π.χ. Ράτσα μητρικής βασίλισσας, συνθήκες..."
            placeholderTextColor={MUTED}
            multiline
          />
        </View>

        {/* ── Κουμπί Έναρξης ── */}
        <TouchableOpacity
          style={[s.startBtn, (!startDate || saving) && { opacity: 0.4 }]}
          onPress={saveCycle}
          disabled={!startDate || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.startBtnText}>🚀 Έναρξη κύκλου</Text>
          }
        </TouchableOpacity>

        {/* ── Breed Modal ── */}
        <BreedPickerModal
          visible={breedModalVisible}
          selected={queenBreed}
          onSelect={setQueenBreed}
          onClose={() => setBreedModalVisible(false)}
        />
      </ScrollView>
    );
  }

  // ── CALENDAR ──────────────────────────────────────────────────────────────────
  if (view === 'calendar' && activeRecord) {
    const currentSteps  = activeRecord.method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;
    const completedSteps = activeRecord.completed_steps ?? [];
    const nextStepIndex  = currentSteps.findIndex((_, i) => !completedSteps.includes(i));
    const nextStepDate   = nextStepIndex >= 0
      ? addDays(activeRecord.start_date, currentSteps[nextStepIndex].day)
      : null;

    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <TouchableOpacity style={s.backRow} onPress={() => setView('home')}>
          <Text style={s.backText}>← Πίσω</Text>
        </TouchableOpacity>

        <Text style={s.title}>{purposeLabel(activeRecord.purpose)}</Text>
        <Text style={s.subtitle}>{methodLabel(activeRecord.method)}</Text>

        {/* Meta info */}
        {(activeRecord.hive_number_start || activeRecord.queen_breed) && (
          <View style={[s.card, { marginBottom: 12 }]}>
            {activeRecord.hive_number_start && (
              <Text style={s.metaRow}>
                🐝 Κυψέλη Έναρξης: <Text style={s.metaValue}>#{activeRecord.hive_number_start}</Text>
                {activeRecord.hive_number_finisher
                  ? `  •  Αποπεράτωσης: #${activeRecord.hive_number_finisher}`
                  : ''}
              </Text>
            )}
            {activeRecord.queen_breed && (
              <Text style={s.metaRow}>
                👑 Φυλή: <Text style={s.metaValue}>{activeRecord.queen_breed}</Text>
              </Text>
            )}
          </View>
        )}

        {/* Progress */}
        <View style={s.progressCard}>
          <View style={s.progressBar}>
            <View style={[s.progressFill, {
              width: `${Math.round((completedSteps.length / currentSteps.length) * 100)}%`,
            }]} />
          </View>
          <Text style={s.progressText}>
            {completedSteps.length} / {currentSteps.length} βήματα ολοκληρώθηκαν
          </Text>
          {nextStepDate && (
            <Text style={s.nextStep}>⏭️ Επόμενο: {formatDate(nextStepDate)}</Text>
          )}
        </View>

        {/* Steps */}
        {currentSteps.map((step, i) => {
          const stepDate    = addDays(activeRecord.start_date, step.day);
          const isCompleted = completedSteps.includes(i);
          const todayStep   = isToday(stepDate);
          const pastStep    = isPast(stepDate);

          return (
            <TouchableOpacity
              key={i}
              style={[
                s.stepCard,
                isCompleted && s.stepDone,
                todayStep   && s.stepToday,
                !isCompleted && pastStep && !todayStep && s.stepOverdue,
              ]}
              onPress={() => toggleStep(activeRecord, i)}
            >
              <View style={[
                s.stepCheck,
                isCompleted && s.stepCheckDone,
                todayStep   && s.stepCheckToday,
              ]}>
                <Text style={s.stepCheckText}>{isCompleted ? '✓' : String(i + 1)}</Text>
              </View>
              <View style={s.stepContent}>
                <Text style={[s.stepDate, todayStep && { color: HONEY }]}>
                  {todayStep ? '📅 ΣΗΜΕΡΑ' : formatDate(stepDate)}
                  {!isCompleted && pastStep && !todayStep ? ' ⚠️' : ''}
                </Text>
                <Text style={[
                  s.stepAction,
                  isCompleted && s.stepActionDone,
                  step.important && !isCompleted && s.stepActionImportant,
                ]}>
                  {step.action}
                </Text>
                <Text style={s.stepDay}>Ημέρα {step.day}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Notes */}
        {activeRecord.notes && (
          <View style={s.notesCard}>
            <Text style={s.notesTitle}>📝 Σημειώσεις</Text>
            <Text style={s.notesText}>{activeRecord.notes}</Text>
          </View>
        )}

        {/* Delete */}
        <TouchableOpacity style={s.deleteBtn} onPress={() => deleteRecord(activeRecord.id)}>
          <Text style={s.deleteBtnText}>🗑️ Διαγραφή κύκλου</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── HISTORY ───────────────────────────────────────────────────────────────────
  if (view === 'history') {
    const today = new Date().toISOString().split('T')[0];
    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <TouchableOpacity style={s.backRow} onPress={() => setView('home')}>
          <Text style={s.backText}>← Πίσω</Text>
        </TouchableOpacity>
        <Text style={s.title}>📋 Ιστορικό</Text>

        {loading && <ActivityIndicator color={HONEY} style={{ marginTop: 40 }} />}

        {!loading && records.length === 0 && (
          <Text style={s.emptyText}>Δεν υπάρχουν καταγεγραμμένοι κύκλοι ακόμα.</Text>
        )}

        {records.map(r => {
          const rSteps  = r.method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;
          const endDate = addDays(r.start_date, rSteps[rSteps.length - 1].day);
          const active  = endDate >= today;

          return (
            <TouchableOpacity
              key={r.id}
              style={[s.recordCard, active && s.recordCardActive]}
              onPress={() => { setActiveRecord(r); setMethod(r.method); setView('calendar'); }}
            >
              <View style={s.recordHeader}>
                <Text style={s.recordPurpose}>{purposeLabel(r.purpose)}</Text>
                <Text style={[s.recordStatus, active ? s.statusActive : s.statusDone]}>
                  {active ? '🟢 Ενεργός' : '✅ Ολοκληρώθηκε'}
                </Text>
              </View>
              <Text style={s.recordMethod}>{methodLabel(r.method)}</Text>
              <Text style={s.recordDate}>
                {formatDate(r.start_date)} → {formatDate(endDate)}
              </Text>
              {r.hive_number_start && (
                <Text style={s.recordMeta}>
                  🐝 #{r.hive_number_start}
                  {r.hive_number_finisher ? ` + #${r.hive_number_finisher}` : ''}
                  {r.queen_breed ? `  •  ${r.queen_breed}` : ''}
                </Text>
              )}
              <Text style={s.recordSteps}>
                {r.completed_steps.length} / {rSteps.length} βήματα
              </Text>
              {r.notes && <Text style={s.recordNotes}>📝 {r.notes}</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  return null;
}

// ─── THEME ────────────────────────────────────────────────────────────────────

const HONEY  = '#F5A623';
const BG     = '#0E1320';
const CARD   = '#182035';
const TEXT   = '#E8ECF4';
const MUTED  = '#6B7280';
const GREEN  = '#22C55E';
const RED    = '#EF4444';
const PURPLE = '#9B59B6';

// ─── STYLES ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 16 },
  scrollContent: { paddingBottom: 56 },

  title:    { fontSize: 24, fontWeight: '800', color: HONEY, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 20 },

  backRow:  { flexDirection: 'row', marginBottom: 16 },
  backText: { color: MUTED, fontSize: 15 },

  // ── Cards ──
  row: { flexDirection: 'row', gap: 12, marginBottom: 20 },

  purposeCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  purposeIcon:  { fontSize: 36, marginBottom: 8 },
  purposeTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 4, textAlign: 'center' },
  purposeDesc:  { fontSize: 11, color: MUTED, textAlign: 'center', lineHeight: 16 },

  methodCard: {
    backgroundColor: CARD, borderRadius: 18, padding: 24,
    marginBottom: 14, alignItems: 'center', borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  methodIcon:     { fontSize: 40, marginBottom: 8 },
  methodTitle:    { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 6 },
  methodDesc:     { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  methodDuration: { fontSize: 12, color: HONEY },

  card: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 12 },

  // ── Date inputs ──
  fieldLabel:    { fontSize: 13, color: MUTED, marginBottom: 10, fontWeight: '600' },
  dateRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  dateFieldWrap: { flex: 1 },
  dateFieldLabel:{ fontSize: 11, color: MUTED, marginBottom: 4, textAlign: 'center' },
  dateField: {
    backgroundColor: BG, color: TEXT, borderRadius: 10,
    padding: 14, fontSize: 20, borderWidth: 1, borderColor: '#2A3A5A',
    textAlign: 'center', fontWeight: '700',
  },
  dateSep:     { color: MUTED, fontSize: 24, fontWeight: '700', paddingBottom: 10 },
  dateParsed:  { color: GREEN, fontSize: 13, marginTop: 10 },
  dateInvalid: { color: RED, fontSize: 13, marginTop: 10 },

  // ── Text/Breed inputs ──
  textInput: {
    backgroundColor: BG, color: TEXT, borderRadius: 10,
    padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#2A3A5A',
  },
  breedSelector: {
    backgroundColor: BG, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#2A3A5A',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  breedSelectorText: { color: TEXT, fontSize: 16 },
  breedArrow:        { color: MUTED, fontSize: 18 },

  // ── Preview ──
  previewCard:  { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 12 },
  previewTitle: { fontSize: 11, color: HONEY, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  previewRow:   { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1E2A40', gap: 12 },
  previewDate:  { color: HONEY, fontSize: 12, width: 86 },
  previewAction:{ color: TEXT, fontSize: 12, flex: 1 },
  previewMore:  { color: MUTED, fontSize: 12, marginTop: 8, fontStyle: 'italic' },

  // ── Start button ──
  startBtn: {
    backgroundColor: GREEN, borderRadius: 16, padding: 18,
    alignItems: 'center', marginTop: 4,
    shadowColor: GREEN, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Meta info ──
  metaRow:   { color: MUTED, fontSize: 13, marginBottom: 4 },
  metaValue: { color: TEXT, fontWeight: '600' },

  // ── Progress ──
  progressCard: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 16 },
  progressBar:  { height: 6, backgroundColor: BG, borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, backgroundColor: HONEY, borderRadius: 3 },
  progressText: { fontSize: 12, color: MUTED, marginBottom: 4 },
  nextStep:     { fontSize: 13, color: HONEY },

  // ── Steps ──
  stepCard: {
    flexDirection: 'row', backgroundColor: CARD, borderRadius: 14,
    padding: 14, marginBottom: 10, gap: 12, alignItems: 'flex-start',
  },
  stepDone:    { opacity: 0.55 },
  stepToday:   { borderWidth: 1.5, borderColor: HONEY, backgroundColor: '#1A2D1A' },
  stepOverdue: { borderWidth: 1, borderColor: RED, backgroundColor: '#2D0A0A' },

  stepCheck: {
    width: 32, height: 32, borderRadius: 16, marginTop: 2,
    backgroundColor: '#1E2A40', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: MUTED,
  },
  stepCheckDone:  { backgroundColor: GREEN, borderColor: GREEN },
  stepCheckToday: { backgroundColor: HONEY, borderColor: HONEY },
  stepCheckText:  { color: TEXT, fontSize: 12, fontWeight: '700' },

  stepContent:         { flex: 1 },
  stepDate:            { fontSize: 12, color: MUTED, marginBottom: 4 },
  stepAction:          { fontSize: 14, color: TEXT, lineHeight: 21 },
  stepActionDone:      { textDecorationLine: 'line-through', color: MUTED },
  stepActionImportant: { color: HONEY, fontWeight: '600' },
  stepDay:             { fontSize: 11, color: MUTED, marginTop: 4 },

  // ── Notes ──
  notesCard:  { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 12 },
  notesTitle: { fontSize: 12, color: HONEY, fontWeight: '700', marginBottom: 8 },
  notesText:  { color: TEXT, fontSize: 14, lineHeight: 22 },

  // ── Delete ──
  deleteBtn:     { alignItems: 'center', padding: 16, marginTop: 8 },
  deleteBtnText: { color: RED, fontSize: 14 },

  // ── Sections & Records ──
  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 12, color: HONEY, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  recordCard: {
    backgroundColor: CARD, borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#1E2A40',
  },
  recordCardActive: { borderColor: GREEN },
  recordHeader:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  recordPurpose:  { color: TEXT, fontSize: 15, fontWeight: '700' },
  recordStatus:   { fontSize: 12 },
  statusActive:   { color: GREEN },
  statusDone:     { color: MUTED },
  recordMethod:   { color: MUTED, fontSize: 13, marginBottom: 4 },
  recordDate:     { color: HONEY, fontSize: 12, marginBottom: 4 },
  recordMeta:     { color: MUTED, fontSize: 12, marginBottom: 4 },
  recordSteps:    { color: MUTED, fontSize: 12 },
  recordNotes:    { color: MUTED, fontSize: 12, marginTop: 4, fontStyle: 'italic' },

  historyBtn:     { backgroundColor: CARD, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  historyBtnText: { color: MUTED, fontSize: 14 },
  emptyText:      { color: MUTED, fontSize: 14, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
});