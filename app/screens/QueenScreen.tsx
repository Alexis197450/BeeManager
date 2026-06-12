// screens/QueenScreen.tsx — BeeManager v5.0
// Βασιλοτροφία: Κύκλοι + Παραφυάδες-Κυψελίδια (lifecycle)
// ✨ v5.0: κατανομή κελιών → breeding_units, εκκόλαψη/ωοτοκία ανά μονάδα, εξέλιξη & πώληση

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, FlatList, Keyboard,
} from 'react-native';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  BreedingUnit, UnitType, UNIT_TYPE_LABELS, UNIT_TYPE_EMOJI,
  getUnitsByCycle, getActiveUnits, upsertUnitsFromCells,
  setHatched, setLaying, convertUnitType, upgradeToHive,
  ensureBreedingProducts,
} from '../services/breedingService';

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Purpose = 'queens' | 'royal_jelly';
type Method  = 'starter' | 'starter_finisher';
type SubView = 'home' | 'method_select' | 'date_select' | 'calendar' | 'history';
type Tab     = 'cycles' | 'units';

const QUEEN_BREEDS = ['Μακεδονική', 'Μπάκφαστ', 'Κεκροπία', 'Κάρνικα', 'Λιγκούστικα', 'Άλλη'] as const;
type QueenBreed = typeof QUEEN_BREEDS[number] | '';

type CellDest = 'nucleus' | 'mating' | 'q8' | 'sale' | 'other' | '';
interface CellAssignment { cell: number; dest: CellDest; other_label: string; }

const DEST_OPTIONS: { key: CellDest; label: string }[] = [
  { key: 'nucleus', label: 'Παραφυάδα' },
  { key: 'mating',  label: 'Κυψελίδιο' },
  { key: 'q8',      label: 'Q8' },
  { key: 'sale',    label: 'Πώληση' },
  { key: 'other',   label: 'Άλλο' },
];

interface QueenRearing {
  id: string;
  purpose: Purpose;
  method: Method;
  start_date: string;
  notes: string | null;
  completed_steps: number[];
  created_at: string;
  hive_number_start?: string | null;
  hive_number_finisher?: string | null;
  queen_breed?: string | null;
  queen_cells_count?: number | null;
  queen_cells_assignments?: CellAssignment[] | null;
}

interface Step { id: string; day: number; action: string; important: boolean; }

// ─── ΧΡΟΝΟΔΙΑΓΡΑΜΜΑΤΑ ────────────────────────────────────────────────────────
const STEPS_STARTER: Step[] = [
  { id: 's0', day: -30, action: 'Κηφηνοτροφία',                                                  important: false },
  { id: 's1', day: -15, action: 'Τάισμα στα μελίσσια Έναρξης',                                  important: false },
  { id: 's2', day:  -6, action: 'Αφαιρούμε τις Βασίλισσες από τα Μελίσσια Έναρξης',            important: true  },
  { id: 's3', day:  -5, action: 'Προσθέτουμε ένα Μαύρο Πλαίσιο σε Επιλεγμένο Μελίσσι',        important: false },
  { id: 's4', day:   0, action: 'Εμβολιασμός',                                                   important: true  },
  { id: 's5', day:  +4, action: 'Έλεγχος για Σφραγισμένα Β.Κ. και καταστροφή αυτών',           important: true  },
  { id: 'queen_cells', day: +10, action: 'Καταγραφή & Κατανομή Βασιλικών Κελιών',              important: true  },
  { id: 'hatch', day: +12, action: 'Έλεγχος Εκκόλαψης Βασίλισσας',                              important: true  },
  { id: 'laying', day: +25, action: 'Έλεγχος Ωοτοκίας & Σφραγισμένου Γόνου',                    important: true  },
];

const STEPS_STARTER_FINISHER: Step[] = [
  { id: 'sf0', day: -30, action: 'Κηφηνοτροφία',                                                  important: false },
  { id: 'sf1', day: -15, action: 'Τάισμα στα μελίσσια Έναρξης',                                  important: false },
  { id: 'sf2', day:  -6, action: 'Αφαιρούμε τις Βασίλισσες από τα Μελίσσια Έναρξης',            important: true  },
  { id: 'sf3', day:  -5, action: 'Προσθέτουμε ένα Μαύρο Πλαίσιο σε Επιλεγμένο Μελίσσι',        important: false },
  { id: 'sf4', day:   0, action: 'Εμβολιασμός & Προετοιμασία Μελισσιών Αποπεράτωσης',           important: true  },
  { id: 'sf5', day:  +1, action: 'Μεταφορά Βασιλικών Κελιών στα Αποπεράτωσης',                  important: true  },
  { id: 'sf6', day:  +4, action: 'Έλεγχος για Σφραγισμένα Β.Κ. και καταστροφή αυτών',           important: true  },
  { id: 'queen_cells', day: +10, action: 'Καταγραφή & Κατανομή Βασιλικών Κελιών',              important: true  },
  { id: 'hatch', day: +12, action: 'Έλεγχος Εκκόλαψης Βασίλισσας',                              important: true  },
  { id: 'laying', day: +25, action: 'Έλεγχος Ωοτοκίας & Σφραγισμένου Γόνου',                    important: true  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function isToday(dateStr: string): boolean { return dateStr === new Date().toISOString().split('T')[0]; }
function isPast(dateStr: string): boolean { return dateStr < new Date().toISOString().split('T')[0]; }
function purposeLabel(p: Purpose): string { return p === 'queens' ? '👑 Βασίλισσες' : '🍯 Βασιλικός Πολτός'; }
function methodLabel(m: Method): string { return m === 'starter' ? 'Μελίσσι Έναρξης' : 'Έναρξης + Αποπεράτωσης'; }

// ─── BREED PICKER MODAL ───────────────────────────────────────────────────────
function BreedPickerModal({ visible, selected, onSelect, onClose }: {
  visible: boolean; selected: QueenBreed; onSelect: (v: QueenBreed) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={() => { Keyboard.dismiss(); onClose(); }} />
      <View style={pk.sheet}>
        <View style={pk.handle} />
        <Text style={pk.title}>Φυλή Βασίλισσας</Text>
        <FlatList data={QUEEN_BREEDS} keyExtractor={i => i}
          renderItem={({ item }) => (
            <TouchableOpacity style={[pk.option, selected === item && pk.optionSelected]}
              onPress={() => { Keyboard.dismiss(); onSelect(item); onClose(); }}>
              <Text style={[pk.optionText, selected === item && pk.optionTextSelected]}>{item}</Text>
              {selected === item && <Text style={pk.check}>✓</Text>}
            </TouchableOpacity>
          )} />
        <TouchableOpacity style={pk.cancelBtn} onPress={() => { Keyboard.dismiss(); onClose(); }}>
          <Text style={pk.cancelText}>Ακύρωση</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── CELLS MODAL (βήμα +10) ───────────────────────────────────────────────────
function QueenCellsModal({ visible, record, onClose, onSaved, onSellCells }: {
  visible: boolean; record: QueenRearing | null;
  onClose: () => void;
  onSaved: () => void;
  onSellCells: (count: number) => void;
}) {
  const [count, setCount] = useState('');
  const [cells, setCells] = useState<CellAssignment[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && record) {
      const existing = record.queen_cells_count ?? 0;
      setCount(existing ? String(existing) : '');
      setCells(record.queen_cells_assignments ?? []);
    }
  }, [visible, record]);

  const handleCount = (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 2);
    setCount(v);
    const n = parseInt(v) || 0;
    setCells(prev => {
      const next = [...prev];
      if (n > next.length) for (let i = next.length; i < n; i++) next.push({ cell: i + 1, dest: '', other_label: '' });
      else if (n < next.length) next.length = n;
      return next;
    });
  };

  const setDest = (idx: number, dest: CellDest) =>
    setCells(prev => prev.map((c, i) => i === idx ? { ...c, dest } : c));
  const setOther = (idx: number, t: string) =>
    setCells(prev => prev.map((c, i) => i === idx ? { ...c, other_label: t } : c));

  const handleSave = async () => {
    if (!record) return;
    setSaving(true);
    try {
      // 1. Αποθήκευση επιλογών στο queen_rearing
      await supabase.from('queen_rearing').update({
        queen_cells_count: parseInt(count) || 0,
        queen_cells_assignments: cells,
      }).eq('id', record.id);

      // 2. Δημιουργία breeding_units για όσα ΔΕΝ είναι πώληση
      const unitCells = cells
        .filter(c => c.dest && c.dest !== 'sale')
        .map(c => ({
          cell_number: c.cell,
          unit_type: (c.dest === 'other' ? 'other' : c.dest) as UnitType,
          label: c.dest === 'other' ? (c.other_label || 'Άλλο') : UNIT_TYPE_LABELS[c.dest as UnitType],
        }));
      await upsertUnitsFromCells(record.id, record.queen_breed ?? null, unitCells);

      // 3. Πώληση κελιών;
      const saleCount = cells.filter(c => c.dest === 'sale').length;
      onSaved();
      onClose();
      if (saleCount > 0) {
        setTimeout(() => onSellCells(saleCount), 300);
      }
    } catch (e: any) { Alert.alert('Σφάλμα', e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <View style={cm.sheet}>
          <View style={pk.handle} />
          <Text style={cm.title}>🔬 Κατανομή Βασιλικών Κελιών</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>
            <Text style={cm.label}>Πόσα βασιλικά κελιά δημιουργήθηκαν;</Text>
            <TextInput style={cm.countInput} value={count} onChangeText={handleCount}
              placeholder="π.χ. 8" placeholderTextColor={MUTED} keyboardType="number-pad" maxLength={2} />
            {cells.map((c, idx) => (
              <View key={idx} style={cm.cellBlock}>
                <View style={cm.cellHeader}>
                  <View style={cm.cellNum}><Text style={cm.cellNumText}>{c.cell}</Text></View>
                  <Text style={cm.cellTitle}>Κελί {c.cell}</Text>
                </View>
                <View style={cm.destRow}>
                  {DEST_OPTIONS.map(opt => (
                    <TouchableOpacity key={opt.key}
                      style={[cm.destChip, c.dest === opt.key && cm.destChipOn]}
                      onPress={() => setDest(idx, opt.key)}>
                      <Text style={[cm.destTxt, c.dest === opt.key && cm.destTxtOn]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {c.dest === 'other' && (
                  <TextInput style={cm.otherInput} value={c.other_label} onChangeText={(t) => setOther(idx, t)}
                    placeholder="Περιγραφή προορισμού..." placeholderTextColor={MUTED} />
                )}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[cm.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={cm.saveTxt}>💾 Αποθήκευση & Δημιουργία Μονάδων</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={pk.cancelBtn} onPress={onClose}>
            <Text style={pk.cancelText}>Κλείσιμο</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── HATCH MODAL (βήμα +12) ───────────────────────────────────────────────────
function HatchModal({ visible, cycleId, onClose }: {
  visible: boolean; cycleId: string | null; onClose: () => void;
}) {
  const [units, setUnits] = useState<BreedingUnit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!cycleId) return;
    setLoading(true);
    try {
      const all = await getUnitsByCycle(cycleId);
      setUnits(all.filter(u => u.status !== 'sold' && u.status !== 'upgraded_to_hive'));
    } catch {}
    setLoading(false);
  }, [cycleId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const markHatched = async (u: BreedingUnit) => {
    await setHatched(u.id, true, false);
    load();
  };

  const markFailed = async (u: BreedingUnit) => {
    Alert.alert(
      '❌ Δεν Εκκολάφθηκε',
      `Η μονάδα "${u.label || UNIT_TYPE_LABELS[u.unit_type]}" (Κελί ${u.cell_number}) δεν εκκολάφθηκε.\n\nΗ μονάδα παραμένει ενεργή ως ορφανή — χρειάζεται νέο βασιλικό κελί.`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        { text: 'Επιβεβαίωση', style: 'destructive', onPress: async () => {
          await setHatched(u.id, false, true);
          load();
        }},
      ]
    );
  };

  const resetHatch = async (u: BreedingUnit) => {
    await setHatched(u.id, false, false);
    load();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <View style={cm.sheet}>
          <View style={pk.handle} />
          <Text style={cm.title}>🐝 Έλεγχος Εκκόλαψης</Text>
          {loading ? <ActivityIndicator color={HONEY} style={{ marginVertical: 20 }} /> :
           units.length === 0 ? <Text style={cm.empty}>Δεν υπάρχουν μονάδες. Καταχώρησε πρώτα τα κελιά (βήμα +10).</Text> :
            <ScrollView style={{ maxHeight: 440 }}>
              {units.map(u => {
                const isFailed = u.failed_hatch;
                const isHatched = u.hatched;
                return (
                  <View key={u.id} style={[cm.unitRow, isHatched && cm.unitRowOn, isFailed && cm.unitRowFailed]}>
                    <Text style={cm.unitEmoji}>{UNIT_TYPE_EMOJI[u.unit_type]}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={cm.unitName}>{u.label || UNIT_TYPE_LABELS[u.unit_type]}</Text>
                      <Text style={cm.unitSub}>Κελί {u.cell_number} • {UNIT_TYPE_LABELS[u.unit_type]}</Text>
                      {isFailed && <Text style={cm.failedNote}>⚠️ Ορφανή — χρειάζεται νέο κελί</Text>}
                    </View>
                    {/* Τρία κουμπιά: Εκκολάφθηκε / Δεν εκκολάφθηκε / Επαναφορά */}
                    {!isHatched && !isFailed && (
                      <View style={cm.hatchBtns}>
                        <TouchableOpacity style={cm.hatchBtnGreen} onPress={() => markHatched(u)}>
                          <Text style={cm.hatchBtnTxt}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={cm.hatchBtnRed} onPress={() => markFailed(u)}>
                          <Text style={cm.hatchBtnTxt}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {isHatched && (
                      <TouchableOpacity style={cm.hatchBoxOn} onPress={() => resetHatch(u)}>
                        <Text style={cm.hatchBoxTxt}>✓ Εκκολ.</Text>
                      </TouchableOpacity>
                    )}
                    {isFailed && (
                      <TouchableOpacity style={cm.hatchBoxFailed} onPress={() => resetHatch(u)}>
                        <Text style={cm.hatchBoxTxt}>✕ Απέτυχε</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>}
          <TouchableOpacity style={pk.cancelBtn} onPress={onClose}>
            <Text style={pk.cancelText}>Κλείσιμο</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── LAYING MODAL (βήμα +25) ──────────────────────────────────────────────────
function LayingModal({ visible, cycleId, onClose }: {
  visible: boolean; cycleId: string | null; onClose: () => void;
}) {
  const [units, setUnits] = useState<BreedingUnit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!cycleId) return;
    setLoading(true);
    try {
      const all = await getUnitsByCycle(cycleId);
      setUnits(all.filter(u => u.hatched && u.status !== 'sold' && u.status !== 'upgraded_to_hive'));
    } catch {}
    setLoading(false);
  }, [cycleId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const toggleLaying = async (u: BreedingUnit) => { await setLaying(u.id, !u.queen_laying, u.sealed_brood); load(); };
  const toggleSealed = async (u: BreedingUnit) => { await setLaying(u.id, u.queen_laying, !u.sealed_brood); load(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <View style={cm.sheet}>
          <View style={pk.handle} />
          <Text style={cm.title}>📋 Έλεγχος Ωοτοκίας</Text>
          {loading ? <ActivityIndicator color={HONEY} style={{ marginVertical: 20 }} /> :
           units.length === 0 ? <Text style={cm.empty}>Δεν υπάρχουν εκκολαμμένες βασίλισσες. Συμπλήρωσε πρώτα την εκκόλαψη (βήμα +12).</Text> :
            <ScrollView style={{ maxHeight: 440 }}>
              {units.map(u => (
                <View key={u.id} style={cm.layBlock}>
                  <Text style={cm.unitName}>{UNIT_TYPE_EMOJI[u.unit_type]} {u.label || UNIT_TYPE_LABELS[u.unit_type]}</Text>
                  <View style={cm.layRow}>
                    <TouchableOpacity style={[cm.layChip, u.queen_laying && cm.layChipGreen]} onPress={() => toggleLaying(u)}>
                      <Text style={[cm.layChipTxt, u.queen_laying && { color: '#fff' }]}>
                        {u.queen_laying ? '✅ Γεννάει' : 'Γεννάει;'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[cm.layChip, u.sealed_brood && cm.layChipOrange]} onPress={() => toggleSealed(u)}>
                      <Text style={[cm.layChipTxt, u.sealed_brood && { color: '#fff' }]}>
                        {u.sealed_brood ? '✅ Σφραγ. γόνος' : 'Σφραγ. γόνος;'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>}
          <TouchableOpacity style={pk.cancelBtn} onPress={onClose}>
            <Text style={pk.cancelText}>Κλείσιμο</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── UPGRADE MODAL (παραφυάδα → κυψέλη) ───────────────────────────────────────
function UpgradeModal({ visible, unit, onClose, onDone }: {
  visible: boolean; unit: BreedingUnit | null; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setName(''); }, [visible]);

  const handle = async () => {
    if (!unit || !name.trim()) { Alert.alert('Σφάλμα', 'Δώσε αριθμό/όνομα κυψέλης'); return; }
    setSaving(true);
    try { await upgradeToHive(unit, name.trim()); onDone(); onClose(); }
    catch (e: any) { Alert.alert('Σφάλμα', e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cm.promptOverlay}>
        <View style={cm.promptBox}>
          <Text style={cm.promptTitle}>⬆️ Αναβάθμιση σε Κυψέλη</Text>
          <Text style={cm.promptSub}>Δώσε αριθμό/όνομα για τη νέα παραγωγική κυψέλη</Text>
          <TextInput style={cm.promptInput} value={name} onChangeText={setName}
            placeholder="π.χ. 125" placeholderTextColor={MUTED} keyboardType="default" autoFocus />
          <View style={cm.promptBtns}>
            <TouchableOpacity style={cm.promptCancel} onPress={onClose}>
              <Text style={cm.promptCancelTxt}>Ακύρωση</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cm.promptOk, saving && { opacity: 0.5 }]} onPress={handle} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={cm.promptOkTxt}>Δημιουργία</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function QueenScreen({ navigation }: any) {
  const { user } = useAuth();

  const [tab, setTab]             = useState<Tab>('cycles');
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

  const [hiveNumberStart,    setHiveNumberStart]    = useState('');
  const [hiveNumberFinisher, setHiveNumberFinisher] = useState('');
  const [queenBreed,         setQueenBreed]         = useState<QueenBreed>('');
  const [breedModalVisible,  setBreedModalVisible]  = useState(false);

  const [cellsModalVisible,  setCellsModalVisible]  = useState(false);
  const [hatchModalVisible,  setHatchModalVisible]  = useState(false);
  const [layingModalVisible, setLayingModalVisible] = useState(false);

  // Units tab
  const [units, setUnits]         = useState<BreedingUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [upgradeUnit, setUpgradeUnit]   = useState<BreedingUnit | null>(null);

  const monthRef = useRef<TextInput>(null);
  const yearRef  = useRef<TextInput>(null);

  // Εξασφάλιση breeding προϊόντων στο finance
  useEffect(() => { ensureBreedingProducts().catch(() => {}); }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('queen_rearing').select('*').order('start_date', { ascending: false });
    setRecords((data ?? []) as QueenRearing[]);
    setLoading(false);
  }, []);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const loadUnits = useCallback(async () => {
    setUnitsLoading(true);
    try { setUnits(await getActiveUnits()); } catch {}
    setUnitsLoading(false);
  }, []);
  useEffect(() => { if (tab === 'units') loadUnits(); }, [tab, loadUnits]);

  // ── DATE ──
  const handleDay = (val: string) => { const v = val.replace(/\D/g, '').slice(0, 2); setDateDay(v); if (v.length === 2) monthRef.current?.focus(); rebuildDate(v, dateMonth, dateYear); };
  const handleMonth = (val: string) => { const v = val.replace(/\D/g, '').slice(0, 2); setDateMonth(v); if (v.length === 2) yearRef.current?.focus(); rebuildDate(dateDay, v, dateYear); };
  const handleYear = (val: string) => { const v = val.replace(/\D/g, '').slice(0, 4); setDateYear(v); rebuildDate(dateDay, dateMonth, v); };
  const rebuildDate = (d: string, m: string, y: string) => {
    if (d.length >= 1 && m.length >= 1 && y.length === 4) {
      const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      setStartDate(!isNaN(Date.parse(iso)) ? iso : '');
    } else setStartDate('');
  };
  const resetDateFields = () => {
    setDateDay(''); setDateMonth(''); setDateYear(''); setStartDate('');
    setHiveNumberStart(''); setHiveNumberFinisher(''); setQueenBreed(''); setNotes('');
  };

  const saveCycle = async () => {
    if (!startDate) { Alert.alert('Σφάλμα', 'Επίλεξε ημερομηνία έναρξης'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('queen_rearing').insert([{
        user_id: user?.id, purpose, method, start_date: startDate,
        notes: notes.trim() || null, completed_steps: [],
        hive_number_start: hiveNumberStart.trim() || null,
        hive_number_finisher: method === 'starter_finisher' ? (hiveNumberFinisher.trim() || null) : null,
        queen_breed: queenBreed || null, queen_cells_count: 0, queen_cells_assignments: [],
      }]).select().single();
      if (error) throw error;
      setActiveRecord(data as QueenRearing);
      setView('calendar'); loadRecords(); resetDateFields();
    } catch (e: any) { Alert.alert('Σφάλμα', e.message); }
    finally { setSaving(false); }
  };

  const toggleStep = async (record: QueenRearing, stepIndex: number) => {
    const completed = record.completed_steps ?? [];
    const newCompleted = completed.includes(stepIndex) ? completed.filter(i => i !== stepIndex) : [...completed, stepIndex];
    const { data, error } = await supabase.from('queen_rearing').update({ completed_steps: newCompleted }).eq('id', record.id).select().single();
    if (!error && data) {
      const updated = data as QueenRearing;
      setActiveRecord(updated);
      setRecords(prev => prev.map(r => r.id === record.id ? updated : r));
    }
  };

  const refreshActive = async () => {
    if (!activeRecord) return;
    const { data } = await supabase.from('queen_rearing').select('*').eq('id', activeRecord.id).single();
    if (data) {
      setActiveRecord(data as QueenRearing);
      setRecords(prev => prev.map(r => r.id === data.id ? (data as QueenRearing) : r));
    }
  };

  const deleteRecord = (id: string) => {
    Alert.alert('Διαγραφή', 'Να διαγραφεί αυτός ο κύκλος;', [
      { text: 'Ακύρωση', style: 'cancel' },
      { text: 'Διαγραφή', style: 'destructive', onPress: async () => {
        await supabase.from('queen_rearing').delete().eq('id', id);
        loadRecords();
        if (activeRecord?.id === id) { setActiveRecord(null); setView('home'); }
      }},
    ]);
  };

  // ── Πώληση (navigate AddSale) ──
  const goToSale = (productHint: string) => {
    Alert.alert('Καταγραφή Πώλησης',
      `Στην επόμενη οθόνη επίλεξε το προϊόν "${productHint}" και συμπλήρωσε πελάτη, ποσότητα και τιμή.`,
      [{ text: 'Συνέχεια', onPress: () => navigation.navigate('AddSale', { year: new Date().getFullYear() }) }]);
  };

  // ── Units actions ──
  const convertToNucleus = async (u: BreedingUnit) => {
    await convertUnitType(u.id, 'nucleus'); loadUnits();
  };

  const steps = method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;

  // ═══ TAB BAR ═══
  const TabBar = () => (
    <View style={s.tabBar}>
      <TouchableOpacity style={[s.tabBtn, tab === 'cycles' && s.tabBtnOn]} onPress={() => setTab('cycles')}>
        <Text style={[s.tabBtnTxt, tab === 'cycles' && s.tabBtnTxtOn]}>📅 Κύκλοι</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.tabBtn, tab === 'units' && s.tabBtnOn]} onPress={() => { setTab('units'); }}>
        <Text style={[s.tabBtnTxt, tab === 'units' && s.tabBtnTxtOn]}>🐝 Παραφυάδες-Κυψελίδια</Text>
      </TouchableOpacity>
    </View>
  );

  // ═══ UNITS TAB ═══
  if (tab === 'units') {
    return (
      <View style={s.container}>
        <Text style={s.title}>👑 Βασιλοτροφία</Text>
        <TabBar />
        {unitsLoading ? <ActivityIndicator color={HONEY} style={{ marginTop: 40 }} /> :
         units.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ fontSize: 50 }}>🐝</Text>
            <Text style={s.emptyText}>Δεν υπάρχουν ενεργές μονάδες.{'\n'}Δημιουργούνται από την κατανομή κελιών (βήμα +10).</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scrollContent}>
            {units.map(u => (
              <View key={u.id} style={s.unitCard}>
                <View style={s.unitTop}>
                  <Text style={s.unitEmoji}>{UNIT_TYPE_EMOJI[u.unit_type]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.unitTitle}>{u.label || UNIT_TYPE_LABELS[u.unit_type]}</Text>
                    <Text style={s.unitMeta}>{UNIT_TYPE_LABELS[u.unit_type]}{u.queen_breed ? ` • ${u.queen_breed}` : ''}</Text>
                  </View>
                </View>
                <View style={s.badgeRow}>
                  {u.hatched && <View style={s.badgeGreen}><Text style={s.badgeTxt}>🐝 Εκκολάφθηκε</Text></View>}
                  {u.queen_laying && <View style={s.badgeGreen}><Text style={s.badgeTxt}>✅ Γεννάει</Text></View>}
                  {u.sealed_brood && <View style={s.badgeOrange}><Text style={s.badgeTxt}>Σφραγ. γόνος</Text></View>}
                </View>
                <View style={s.unitActions}>
                  {u.unit_type === 'nucleus' && (
                    <>
                      <TouchableOpacity style={s.actUpgrade} onPress={() => setUpgradeUnit(u)}>
                        <Text style={s.actTxt}>⬆️ Σε Κυψέλη</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actSale} onPress={() => goToSale('Παραφυάδες')}>
                        <Text style={s.actTxt}>💰 Πώληση Παραφυάδας</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {u.unit_type === 'mating' && (
                    <>
                      <TouchableOpacity style={s.actConvert} onPress={() => convertToNucleus(u)}>
                        <Text style={s.actTxt}>→ Παραφυάδα</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actSale} onPress={() => goToSale('Βασίλισσες')}>
                        <Text style={s.actTxt}>💰 Πώληση</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {u.unit_type === 'q8' && (
                    <>
                      <TouchableOpacity style={s.actConvert} onPress={() => convertToNucleus(u)}>
                        <Text style={s.actTxt}>→ Παραφυάδα</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.actSale} onPress={() => goToSale('Βασίλισσες')}>
                        <Text style={s.actTxt}>💰 Πώληση Βασίλισσας</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {u.unit_type === 'other' && (
                    <TouchableOpacity style={s.actSale} onPress={() => goToSale('Βασίλισσες')}>
                      <Text style={s.actTxt}>💰 Πώληση</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
        <UpgradeModal visible={!!upgradeUnit} unit={upgradeUnit}
          onClose={() => setUpgradeUnit(null)} onDone={() => { loadUnits(); }} />
      </View>
    );
  }

  // ═══ CYCLES TAB ═══
  // ── HOME ──
  if (view === 'home') {
    const today = new Date().toISOString().split('T')[0];
    const activeRecords = records.filter(r => {
      const rSteps = r.method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;
      return addDays(r.start_date, rSteps[rSteps.length - 1].day) >= today;
    });
    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <Text style={s.title}>👑 Βασιλοτροφία</Text>
        <TabBar />
        <View style={s.row}>
          <TouchableOpacity style={[s.purposeCard, { borderColor: HONEY }]}
            onPress={() => { setPurpose('queens'); setView('method_select'); }}>
            <Text style={s.purposeIcon}>👑</Text>
            <Text style={s.purposeTitle}>Βασίλισσες</Text>
            <Text style={s.purposeDesc}>Νέος κύκλος παραγωγής</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.purposeCard, { borderColor: '#F5C842' }]}
            onPress={() => { setPurpose('royal_jelly'); setView('method_select'); }}>
            <Text style={s.purposeIcon}>🍯</Text>
            <Text style={s.purposeTitle}>Βασιλικός Πολτός</Text>
            <Text style={s.purposeDesc}>Νέος κύκλος παραγωγής</Text>
          </TouchableOpacity>
        </View>
        {activeRecords.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>🟢 Ενεργοί Κύκλοι</Text>
            {activeRecords.map(r => {
              const rSteps = r.method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;
              return (
                <TouchableOpacity key={r.id} style={s.recordCard}
                  onPress={() => { setActiveRecord(r); setMethod(r.method); setView('calendar'); }}>
                  <View style={s.recordHeader}>
                    <Text style={s.recordPurpose}>{purposeLabel(r.purpose)}</Text>
                    <Text style={s.recordMethod}>{methodLabel(r.method)}</Text>
                  </View>
                  <Text style={s.recordDate}>Έναρξη: {formatDate(r.start_date)}</Text>
                  {r.hive_number_start && (
                    <Text style={s.recordMeta}>🐝 Κυψέλη Έναρξης: #{r.hive_number_start}
                      {r.hive_number_finisher ? `  •  Αποπεράτωσης: #${r.hive_number_finisher}` : ''}</Text>
                  )}
                  {r.queen_breed && <Text style={s.recordMeta}>👑 Φυλή: {r.queen_breed}</Text>}
                  {!!r.queen_cells_count && <Text style={s.recordMeta}>🔬 Κελιά: {r.queen_cells_count}</Text>}
                  <View style={s.progressBar}>
                    <View style={[s.progressFill, { width: `${Math.round((r.completed_steps.length / rSteps.length) * 100)}%` }]} />
                  </View>
                  <Text style={s.progressText}>{r.completed_steps.length} / {rSteps.length} βήματα</Text>
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

  // ── METHOD SELECT ──
  if (view === 'method_select') {
    return (
      <View style={s.container}>
        <TouchableOpacity style={s.backRow} onPress={() => setView('home')}><Text style={s.backText}>← Πίσω</Text></TouchableOpacity>
        <Text style={s.title}>{purposeLabel(purpose)}</Text>
        <Text style={s.subtitle}>Επίλεξε μέθοδο</Text>
        <TouchableOpacity style={[s.methodCard, { borderColor: HONEY }]}
          onPress={() => { setMethod('starter'); resetDateFields(); setView('date_select'); }}>
          <Text style={s.methodIcon}>🐝</Text>
          <Text style={s.methodTitle}>Μελίσσι Έναρξης</Text>
          <Text style={s.methodDesc}>Ένα μελίσσι όλη τη διαδικασία</Text>
          <Text style={s.methodDuration}>⏱ 55 ημέρες</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.methodCard, { borderColor: PURPLE }]}
          onPress={() => { setMethod('starter_finisher'); resetDateFields(); setView('date_select'); }}>
          <Text style={s.methodIcon}>🐝🐝</Text>
          <Text style={s.methodTitle}>Έναρξης + Αποπεράτωσης</Text>
          <Text style={s.methodDesc}>Δύο μελίσσια</Text>
          <Text style={s.methodDuration}>⏱ 55 ημέρες</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── DATE SELECT ──
  if (view === 'date_select') {
    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.backRow} onPress={() => setView('method_select')}><Text style={s.backText}>← Πίσω</Text></TouchableOpacity>
        <Text style={s.title}>Ημερομηνία Εμβολιασμού</Text>
        <Text style={s.subtitle}>Day 0 — {methodLabel(method)}</Text>
        <View style={s.card}>
          <Text style={s.fieldLabel}>Ημερομηνία έναρξης</Text>
          <View style={s.dateRow}>
            <View style={s.dateFieldWrap}>
              <Text style={s.dateFieldLabel}>Ημέρα</Text>
              <TextInput style={s.dateField} value={dateDay} onChangeText={handleDay} placeholder="ΗΗ" placeholderTextColor={MUTED} keyboardType="number-pad" maxLength={2} returnKeyType="next" />
            </View>
            <Text style={s.dateSep}>/</Text>
            <View style={s.dateFieldWrap}>
              <Text style={s.dateFieldLabel}>Μήνας</Text>
              <TextInput ref={monthRef} style={s.dateField} value={dateMonth} onChangeText={handleMonth} placeholder="ΜΜ" placeholderTextColor={MUTED} keyboardType="number-pad" maxLength={2} returnKeyType="next" />
            </View>
            <Text style={s.dateSep}>/</Text>
            <View style={[s.dateFieldWrap, { flex: 2 }]}>
              <Text style={s.dateFieldLabel}>Έτος</Text>
              <TextInput ref={yearRef} style={s.dateField} value={dateYear} onChangeText={handleYear} placeholder="ΕΕΕΕ" placeholderTextColor={MUTED} keyboardType="number-pad" maxLength={4} returnKeyType="done" />
            </View>
          </View>
          {startDate ? <Text style={s.dateParsed}>✅ {formatDate(startDate)}</Text>
            : (dateDay || dateMonth || dateYear) ? <Text style={s.dateInvalid}>⚠️ Μη έγκυρη ημερομηνία</Text> : null}
        </View>
        <View style={s.card}>
          <Text style={s.fieldLabel}>Αριθμός Μελισσιού Έναρξης</Text>
          <TextInput style={s.textInput} value={hiveNumberStart} onChangeText={setHiveNumberStart} placeholder="π.χ. 12" placeholderTextColor={MUTED} keyboardType="number-pad" />
        </View>
        {method === 'starter_finisher' && (
          <View style={s.card}>
            <Text style={s.fieldLabel}>Αριθμός Μελισσιού Αποπεράτωσης</Text>
            <TextInput style={s.textInput} value={hiveNumberFinisher} onChangeText={setHiveNumberFinisher} placeholder="π.χ. 27" placeholderTextColor={MUTED} keyboardType="number-pad" />
          </View>
        )}
        <View style={s.card}>
          <Text style={s.fieldLabel}>Φυλή Βασίλισσας</Text>
          <TouchableOpacity style={s.breedSelector} onPress={() => setBreedModalVisible(true)}>
            <Text style={[s.breedSelectorText, !queenBreed && { color: MUTED }]}>{queenBreed || '— Επιλογή φυλής —'}</Text>
            <Text style={s.breedArrow}>▾</Text>
          </TouchableOpacity>
        </View>
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
        <View style={s.card}>
          <Text style={s.fieldLabel}>Σημειώσεις (προαιρετικό)</Text>
          <TextInput style={[s.textInput, { minHeight: 80, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="π.χ. Ράτσα μητρικής..." placeholderTextColor={MUTED} multiline />
        </View>
        <TouchableOpacity style={[s.startBtn, (!startDate || saving) && { opacity: 0.4 }]} onPress={saveCycle} disabled={!startDate || saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.startBtnText}>🚀 Έναρξη κύκλου</Text>}
        </TouchableOpacity>
        <BreedPickerModal visible={breedModalVisible} selected={queenBreed} onSelect={setQueenBreed} onClose={() => setBreedModalVisible(false)} />
      </ScrollView>
    );
  }

  // ── CALENDAR ──
  if (view === 'calendar' && activeRecord) {
    const currentSteps   = activeRecord.method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;
    const completedSteps = activeRecord.completed_steps ?? [];
    const nextStepIndex  = currentSteps.findIndex((_, i) => !completedSteps.includes(i));
    const nextStepDate   = nextStepIndex >= 0 ? addDays(activeRecord.start_date, currentSteps[nextStepIndex].day) : null;

    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <TouchableOpacity style={s.backRow} onPress={() => setView('home')}><Text style={s.backText}>← Πίσω</Text></TouchableOpacity>
        <Text style={s.title}>{purposeLabel(activeRecord.purpose)}</Text>
        <Text style={s.subtitle}>{methodLabel(activeRecord.method)}</Text>
        {(activeRecord.hive_number_start || activeRecord.queen_breed) && (
          <View style={[s.card, { marginBottom: 12 }]}>
            {activeRecord.hive_number_start && (
              <Text style={s.metaRow}>🐝 Κυψέλη Έναρξης: <Text style={s.metaValue}>#{activeRecord.hive_number_start}</Text>
                {activeRecord.hive_number_finisher ? `  •  Αποπεράτωσης: #${activeRecord.hive_number_finisher}` : ''}</Text>
            )}
            {activeRecord.queen_breed && <Text style={s.metaRow}>👑 Φυλή: <Text style={s.metaValue}>{activeRecord.queen_breed}</Text></Text>}
          </View>
        )}
        <View style={s.progressCard}>
          <View style={s.progressBar}><View style={[s.progressFill, { width: `${Math.round((completedSteps.length / currentSteps.length) * 100)}%` }]} /></View>
          <Text style={s.progressText}>{completedSteps.length} / {currentSteps.length} βήματα ολοκληρώθηκαν</Text>
          {nextStepDate && <Text style={s.nextStep}>⏭️ Επόμενο: {formatDate(nextStepDate)}</Text>}
        </View>

        {currentSteps.map((step, i) => {
          const stepDate    = addDays(activeRecord.start_date, step.day);
          const isCompleted = completedSteps.includes(i);
          const todayStep   = isToday(stepDate);
          const pastStep    = isPast(stepDate);
          const isCells  = step.id === 'queen_cells';
          const isHatch  = step.id === 'hatch';
          const isLaying = step.id === 'laying';
          const interactive = isCells || isHatch || isLaying;

          return (
            <View key={i}>
              <TouchableOpacity
                style={[s.stepCard, isCompleted && s.stepDone, todayStep && s.stepToday,
                  !isCompleted && pastStep && !todayStep && s.stepOverdue, interactive && s.stepInteractive]}
                onPress={() => toggleStep(activeRecord, i)}>
                <View style={[s.stepCheck, isCompleted && s.stepCheckDone, todayStep && s.stepCheckToday]}>
                  <Text style={s.stepCheckText}>{isCompleted ? '✓' : String(i + 1)}</Text>
                </View>
                <View style={s.stepContent}>
                  <Text style={[s.stepDate, todayStep && { color: HONEY }]}>
                    {todayStep ? '📅 ΣΗΜΕΡΑ' : formatDate(stepDate)}{!isCompleted && pastStep && !todayStep ? ' ⚠️' : ''}
                  </Text>
                  <Text style={[s.stepAction, isCompleted && s.stepActionDone, step.important && !isCompleted && s.stepActionImportant]}>{step.action}</Text>
                  <Text style={s.stepDay}>Ημέρα {step.day}</Text>
                </View>
              </TouchableOpacity>

              {isCells && (
                <TouchableOpacity style={s.interactiveBtn} onPress={() => setCellsModalVisible(true)}>
                  <Text style={s.interactiveBtnText}>🔬 {activeRecord.queen_cells_count ? `${activeRecord.queen_cells_count} κελιά — κατανομή` : 'Καταγραφή & Κατανομή Κελιών'}</Text>
                  <Text style={s.interactiveArrow}>›</Text>
                </TouchableOpacity>
              )}
              {isHatch && (
                <TouchableOpacity style={s.interactiveBtn} onPress={() => setHatchModalVisible(true)}>
                  <Text style={s.interactiveBtnText}>🐝 Έλεγχος Εκκόλαψης ανά μονάδα</Text>
                  <Text style={s.interactiveArrow}>›</Text>
                </TouchableOpacity>
              )}
              {isLaying && (
                <TouchableOpacity style={s.interactiveBtn} onPress={() => setLayingModalVisible(true)}>
                  <Text style={s.interactiveBtnText}>📋 Έλεγχος Ωοτοκίας ανά μονάδα</Text>
                  <Text style={s.interactiveArrow}>›</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {activeRecord.notes && (
          <View style={s.notesCard}>
            <Text style={s.notesTitle}>📝 Σημειώσεις</Text>
            <Text style={s.notesText}>{activeRecord.notes}</Text>
          </View>
        )}
        <TouchableOpacity style={s.deleteBtn} onPress={() => deleteRecord(activeRecord.id)}><Text style={s.deleteBtnText}>🗑️ Διαγραφή κύκλου</Text></TouchableOpacity>

        <QueenCellsModal visible={cellsModalVisible} record={activeRecord}
          onClose={() => setCellsModalVisible(false)} onSaved={refreshActive}
          onSellCells={() => goToSale('Βασιλικά Κελιά')} />
        <HatchModal visible={hatchModalVisible} cycleId={activeRecord.id} onClose={() => setHatchModalVisible(false)} />
        <LayingModal visible={layingModalVisible} cycleId={activeRecord.id} onClose={() => setLayingModalVisible(false)} />
      </ScrollView>
    );
  }

  // ── HISTORY ──
  if (view === 'history') {
    const today = new Date().toISOString().split('T')[0];
    return (
      <ScrollView style={s.container} contentContainerStyle={s.scrollContent}>
        <TouchableOpacity style={s.backRow} onPress={() => setView('home')}><Text style={s.backText}>← Πίσω</Text></TouchableOpacity>
        <Text style={s.title}>📋 Ιστορικό</Text>
        {loading && <ActivityIndicator color={HONEY} style={{ marginTop: 40 }} />}
        {!loading && records.length === 0 && <Text style={s.emptyText}>Δεν υπάρχουν κύκλοι ακόμα.</Text>}
        {records.map(r => {
          const rSteps  = r.method === 'starter' ? STEPS_STARTER : STEPS_STARTER_FINISHER;
          const endDate = addDays(r.start_date, rSteps[rSteps.length - 1].day);
          const active  = endDate >= today;
          return (
            <TouchableOpacity key={r.id} style={[s.recordCard, active && s.recordCardActive]}
              onPress={() => { setActiveRecord(r); setMethod(r.method); setView('calendar'); }}>
              <View style={s.recordHeader}>
                <Text style={s.recordPurpose}>{purposeLabel(r.purpose)}</Text>
                <Text style={[s.recordStatus, active ? s.statusActive : s.statusDone]}>{active ? '🟢 Ενεργός' : '✅ Ολοκληρώθηκε'}</Text>
              </View>
              <Text style={s.recordMethod}>{methodLabel(r.method)}</Text>
              <Text style={s.recordDate}>{formatDate(r.start_date)} → {formatDate(endDate)}</Text>
              {r.hive_number_start && (
                <Text style={s.recordMeta}>🐝 #{r.hive_number_start}{r.hive_number_finisher ? ` + #${r.hive_number_finisher}` : ''}{r.queen_breed ? `  •  ${r.queen_breed}` : ''}</Text>
              )}
              <Text style={s.recordSteps}>{r.completed_steps.length} / {rSteps.length} βήματα</Text>
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
const ORANGE = '#EA580C';

// ─── PICKER STYLES ────────────────────────────────────────────────────────────
const pk = StyleSheet.create({
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

// ─── CELL / MODAL STYLES ──────────────────────────────────────────────────────
const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  title:   { color: TEXT, fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  label:   { color: MUTED, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  empty:   { color: MUTED, fontSize: 14, textAlign: 'center', marginVertical: 24, lineHeight: 20 },
  countInput: { backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 14, fontSize: 22, fontWeight: '700', textAlign: 'center', borderWidth: 1, borderColor: '#2A3A5A', marginBottom: 8 },
  cellBlock: { backgroundColor: '#0E1320', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#1E2A40' },
  cellHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cellNum:  { width: 28, height: 28, borderRadius: 14, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  cellNumText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cellTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  destRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  destChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: BG, borderWidth: 1, borderColor: '#2A3A5A' },
  destChipOn: { backgroundColor: '#1A2D1A', borderColor: GREEN },
  destTxt:  { color: MUTED, fontSize: 12, fontWeight: '600' },
  destTxtOn: { color: GREEN },
  otherInput: { backgroundColor: BG, color: TEXT, borderRadius: 8, padding: 10, fontSize: 14, borderWidth: 1, borderColor: '#2A3A5A', marginTop: 8 },
  saveBtn:  { backgroundColor: GREEN, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 16 },
  saveTxt:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  unitRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: BG, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1E2A40' },
  unitRowOn: { borderColor: GREEN, backgroundColor: '#0F1F12' },
  unitEmoji: { fontSize: 22 },
  unitName: { color: TEXT, fontSize: 14, fontWeight: '700' },
  unitSub:  { color: MUTED, fontSize: 12, marginTop: 2 },
  hatchBox: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E2A40' },
  hatchBoxOn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: GREEN },
  hatchBoxFailed: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: RED },
  hatchBoxTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  unitRowFailed: { borderColor: RED, backgroundColor: '#1A0808' },
  failedNote: { color: '#F87171', fontSize: 11, marginTop: 3 },
  hatchBtns: { flexDirection: 'row', gap: 6 },
  hatchBtnGreen: { width: 36, height: 36, borderRadius: 18, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  hatchBtnRed: { width: 36, height: 36, borderRadius: 18, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  hatchBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  layBlock: { backgroundColor: BG, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1E2A40' },
  layRow:   { flexDirection: 'row', gap: 8, marginTop: 8 },
  layChip:  { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0E1320', borderWidth: 1, borderColor: '#2A3A5A', alignItems: 'center' },
  layChipGreen: { backgroundColor: GREEN, borderColor: GREEN },
  layChipOrange: { backgroundColor: ORANGE, borderColor: ORANGE },
  layChipTxt: { color: MUTED, fontSize: 12, fontWeight: '700' },
  promptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  promptBox: { backgroundColor: CARD, borderRadius: 18, padding: 22 },
  promptTitle: { color: TEXT, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  promptSub: { color: MUTED, fontSize: 13, marginBottom: 14 },
  promptInput: { backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 14, fontSize: 18, fontWeight: '700', textAlign: 'center', borderWidth: 1, borderColor: '#2A3A5A' },
  promptBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  promptCancel: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: BG, alignItems: 'center' },
  promptCancelTxt: { color: MUTED, fontSize: 15, fontWeight: '600' },
  promptOk: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center' },
  promptOkTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── MAIN STYLES ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 16 },
  scrollContent: { paddingBottom: 56 },
  title:    { fontSize: 24, fontWeight: '800', color: HONEY, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 20 },
  backRow:  { flexDirection: 'row', marginBottom: 16 },
  backText: { color: MUTED, fontSize: 15 },

  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: CARD, alignItems: 'center', borderWidth: 1.5, borderColor: '#1E2A40' },
  tabBtnOn: { backgroundColor: '#1A2438', borderColor: HONEY },
  tabBtnTxt: { color: MUTED, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  tabBtnTxtOn: { color: HONEY },

  row: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  purposeCard: { flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1.5, elevation: 5 },
  purposeIcon:  { fontSize: 36, marginBottom: 8 },
  purposeTitle: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 4, textAlign: 'center' },
  purposeDesc:  { fontSize: 11, color: MUTED, textAlign: 'center', lineHeight: 16 },
  methodCard: { backgroundColor: CARD, borderRadius: 18, padding: 24, marginBottom: 14, alignItems: 'center', borderWidth: 1.5, elevation: 5 },
  methodIcon:     { fontSize: 40, marginBottom: 8 },
  methodTitle:    { fontSize: 18, fontWeight: '700', color: TEXT, marginBottom: 6 },
  methodDesc:     { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  methodDuration: { fontSize: 12, color: HONEY },
  card: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 12 },
  fieldLabel:    { fontSize: 13, color: MUTED, marginBottom: 10, fontWeight: '600' },
  dateRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  dateFieldWrap: { flex: 1 },
  dateFieldLabel:{ fontSize: 11, color: MUTED, marginBottom: 4, textAlign: 'center' },
  dateField: { backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 14, fontSize: 20, borderWidth: 1, borderColor: '#2A3A5A', textAlign: 'center', fontWeight: '700' },
  dateSep:     { color: MUTED, fontSize: 24, fontWeight: '700', paddingBottom: 10 },
  dateParsed:  { color: GREEN, fontSize: 13, marginTop: 10 },
  dateInvalid: { color: RED, fontSize: 13, marginTop: 10 },
  textInput: { backgroundColor: BG, color: TEXT, borderRadius: 10, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#2A3A5A' },
  breedSelector: { backgroundColor: BG, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#2A3A5A', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breedSelectorText: { color: TEXT, fontSize: 16 },
  breedArrow:        { color: MUTED, fontSize: 18 },
  previewCard:  { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 12 },
  previewTitle: { fontSize: 11, color: HONEY, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  previewRow:   { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1E2A40', gap: 12 },
  previewDate:  { color: HONEY, fontSize: 12, width: 86 },
  previewAction:{ color: TEXT, fontSize: 12, flex: 1 },
  previewMore:  { color: MUTED, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  startBtn: { backgroundColor: GREEN, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 4, elevation: 5 },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  metaRow:   { color: MUTED, fontSize: 13, marginBottom: 4 },
  metaValue: { color: TEXT, fontWeight: '600' },
  progressCard: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 16 },
  progressBar:  { height: 6, backgroundColor: BG, borderRadius: 3, marginBottom: 6 },
  progressFill: { height: 6, backgroundColor: HONEY, borderRadius: 3 },
  progressText: { fontSize: 12, color: MUTED, marginBottom: 4 },
  nextStep:     { fontSize: 13, color: HONEY },
  stepCard: { flexDirection: 'row', backgroundColor: CARD, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, alignItems: 'flex-start' },
  stepDone:    { opacity: 0.55 },
  stepToday:   { borderWidth: 1.5, borderColor: HONEY, backgroundColor: '#1A2D1A' },
  stepOverdue: { borderWidth: 1, borderColor: RED, backgroundColor: '#2D0A0A' },
  stepInteractive: { borderWidth: 1, borderColor: PURPLE },
  stepCheck: { width: 32, height: 32, borderRadius: 16, marginTop: 2, backgroundColor: '#1E2A40', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: MUTED },
  stepCheckDone:  { backgroundColor: GREEN, borderColor: GREEN },
  stepCheckToday: { backgroundColor: HONEY, borderColor: HONEY },
  stepCheckText:  { color: TEXT, fontSize: 12, fontWeight: '700' },
  stepContent:         { flex: 1 },
  stepDate:            { fontSize: 12, color: MUTED, marginBottom: 4 },
  stepAction:          { fontSize: 14, color: TEXT, lineHeight: 21 },
  stepActionDone:      { textDecorationLine: 'line-through', color: MUTED },
  stepActionImportant: { color: HONEY, fontWeight: '600' },
  stepDay:             { fontSize: 11, color: MUTED, marginTop: 4 },
  interactiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E1535', borderRadius: 12, padding: 14, marginBottom: 10, marginTop: -4, marginLeft: 44, borderWidth: 1, borderColor: PURPLE },
  interactiveBtnText: { color: '#C4B5FD', fontSize: 13, fontWeight: '700', flex: 1 },
  interactiveArrow: { color: PURPLE, fontSize: 22, fontWeight: '700' },
  notesCard:  { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 12 },
  notesTitle: { fontSize: 12, color: HONEY, fontWeight: '700', marginBottom: 8 },
  notesText:  { color: TEXT, fontSize: 14, lineHeight: 22 },
  deleteBtn:     { alignItems: 'center', padding: 16, marginTop: 8 },
  deleteBtnText: { color: RED, fontSize: 14 },
  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 12, color: HONEY, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  recordCard: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1E2A40' },
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
  emptyText:      { color: MUTED, fontSize: 14, textAlign: 'center', marginTop: 20, fontStyle: 'italic', lineHeight: 20 },
  // Units tab
  unitCard: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1E2A40' },
  unitEmoji: { fontSize: 32 },
  unitTop:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  unitTitle: { color: TEXT, fontSize: 16, fontWeight: '700' },
  unitMeta:  { color: MUTED, fontSize: 12, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  badgeGreen: { backgroundColor: '#14532D', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeOrange: { backgroundColor: '#7C2D12', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  unitActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actUpgrade: { backgroundColor: HONEY, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  actConvert: { backgroundColor: PURPLE, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  actSale:    { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  actTxt:     { color: '#fff', fontSize: 13, fontWeight: '700' },
});