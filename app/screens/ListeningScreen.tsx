// screens/ListeningScreen.tsx — BeeManager v4.2
// Continuous offline STT με react-native-executorch + expo-av
//
// v4.2: WHISPER_BASE αντί TINY για καλύτερη αναγνώριση ελληνικών
// v4.1: Android recording options — από DEFAULT/DEFAULT (που παράγει AMR_NB
//       σε 3GPP container παρά το .wav extension) → MPEG_4/AAC/.m4a.
//       Το FFmpeg του AudioContext μπορεί πλέον να κάνει decode.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, AppState, AppStateStatus, ActivityIndicator,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { AudioContext } from 'react-native-audio-api';
import {
  useSpeechToText,
  WHISPER_BASE,
  SpeechToTextLanguage,
} from 'react-native-executorch';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLock } from '../../hooks/useLock';
import { parseWakeWord, WakeWordCommand } from '../services/voiceService';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Hive {
  id: string;
  name: string;
  locked_by: string | null;
  locked_at: string | null;
}

type ListeningState = 'idle' | 'hive_selected' | 'navigating';

interface Props {
  navigation: any;
  route: { params?: { apiary_id?: string; apiary_name?: string } };
}

// ─── RECORDING OPTIONS ────────────────────────────────────────────────────────
// Android: MPEG_4 + AAC → έγκυρο .m4a που το FFmpeg αποκωδικοποιεί.
//          Το DEFAULT/DEFAULT παράγει AMR_NB/3GPP → FFmpeg crash.
// iOS:     WAV/PCM — ιδανικό για Whisper/executorch (16kHz mono).
// Το AudioContext (react-native-audio-api) κάνει resampling σε 16kHz κατά το decode.

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function ListeningScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { lockHive, unlockHive } = useLock();
  const apiary_name = route.params?.apiary_name ?? 'Μελισσοκομείο';

  // Executorch STT hook — WHISPER_BASE: καλύτερα ελληνικά από TINY, λογικό trade-off ταχύτητας
  const { transcribe, isReady, isGenerating, error: sttError } = useSpeechToText({
    model: WHISPER_BASE,
  });

  const [hives, setHives]               = useState<Hive[]>([]);
  const [state, setState]               = useState<ListeningState>('idle');
  const [selectedHive, setSelectedHive] = useState<Hive | null>(null);
  const [isListening, setIsListening]   = useState(false);
  const [isLoading, setIsLoading]       = useState(true); // model loading
  const [loadProgress, setLoadProgress] = useState(0);
  const [lastHeard, setLastHeard]       = useState('');
  const [log, setLog]                   = useState<string[]>([]);
  const [isPaused, setIsPaused]         = useState(false);

  const activeRef    = useRef(true);  // για cleanup
  const pausedRef    = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const logRef       = useRef<ScrollView>(null);

  // ── HELPERS ───────────────────────────────────────────────────────────────────

  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('el-GR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    setLog(prev => [`[${time}] ${msg}`, ...prev].slice(0, 30));
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    Speech.stop();
    Speech.speak(text, { language: 'el-GR', rate: 0.95, onDone: () => onDone?.() });
  }, []);

  // ── MODEL LOADING STATUS ──────────────────────────────────────────────────────

  useEffect(() => {
    if (isReady) {
      setIsLoading(false);
      addLog('✅ Μοντέλο φωνής έτοιμο');
      speak('Έτοιμο. Πες την κυψέλη που θέλεις να επιθεωρήσεις.');
    }
  }, [isReady]);

  useEffect(() => {
    if (sttError) {
      addLog(`❌ Σφάλμα μοντέλου: ${sttError}`);
      setIsLoading(false);
    }
  }, [sttError]);

  // ── LOAD HIVES ────────────────────────────────────────────────────────────────

  const loadHives = useCallback(async () => {
    const apiary_id = route.params?.apiary_id;
    let query = supabase.from('hives').select('id, name, locked_by, locked_at');

    if (apiary_id) {
      const { data: ha } = await supabase
        .from('hive_apiaries')
        .select('hive_id')
        .eq('apiary_id', apiary_id)
        .is('departed_at', null);
      const ids = (ha ?? []).map((h: any) => h.hive_id);
      if (ids.length > 0) query = query.in('id', ids);
    }
    const { data } = await query.order('name');
    setHives(data ?? []);
  }, [route.params?.apiary_id]);

  // ── AUTO-UNLOCK on background ─────────────────────────────────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (selectedHive) await unlockHive(selectedHive.id);
        pausedRef.current = true;
        setIsPaused(true);
      }
      if (nextState === 'active') {
        pausedRef.current = false;
        setIsPaused(false);
      }
    });
    return () => sub.remove();
  }, [selectedHive, unlockHive]);

  // ── RECORD + TRANSCRIBE CHUNK ─────────────────────────────────────────────────
  // Ηχογραφεί 3 δευτ. → decode → executorch → parse wake word

  const recordAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (!isReady || pausedRef.current) return null;

    let uri: string | null = null;  // Declare outside try for scope

    try {
      // 1. Permissions
      console.log('[Listen] 1. Requesting permissions...');
      const { status } = await Audio.requestPermissionsAsync();
      console.log('[Listen] 2. Permission status:', status);
      if (status !== 'granted') {
        console.error('[Listen] Δεν δόθηκε άδεια μικροφώνου');
        return null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      // 2. Start recording με έγκυρο format
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recordingRef.current = recording;
      setIsListening(true);

      // 3. Περίμενε 3 δευτερόλεπτα
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. Early exit αν έκλεισε το screen ή μπήκε σε pause
      if (!activeRef.current || pausedRef.current) {
        await recording.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
        setIsListening(false);
        return null;
      }

      // 5. Σταμάτα εγγραφή
      console.log('[Listen] 5. Stopping recording...');
      await recording.stopAndUnloadAsync();
      console.log('[Listen] 5a. Recording stopped');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      console.log('[Listen] 5b. Audio mode reset');
      
      uri = recording.getURI();
      console.log('[Listen] 5c. Got URI:', uri);
      recordingRef.current = null;
      setIsListening(false);

      if (!uri || uri === '') {
        console.error('[Listen] ❌ URI is null/empty after stop. Recording likely failed.');
        return null;
      }

      // 6. Verify αρχείου πριν το decode
      console.log('[Listen] 6. Verifying file:', uri);
      const info = await FileSystem.getInfoAsync(uri);
      console.log('[Listen] 7. File info:', JSON.stringify(info));
      if (!info.exists || info.size === 0) {
        console.warn('[Listen] ❌ Κενό/ανύπαρκτο αρχείο');
        return null;
      }

      // 8. Read as base64 (fetch δεν δουλεύει αξιόπιστα σε RN με file:// URIs)
      console.log('[Listen] 8. Reading file as base64...');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('[Listen] 9. Base64 length:', base64.length);

      // 9. Base64 → ArrayBuffer
      console.log('[Listen] 10. Converting base64 to ArrayBuffer...');
      const binaryString = globalThis.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;
      console.log('[Listen] 11. ArrayBuffer bytes:', arrayBuffer.byteLength);

      // 10. Decode audio → Float32Array
      console.log('[Listen] 12. Decoding audio...');
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);
      const waveform = decodedAudio.getChannelData(0);
      console.log('[Listen] 13. Waveform samples:', waveform.length);

      console.log('[Listen] 14. Transcribing...');
      const result = await transcribe(waveform, {
        language: 'el' as SpeechToTextLanguage,
      });

      const text = typeof result === 'string' ? result : result?.text ?? '';
      console.log('[Listen] 15. Result:', text);
      if (text.trim()) console.log('🎙️ EXECUTORCH:', text);
      return text.trim() || null;

    } catch (e: any) {
      console.error('[Listen] ❌ recordAndTranscribe error:', {
        message: e?.message,
        code: e?.code,
        uri,
        error: String(e),
      });
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }
      setIsListening(false);
      return null;
    }
  }, [isReady, transcribe]);

  // ── COMMAND HANDLER ───────────────────────────────────────────────────────────

  const handleCommand = useCallback(async (cmd: WakeWordCommand, hivesList: Hive[], currentState: ListeningState, currentHive: Hive | null) => {
    setLastHeard(cmd.type === 'UNKNOWN' ? cmd.text : cmd.type);

    switch (cmd.type) {
      case 'SELECT_HIVE': {
        const hive = hivesList.find(h =>
          h.name === String(cmd.hiveNumber) ||
          h.name.includes(String(cmd.hiveNumber))
        );
        if (!hive) {
          speak(`Δεν βρέθηκε κυψέλη ${cmd.hiveNumber}.`);
          addLog(`❌ Κυψέλη ${cmd.hiveNumber} δεν βρέθηκε`);
          return { state: currentState, hive: currentHive };
        }
        addLog(`🐝 Επιλέχθηκε κυψέλη ${hive.name}`);
        const result = await lockHive(hive.id);
        if (!result.success) {
          speak(`Η κυψέλη ${hive.name} επιθεωρείται από ${result.lockedBy}. Επίλεξε άλλη.`);
          addLog(`🔒 Κλειδωμένη από ${result.lockedBy}`);
          return { state: currentState, hive: currentHive };
        }
        setState('hive_selected');
        setSelectedHive(hive);
        speak(`Κυψέλη ${hive.name}. Καθοδηγούμενη ή ελεύθερη επιθεώρηση;`);
        return { state: 'hive_selected' as ListeningState, hive };
      }

      case 'SELECT_MODE': {
        if (!currentHive || currentState !== 'hive_selected') {
          speak('Πες πρώτα την κυψέλη. Για παράδειγμα: Κυψέλη εκατό.');
          return { state: currentState, hive: currentHive };
        }
        setState('navigating');
        pausedRef.current = true;
        addLog(`📋 Mode: ${cmd.mode === 'guided' ? 'Καθοδηγούμενη' : 'Ελεύθερη'}`);
        navigation.navigate('Inspection', {
          hive_id:   currentHive.id,
          hive_name: currentHive.name,
          mode:      cmd.mode,
        });
        const unsubscribe = navigation.addListener('focus', async () => {
          await unlockHive(currentHive.id);
          setSelectedHive(null);
          setState('idle');
          loadHives();
          pausedRef.current = false;
          setIsPaused(false);
          unsubscribe();
        });
        return { state: 'navigating' as ListeningState, hive: currentHive };
      }

      case 'PAUSE': {
        pausedRef.current = true;
        setIsPaused(true);
        speak('Σε παύση. Πες "Συνέχεια" για να προχωρήσεις.');
        addLog('⏸️ Παύση');
        return { state: currentState, hive: currentHive };
      }

      case 'RESUME': {
        pausedRef.current = false;
        setIsPaused(false);
        speak('Συνεχίζω.');
        addLog('▶️ Συνέχεια');
        return { state: currentState, hive: currentHive };
      }

      case 'HELP': {
        speak('Πες: Κυψέλη και τον αριθμό. Μετά: Καθοδηγούμενη ή Ελεύθερη. Για παύση πες: Παύση.');
        addLog('ℹ️ Βοήθεια');
        return { state: currentState, hive: currentHive };
      }

      case 'UNKNOWN': {
        if (cmd.text.trim().length > 2) addLog(`👂 "${cmd.text}"`);
        return { state: currentState, hive: currentHive };
      }

      default:
        return { state: currentState, hive: currentHive };
    }
  }, [speak, addLog, lockHive, unlockHive, loadHives, navigation]);

  // ── CONTINUOUS LISTENING LOOP ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isReady) return;

    let currentState: ListeningState = 'idle';
    let currentHive: Hive | null = null;
    let currentHives: Hive[] = [];

    // Sync refs με state
    setState(s => { currentState = s; return s; });
    setSelectedHive(h => { currentHive = h; return h; });
    setHives(h => { currentHives = h; return h; });

    const loop = async () => {
      while (activeRef.current) {
        if (pausedRef.current || currentState === 'navigating') {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        const text = await recordAndTranscribe();
        if (text && activeRef.current) {
          const cmd = parseWakeWord(text);
          const result = await handleCommand(cmd, currentHives, currentState, currentHive);
          if (result) {
            currentState = result.state;
            currentHive  = result.hive;
          }
        }

        // Μικρή παύση μεταξύ chunks
        await new Promise(r => setTimeout(r, 200));
      }
    };

    loop().catch(console.error);

    return () => {
      activeRef.current = false;
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, [isReady, recordAndTranscribe, handleCommand]);

  // ── INIT ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    activeRef.current = true;
    loadHives();
    addLog('⏳ Φόρτωση μοντέλου Whisper...');
    addLog('📥 Πρώτη εκτέλεση: κατεβαίνει ~150MB');
    return () => { activeRef.current = false; };
  }, []);

  // ─── RENDER ───────────────────────────────────────────────────────────────────

  const statusColor = isPaused ? AMBER : isListening ? GREEN : isLoading ? HONEY : MUTED;
  const statusText  = isPaused ? 'ΣΕ ΠΑΥΣΗ' : isLoading ? 'ΦΟΡΤΩΣΗ...' : isListening ? 'ΑΚΟΥΩ...' : 'ΑΝΑΜΟΝΗ';

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🐝 {apiary_name}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Πίσω</Text>
        </TouchableOpacity>
      </View>

      {/* Status */}
      <View style={styles.statusCard}>
        {isLoading
          ? <ActivityIndicator color={HONEY} />
          : <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        }
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        {isListening && !isPaused && (
          <View style={styles.waveContainer}>
            {[1,2,3,4,5].map(i => (
              <View key={i} style={[styles.wave, { opacity: 0.4 + i * 0.12 }]} />
            ))}
          </View>
        )}
      </View>

      {/* Loading message */}
      {isLoading && (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>
            📥 Κατεβαίνει το μοντέλο Whisper (~150MB){'\n'}
            Μόνο την πρώτη φορά — μετά είναι offline!
          </Text>
        </View>
      )}

      {/* Selected hive */}
      {selectedHive && (
        <View style={styles.selectedCard}>
          <Text style={styles.selectedLabel}>Επιλεγμένη κυψέλη</Text>
          <Text style={styles.selectedHive}>🏠 {selectedHive.name}</Text>
          <Text style={styles.selectedHint}>Πες "Καθοδηγούμενη" ή "Ελεύθερη"</Text>
        </View>
      )}

      {/* Last heard */}
      {!!lastHeard && (
        <View style={styles.heardBox}>
          <Text style={styles.heardLabel}>Άκουσα:</Text>
          <Text style={styles.heardText}>"{lastHeard}"</Text>
        </View>
      )}

      {/* Instructions */}
      {!selectedHive && !isLoading && (
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Φωνητικές εντολές</Text>
          {[
            { cmd: '"Κυψέλη [αριθμός]"', desc: 'Επιλογή κυψέλης' },
            { cmd: '"Καθοδηγούμενη"',    desc: 'Guided επιθεώρηση' },
            { cmd: '"Ελεύθερη"',         desc: 'Free επιθεώρηση' },
            { cmd: '"Παύση"',            desc: 'Διακοπή ακρόασης' },
            { cmd: '"Συνέχεια"',         desc: 'Επανεκκίνηση' },
            { cmd: '"Βοήθεια"',          desc: 'Εντολές' },
          ].map((item, i) => (
            <View key={i} style={styles.cmdRow}>
              <Text style={styles.cmdText}>{item.cmd}</Text>
              <Text style={styles.cmdDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Log */}
      <View style={styles.logCard}>
        <Text style={styles.logTitle}>Καταγραφή δραστηριότητας</Text>
        <ScrollView ref={logRef} style={styles.logScroll} showsVerticalScrollIndicator={false}>
          {log.map((entry, i) => (
            <Text key={i} style={styles.logEntry}>{entry}</Text>
          ))}
          {log.length === 0 && <Text style={styles.logEmpty}>Αναμονή...</Text>}
        </ScrollView>
      </View>

      {/* Pause button */}
      {!isLoading && (
        <TouchableOpacity
          style={[styles.pauseBtn, isPaused && styles.pauseBtnActive]}
          onPress={() => {
            if (isPaused) {
              pausedRef.current = false;
              setIsPaused(false);
              speak('Συνεχίζω.');
            } else {
              pausedRef.current = true;
              setIsPaused(true);
            }
          }}
        >
          <Text style={styles.pauseBtnText}>
            {isPaused ? '▶️ Συνέχεια' : '⏸️ Παύση'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── THEME & STYLES ───────────────────────────────────────────────────────────

const HONEY = '#F5A623';
const BG    = '#0E1320';
const CARD  = '#182035';
const TEXT  = '#E8ECF4';
const MUTED = '#6B7280';
const GREEN = '#22C55E';
const AMBER = '#F59E0B';

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG, paddingTop: 52 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: HONEY },
  backBtn:      { padding: 8 },
  backBtnText:  { color: MUTED, fontSize: 14 },

  statusCard:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: CARD, marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 12, gap: 10 },
  statusDot:     { width: 12, height: 12, borderRadius: 6 },
  statusText:    { fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  waveContainer: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  wave:          { width: 3, height: 16, backgroundColor: GREEN, borderRadius: 2 },

  loadingCard:  { backgroundColor: CARD, marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
  loadingText:  { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 22 },

  selectedCard:  { backgroundColor: '#1A3A5C', marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: HONEY, alignItems: 'center' },
  selectedLabel: { fontSize: 11, color: HONEY, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  selectedHive:  { fontSize: 28, fontWeight: '800', color: TEXT, marginBottom: 6 },
  selectedHint:  { fontSize: 13, color: MUTED },

  heardBox:   { backgroundColor: '#0B1525', marginHorizontal: 16, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#1E3A5F', flexDirection: 'row', gap: 8, alignItems: 'center' },
  heardLabel: { fontSize: 12, color: MUTED },
  heardText:  { fontSize: 14, color: TEXT, fontStyle: 'italic', flex: 1 },

  instructionsCard:  { backgroundColor: CARD, marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 12 },
  instructionsTitle: { fontSize: 12, color: HONEY, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  cmdRow:            { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1E2A40' },
  cmdText:           { color: TEXT, fontSize: 13, fontWeight: '600' },
  cmdDesc:           { color: MUTED, fontSize: 13 },

  logCard:   { flex: 1, backgroundColor: CARD, marginHorizontal: 16, borderRadius: 16, padding: 14, marginBottom: 12 },
  logTitle:  { fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  logScroll: { flex: 1 },
  logEntry:  { color: TEXT, fontSize: 12, lineHeight: 20 },
  logEmpty:  { color: MUTED, fontSize: 12, fontStyle: 'italic' },

  pauseBtn:       { margin: 16, backgroundColor: CARD, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#2A3A5A' },
  pauseBtnActive: { backgroundColor: '#2A1800', borderColor: AMBER },
  pauseBtnText:   { color: TEXT, fontSize: 15, fontWeight: '700' },
});
