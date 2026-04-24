// voiceService.ts — BeeManager v4.0
// Whisper API (OpenAI) για online transcription
// executorch/offline: pending (react-native-executorch — βλ. SESSION_03.md)
//
// ⚠️  SECURITY: Το EXPO_PUBLIC_OPENAI_KEY είναι ορατό στο client bundle.
//     Για production χρησιμοποίησε Supabase Edge Function ως proxy ώστε
//     το key να μείνει server-side.

import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type WakeWordCommand =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'REPEAT' }
  | { type: 'CORRECTION' }
  | { type: 'SAVE' }
  | { type: 'FINISH' }
  | { type: 'HELP' }
  | { type: 'SELECT_HIVE'; hiveNumber: number }
  | { type: 'SELECT_MODE'; mode: 'guided' | 'free' }
  | { type: 'DISABLE_NOTIFICATIONS' }
  | { type: 'UNKNOWN'; text: string };

// ─── RECORDING OPTIONS ────────────────────────────────────────────────────────
// Whisper API δέχεται: mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25MB)
//
// Android: HIGH_QUALITY preset → AAC/M4A — το Android MediaRecorder
//          δεν υποστηρίζει native PCM output, οπότε custom WAV options
//          παράγουν κατεστραμμένο αρχείο που σπάει το FFmpeg του Whisper.
// iOS:     WAV/16kHz/mono PCM — ιδανικό για Whisper και μελλοντικό executorch.

const RECORDING_OPTIONS: Audio.RecordingOptions =
  Platform.OS === 'android'
    ? Audio.RecordingOptionsPresets.HIGH_QUALITY
    : {
        android: Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
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
        isMeteringEnabled: true,
        web: {},
      };

// Το MIME type που στέλνουμε στο Whisper API ανάλογα platform
const AUDIO_MIME_TYPE = Platform.OS === 'android' ? 'audio/m4a' : 'audio/wav';
const AUDIO_FILENAME  = Platform.OS === 'android' ? 'recording.m4a' : 'recording.wav';

// ─── VOCABULARY CORRECTIONS ───────────────────────────────────────────────────

const BEEKEEPING_CORRECTIONS: Record<string, string> = {
  'βαρόα':        'βαρρόα',
  'αρενοτόκο':    'αρρενοτόκο',
  'ασκοσφέρωση':  'ασκοσφαίρωση',
  'νοζεμίαση':    'νοζεμίαση',
  'σηψιγονία':    'σηψιγονία',
  'γονοφωλιά':    'γονοφωλιά',
  'βασιλοτροφία': 'βασιλοτροφία',
  'παραφυάδα':    'παραφυάδα',
};

function correctBeekeepingTerms(text: string): string {
  return Object.entries(BEEKEEPING_CORRECTIONS).reduce(
    (acc, [wrong, right]) => acc.replace(new RegExp(wrong, 'gi'), right),
    text,
  );
}

// ─── WHISPER TRANSCRIPTION ────────────────────────────────────────────────────

export async function transcribeWithWhisper(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_KEY δεν έχει οριστεί.');

  // Έλεγχος αρχείου πριν το στείλουμε — αποφεύγει FFmpeg decode error στο Whisper
  const info = await FileSystem.getInfoAsync(audioUri);
  console.log('[Voice] File info before upload:', JSON.stringify(info));
  if (!info.exists) throw new Error('Το αρχείο ήχου δεν υπάρχει: ' + audioUri);
  if (info.size === 0) throw new Error('Το αρχείο ήχου είναι κενό.');

  // React Native FormData: το object literal με uri/type/name είναι ο μόνος
  // τρόπος να στείλεις αρχείο — δεν υποστηρίζεται το Blob API σε RN.
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: AUDIO_MIME_TYPE,
    name: AUDIO_FILENAME,
  } as unknown as Blob);
  formData.append('model', 'whisper-1');
  formData.append('language', 'el');
  // Prompt: βοηθά το Whisper να αναγνωρίσει μελισσοκομικούς όρους
  formData.append(
    'prompt',
    'βαρρόα, αρρενοτόκο, ασκοσφαίρωση, νοζεμίαση, βασιλοτροφία, παραφυάδα, γονοφωλιά',
  );

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const result = correctBeekeepingTerms(data.text ?? '');
  console.log('[Voice] 📝 WHISPER:', result);
  return result;
}

// ─── LOW-LEVEL RECORDING ──────────────────────────────────────────────────────

export async function startRecording(): Promise<Audio.Recording> {
  // 1. Permissions — verbose για debugging
  const { status } = await Audio.requestPermissionsAsync();
  console.log('[Voice] Permission status:', status);
  if (status !== 'granted') {
    throw new Error('Δεν δόθηκε άδεια μικροφώνου.');
  }

  // 2. Audio mode
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  // 3. Εκκίνηση εγγραφής
  console.log('[Voice] Starting recording, platform:', Platform.OS);
  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
  console.log('[Voice] Recording started OK');
  return recording;
}

// Σταματά, ελέγχει το αρχείο και επιστρέφει το URI
// Επιστρέφει null αν είχε ήδη γίνει unload — δεν κρασάρει
export async function stopRecording(
  recording: Audio.Recording,
): Promise<string | null> {
  try {
    const status = await recording.getStatusAsync();
    // RecordingStatus δεν έχει isLoaded — χρησιμοποιούμε isDoneRecording
    // για να αποφύγουμε το "Cannot unload a Recording that has already been unloaded"
    if (status.isDoneRecording) {
      console.log('[Voice] Recording was already done, returning URI directly');
      return recording.getURI() ?? null;
    }

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    console.log('[Voice] Recording stopped, URI:', uri);
    return uri ?? null;

  } catch (error: any) {
    // Guard για edge case: η εγγραφή unloaded ενώ τρέχαμε
    if (
      typeof error?.message === 'string' &&
      error.message.includes('already been unloaded')
    ) {
      console.warn('[Voice] stopRecording: already unloaded — skipping.');
      return null;
    }
    throw error;
  } finally {
    // Επαναφέρουμε πάντα το audio mode
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  }
}

// ─── STATEFUL VOICE SERVICE ───────────────────────────────────────────────────
// Singleton wrapper — χρησιμοποιείται από InspectionScreen / ListeningScreen

let _activeRecording: Audio.Recording | null = null;
let _isUnloading = false; // lock για να αποφύγουμε race conditions

export const voiceService = {
  // Ξεκινά νέα ηχογράφηση. Αν υπάρχει ήδη, την ακυρώνει πρώτα.
  async startRecording(): Promise<void> {
    if (_isUnloading) {
      // Περίμενε να τελειώσει το προηγούμενο unload
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (!_isUnloading) { clearInterval(check); resolve(); }
        }, 50);
      });
    }

    if (_activeRecording) {
      await this.cancelRecording();
    }

    _activeRecording = await startRecording();
  },

  // Σταματά, μεταγράφει και επιστρέφει το κείμενο
  async stopAndTranscribe(): Promise<string> {
    if (!_activeRecording) throw new Error('Δεν υπάρχει ενεργή ηχογράφηση.');

    _isUnloading = true;
    const recording = _activeRecording;
    _activeRecording = null;

    try {
      const uri = await stopRecording(recording);
      if (!uri) throw new Error('Δεν παράχθηκε αρχείο ήχου.');
      return await transcribeWithWhisper(uri);
    } finally {
      _isUnloading = false;
    }
  },

  // Ακυρώνει χωρίς transcription
  async cancelRecording(): Promise<void> {
    if (!_activeRecording) return;

    _isUnloading = true;
    const recording = _activeRecording;
    _activeRecording = null;

    try {
      await stopRecording(recording);
    } catch (e) {
      console.warn('[Voice] cancelRecording error (ignored):', e);
    } finally {
      _isUnloading = false;
    }
  },

  isRecording(): boolean {
    return _activeRecording !== null;
  },
};

// ─── WAKE WORD PARSER ─────────────────────────────────────────────────────────

export function parseWakeWord(text: string): WakeWordCommand {
  const t = text.toLowerCase().trim();

  // Αριθμός: "κυψέλη 5"
  const hiveDigit = t.match(/κυψέλη\s+(\d+)/);
  if (hiveDigit) return { type: 'SELECT_HIVE', hiveNumber: parseInt(hiveDigit[1], 10) };

  // Αριθμός ως λέξη: "κυψέλη πέντε"
  const hiveWord = t.match(/κυψέλη\s+(.+)/);
  if (hiveWord) {
    const n = wordToNumber(hiveWord[1].trim());
    if (n > 0) return { type: 'SELECT_HIVE', hiveNumber: n };
  }

  if (t.includes('καθοδηγούμενη'))                          return { type: 'SELECT_MODE', mode: 'guided' };
  if (t.includes('ελεύθερη'))                               return { type: 'SELECT_MODE', mode: 'free' };
  if (t.includes('πάμε') || t.includes('ξεκίνα'))           return { type: 'START_RECORDING' };
  if (t.includes('τέλος') || t.includes('σταμάτα εγγραφή')) return { type: 'STOP_RECORDING' };
  if (t.includes('παύση') || t.includes('σταμάτα'))         return { type: 'PAUSE' };
  if (t.includes('συνέχεια') || t.includes('συνέχισε'))     return { type: 'RESUME' };
  if (t.includes('επανάλαβε') || t.includes('επανάληψη'))   return { type: 'REPEAT' };
  if (t.includes('διόρθωση') || t.includes('λάθος'))        return { type: 'CORRECTION' };
  if (t.includes('αποθήκευση') || t.includes('σώσε'))       return { type: 'SAVE' };
  if (t.includes('ολοκλήρωση') || t.includes('τελείωσε'))   return { type: 'FINISH' };
  if (t.includes('βοήθεια'))                                return { type: 'HELP' };
  if (t.includes('απενεργοποίησε ειδοποιήσεις'))            return { type: 'DISABLE_NOTIFICATIONS' };

  return { type: 'UNKNOWN', text };
}

function wordToNumber(word: string): number {
  const MAP: Record<string, number> = {
    'ένα': 1,        'δύο': 2,          'τρία': 3,         'τέσσερα': 4,
    'πέντε': 5,      'έξι': 6,          'επτά': 7,         'οκτώ': 8,
    'εννέα': 9,      'δέκα': 10,        'έντεκα': 11,      'δώδεκα': 12,
    'δεκατρία': 13,  'δεκατέσσερα': 14, 'δεκαπέντε': 15,   'δεκαέξι': 16,
    'δεκαεπτά': 17,  'δεκαοκτώ': 18,   'δεκαεννέα': 19,   'είκοσι': 20,
    'τριάντα': 30,   'σαράντα': 40,     'πενήντα': 50,     'εξήντα': 60,
    'εβδομήντα': 70, 'ογδόντα': 80,     'ενενήντα': 90,    'εκατό': 100,
    'διακόσια': 200, 'τριακόσια': 300,  'τετρακόσια': 400, 'πεντακόσια': 500,
  };
  if (MAP[word]) return MAP[word];
  return word.split(/\s+/).reduce((sum, w) => sum + (MAP[w] ?? 0), 0);
}

// ─── CONTINUOUS LISTENER STUB ─────────────────────────────────────────────────
// Placeholder — θα αντικατασταθεί με react-native-executorch offline STT

export const continuousListener = {
  async start(_options: unknown): Promise<void> {
    console.log('[Voice] continuousListener: stub mode (executorch pending)');
  },
  async stop(): Promise<void> {},
  pause(): void {},
  resume(): void {},
};