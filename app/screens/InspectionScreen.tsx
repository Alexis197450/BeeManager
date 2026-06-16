// app/screens/InspectionScreen.tsx — v6.3
// Direct save (όπως ο τρύγος) + Edit mode από Ιστορικό

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { createInspection, getHives, getInspectionsByHive, updateHive, updateInspection } from '../services/inspectionService';
import { createHarvest } from '../services/harvestService';
import {
  BROOD_CONDITION_OPTIONS, DISEASES_OPTIONS, EQUIPMENT_STATUS_OPTIONS,
  FEEDING_TYPE_OPTIONS, Hive, Inspection, POPULATION_STRENGTH_OPTIONS,
  TEMPERAMENT_OPTIONS, VARROA_LEVEL_OPTIONS,
} from '../types/inspectionTypes';
import {
  guidedVoiceSession, GuidedSessionCallbacks, GuidedInspectionResult,
  isWakeWord, isStopWord, isFinalEnd, normalizeGreek,
} from '../services/guidedVoiceSession';

const C = {
  primary: '#F59E0B', primaryDark: '#D97706', primaryLight: '#FEF3C7',
  bg: '#FFFBF0', card: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', textSub: '#6B7280', textLight: '#9CA3AF',
  red: '#DC2626', redLight: '#FEE2E2',
  blue: '#2563EB', blueLight: '#DBEAFE',
  record: '#EF4444', green: '#16A34A', honey: '#D97706',
  dark: '#1E293B', darker: '#0F172A',
};

const GREEK_NUMBERS: Record<string, number> = {
  'μηδέν': 0, 'μηδεν': 0, 'ένα': 1, 'ενα': 1, 'δύο': 2, 'δυο': 2,
  'τρία': 3, 'τρια': 3, 'τέσσερα': 4, 'τεσσερα': 4, 'πέντε': 5, 'πεντε': 5,
  'έξι': 6, 'εξι': 6, 'επτά': 7, 'επτα': 7, 'εφτά': 7, 'εφτα': 7,
  'οκτώ': 8, 'οκτω': 8, 'εννέα': 9, 'εννεα': 9, 'εννιά': 9,
  'δέκα': 10, 'δεκα': 10, 'έντεκα': 11, 'εντεκα': 11, 'δώδεκα': 12, 'δωδεκα': 12,
  'δεκατρία': 13, 'δεκατρια': 13, 'δεκατέσσερα': 14, 'δεκατεσσερα': 14,
  'δεκαπέντε': 15, 'δεκαπεντε': 15, 'δεκαέξι': 16, 'δεκαεξι': 16,
  'δεκαεπτά': 17, 'δεκαεπτα': 17, 'δεκαοκτώ': 18, 'δεκαοκτω': 18,
  'δεκαεννέα': 19, 'δεκαεννεα': 19, 'είκοσι': 20, 'εικοσι': 20,
};
function parseNum(text: string): number | null {
  const t = text.toLowerCase().trim();
  const d = t.match(/\d+/);
  if (d) return parseInt(d[0], 10);
  for (const [w, n] of Object.entries(GREEK_NUMBERS)) if (t.includes(w)) return n;
  return null;
}

function SH({ e, t }: { e: string; t: string }) {
  return <View style={s.sh}><Text style={s.se}>{e}</Text><Text style={s.st}>{t}</Text></View>;
}
function Lbl({ text }: { text: string }) { return <Text style={s.lbl}>{text}</Text>; }
function Chips<T extends string>({ opts, val, onSel }: {
  opts: readonly { value: T; label: string; color?: string; textColor?: string }[];
  val: T | null; onSel: (v: T) => void;
}) {
  return (
    <View style={s.row}>
      {opts.map(o => {
        const sel = val === o.value;
        return (
          <TouchableOpacity key={o.value}
            style={[s.chip, sel && { backgroundColor: o.color ?? C.primaryLight, borderColor: o.textColor ?? C.primary }]}
            onPress={() => onSel(o.value)} activeOpacity={0.7}>
            <Text style={[s.ct, sel && { color: o.textColor ?? C.primaryDark, fontWeight: '700' }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
function Step({ val, set, max = 30, sfx = '' }: {
  val: number; set: (v: number) => void; max?: number; sfx?: string;
}) {
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={s.sb} onPress={() => set(Math.max(0, val - 1))} activeOpacity={0.7}>
        <Text style={s.sbt}>−</Text>
      </TouchableOpacity>
      <Text style={s.sv}>{val}{sfx ? <Text style={s.ss}> {sfx}</Text> : null}</Text>
      <TouchableOpacity style={s.sb} onPress={() => set(Math.min(max, val + 1))} activeOpacity={0.7}>
        <Text style={s.sbt}>+</Text>
      </TouchableOpacity>
    </View>
  );
}
function Tog({ val, set, on = 'Ναι', off = 'Όχι' }: {
  val: boolean; set: (v: boolean) => void; on?: string; off?: string;
}) {
  return (
    <View style={s.togRow}>
      <TouchableOpacity style={[s.tog, !val && s.togOn]} onPress={() => set(false)} activeOpacity={0.7}>
        <Text style={[s.tott, !val && s.totOn]}>{off}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.tog, val && s.togOn]} onPress={() => set(true)} activeOpacity={0.7}>
        <Text style={[s.tott, val && s.totOn]}>{on}</Text>
      </TouchableOpacity>
    </View>
  );
}

type EntryMode = 'select' | 'voice' | 'harvest' | 'manual';
interface SavedHiveEntry { hiveName: string; savedAt: string; dead?: boolean; frames?: number; }

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: { extension: '.m4a', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 },
  ios: { extension: '.m4a', audioQuality: Audio.IOSAudioQuality.MEDIUM, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};

const STT_MODEL = 'gpt-4o-mini-transcribe';
const HARVEST_PROMPT = 'Ελληνικά: έτοιμος, στοπ, μηδέν, ένα, δύο, τρία, τέσσερα, πέντε, έξι, επτά, οκτώ, εννέα, δέκα, οριστικό τέλος, κυψέλη, πλαίσια';
const BEEP_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

async function speakHarvest(text: string): Promise<void> {
  try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false, staysActiveInBackground: false }); } catch {}
  await new Promise<void>(resolve => {
    const done = (): void => { setTimeout(resolve, 200); };
    Speech.stop();
    Speech.speak(text, { language: 'el-GR', rate: 0.95, onDone: () => done(), onError: () => done(), onStopped: () => { setTimeout(resolve, 100); } });
  });
  try { await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false, staysActiveInBackground: false }); } catch {}
  await new Promise<void>(r => setTimeout(r, 150));
}

async function recordHarvest(apiKey: string, durationMs: number): Promise<string> {
  try {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false, staysActiveInBackground: false });
    const { sound } = await Audio.Sound.createAsync({ uri: BEEP_URL }, { shouldPlay: true, volume: 1.0 });
    await new Promise(r => setTimeout(r, 400));
    await sound.unloadAsync();
  } catch {}
  try { await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false, staysActiveInBackground: false }); } catch {}
  await new Promise(r => setTimeout(r, 200));

  let uri: string | null = null;
  try {
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(RECORDING_OPTIONS);
    await rec.startAsync();
    await new Promise<void>(r => setTimeout(r, durationMs));
    await rec.stopAndUnloadAsync();
    uri = rec.getURI() ?? null;
  } catch { return ''; }
  if (!uri) return '';
  try {
    const fd = new FormData();
    fd.append('file', { uri, type: 'audio/mp4', name: 'rec.m4a' } as any);
    fd.append('model', STT_MODEL);
    fd.append('language', 'el');
    fd.append('prompt', HARVEST_PROMPT);
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: fd,
    });
    if (!res.ok) return '';
    const data = await res.json();
    return (data.text ?? '').trim();
  } catch { return ''; }
  finally { try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {} }
}

export default function InspectionScreen({ route, navigation }: any) {
  const { hive_id, hive_name, mode = 'guided', autoRecord = false, editInspection } = route.params ?? {};
  const [entryMode, setEntryMode] = useState<EntryMode>(hive_id ? 'manual' : 'select');
  const [hives, setHives]         = useState<Hive[]>([]);
  const hivesRef                  = useRef<Hive[]>([]);

  const [voiceState,      setVoiceState]      = useState('idle');
  const [currentHiveName, setCurrentHiveName] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [lastAnswer,      setLastAnswer]      = useState('');
  const [savedHives,      setSavedHives]      = useState<SavedHiveEntry[]>([]);
  const [sessionError,    setSessionError]    = useState('');
  const [savedCount,      setSavedCount]      = useState(0);

  const harvestStop = useRef(false);
  const harvestSavedCount = useRef(0);

  const [selectedHiveId,   setSelectedHiveId]   = useState<string>(hive_id ?? '');
  const [selectedHiveName, setSelectedHiveName] = useState<string>(hive_name ?? '');
  const [saving,  setSaving]  = useState(false);
  const [recent,  setRecent]  = useState<Inspection[]>([]);
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0]);
  const [pf,  setPf]  = useState(0);
  const [ps,  setPs]  = useState<string | null>(null);
  const [tp,  setTp]  = useState<string | null>(null);
  const [sw,  setSw]  = useState(false);
  const [qp,  setQp]  = useState<boolean | null>(null);
  const [qs,  setQs]  = useState<string | null>(null);
  const [ql,  setQl]  = useState<string | null>(null);
  const [qc,  setQc]  = useState(0);
  const [bf,  setBf]  = useState(0);
  const [bc,  setBc]  = useState<string | null>(null);
  const [bt,  setBt]  = useState<string | null>(null);
  const [hf,  setHf]  = useState(0);
  const [plf, setPlf] = useState(0);
  const [ft,  setFt]  = useState<string | null>('καμία');
  const [fa,  setFa]  = useState(0);
  const [vl,  setVl]  = useState<string | null>(null);
  const [vm,  setVm]  = useState('');
  const [dis, setDis] = useState<string[]>([]);
  const [tt,  setTt]  = useState('');
  const [td,  setTd]  = useState('');
  const [es,  setEs]  = useState<string | null>(null);
  const [en,  setEn]  = useState('');
  const [ma,  setMa]  = useState('');
  const [nv,  setNv]  = useState('');
  const [nvr, setNvr] = useState('');
  const [urg, setUrg] = useState(false);
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(editInspection?.id ?? null);

  useEffect(() => {
    getHives().then(h => { setHives(h); hivesRef.current = h; }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedHiveName) navigation.setOptions({ title: `🔍 ${selectedHiveName}` });
  }, [selectedHiveName]);

  useEffect(() => {
    if (!selectedHiveId) return;
    getInspectionsByHive(selectedHiveId).then(d => setRecent(d.slice(0, 3))).catch(() => {});
  }, [selectedHiveId]);

  useEffect(() => {
    if (!autoRecord) return;
    setEntryMode('voice');
    const t = setTimeout(() => startVoiceSession(), 800);
    return () => clearTimeout(t);
  }, [autoRecord]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      guidedVoiceSession.reset();
      harvestStop.current = true;
    };
  }, []);

  // ═══ EDIT MODE: φόρτωση δεδομένων από editInspection ═══════
  useEffect(() => {
    if (!editInspection) return;
    console.log('[Edit] Loading editInspection id:', editInspection.id);
    setEditingId(editInspection.id);
    setEntryMode('manual');
    setSelectedHiveId(editInspection.hive_id);
    setSelectedHiveName(editInspection.hive_name ?? '');
    setDate(editInspection.date?.split('T')[0] ?? new Date().toISOString().split('T')[0]);
    setPf(editInspection.population_frames ?? 0);
    setPs(editInspection.population_strength ?? null);
    setTp(editInspection.temperament ?? null);
    setSw(editInspection.has_swarmed ?? false);
    setQp(editInspection.queen_present ?? null);
    setQs(editInspection.queen_status ?? null);
    setQl(editInspection.queen_laying ?? null);
    setQc(editInspection.queen_cells ?? 0);
    setBf(editInspection.brood_frames ?? 0);
    setBc(editInspection.brood_condition ?? null);
    setBt(editInspection.brood_type ?? null);
    setHf(editInspection.honey_frames ?? 0);
    setPlf(editInspection.pollen_frames ?? 0);
    setFt(editInspection.feeding_type ?? 'καμία');
    setFa(editInspection.feeding_amount ?? 0);
    setVl(editInspection.varroa_level ?? null);
    setVm(editInspection.varroa_measurement != null ? String(editInspection.varroa_measurement) : '');
    setDis(editInspection.diseases ? editInspection.diseases.split(', ').filter(Boolean) : []);
    setTt(editInspection.treatment_type ?? '');
    setTd(editInspection.treatment_dose != null ? String(editInspection.treatment_dose) : '');
    setEs(editInspection.equipment_status ?? null);
    setEn(editInspection.equipment_notes ?? '');
    setMa(editInspection.management_actions ?? '');
    setNv(editInspection.next_visit ?? '');
    setNvr(editInspection.next_visit_reason ?? '');
    setUrg(editInspection.urgent ?? false);
    setNotes(editInspection.notes ?? '');
  }, [editInspection]);

  const getHiveByNumber = useCallback((num: number | string) => {
    const numStr = String(num).trim();
    const h = hivesRef.current.find(hv => {
      const name = hv.name.trim();
      if (name === numStr) return true;
      const m = name.match(/\d+/);
      return m ? m[0] === numStr : false;
    });
    return h ? { id: h.id, name: h.name } : null;
  }, []);

  const togDis = (d: string) =>
    setDis(p => p.includes(d) ? p.filter((x: string) => x !== d) : [...p, d]);

  // ═══ DIRECT SAVE από voice ════════════════════════════════
  const persistVoiceInspection = useCallback(async (r: GuidedInspectionResult): Promise<void> => {
    const now = new Date().toISOString();
    await createInspection({
      hive_id: r.hive_id, date: now, mode: 'guided' as const,
      population_frames: r.population_frames ?? null,
      population_strength: null,
      temperament: r.temperament as any ?? null,
      has_swarmed: r.has_swarmed ?? false,
      queen_present: r.queen_present ?? null,
      queen_status: r.queen_status as any ?? null,
      queen_laying: null,
      queen_cells: r.queen_cells ?? null,
      brood_frames: r.brood_frames ?? null,
      brood_condition: null, brood_type: null,
      honey_frames: r.honey_frames ?? null,
      pollen_frames: null,
      feeding_type: (r.feeding_type as any) ?? 'καμία',
      feeding_amount: null,
      varroa_level: null, varroa_measurement: null,
      diseases: null, treatment_type: null, treatment_dose: null,
      equipment_status: null, equipment_notes: null,
      management_actions: null, next_visit: null, next_visit_reason: null,
      urgent: r.urgent ?? false,
      notes: r.notes ?? null,
      audio_url: null, transcript: null, notifications_disabled: false,
    });
    try {
      await updateHive(r.hive_id, {
        status: r.is_dead ? 'dead' : 'active',
        last_inspection_date: now,
        population_frames: r.population_frames ?? null,
        brood_frames: r.brood_frames ?? null,
        honey_frames: r.honey_frames ?? null,
        queen_present: r.queen_present ?? null,
        queen_status: r.queen_status ?? null,
        temperament: r.temperament ?? null,
        has_swarmed: r.has_swarmed ?? false,
        urgent: r.urgent ?? false,
        notes: r.notes ?? null,
      });
      if (r.is_dead) {
        const fresh = await getHives();
        setHives(fresh); hivesRef.current = fresh;
      }
    } catch (e) {
      console.warn('[Inspection] updateHive failed but inspection saved:', e);
    }
  }, []);

  // ═══ HARVEST ═══════════════════════════════════════════════
  const startHarvestSession = async () => {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_KEY ?? '';
    if (!apiKey) { Alert.alert('Σφάλμα', 'EXPO_PUBLIC_OPENAI_KEY λείπει'); return; }
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Σφάλμα', 'Δεν δόθηκε άδεια μικροφώνου'); return; }
    setEntryMode('harvest');
    setSavedHives([]); setSavedCount(0);
    setCurrentHiveName(''); setSessionError('');
    setCurrentQuestion(''); setLastAnswer('');
    harvestStop.current = false;
    harvestSavedCount.current = 0;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false, staysActiveInBackground: false });
    harvestActiveLoop(apiKey, true);
  };

  const harvestPausedLoop = async (apiKey: string) => {
    setVoiceState('paused');
    setCurrentHiveName('');
    setCurrentQuestion('Σε αδράνεια — πείτε "έτοιμος"');
    while (!harvestStop.current) {
      const text = await recordHarvest(apiKey, 2500);
      if (!text) continue;
      if (isFinalEnd(text)) { await finishHarvest(); return; }
      if (isWakeWord(text)) { setLastAnswer(text); harvestActiveLoop(apiKey, true); return; }
    }
  };

  const harvestActiveLoop = async (apiKey: string, announce: boolean) => {
    setVoiceState('waiting_hive');
    setCurrentQuestion('Πείτε αριθμό κυψέλης');
    if (announce) await speakHarvest('Πείτε αριθμό κυψέλης.');
    let emptyCount = 0;
    while (!harvestStop.current) {
      const text = await recordHarvest(apiKey, 3500);
      if (!text) {
        emptyCount++;
        if (emptyCount >= 3) { await speakHarvest('Αδράνεια. Πείτε έτοιμος για συνέχεια.'); harvestPausedLoop(apiKey); return; }
        continue;
      }
      emptyCount = 0;
      if (isStopWord(text)) { await speakHarvest('Αδράνεια. Πείτε έτοιμος για συνέχεια.'); harvestPausedLoop(apiKey); return; }
      if (isFinalEnd(text)) { await finishHarvest(); return; }
      const hiveNum = parseNum(text);
      if (hiveNum !== null && hiveNum > 0) {
        const hive = getHiveByNumber(hiveNum);
        if (!hive) { await speakHarvest(`Δεν βρήκα κυψέλη ${hiveNum}. Ξαναπείτε.`); continue; }
        setCurrentHiveName(hive.name);
        setVoiceState('recording');
        setCurrentQuestion(`Κυψέλη ${hiveNum} — Πόσα πλαίσια;`);
        await speakHarvest(`Κυψέλη ${hiveNum}. Πόσα πλαίσια;`);
        let frames: number | null = null;
        let pauseReq = false;
        for (let attempt = 1; attempt <= 3 && frames === null && !harvestStop.current; attempt++) {
          const ans = await recordHarvest(apiKey, 3500);
          if (ans) {
            if (isStopWord(ans)) { pauseReq = true; break; }
            setLastAnswer(ans);
            frames = parseNum(ans);
          }
          if (frames === null && !pauseReq && attempt < 3) await speakHarvest('Επανέλαβε, δεν κατάλαβα.');
        }
        if (pauseReq) { await speakHarvest('Αδράνεια. Πείτε έτοιμος για συνέχεια.'); harvestPausedLoop(apiKey); return; }
        if (frames !== null) {
          setVoiceState('processing');
          try {
            await createHarvest({ hive_id: hive.id, date: new Date().toISOString(), frames_harvested: frames });
            try {
              await updateHive(hive.id, { last_harvest_date: new Date().toISOString(), last_harvest_frames: frames });
            } catch (e) { console.warn('[Harvest] updateHive failed, harvest saved OK', e); }
            harvestSavedCount.current += 1;
            setSavedCount(harvestSavedCount.current);
            setSavedHives(sh => [...sh, { hiveName: hive.name, savedAt: new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }), frames }]);
            await speakHarvest(`Κυψέλη ${hiveNum}, ${frames} πλαίσια, αποθηκεύτηκε.`);
          } catch (e: any) { setSessionError(`Σφάλμα: ${e.message}`); await speakHarvest('Σφάλμα αποθήκευσης.'); }
          await speakHarvest('Πείτε επόμενη κυψέλη ή οριστικό τέλος.');
        } else {
          await speakHarvest('Κυψέλη δεν καταγράφηκε. Πείτε επόμενη κυψέλη ή οριστικό τέλος.');
        }
        setVoiceState('waiting_hive');
        setCurrentHiveName('');
        setCurrentQuestion('Πείτε αριθμό κυψέλης');
      }
    }
  };

  const finishHarvest = async () => {
    await speakHarvest(`Τρύγος ολοκληρώθηκε. ${harvestSavedCount.current} κυψέλες.`);
    setVoiceState('finished');
    setTimeout(() => {
      Alert.alert('✅ Τρύγος Ολοκληρώθηκε!', `${harvestSavedCount.current} κυψέλες καταγράφηκαν.`,
        [{ text: 'Πίσω', onPress: () => navigation.goBack() }]);
    }, 1000);
  };

  // ═══ INSPECTION SESSION (direct save) ═══════════════════════
  const guidedCallbacks: GuidedSessionCallbacks = {
    onQuestion:    (q) => setCurrentQuestion(q),
    onAnswer:      (a) => setLastAnswer(a),
    onListening:   () => {},
    onHiveStart:   (name) => { setCurrentHiveName(name); setCurrentQuestion(''); setLastAnswer(''); },
    onError:       (msg) => { console.warn('[Voice]', msg); setSessionError(msg); },
    onStateChange: (state) => {
      setVoiceState(state);
      if (state === 'waiting_hive') { setCurrentHiveName(''); setCurrentQuestion('Πείτε αριθμό κυψέλης'); setLastAnswer(''); }
      if (state === 'paused') { setCurrentQuestion('Πείτε επόμενη κυψέλη ή οριστικό τέλος'); }
    },
    onHiveSaved: (name, count) => {
      setSavedCount(count);
      setSavedHives(sh => [...sh, {
        hiveName: name,
        savedAt: new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
      }]);
    },
    onFinished: (count) => {
      setTimeout(() => {
        Alert.alert(
          '✅ Επιθεώρηση Ολοκληρώθηκε!',
          count > 0 ? `${count} κυψέλες καταγράφηκαν.` : 'Δεν αποθηκεύτηκαν κυψέλες.',
          [{ text: 'Πίσω', onPress: () => navigation.goBack() }],
        );
      }, 800);
    },
    saveInspection: persistVoiceInspection,
    getHiveByNumber,
  };

  const startVoiceSession = async () => {
    setEntryMode('voice');
    setSavedHives([]); setSavedCount(0);
    setCurrentHiveName(''); setCurrentQuestion('');
    setLastAnswer(''); setSessionError('');
    guidedVoiceSession.reset();
    await guidedVoiceSession.start(guidedCallbacks);
  };

  // ═══ MANUAL SAVE (create ή update) ═════════════════════════
  const saveManualInspection = async () => {
    if (!selectedHiveId) { Alert.alert('Προσοχή', 'Επίλεξε κυψέλη.'); return; }
    setSaving(true);
    const now = new Date(date).toISOString();
    try {
      const payload = {
        hive_id: selectedHiveId, date: now, mode,
        population_frames: pf || null, population_strength: ps as any,
        temperament: tp as any, has_swarmed: sw, queen_present: qp,
        queen_status: qs as any, queen_laying: ql as any, queen_cells: qc || null,
        brood_frames: bf || null, brood_condition: bc as any, brood_type: bt as any,
        honey_frames: hf || null, pollen_frames: plf || null,
        feeding_type: ft as any, feeding_amount: ft !== 'καμία' ? fa : null,
        varroa_level: vl as any, varroa_measurement: vm ? parseFloat(vm) : null,
        diseases: dis.length ? dis.join(', ') : null,
        treatment_type: tt || null, treatment_dose: td ? parseFloat(td) : null,
        equipment_status: es as any, equipment_notes: en || null,
        management_actions: ma || null, next_visit: nv || null,
        next_visit_reason: nvr || null, urgent: urg, notes: notes || null,
        audio_url: null, transcript: null, notifications_disabled: false,
      };
      if (editingId) {
        await updateInspection(editingId, payload);
      } else {
        await createInspection(payload);
      }
      await updateHive(selectedHiveId, {
        last_inspection_date: now,
        population_frames: pf || null,
        brood_frames: bf || null,
        honey_frames: hf || null,
        queen_present: qp ?? null,
        queen_status: qs ?? null,
        temperament: tp ?? null,
        has_swarmed: sw, urgent: urg,
        notes: notes || null,
      });
      Alert.alert(
        editingId ? '✅ Ενημερώθηκε!' : '✅ Αποθηκεύτηκε!',
        `Επιθεώρηση "${selectedHiveName}" ${editingId ? 'ενημερώθηκε' : 'καταχωρήθηκε'}.`,
        [{ text: 'Πίσω', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Σφάλμα', e.message ?? 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const handleForceStop = () => {
    Alert.alert('Διακοπή', 'Θέλεις να τερματίσεις;',
      [
        { text: 'Άκυρο', style: 'cancel' },
        { text: 'Διακοπή', style: 'destructive', onPress: () => {
          guidedVoiceSession.forceStop();
          harvestStop.current = true;
          setVoiceState('finished');
        }},
      ],
    );
  };

  const stateLabel: Record<string, { icon: string; label: string; color: string }> = {
    idle:         { icon: '💤', label: 'Έτοιμο',                      color: C.dark },
    paused:       { icon: '⏸️', label: 'Αδράνεια — πείτε "έτοιμος"',  color: '#334155' },
    waiting_hive: { icon: '🎙️', label: 'Ακούω...',                    color: '#1E3A5F' },
    recording:    { icon: '🔴', label: 'Καταγραφή',                   color: '#7F1D1D' },
    processing:   { icon: '⚙️', label: 'Αποθήκευση...',               color: '#1E293B' },
    finished:     { icon: '✅', label: 'Ολοκληρώθηκε',                 color: '#14532D' },
  };
  const cfg = stateLabel[voiceState] ?? stateLabel.idle;

  // ─── SELECT ───────────────────────────────────────────────
  if (entryMode === 'select') {
    return (
      <ScrollView style={s.selectContainer} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={s.selectTitle}>🐝 Νέα Καταχώρηση</Text>
        <Text style={s.selectSub}>Επίλεξε τρόπο</Text>

        <TouchableOpacity style={s.selectBtnVoice} onPress={startVoiceSession} activeOpacity={0.85}>
          <Text style={s.selectBtnIcon}>🎙️</Text>
          <Text style={s.selectBtnTitle}>Φωνητική Επιθεώρηση</Text>
          <Text style={s.selectBtnSub}>Άμεση αποθήκευση μετά από κάθε κυψέλη</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.historyLink} onPress={() => navigation.navigate('InspectionHistory')} activeOpacity={0.7}>
          <Text style={s.historyLinkIcon}>📋</Text>
          <Text style={s.historyLinkTxt}>Ιστορικό Επιθεωρήσεων</Text>
          <Text style={s.historyLinkArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.selectBtnHarvest} onPress={startHarvestSession} activeOpacity={0.85}>
          <Text style={s.selectBtnIcon}>🍯</Text>
          <Text style={s.selectBtnTitle}>Τρύγος</Text>
          <Text style={s.selectBtnSub}>Πλαίσια ανά κυψέλη</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.historyLink} onPress={() => navigation.navigate('HarvestHistory')} activeOpacity={0.7}>
          <Text style={s.historyLinkIcon}>🍯</Text>
          <Text style={s.historyLinkTxt}>Ιστορικό Τρύγου</Text>
          <Text style={s.historyLinkArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.selectBtnManual} onPress={() => setEntryMode('manual')} activeOpacity={0.85}>
          <Text style={s.selectBtnIcon}>✍️</Text>
          <Text style={[s.selectBtnTitle, { color: C.text }]}>Χειροκίνητη Καταχώρηση</Text>
          <Text style={[s.selectBtnSub, { color: C.textSub }]}>Συμπλήρωσε τα πεδία χειρόγραφα</Text>
        </TouchableOpacity>

        <View style={s.cmdGuide}>
          <Text style={s.cmdTitle}>📋 Φωνητικές Εντολές</Text>
          {[
            ['[αριθμός]', 'Επιλογή κυψέλης / πλαίσια'],
            ['ναι / όχι', 'Απαντήσεις ερωτήσεων'],
            ['παράλειψη', 'Παράλειψη σημειώσεων'],
            ['τέλος', 'Τέλος σημειώσεων'],
            ['οριστικό τέλος', 'Τερματισμός'],
          ].map(([cmd, desc]) => (
            <View key={cmd + desc} style={s.cmdRow}>
              <Text style={s.cmdCmd}>"{cmd}"</Text>
              <Text style={s.cmdDesc}>{desc}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ─── VOICE / HARVEST ──────────────────────────────────────
  if (entryMode === 'voice' || entryMode === 'harvest') {
    const isHarvest = entryMode === 'harvest';
    return (
      <View style={s.voiceContainer}>
        <View style={s.voiceHeader}>
          <TouchableOpacity onPress={() => { guidedVoiceSession.reset(); harvestStop.current = true; setEntryMode('select'); }} style={s.backBtn}>
            <Text style={s.backBtnTxt}>← Πίσω</Text>
          </TouchableOpacity>
          <Text style={[s.voiceTitle, isHarvest && { color: C.honey }]}>
            {isHarvest ? '🍯 Τρύγος' : '🎙️ Φωνητική Επιθεώρηση'}
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={[s.hiveBar, isHarvest && { borderColor: C.honey }]}>
            <Text style={s.hiveBarIcon}>{isHarvest ? '🍯' : '🐝'}</Text>
            <Text style={[s.hiveBarName, !currentHiveName && { color: C.textLight }]}>
              {currentHiveName ? `Κυψέλη ${currentHiveName}` :
               voiceState === 'paused' ? 'Αδράνεια' :
               voiceState === 'waiting_hive' ? 'Αναμένω κυψέλη...' :
               voiceState === 'finished' ? 'Ολοκληρώθηκε' : '—'}
            </Text>
            {savedCount > 0 && (
              <View style={[s.savedBadge, isHarvest && { backgroundColor: '#78350F' }]}>
                <Text style={s.savedBadgeTxt}>✅ {savedCount}</Text>
              </View>
            )}
          </View>
          <View style={[s.statusBox, { backgroundColor: cfg.color }]}>
            {voiceState === 'processing'
              ? <ActivityIndicator color="#fff" size="large" style={{ marginBottom: 12 }} />
              : <Text style={s.statusIcon}>{cfg.icon}</Text>}
            <Text style={s.statusLabel}>{cfg.label}</Text>
            {!!sessionError && <Text style={[s.statusSub, { color: '#FCA5A5', marginTop: 8 }]}>⚠️ {sessionError}</Text>}
          </View>
          {!!currentQuestion && (
            <View style={[s.qaBox, isHarvest && { borderColor: C.honey }]}>
              <Text style={[s.qaQuestion, isHarvest && { color: C.honey }]}>❓ {currentQuestion}</Text>
              {!!lastAnswer && <Text style={s.qaAnswer}>🗣️ {lastAnswer}</Text>}
            </View>
          )}
          {savedHives.length > 0 && (
            <View style={s.savedList}>
              <Text style={s.savedListTitle}>Καταγραφές ({savedHives.length})</Text>
              {savedHives.map((h, i) => (
                <View key={i} style={s.savedRow}>
                  <Text style={s.savedRowIcon}>{h.dead ? '💀' : isHarvest ? '🍯' : '🐝'}</Text>
                  <Text style={[s.savedRowName, h.dead && { color: '#F87171' }]}>
                    Κυψέλη {h.hiveName}{h.dead ? ' — ΝΕΚΡΗ' : h.frames !== undefined ? ` — ${h.frames} πλαίσια` : ''}
                  </Text>
                  <Text style={s.savedRowTime}>{h.savedAt}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={s.controls}>
            {voiceState !== 'finished' && (
              <TouchableOpacity style={s.btnStop} onPress={handleForceStop} activeOpacity={0.8}>
                <Text style={s.btnTxt}>⏹️ Οριστική Διακοπή</Text>
              </TouchableOpacity>
            )}
            {voiceState === 'finished' && (
              <TouchableOpacity style={s.btnBack} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Text style={s.btnTxt}>🏠 Επιστροφή</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ─── MANUAL ───────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {!hive_id && !editingId && (
          <TouchableOpacity style={s.backBtn} onPress={() => setEntryMode('select')}>
            <Text style={s.backBtnTxt}>← Αλλαγή τρόπου</Text>
          </TouchableOpacity>
        )}
        {editingId && (
          <View style={s.editBanner}>
            <Text style={s.editBannerTxt}>✏️ Επεξεργασία Επιθεώρησης</Text>
          </View>
        )}
        <View style={s.card}>
          <SH e="🐝" t="Επίλεξε Κυψέλη" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.row}>
              {hives.map((h: Hive) => (
                <TouchableOpacity key={h.id}
                  style={[s.chip, selectedHiveId === h.id && s.chipA]}
                  onPress={() => { setSelectedHiveId(h.id); setSelectedHiveName(h.name); }}
                  activeOpacity={0.7}>
                  <Text style={[s.ct, selectedHiveId === h.id && s.ctA]}>🐝 {h.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
        {recent.length > 0 && !editingId && (
          <View style={s.recentBox}>
            <Text style={s.recentTitle}>📅 Ιστορικό (τελευταίες 3)</Text>
            {recent.map(r => (
              <View key={r.id} style={s.recentRow}>
                <Text style={s.recentDate}>{new Date(r.date).toLocaleDateString('el-GR')}</Text>
                <Text style={s.recentDet}>{r.population_strength ?? '—'} · {r.temperament ?? '—'}</Text>
                {r.urgent && <View style={s.urgBadge}><Text style={s.urgTxt}>⚠️ Επείγον</Text></View>}
              </View>
            ))}
          </View>
        )}
        <View style={s.card}>
          <SH e="📋" t="Βασικά Στοιχεία" />
          <Lbl text="Ημερομηνία" />
          <TextInput style={s.inp} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={C.textLight} />
        </View>
        <View style={s.card}>
          <SH e="👑" t="Πληθυσμός & Βασίλισσα" />
          <Lbl text="Πλαίσια με Μέλισσες" /><Step val={pf} set={setPf} sfx="πλαίσια" />
          <Lbl text="Δύναμη Μελίσσιου" /><Chips opts={POPULATION_STRENGTH_OPTIONS} val={ps} onSel={setPs} />
          <Lbl text="Ιδιοσυγκρασία" /><Chips opts={TEMPERAMENT_OPTIONS} val={tp} onSel={setTp} />
          <Lbl text="Σμηνουργία" /><Tog val={sw} set={setSw} on="🐝 Σμηνουργήσε" off="Δεν σμηνούγησε" />
          <Lbl text="Παρουσία Βασίλισσας" />
          <View style={s.row}>
            {[{ v: true, l: '✅ Ναι' }, { v: false, l: '❌ Όχι' }, { v: null, l: '❓ Αβέβαιο' }].map(o => (
              <TouchableOpacity key={String(o.v)} style={[s.chip, qp === o.v && s.chipA]} onPress={() => setQp(o.v)} activeOpacity={0.7}>
                <Text style={[s.ct, qp === o.v && s.chipA]}>{o.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {qp === true && (
            <>
              <Lbl text="Κατάσταση Βασίλισσας" />
              <Chips opts={[
                { value: 'Εξαιρετική',      label: '⭐ Εξαιρετική'      },
                { value: 'Μέτρια',          label: '😐 Μέτρια'          },
                { value: 'κακή',            label: '❌ Κακή'            },
                { value: 'Δεν εντοπίστηκε', label: '🔍 Δεν εντοπίστηκε' },
                { value: 'Σμηνουργίας',     label: '🐝 Σμηνουργίας'     },
                { value: 'Ορφανό',          label: '⚠️ Ορφανό'          },
              ]} val={qs} onSel={setQs} />
              <Lbl text="Ωοτοκία" />
              <Chips opts={[
                { value: 'κανονική', label: '🟢 Κανονική' },
                { value: 'αραιή',    label: '🟡 Αραιή'    },
                { value: 'καμία',    label: '🔴 Καμία'    },
              ]} val={ql} onSel={setQl} />
            </>
          )}
          <Lbl text="Βασιλικά Κελιά" /><Step val={qc} set={setQc} max={20} sfx="κελιά" />
        </View>
        <View style={s.card}>
          <SH e="🥚" t="Γόνος" />
          <Lbl text="Πλαίσια Γόνου" /><Step val={bf} set={setBf} sfx="πλαίσια" />
          <Lbl text="Κατάσταση Γόνου" /><Chips opts={BROOD_CONDITION_OPTIONS} val={bc} onSel={setBc} />
          <Lbl text="Τύπος Γόνου" />
          <Chips opts={[
            { value: 'ανοιχτός', label: '🟡 Ανοιχτός' },
            { value: 'κλειστός', label: '🟤 Κλειστός' },
            { value: 'μικτός',   label: '🔵 Μικτός'   },
          ]} val={bt} onSel={setBt} />
        </View>
        <View style={s.card}>
          <SH e="🍯" t="Αποθέματα" />
          <Lbl text="Πλαίσια Μελιού" /><Step val={hf} set={setHf} sfx="πλαίσια" />
          <Lbl text="Πλαίσια Γύρης" /><Step val={plf} set={setPlf} sfx="πλαίσια" />
          <Lbl text="Τροφοδοσία" /><Chips opts={FEEDING_TYPE_OPTIONS} val={ft} onSel={setFt} />
          {ft !== 'καμία' && (<><Lbl text="Ποσότητα (kg / lt)" /><Step val={fa} set={setFa} max={50} sfx="kg/lt" /></>)}
        </View>
        <View style={s.card}>
          <SH e="🦠" t="Υγεία & Θεραπείες" />
          <Lbl text="Επίπεδο Βαρρόας" /><Chips opts={VARROA_LEVEL_OPTIONS} val={vl} onSel={setVl} />
          <Lbl text="Μέτρηση Βαρρόας (‰)" />
          <TextInput style={s.inp} value={vm} onChangeText={setVm} keyboardType="decimal-pad" placeholder="π.χ. 2.5" placeholderTextColor={C.textLight} />
          <Lbl text="Ασθένειες" />
          <View style={s.row}>
            {DISEASES_OPTIONS.map((d: string) => (
              <TouchableOpacity key={d} style={[s.chip, dis.includes(d) && { backgroundColor: C.redLight, borderColor: C.red }]} onPress={() => togDis(d)} activeOpacity={0.7}>
                <Text style={[s.ct, dis.includes(d) && { color: C.red, fontWeight: '700' }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Lbl text="Θεραπεία" />
          <TextInput style={s.inp} value={tt} onChangeText={setTt} placeholder="π.χ. Amitraz..." placeholderTextColor={C.textLight} />
          <Lbl text="Δόση (ml / gr)" />
          <TextInput style={s.inp} value={td} onChangeText={setTd} keyboardType="decimal-pad" placeholder="π.χ. 5" placeholderTextColor={C.textLight} />
        </View>
        <View style={s.card}>
          <SH e="🔧" t="Εξοπλισμός & Χειρισμοί" />
          <Lbl text="Κατάσταση Εξοπλισμού" /><Chips opts={EQUIPMENT_STATUS_OPTIONS} val={es} onSel={setEs} />
          <Lbl text="Σημειώσεις Εξοπλισμού" />
          <TextInput style={[s.inp, s.ta]} value={en} onChangeText={setEn} multiline numberOfLines={2} placeholder="π.χ. Χρειάζεται νέο πλαίσιο..." placeholderTextColor={C.textLight} />
          <Lbl text="Χειρισμοί" />
          <TextInput style={[s.inp, s.ta]} value={ma} onChangeText={setMa} multiline numberOfLines={3} placeholder="π.χ. Τοποθέτηση 2ου σώματος..." placeholderTextColor={C.textLight} />
        </View>
        <View style={s.card}>
          <SH e="📅" t="Επόμενη Επίσκεψη" />
          <Lbl text="Ημερομηνία" />
          <TextInput style={s.inp} value={nv} onChangeText={setNv} placeholder="YYYY-MM-DD" placeholderTextColor={C.textLight} />
          <Lbl text="Λόγος" />
          <TextInput style={s.inp} value={nvr} onChangeText={setNvr} placeholder="π.χ. Έλεγχος θεραπείας..." placeholderTextColor={C.textLight} />
          <Lbl text="Προτεραιότητα" /><Tog val={urg} set={setUrg} on="⚠️ Επείγον" off="✅ Κανονικό" />
        </View>
        <View style={s.card}>
          <SH e="📝" t="Σημειώσεις" />
          <TextInput style={[s.inp, s.ta]} value={notes} onChangeText={setNotes} multiline numberOfLines={4} placeholder="Ελεύθερες παρατηρήσεις..." placeholderTextColor={C.textLight} />
        </View>
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={saveManualInspection} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>{editingId ? '💾 Ενημέρωση Επιθεώρησης' : '💾 Αποθήκευση Επιθεώρησης'}</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  selectContainer: { flex: 1, backgroundColor: C.bg, padding: 24, paddingTop: 60 },
  selectTitle:     { fontSize: 28, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 8 },
  selectSub:       { fontSize: 15, color: C.textSub, textAlign: 'center', marginBottom: 32 },
  selectBtnVoice:  { backgroundColor: C.record, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 6 },
  selectBtnHarvest:{ backgroundColor: '#D97706', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, elevation: 6 },
  selectBtnManual: { backgroundColor: C.card, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: C.border, elevation: 2, marginBottom: 24 },
  selectBtnIcon:   { fontSize: 48, marginBottom: 8 },
  selectBtnTitle:  { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  selectBtnSub:    { fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  cmdGuide:  { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  cmdTitle:  { fontSize: 13, fontWeight: '700', color: C.green, marginBottom: 10 },
  cmdRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cmdCmd:    { fontSize: 13, fontWeight: '700', color: C.dark, flex: 1 },
  cmdDesc:   { fontSize: 13, color: C.textSub, flex: 1, textAlign: 'right' },
  voiceContainer: { flex: 1, backgroundColor: C.darker },
  voiceHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12 },
  voiceTitle:     { fontSize: 18, fontWeight: '800', color: C.primary },
  hiveBar:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1E293B', marginHorizontal: 16, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: C.primary },
  hiveBarIcon:    { fontSize: 24 },
  hiveBarName:    { fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 },
  savedBadge:     { backgroundColor: '#14532D', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  savedBadgeTxt:  { fontSize: 13, fontWeight: '700', color: '#86EFAC' },
  statusBox:      { marginHorizontal: 16, borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 16, minHeight: 120, justifyContent: 'center' },
  statusIcon:     { fontSize: 44, marginBottom: 10 },
  statusLabel:    { fontSize: 17, fontWeight: '700', color: '#fff', textAlign: 'center' },
  statusSub:      { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 8, textAlign: 'center' },
  qaBox:          { marginHorizontal: 16, backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: C.primary },
  qaQuestion:     { fontSize: 16, fontWeight: '700', color: C.primary, marginBottom: 8 },
  qaAnswer:       { fontSize: 15, color: '#E2E8F0' },
  savedList:      { marginHorizontal: 16, backgroundColor: '#1E293B', borderRadius: 14, padding: 14, marginBottom: 16 },
  savedListTitle: { fontSize: 13, fontWeight: '700', color: '#86EFAC', marginBottom: 10 },
  savedRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#334155' },
  savedRowIcon:   { fontSize: 18 },
  savedRowName:   { fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 },
  savedRowTime:   { fontSize: 12, color: '#94A3B8' },
  controls:       { marginHorizontal: 16, gap: 12 },
  btnStop:        { backgroundColor: '#991B1B', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnBack:        { backgroundColor: C.green, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnTxt:         { fontSize: 16, fontWeight: '800', color: '#fff' },
  backBtn:        { paddingHorizontal: 4, paddingVertical: 8 },
  backBtnTxt:     { fontSize: 14, color: '#94A3B8' },
  editBanner:     { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1.5, borderColor: C.primary },
  editBannerTxt:  { fontSize: 15, fontWeight: '700', color: C.primaryDark, textAlign: 'center' },
  container:      { flex: 1, backgroundColor: C.bg },
  content:        { padding: 16 },
  recentBox:      { backgroundColor: C.blueLight, borderRadius: 12, padding: 12, marginBottom: 12 },
  recentTitle:    { fontSize: 13, fontWeight: '700', color: C.blue, marginBottom: 8 },
  recentRow:      { marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#BFDBFE' },
  recentDate:     { fontSize: 13, fontWeight: '600', color: C.text },
  recentDet:      { fontSize: 12, color: C.textSub, marginTop: 2 },
  urgBadge:       { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  urgTxt:         { fontSize: 11, color: '#92400E', fontWeight: '700' },
  card:           { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, elevation: 2 },
  sh:             { flexDirection: 'row', alignItems: 'center', marginBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 10 },
  se:             { fontSize: 20, marginRight: 8 },
  st:             { fontSize: 16, fontWeight: '700', color: C.text },
  lbl:            { fontSize: 13, fontWeight: '600', color: C.textSub, marginBottom: 6, marginTop: 10 },
  inp:            { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 15, color: C.text, backgroundColor: '#FAFAFA', marginBottom: 4 },
  ta:             { minHeight: 80, textAlignVertical: 'top' },
  row:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: '#F9FAFB' },
  chipA:          { backgroundColor: C.primaryLight, borderColor: C.primary },
  ct:             { fontSize: 13, color: C.textSub, fontWeight: '500' },
  ctA:            { color: C.primaryDark, fontWeight: '700' },
  stepper:        { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  sb:             { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center' },
  sbt:            { fontSize: 22, fontWeight: '700', color: C.primaryDark },
  sv:             { fontSize: 20, fontWeight: '700', color: C.text, minWidth: 60, textAlign: 'center' },
  ss:             { fontSize: 13, color: C.textSub, fontWeight: '400' },
  togRow:         { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tog:            { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: '#F9FAFB', alignItems: 'center' },
  togOn:          { backgroundColor: C.primaryLight, borderColor: C.primary },
  tott:           { fontSize: 14, color: C.textSub, fontWeight: '500' },
  totOn:          { color: C.primaryDark, fontWeight: '700' },
  saveBtn:        { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 8, elevation: 6 },
  saveTxt:        { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  historyLink:    {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 14,
    marginBottom: 16, borderWidth: 1.5, borderColor: C.border,
    elevation: 1,
  },
  historyLinkIcon:  { fontSize: 22 },
  historyLinkTxt:   { fontSize: 15, color: C.text, fontWeight: '700', flex: 1 },
  historyLinkArrow: { fontSize: 22, color: C.textSub, fontWeight: '700' },
});