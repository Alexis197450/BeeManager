// screens/InspectionScreen.tsx — BeeManager v2.0 FINAL
// Πλήρης Οθόνη Επιθεώρησης: Καθοδηγούμενη | Ελεύθερη | Φωνή | Ειδοποιήσεις | Υπενθυμίσεις

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Modal, Alert as RNAlert,
} from 'react-native';
import * as Speech from 'expo-speech';
import { supabase } from '../supabase';
import { voiceService } from '../voiceService';
import { useLock } from '../hooks/useLock';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ScreenMode = 'select' | 'guided' | 'free';

interface InspectionData {
  hive_id: string;
  date: string;
  mode: string;
  population_frames: number | null;
  population_strength: string | null;
  queen_present: string | null;
  queen_status: string | null;
  queen_laying: string | null;
  brood_frames: number | null;
  brood_condition: string | null;
  brood_type: string | null;
  queen_cells: number | null;
  honey_frames: number | null;
  pollen_frames: number | null;
  varroa_level: string | null;
  varroa_measurement: string | null;
  diseases: string | null;
  equipment_status: string | null;
  equipment_notes: string | null;
  feeding_type: string | null;
  feeding_amount: string | null;
  treatment_type: string | null;
  treatment_dose: string | null;
  management_actions: string | null;
  next_visit: string | null;
  next_visit_reason: string | null;
  urgent: boolean;
  notes: string | null;
  notifications_disabled: boolean;
}

interface AppAlert {
  id: string;
  level: 'critical' | 'warning';
  message: string;
  dismissed: boolean;
}

interface Reminder {
  date: string;
  description: string;
  priority: 'urgent' | 'normal';
}

// ─── GUIDED STEPS ─────────────────────────────────────────────────────────────

const STEPS = [
  { key: 'population',   q: 'Πόσα πλαίσια πληθυσμός; Και πώς είναι — δυνατή, μέτρια ή αδύναμη;' },
  { key: 'queen',        q: 'Βρήκες τη βασίλισσα; Πες βρήκα, δεν βρήκα ή αβέβαιο.' },
  { key: 'queen_laying', q: 'Πώς γεννάει; Κανονικά, δεν γεννάει, ακανόνιστη γέννα ή αρρενοτόκο;' },
  { key: 'brood',        q: 'Πόσα πλαίσια γόνος; Πες αν είναι συμπαγής, τρύπιος, σφραγισμένος ή ανοιχτός.' },
  { key: 'queen_cells',  q: 'Υπάρχουν βασιλικά κελιά; Πες αριθμό ή "κανένα".' },
  { key: 'stores',       q: 'Πόσα πλαίσια μέλι και πόσα γύρη;' },
  { key: 'varroa',       q: 'Επίπεδο βαρρόα; Χαμηλή, μέτρια ή υψηλή; Έχεις μέτρηση ή ποσοστό;' },
  { key: 'diseases',     q: 'Παρατήρησες ασθένειες; Τρύπιος γόνος, κιμωλίες, παραμορφωμένες μέλισσες;' },
  { key: 'equipment',    q: 'Πώς είναι ο εξοπλισμός; Πες καλά ή ό,τι χρειάζεται επισκευή.' },
  { key: 'feeding',      q: 'Έκανες τροφοδοσία; Τι είδος και πόσο; Ή πες "όχι".' },
  { key: 'treatment',    q: 'Εφάρμοσες θεραπεία βαρρόα; Τι προϊόν και δόση; Ή πες "όχι".' },
  { key: 'management',   q: 'Ενέργειες διαχείρισης; Παραφυάδα, συνένωση, βασίλισσα; Ή πες "καμία".' },
  { key: 'next_visit',   q: 'Πότε επόμενη επίσκεψη; Πες "σε X μέρες" ή "αύριο" και τον λόγο.' },
  { key: 'notes',        q: 'Επιπλέον σημειώσεις; Ή πες "παράλειψε".' },
];

// ─── EMPTY DATA ───────────────────────────────────────────────────────────────

function emptyData(hive_id: string): InspectionData {
  return {
    hive_id,
    date: new Date().toISOString().split('T')[0],
    mode: 'guided',
    population_frames: null, population_strength: null,
    queen_present: null, queen_status: null, queen_laying: null,
    brood_frames: null, brood_condition: null, brood_type: null, queen_cells: null,
    honey_frames: null, pollen_frames: null,
    varroa_level: null, varroa_measurement: null, diseases: null,
    equipment_status: null, equipment_notes: null,
    feeding_type: null, feeding_amount: null,
    treatment_type: null, treatment_dose: null, management_actions: null,
    next_visit: null, next_visit_reason: null, urgent: false,
    notes: null, notifications_disabled: false,
  };
}

// ─── VOCAB FIX ────────────────────────────────────────────────────────────────

function fix(text: string): string {
  return text.toLowerCase()
    .replace(/βαρ[οό]α/g, 'βαρρόα')
    .replace(/αρ[εέ]νοτόκ/g, 'αρρενοτόκ')
    .replace(/ασκοσφ[εέ]ρωση/g, 'ασκοσφαίρωση');
}

// ─── STEP PARSER ──────────────────────────────────────────────────────────────

function parseStep(raw: string, key: string): Partial<InspectionData> {
  const t = fix(raw);
  const u: Partial<InspectionData> = {};
  const skip =
    t.includes('παράλειψε') || t.includes('τίποτα') ||
    t.includes('καμία') || (t.trim() === 'όχι');

  switch (key) {
    case 'population': {
      const f = t.match(/(\d+)\s*πλαίσ/);
      if (f) u.population_frames = +f[1];
      if (t.includes('δυνατ'))                              u.population_strength = 'δυνατή';
      else if (t.includes('μέτρι'))                         u.population_strength = 'μέτρια';
      else if (t.includes('αδύναμ') || t.includes('αδύνατ')) u.population_strength = 'αδύναμη';
      break;
    }
    case 'queen': {
      if (t.includes('βρήκα') || t.trim() === 'ναι')        u.queen_present = 'yes';
      else if (t.includes('δεν βρήκα') || t.includes('δεν υπάρχ')) u.queen_present = 'no';
      else if (t.includes('αβέβαιο') || t.includes('δεν ξέρ'))      u.queen_present = 'uncertain';
      break;
    }
    case 'queen_laying': {
      if (t.includes('αρρενοτόκ'))                              u.queen_laying = 'drone_layer';
      else if (t.includes('κανονικά') || t.includes('καλά'))   u.queen_laying = 'normal';
      else if (t.includes('δεν γεννάει') || t.includes('καθόλου')) u.queen_laying = 'none';
      else if (t.includes('ακανόνιστ'))                         u.queen_laying = 'irregular';
      break;
    }
    case 'brood': {
      const f = t.match(/(\d+)\s*πλαίσ/);
      if (f) u.brood_frames = +f[1];
      if (t.includes('τρύπιος') || t.includes('τρύπιο'))  u.brood_condition = 'scattered';
      else if (t.includes('συμπαγ'))                       u.brood_condition = 'compact';
      else if (t.includes('ανοιχτ'))                       u.brood_condition = 'open';
      if (t.includes('σφραγισμέν'))                        u.brood_type = 'sealed';
      else if (t.includes('ανοιχτ'))                       u.brood_type = 'open';
      else if (t.includes('μεικτ') || t.includes('μικτ')) u.brood_type = 'mixed';
      break;
    }
    case 'queen_cells': {
      if (t.includes('κανένα') || t.trim() === 'όχι' || t.includes('τίποτα')) {
        u.queen_cells = 0;
      } else {
        const n = t.match(/(\d+)/);
        if (n) u.queen_cells = +n[1];
      }
      break;
    }
    case 'stores': {
      const h = t.match(/(\d+)\s*(?:πλαίσ\w*\s+)?μέλι/);
      const p = t.match(/(\d+)\s*(?:πλαίσ\w*\s+)?γύρη/);
      if (h) u.honey_frames  = +h[1];
      if (p) u.pollen_frames = +p[1];
      break;
    }
    case 'varroa': {
      if (t.includes('χαμηλ'))                            u.varroa_level = 'low';
      else if (t.includes('μέτρι') || t.includes('μέση')) u.varroa_level = 'medium';
      else if (t.includes('υψηλ'))                         u.varroa_level = 'high';
      const pct  = t.match(/(\d+(?:[.,]\d+)?)\s*(?:%|τοις εκατό)/);
      const fall = t.match(/(\d+)\s*(?:πτώσ|βαρρόε)/);
      if (pct)       u.varroa_measurement = pct[1].replace(',', '.') + '%';
      else if (fall) u.varroa_measurement = fall[1] + ' βαρρόες/24h';
      break;
    }
    case 'diseases': {
      if (t.includes('τίποτα') || t.includes('καθαρ') || t.includes('κανέν')) {
        u.diseases = 'Καμία'; break;
      }
      const d: string[] = [];
      if (t.includes('τρύπιος γόνος') || t.includes('κολλάει')) d.push('Υποψία AFB');
      if (t.includes('κιμωλ') || t.includes('άσπρα κελ') || t.includes('ασκοσφαίρωση')) d.push('Ασκοσφαίρωση');
      if (t.includes('κουτσ') || t.includes('παραμορφ'))           d.push('Βαρρόα (συμπτώματα)');
      if (t.includes('τρέμ') || t.includes('παράλυση'))            d.push('Χρόνια Παράλυση');
      u.diseases = d.length ? d.join(', ') : raw.trim();
      break;
    }
    case 'equipment': {
      if (t.includes('καλ') || t.includes('εντάξει') || t.toLowerCase().includes('ok')) {
        u.equipment_status = 'ok';
      } else if (!skip) {
        u.equipment_status = 'needs_repair';
        u.equipment_notes  = raw.trim();
      }
      break;
    }
    case 'feeding': {
      if (skip) break;
      if (t.includes('σιρόπι'))                                  u.feeding_type = 'σιρόπι';
      else if (t.includes('apifonda') || t.includes('απιφόντ'))  u.feeding_type = 'Apifonda';
      else if (t.includes('γυρεόπιτα'))                          u.feeding_type = 'γυρεόπιτα';
      else if (t.includes('ζυμωτ'))                              u.feeding_type = 'ζυμωτή';
      else if (t.includes('πούδρα γύρης'))                       u.feeding_type = 'πούδρα γύρης';
      const a = t.match(/(\d+(?:[.,]\d+)?)\s*(λίτρα|κιλά|γραμμάρια|γρ|ml)/);
      if (a) u.feeding_amount = a[1] + ' ' + a[2];
      break;
    }
    case 'treatment': {
      if (skip) break;
      if (t.includes('θυμόλη'))                                    u.treatment_type = 'θυμόλη';
      else if (t.includes('μυρμηγκικό') || t.includes('οξύ'))     u.treatment_type = 'μυρμηγκικό οξύ';
      else if (t.includes('εξάχνωσ') || (t.includes('οξαλικ') && !t.includes('ταινι')))
                                                                   u.treatment_type = 'οξαλικό (εξάχνωση)';
      else if (t.includes('ταινί') && t.includes('οξαλικ'))       u.treatment_type = 'οξαλικό (ταινίες)';
      else if (t.includes('varrored') || t.includes('βαρορέδ'))   u.treatment_type = 'Varrored';
      else if (t.includes('apivar') || t.includes('άπιβαρ'))      u.treatment_type = 'Apivar';
      else if (t.includes('ριγανέλαιο'))                           u.treatment_type = 'ριγανέλαιο';
      else if (t.includes('nozevit') || t.includes('νόζεβιτ'))    u.treatment_type = 'Nozevit';
      const d = t.match(/(\d+(?:[.,]\d+)?)\s*(γρ|ml|γραμμ|ταινί|εφαρμογ)/);
      if (d) u.treatment_dose = d[1] + ' ' + d[2];
      break;
    }
    case 'management': {
      if (!skip) u.management_actions = raw.trim();
      break;
    }
    case 'next_visit': {
      if (skip) break;
      const days = t.match(/σε\s+(\d+)\s+μέρ/);
      const dt = new Date();
      if (days)               { dt.setDate(dt.getDate() + +days[1]); u.next_visit = dt.toISOString().split('T')[0]; }
      else if (t.includes('αύριο'))         { dt.setDate(dt.getDate() + 1);  u.next_visit = dt.toISOString().split('T')[0]; }
      else if (t.includes('επόμενη εβδ'))  { dt.setDate(dt.getDate() + 7);  u.next_visit = dt.toISOString().split('T')[0]; }
      if (t.includes('επείγ') || t.includes('άμεσ')) u.urgent = true;
      u.next_visit_reason = raw.trim();
      break;
    }
    case 'notes': {
      if (!skip) u.notes = raw.trim();
      break;
    }
  }
  return u;
}

// ─── FREE TEXT PARSER ─────────────────────────────────────────────────────────

function parseFreeText(text: string, hive_id: string): InspectionData {
  const base = { ...emptyData(hive_id), mode: 'free' };
  for (const s of STEPS) Object.assign(base, parseStep(text, s.key));
  return base;
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────

function evaluateAlerts(d: InspectionData): AppAlert[] {
  if (d.notifications_disabled) return [];
  const a: AppAlert[] = [];

  // ΚΡΙΣΙΜΑ
  if (d.diseases?.includes('AFB'))
    a.push({ id: 'afb',      level: 'critical', message: '⚠️ Υποψία Αμερικάνικης Σηψιγονίας! Αποστολή δείγματος σε εργαστήριο!', dismissed: false });
  if (d.queen_laying === 'drone_layer')
    a.push({ id: 'drone',    level: 'critical', message: '🔴 Αρρενοτόκο μελίσσι! Άμεση αντικατάσταση βασίλισσας!', dismissed: false });
  if ((d.queen_cells ?? 0) > 2)
    a.push({ id: 'swarm',    level: 'critical', message: '🔴 Πολλά βασιλικά κελιά! Κίνδυνος σμηνουργίας — Σπάσε σε παραφυάδες!', dismissed: false });

  const varPct = d.varroa_measurement?.includes('%') ? parseFloat(d.varroa_measurement!) : null;
  if (varPct !== null && varPct >= 3)
    a.push({ id: 'var_pct',  level: 'critical', message: `🔴 Βαρρόα ${varPct}%! Πάνω από 3% — Άμεση θεραπεία!`, dismissed: false });
  else if (d.varroa_level === 'high')
    a.push({ id: 'var_high', level: 'critical', message: '🔴 Υψηλή Βαρρόα! Άμεση θεραπεία!', dismissed: false });

  // ΠΡΟΣΟΧΗ
  if (d.queen_present === 'no')
    a.push({ id: 'no_queen', level: 'warning',  message: '⚠️ Δεν βρέθηκε βασίλισσα — Έλεγξε για βασιλικά κελιά.', dismissed: false });
  if (d.diseases?.includes('Ασκοσφαίρωση'))
    a.push({ id: 'chalk',    level: 'warning',  message: '⚠️ Ασκοσφαίρωση — Βελτίωση αερισμού κυψέλης.', dismissed: false });
  if (d.honey_frames !== null && d.honey_frames < 2)
    a.push({ id: 'stores',   level: 'warning',  message: '⚠️ Χαμηλά αποθέματα μελιού — Σκέψου τροφοδότηση.', dismissed: false });
  if (d.population_frames !== null && d.population_frames < 3)
    a.push({ id: 'weak',     level: 'warning',  message: '⚠️ Αδύναμη κυψέλη — Εξέτασε ενίσχυση ή συνένωση.', dismissed: false });

  return a;
}

// ─── AUTO REMINDERS ───────────────────────────────────────────────────────────

function buildReminders(d: InspectionData): Reminder[] {
  const r: Reminder[] = [];
  const plus = (n: number) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + n);
    return dt.toISOString().split('T')[0];
  };
  const act = (d.management_actions ?? '').toLowerCase();

  if ((d.queen_cells ?? 0) > 0)
    r.push({ date: plus(7),  description: '🔔 Βασιλικά κελιά — Επίσκεψη σε 7 μέρες',              priority: 'urgent' });
  if (act.includes('κλουβ') && act.includes('βασίλισσ'))
    r.push({ date: plus(1),  description: '🔔 Σπάσε πορτάκι κλουβιού βασίλισσας ΑΥΡΙΟ!',           priority: 'urgent' });
  if (act.includes('έναρξης βασιλοτροφίας'))
    r.push({ date: plus(3),  description: '🔔 Τροφοδοσία σιρόπι — μελίσσι έναρξης',               priority: 'normal' });
  if (d.treatment_type === 'θυμόλη')
    r.push({ date: plus(14), description: '🔔 Αφαίρεση θυμόλης (14-21 μέρες)',                    priority: 'normal' });
  if (d.treatment_type === 'μυρμηγκικό οξύ')
    r.push({ date: plus(7),  description: '🔔 Αφαίρεση μυρμηγκικού οξέος (7-14 μέρες)',          priority: 'normal' });
  if (d.treatment_type === 'οξαλικό (εξάχνωση)' && (d.brood_frames ?? 0) > 0)
    r.push({ date: plus(3),  description: '🔔 Επόμενη εφαρμογή οξαλικού σε 3-4 μέρες',           priority: 'urgent' });
  if (d.treatment_type?.includes('Varrored') || d.treatment_type?.includes('Apivar'))
    r.push({ date: plus(42), description: '🔔 Αφαίρεση ταινιών Varrored/Apivar (42 μέρες)',       priority: 'normal' });
  if (d.treatment_type === 'Nozevit')
    r.push({ date: plus(10), description: '🔔 Επόμενη δόση Nozevit σε 10 μέρες',                 priority: 'normal' });
  if (d.management_actions?.toLowerCase().includes('αφεσμό'))
    r.push({ date: plus(7),  description: '🔔 Έλεγξε νέο αφεσμό σε 7 μέρες',                    priority: 'normal' });
  if (d.next_visit)
    r.push({ date: d.next_visit, description: `🔔 Επόμενη επίσκεψη: ${d.next_visit_reason ?? ''}`, priority: d.urgent ? 'urgent' : 'normal' });

  return r;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

interface Props {
  route: { params: { hive_id: string; hive_name: string; mode?: 'guided' | 'free' } };
  navigation: any;
}

export default function InspectionScreen({ route, navigation }: Props) {
  const { hive_id, hive_name } = route.params;

  const [mode, setMode]                   = useState<ScreenMode>('select');
  const [step, setStep]                   = useState(0);
  const [data, setData]                   = useState<InspectionData>(emptyData(hive_id));
  const [alerts, setAlerts]               = useState<AppAlert[]>([]);
  const [isListening, setIsListening]     = useState(false);
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [isPaused, setIsPaused]           = useState(false);
  const [transcript, setTranscript]       = useState('');
  const [freeText, setFreeText]           = useState('');
  const [showSummary, setShowSummary]     = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [savedOk, setSavedOk]             = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const { unlockHive } = useLock();

// Ξεκίνα αυτόματα αν έχει έρθει mode από ListeningScreen
React.useEffect(() => {
  const initialMode = route.params.mode;
  if (initialMode === 'guided') {
    const d = { ...emptyData(hive_id), mode: 'guided' };
    setData(d); setAlerts([]); setStep(0); setMode('guided');
  } else if (initialMode === 'free') {
    const d = { ...emptyData(hive_id), mode: 'free' };
    setData(d); setAlerts([]); setFreeText(''); setMode('free');
  }
}, []);

  // ── TTS ─────────────────────────────────────────────────────────────────────

  const speak = useCallback((text: string, onDone?: () => void) => {
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, {
      language: 'el-GR', rate: 0.95, pitch: 1.0,
      onDone:    () => { setIsSpeaking(false); onDone?.(); },
      onStopped: () => setIsSpeaking(false),
      onError:   () => setIsSpeaking(false),
    });
  }, []);

  // ── REFRESH ALERTS ───────────────────────────────────────────────────────────

  const refreshAlerts = useCallback((d: InspectionData) => {
    setAlerts(evaluateAlerts(d));
  }, []);

  // ── VOICE COMMANDS ────────────────────────────────────────────────────────────

  const handleCmd = useCallback((text: string): boolean => {
    const t = text.toLowerCase().trim();
    if (t.includes('παύση') || t.includes('σταμάτα')) {
      setIsPaused(true); Speech.stop(); return true;
    }
    if (t.includes('συνέχεια') || t.includes('πάμε')) {
      setIsPaused(false); return true;
    }
    if (t.includes('επανάληψη') || t.includes('τι είπες')) {
      speak(STEPS[step].q); return true;
    }
    if (t.includes('διόρθωση') || t.includes('λάθος')) {
      if (step > 0) { const p = step - 1; setStep(p); speak('Πίσω. ' + STEPS[p].q); }
      return true;
    }
    if (t.includes('αποθήκευση') || t.includes('σώσε')) {
      handleSave(); return true;
    }
    if (t.includes('τέλος') || t.includes('ολοκλήρωση')) {
      finishInspection(); return true;
    }
    if (t.includes('βοήθεια')) {
      speak('Εντολές: Παύση, Συνέχεια, Επανάληψη, Διόρθωση, Αποθήκευση, Τέλος, Βοήθεια, Απενεργοποίησε ειδοποιήσεις.');
      return true;
    }
    if (t.includes('απενεργοποίησε ειδοποιήσεις') || t.includes('το ξέρω')) {
      if (t.includes('απενεργοποίησε')) {
        setData(prev => { const n = { ...prev, notifications_disabled: true }; setAlerts([]); return n; });
        speak('Ειδοποιήσεις απενεργοποιημένες.');
      } else {
        setAlerts(prev => prev.map((a, i) => i === 0 ? { ...a, dismissed: true } : a));
      }
      return true;
    }
    return false;
  }, [step, speak]);

  // ── RECORD / PROCESS ─────────────────────────────────────────────────────────

  const startRec = useCallback(async () => {
    if (isPaused || isSpeaking || isProcessing) return;
    try {
      await voiceService.startRecording();
      setIsListening(true);
      setTranscript('');
    } catch (e) { console.error('startRec:', e); }
  }, [isPaused, isSpeaking, isProcessing]);

  const stopRec = useCallback(async () => {
    if (!isListening) return;
    setIsListening(false);
    setIsProcessing(true);
    try {
      const text = await voiceService.stopAndTranscribe();
      if (!text?.trim()) return;
      setTranscript(text);
      if (handleCmd(text)) return;

      if (mode === 'guided') {
        const partial = parseStep(text, STEPS[step].key);
        setData(prev => {
          const next = { ...prev, ...partial };
          refreshAlerts(next);
          return next;
        });
        if (step < STEPS.length - 1) {
          const ns = step + 1;
          setStep(ns);
          setTimeout(() => speak(STEPS[ns].q), 700);
        } else {
          finishInspection();
        }
      } else {
        // Free mode: accumulate
        setFreeText(p => p + (p ? ' ' : '') + text);
      }
    } catch (e) {
      console.error('stopRec:', e);
    } finally {
      setIsProcessing(false);
    }
  }, [isListening, mode, step, handleCmd, speak, refreshAlerts]);

  // ── MODES ─────────────────────────────────────────────────────────────────────

  const startGuided = () => {
    const d = { ...emptyData(hive_id), mode: 'guided' };
    setData(d); setAlerts([]); setStep(0); setMode('guided');
    speak(STEPS[0].q);
  };

  const startFree = () => {
    const d = { ...emptyData(hive_id), mode: 'free' };
    setData(d); setAlerts([]); setFreeText(''); setMode('free');
    speak('Ελεύθερη καταγραφή. Πες ό,τι θέλεις για την επιθεώρηση.');
  };

  const applyFreeText = useCallback(() => {
    if (!freeText.trim()) return;
    const parsed = parseFreeText(freeText, hive_id);
    setData(parsed);
    refreshAlerts(parsed);
  }, [freeText, hive_id, refreshAlerts]);

  const jumpToStep = (n: number) => {
    setStep(n);
    speak(STEPS[n].q);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // ── FINISH & SAVE ──────────────────────────────────────────────────────────────

  const finishInspection = useCallback(() => {
    Speech.stop();
    if (mode === 'free' && freeText.trim()) applyFreeText();
    setShowSummary(true);
  }, [mode, freeText, applyFreeText]);

  const handleSave = useCallback(async () => {
    if (isSaving || savedOk) return;
    setIsSaving(true);
    try {
      const { data: ins, error } = await supabase
        .from('inspections')
        .insert([data])
        .select()
        .single();
      if (error) throw error;

      const reminders = buildReminders(data);
      if (reminders.length > 0 && ins?.id) {
        await supabase.from('reminders').insert(
          reminders.map(r => ({
            hive_id,
            inspection_id: ins.id,
            reminder_date: r.date,
            reminder_type: 'auto',
            description: r.description,
            priority: r.priority,
            completed: false,
          }))
        );
      }

      setSavedOk(true);
      // Unlock κυψέλη μετά την αποθήκευση
      await unlockHive(hive_id);
      speak('Η επιθεώρηση αποθηκεύτηκε επιτυχώς!');
      setTimeout(() => { setShowSummary(false); navigation.goBack(); }, 2000);
    } catch (e: any) {
      RNAlert.alert('Σφάλμα', 'Αποτυχία αποθήκευσης: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  }, [data, hive_id, isSaving, savedOk, speak, navigation]);

  // ── HELPERS ─────────────────────────────────────────────────────────────────

  const activeAlerts   = alerts.filter(a => !a.dismissed);
  const dismissAlert   = (id: string) => setAlerts(p => p.map(a => a.id === id ? { ...a, dismissed: true } : a));

  const SummaryRow = ({ label, value }: { label: string; value: any }) => {
    if (value === null || value === undefined || value === '') return null;
    return (
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{String(value)}</Text>
      </View>
    );
  };

  const AlertBanner = ({ a }: { a: AppAlert }) => (
    <View style={[styles.alertBox, a.level === 'critical' ? styles.alertCrit : styles.alertWarn]}>
      <Text style={styles.alertText}>{a.message}</Text>
      <TouchableOpacity onPress={() => dismissAlert(a.id)}>
        <Text style={styles.alertDismiss}>Το ξέρω ✕</Text>
      </TouchableOpacity>
    </View>
  );

  const VoiceButton = () => (
    <View style={styles.voiceArea}>
      {isProcessing
        ? <ActivityIndicator size="large" color={HONEY} style={{ margin: 28 }} />
        : (
          <TouchableOpacity
            style={[styles.voiceBtn, isListening && styles.voiceBtnRec]}
            onPress={isListening ? stopRec : startRec}
            disabled={isSpeaking || isPaused}
          >
            <Text style={styles.voiceBtnIcon}>{isListening ? '⏹' : '🎙'}</Text>
            <Text style={styles.voiceBtnLabel}>{isListening ? 'Σταμάτα' : 'Μίλα'}</Text>
          </TouchableOpacity>
        )
      }
    </View>
  );

  // ── SUMMARY MODAL ─────────────────────────────────────────────────────────────

  const reminders = buildReminders(data);

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── SUMMARY MODAL ── */}
      <Modal visible={showSummary} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 60 }}>
          <Text style={styles.modalTitle}>📋 Σύνοψη Επιθεώρησης</Text>
          <Text style={styles.modalSub}>🐝 {hive_name}  ·  {data.date}</Text>

          {/* Critical alerts at top of summary */}
          {activeAlerts.filter(a => a.level === 'critical').map(a => (
            <View key={a.id} style={[styles.alertBox, styles.alertCrit]}>
              <Text style={styles.alertText}>{a.message}</Text>
            </View>
          ))}

          {/* Sections */}
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Πληθυσμός & Βασίλισσα</Text>
            <SummaryRow label="Πλαίσια πληθυσμού"  value={data.population_frames} />
            <SummaryRow label="Δύναμη"              value={data.population_strength} />
            <SummaryRow label="Βασίλισσα"           value={
              data.queen_present === 'yes' ? '✅ Βρέθηκε' :
              data.queen_present === 'no'  ? '❌ Δεν βρέθηκε' :
              data.queen_present} />
            <SummaryRow label="Γέννα"               value={data.queen_laying} />
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Γόνος & Βασιλικά Κελιά</Text>
            <SummaryRow label="Πλαίσια γόνου"  value={data.brood_frames} />
            <SummaryRow label="Κατάσταση"      value={data.brood_condition} />
            <SummaryRow label="Τύπος"          value={data.brood_type} />
            <SummaryRow label="Βασιλικά κελιά" value={data.queen_cells} />
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Αποθέματα & Βαρρόα</Text>
            <SummaryRow label="Μέλι (πλαίσια)"   value={data.honey_frames} />
            <SummaryRow label="Γύρη (πλαίσια)"   value={data.pollen_frames} />
            <SummaryRow label="Βαρρόα επίπεδο"   value={data.varroa_level} />
            <SummaryRow label="Μέτρηση βαρρόα"   value={data.varroa_measurement} />
          </View>

          {(data.diseases || data.feeding_type || data.treatment_type || data.management_actions) && (
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Ασθένειες & Παρεμβάσεις</Text>
              <SummaryRow label="Ασθένειες"       value={data.diseases} />
              <SummaryRow label="Τροφοδοσία"      value={
                data.feeding_type && data.feeding_amount
                  ? `${data.feeding_type} — ${data.feeding_amount}`
                  : data.feeding_type
              } />
              <SummaryRow label="Θεραπεία"        value={
                data.treatment_type && data.treatment_dose
                  ? `${data.treatment_type} — ${data.treatment_dose}`
                  : data.treatment_type
              } />
              <SummaryRow label="Ενέργειες"       value={data.management_actions} />
              <SummaryRow label="Εξοπλισμός"      value={
                data.equipment_status === 'ok' ? '✅ Καλός' :
                data.equipment_notes ?? data.equipment_status
              } />
            </View>
          )}

          {reminders.length > 0 && (
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>📅 Υπενθυμίσεις</Text>
              {reminders.map((rem, i) => (
                <View key={i} style={styles.reminderRow}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>
                    {rem.priority === 'urgent' ? '🔴' : '🟡'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderDate}>{rem.date}</Text>
                    <Text style={styles.reminderDesc}>{rem.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {data.notes && (
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Σημειώσεις</Text>
              <Text style={styles.notesText}>{data.notes}</Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.btnEdit} onPress={() => setShowSummary(false)}>
              <Text style={styles.btnEditText}>✏️ Επεξεργασία</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSave, savedOk && styles.btnSaved]}
              onPress={handleSave}
              disabled={isSaving || savedOk}
            >
              {isSaving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnSaveText}>{savedOk ? '✅ Αποθηκεύτηκε!' : '💾 Αποθήκευση'}</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>

      {/* ── SELECT MODE ── */}
      {mode === 'select' && (
        <View style={[styles.container, { justifyContent: 'center' }]}>
          <Text style={styles.hiveTitle}>🐝 {hive_name}</Text>
          <Text style={styles.subtitle}>Επιλογή τρόπου επιθεώρησης</Text>
          <TouchableOpacity style={[styles.modeCard, { borderColor: HONEY }]} onPress={startGuided}>
            <Text style={styles.modeIcon}>📋</Text>
            <Text style={styles.modeTitle}>Καθοδηγούμενη</Text>
            <Text style={styles.modeDesc}>Βήμα-βήμα ερωτήσεις με φωνητική καθοδήγηση</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeCard, { borderColor: '#9B59B6' }]} onPress={startFree}>
            <Text style={styles.modeIcon}>🎙️</Text>
            <Text style={styles.modeTitle}>Ελεύθερη</Text>
            <Text style={styles.modeDesc}>Πες ό,τι θέλεις — η εφαρμογή αναλύει αυτόματα</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Πίσω</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── GUIDED MODE ── */}
      {mode === 'guided' && (
        <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.hiveTitle}>🐝 {hive_name}</Text>

          {/* Progress bar */}
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.round((step / STEPS.length) * 100)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>Βήμα {step + 1} / {STEPS.length}</Text>

          {/* Alerts */}
          {activeAlerts.map(a => <AlertBanner key={a.id} a={a} />)}

          {/* Question card */}
          <View style={styles.questionCard}>
            <Text style={styles.qNum}>Ερώτηση {step + 1}</Text>
            <Text style={styles.qText}>{STEPS[step].q}</Text>
            {isSpeaking && <Text style={styles.badge}>🔊 Μιλάω...</Text>}
            {isPaused   && <Text style={[styles.badge, { color: AMBER }]}>⏸️ Σε παύση — πες «Συνέχεια»</Text>}
          </View>

          {/* Transcript */}
          {!!transcript && (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>Κατάλαβα:</Text>
              <Text style={styles.transcriptText}>"{transcript}"</Text>
            </View>
          )}

          {/* Voice button */}
          <VoiceButton />

          {/* Nav row */}
          <View style={styles.navRow}>
            <TouchableOpacity
              style={[styles.navBtn, step === 0 && styles.navDisabled]}
              disabled={step === 0}
              onPress={() => jumpToStep(step - 1)}
            >
              <Text style={styles.navBtnText}>← Πίσω</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navBtn, styles.navNext]}
              onPress={() => step < STEPS.length - 1 ? jumpToStep(step + 1) : finishInspection()}
            >
              <Text style={styles.navBtnText}>{step < STEPS.length - 1 ? 'Παράλειψε →' : '✅ Τέλος'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.finishBtn} onPress={finishInspection}>
            <Text style={styles.finishBtnText}>✅ Ολοκλήρωση & Σύνοψη</Text>
          </TouchableOpacity>

          {/* Step dots */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
            {STEPS.map((s, i) => (
              <TouchableOpacity key={s.key} onPress={() => jumpToStep(i)} style={{ padding: 5 }}>
                <View style={[
                  styles.dot,
                  i < step  && styles.dotDone,
                  i === step && styles.dotActive,
                ]} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ScrollView>
      )}

      {/* ── FREE MODE ── */}
      {mode === 'free' && (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.hiveTitle}>🐝 {hive_name} — Ελεύθερη Καταγραφή</Text>

          {activeAlerts.map(a => <AlertBanner key={a.id} a={a} />)}

          <TextInput
            style={styles.freeInput}
            multiline
            value={freeText}
            onChangeText={setFreeText}
            placeholder={
              'Πληκτρολόγησε ή χρησιμοποίησε το μικρόφωνο...\n\n' +
              'Παράδειγμα: "8 πλαίσια δυνατή, βρήκα βασίλισσα, γεννάει κανονικά, ' +
              '4 πλαίσια γόνος συμπαγής, 2 βασιλικά κελιά, βαρρόα χαμηλή, 4 πλαίσια μέλι"'
            }
            placeholderTextColor="#505A70"
          />

          <VoiceButton />

          {!!transcript && (
            <View style={styles.transcriptBox}>
              <Text style={styles.transcriptLabel}>Κατάλαβα:</Text>
              <Text style={styles.transcriptText}>"{transcript}"</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.analyzeBtn, !freeText.trim() && { opacity: 0.4 }]}
            onPress={applyFreeText}
            disabled={!freeText.trim()}
          >
            <Text style={styles.analyzeBtnText}>🔍 Ανάλυση κειμένου</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.finishBtn} onPress={finishInspection}>
            <Text style={styles.finishBtnText}>✅ Ολοκλήρωση & Σύνοψη</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </>
  );
}

// ─── THEME ────────────────────────────────────────────────────────────────────

const HONEY = '#F5A623';
const BG    = '#0E1320';
const CARD  = '#182035';
const TEXT  = '#E8ECF4';
const MUTED = '#6B7280';
const GREEN = '#22C55E';
const RED   = '#EF4444';
const AMBER = '#F59E0B';

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG, paddingHorizontal: 16, paddingTop: 52 },
  scrollContent: { paddingBottom: 48 },

  hiveTitle: { fontSize: 22, fontWeight: '800', color: HONEY, textAlign: 'center', marginBottom: 4 },
  subtitle:  { fontSize: 15, color: MUTED, textAlign: 'center', marginBottom: 32 },

  // Mode cards
  modeCard: {
    backgroundColor: CARD, borderRadius: 18, padding: 24,
    marginBottom: 14, alignItems: 'center', borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  modeIcon:  { fontSize: 44, marginBottom: 8 },
  modeTitle: { fontSize: 20, fontWeight: '700', color: TEXT, marginBottom: 6 },
  modeDesc:  { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20 },

  backBtn:     { alignItems: 'center', marginTop: 28 },
  backBtnText: { color: MUTED, fontSize: 15 },

  // Progress
  progressBg:   { height: 6, backgroundColor: CARD, borderRadius: 3, marginBottom: 4 },
  progressFill: { height: 6, backgroundColor: HONEY, borderRadius: 3 },
  progressLabel:{ fontSize: 11, color: MUTED, textAlign: 'right', marginBottom: 14 },

  // Alerts
  alertBox:  { borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  alertCrit: { backgroundColor: '#300A0A', borderLeftColor: RED },
  alertWarn: { backgroundColor: '#2A1A00', borderLeftColor: AMBER },
  alertText: { color: TEXT, fontSize: 14, marginBottom: 6, lineHeight: 20 },
  alertDismiss: { color: MUTED, fontSize: 12, textDecorationLine: 'underline' },

  // Question
  questionCard: {
    backgroundColor: CARD, borderRadius: 18, padding: 22, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: HONEY,
    shadowColor: HONEY, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 3,
  },
  qNum:  { fontSize: 11, color: HONEY, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  qText: { fontSize: 18, color: TEXT, lineHeight: 28, fontWeight: '500' },
  badge: { marginTop: 12, color: HONEY, fontSize: 13 },

  // Transcript
  transcriptBox:  {
    backgroundColor: '#0B1525', borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: '#1E3A5F',
  },
  transcriptLabel:{ fontSize: 11, color: MUTED, marginBottom: 4 },
  transcriptText: { color: TEXT, fontSize: 15, fontStyle: 'italic', lineHeight: 22 },

  // Voice
  voiceArea: { alignItems: 'center', marginVertical: 18 },
  voiceBtn: {
    width: 112, height: 112, borderRadius: 56,
    backgroundColor: '#1A2D4A', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: HONEY,
    shadowColor: HONEY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  voiceBtnRec: {
    backgroundColor: '#3A0808', borderColor: RED,
    shadowColor: RED, shadowOpacity: 0.55,
  },
  voiceBtnIcon:  { fontSize: 38, marginBottom: 4 },
  voiceBtnLabel: { fontSize: 12, color: TEXT, fontWeight: '600' },

  // Nav
  navRow:      { flexDirection: 'row', gap: 10, marginBottom: 12 },
  navBtn:      { flex: 1, backgroundColor: CARD, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  navDisabled: { opacity: 0.3 },
  navNext:     { backgroundColor: '#1A3A5C' },
  navBtnText:  { color: TEXT, fontSize: 14, fontWeight: '600' },

  // Finish
  finishBtn: {
    backgroundColor: GREEN, borderRadius: 16, padding: 18,
    alignItems: 'center', marginVertical: 8,
    shadowColor: GREEN, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  finishBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Dots
  dot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: CARD, borderWidth: 1, borderColor: MUTED },
  dotDone:   { backgroundColor: HONEY, borderColor: HONEY },
  dotActive: { backgroundColor: TEXT, borderColor: TEXT, transform: [{ scale: 1.35 }] },

  // Free mode
  freeInput: {
    backgroundColor: CARD, color: TEXT, borderRadius: 14, padding: 16,
    fontSize: 15, minHeight: 200, textAlignVertical: 'top', marginBottom: 12,
    borderWidth: 1, borderColor: '#2A3A5A', lineHeight: 22,
  },
  analyzeBtn:     {
    backgroundColor: '#1A2D4A', borderRadius: 14, padding: 14,
    alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: HONEY,
  },
  analyzeBtnText: { color: HONEY, fontSize: 15, fontWeight: '700' },

  // Modal
  modal:     { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  modalTitle:{ fontSize: 24, fontWeight: '800', color: HONEY, textAlign: 'center', marginBottom: 4, marginTop: 20 },
  modalSub:  { fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 20 },

  summarySection: { backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionTitle:   {
    fontSize: 12, color: HONEY, fontWeight: '700', marginBottom: 12,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E2A40' },
  summaryLabel: { color: MUTED, fontSize: 14, flex: 1 },
  summaryValue: { color: TEXT, fontSize: 14, flex: 2, textAlign: 'right', fontWeight: '500' },

  reminderRow:  { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1E2A40', gap: 8 },
  reminderDate: { color: HONEY, fontSize: 12, marginBottom: 2 },
  reminderDesc: { color: TEXT, fontSize: 13 },
  notesText:    { color: TEXT, fontSize: 14, lineHeight: 22 },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnEdit:   { flex: 1, backgroundColor: CARD, borderRadius: 14, padding: 16, alignItems: 'center' },
  btnEditText:{ color: TEXT, fontSize: 15, fontWeight: '600' },
  btnSave:   {
    flex: 2, backgroundColor: GREEN, borderRadius: 14, padding: 16,
    alignItems: 'center',
    shadowColor: GREEN, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  btnSaved:  { backgroundColor: '#1A5C1A' },
  btnSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
