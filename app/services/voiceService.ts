// app/services/voiceService.ts — BeeManager v7.2
// Dual-mode voice service: Inspection (11 Q&A) + Harvest (1 question)
// STT: gpt-4o-mini-transcribe (whisper-1 ΕΧΕΙ ΑΝΤΙΚΑΤΑΣΤΑΘΕΙ ΟΡΙΣΤΙΚΑ)
//
// CHANGES vs v7.1:
// - FIX: αφαίρεση της λέξης "έτοιμος" από τα prompts (audio loopback / self-echo)
// - FIX: isReady() με word boundaries (πιο αυστηρό)
// - FIX: grace period 1500ms στο waitForReady() για να σβήσει το TTS echo
// - FIX: grace period 600ms σε όλα τα recordings μετά από TTS

import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
export const VOICE_CONFIG = {
  answerListenMs: 5_500,
  notesListenMs: 8_000,
  hiveListenMs: 4_000,
  pausePollingMs: 4_000,
  /** Αυξημένο για αποφυγή echo από TTS */
  postSpeakDelayMs: 1_200,
  /** Επιπλέον grace period στο waitForReady — μετά το prompt "Κυψέλη Χ" */
  pauseGracePeriodMs: 1_500,
  minFileSizeActive: 1_500,
  minFileSizePause: 2_500,
  minFileSizeHardFloor: 500,
  maxRetries: 2,
};

// ─── TYPES ──────────────────────────────────────────────────────────────────
export type SessionMode = 'inspection' | 'harvest';
export type SessionState =
  | 'idle' | 'waiting_hive' | 'paused_ready'
  | 'asking' | 'processing' | 'finished';

export interface InspectionResult {
  hive_id: string;
  hive_name: string;
  hive_number: number;
  population_frames: number | null;
  brood_frames: number | null;
  honey_frames: number | null;
  pollen_frames: number | null;
  queen_present: boolean | null;
  queen_status: string | null;
  queen_cells: number | null;
  has_swarmed: boolean;
  temperament: 'ήρεμο' | 'μέτριο' | 'επιθετικό' | null;
  feeding_raw: string | null;
  feeding_type: string | null;
  feeding_amount: number | null;
  notes: string | null;
  urgent: boolean;
  is_dead: boolean;
}

export interface HarvestResult {
  hive_id: string;
  hive_name: string;
  hive_number: number;
  frames_harvested: number;
}

export interface SessionCallbacks {
  onStateChange: (state: SessionState) => void;
  onQuestion: (question: string) => void;
  onAnswer: (answer: string) => void;
  onHiveStart: (hiveName: string, hiveNumber: number) => void;
  onHiveSaved: (hiveName: string, totalCount: number) => void;
  onError: (msg: string) => void;
  onFinished: (totalCount: number) => void;
  getHiveByNumber: (num: number) => { id: string; name: string } | null;
  saveInspection?: (result: InspectionResult) => Promise<void>;
  saveHarvest?: (result: HarvestResult) => Promise<void>;
}

// ─── GREEK NUMBER PARSING ───────────────────────────────────────────────────
const GREEK_NUMBERS: Record<string, number> = {
  'μηδέν': 0, 'μηδεν': 0, 'τίποτα': 0, 'τιποτα': 0,
  'ένα': 1, 'ενα': 1, 'μία': 1, 'μια': 1, 'έναν': 1, 'εναν': 1,
  'δύο': 2, 'δυο': 2,
  'τρία': 3, 'τρια': 3, 'τρεις': 3,
  'τέσσερα': 4, 'τεσσερα': 4, 'τέσσερις': 4, 'τεσσερις': 4,
  'πέντε': 5, 'πεντε': 5,
  'έξι': 6, 'εξι': 6,
  'επτά': 7, 'επτα': 7, 'εφτά': 7, 'εφτα': 7,
  'οκτώ': 8, 'οκτω': 8, 'οχτώ': 8, 'οχτω': 8,
  'εννέα': 9, 'εννεα': 9, 'εννιά': 9, 'εννια': 9,
  'δέκα': 10, 'δεκα': 10,
  'έντεκα': 11, 'εντεκα': 11,
  'δώδεκα': 12, 'δωδεκα': 12,
  'δεκατρία': 13, 'δεκατρια': 13,
  'δεκατέσσερα': 14, 'δεκατεσσερα': 14,
  'δεκαπέντε': 15, 'δεκαπεντε': 15,
  'δεκαέξι': 16, 'δεκαεξι': 16,
  'δεκαεπτά': 17, 'δεκαεπτα': 17,
  'δεκαοκτώ': 18, 'δεκαοκτω': 18,
  'δεκαεννέα': 19, 'δεκαεννεα': 19,
  'είκοσι': 20, 'εικοσι': 20,
};

export function parseNumber(text: string): number | null {
  const t = text.toLowerCase().trim();
  const digits = t.match(/\d+/);
  if (digits) return parseInt(digits[0], 10);
  for (const [word, num] of Object.entries(GREEK_NUMBERS)) {
    if (t.includes(word)) return num;
  }
  return null;
}

// ─── WAKE WORDS ─────────────────────────────────────────────────────────────
function stripAccents(s: string): string {
  return s.replace(/[άέήίόύώϊϋΐΰ]/g, (c: string) =>
    ({ ά:'α', έ:'ε', ή:'η', ί:'ι', ό:'ο', ύ:'υ', ώ:'ω',
       ϊ:'ι', ϋ:'υ', ΐ:'ι', ΰ:'υ' } as any)[c] || c);
}

// FIX v7.2: Πιο αυστηρό regex με word boundaries
// Πιάνει: ετοιμος, ετοιμη, ετοιμα, ετοιμασα, ξεκινα, ξεκινησα, παμε
export function isReady(text: string): boolean {
  const t = stripAccents(text.toLowerCase().trim());
  return /\bετοιμ\w{0,4}\b/.test(t) ||
         /\bξεκιν\w{0,4}\b/.test(t) ||
         /\bπαμε\b/.test(t);
}

export function isWait(text: string): boolean {
  const t = stripAccents(text.toLowerCase().trim());
  return /\bπεριμενε\b/.test(t) || /\bπαυση\b/.test(t);
}

export function isEnd(text: string): boolean {
  const t = stripAccents(text.toLowerCase().trim());
  return /\bτελος\b/.test(t) && !/οριστικ\w*\s*τελος/.test(t);
}

export function isFinalEnd(text: string): boolean {
  const t = stripAccents(text.toLowerCase().trim());
  return /οριστικ\w*\s*τελος/.test(t);
}

export function isYes(text: string): boolean {
  const t = stripAccents(text.toLowerCase().trim());
  return /\bναι\b/.test(t) || /\bμαλιστα\b/.test(t);
}

export function isNo(text: string): boolean {
  const t = stripAccents(text.toLowerCase().trim());
  return /\bοχι\b/.test(t);
}

// ─── FEEDING PARSER ─────────────────────────────────────────────────────────
export function parseFeedingResponse(text: string): {
  type: string | null;
  amount: number | null;
} {
  if (!text) return { type: null, amount: null };
  const t = stripAccents(text.toLowerCase().trim());

  if (/\b(τιποτα|καμια|δεν)\b/.test(t) && !/\d/.test(t)) {
    return { type: 'καμία', amount: null };
  }

  let type: string | null = null;
  if (t.includes('σιροπ'))           type = 'σιρόπι';
  else if (t.includes('βανιλ'))      type = 'βανίλια';
  else if (t.includes('ζυμωτ'))      type = 'ζυμωτή';
  else if (t.includes('γυρεοπ'))     type = 'γυρεόπιτα';
  else if (t.includes('ζαχαροζυμ'))  type = 'ζαχαροζύμαρο';
  else if (t.includes('σογι'))       type = 'σόγια';
  else if (t.includes('μελι'))       type = 'μέλι';

  let amount: number | null = null;
  if (t.includes('μισο')) amount = 0.5;
  else {
    const n = parseNumber(text);
    if (n !== null) amount = n;
  }

  return { type, amount };
}

// ─── RECORDING OPTIONS ──────────────────────────────────────────────────────
export const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16_000,
    numberOfChannels: 1,
    bitRate: 64_000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16_000,
    numberOfChannels: 1,
    bitRate: 64_000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64_000 },
};

// ─── HALLUCINATION FILTER ───────────────────────────────────────────────────
const HALLUCINATIONS = [
  'ευχαριστώ που παρακολουθήσατε', 'γειά σας', 'γεια σας',
  'thank you for watching', 'υπότιτλοι', 'thanks for watching',
  'σας ευχαριστώ', 'please subscribe',
];

function isHallucination(text: string): boolean {
  if (!text || text.trim().length < 2) return true;
  const t = text.toLowerCase().trim();
  return HALLUCINATIONS.some(h => t.includes(h));
}

// ─── TRANSCRIPTION (gpt-4o-mini-transcribe) ─────────────────────────────────
const TRANSCRIBE_PROMPT =
  'Φωνητική επιθεώρηση ή τρύγος μελισσιών στα ελληνικά. ' +
  'Ο μελισσοκόμος απαντά με αριθμούς (μηδέν έως είκοσι), ναι, όχι, ' +
  'ή τις λέξεις: έτοιμος, περίμενε, τέλος, οριστικό τέλος, ' +
  'σιρόπι, βανίλια, ζυμωτή, γυρεόπιτα, ζαχαροζύμαρο, σόγια, μέλι, ' +
  'πληθυσμός, γόνος, βασίλισσα, βασιλικά κελιά, σμηνουργία.';

export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_KEY δεν έχει οριστεί.');

  for (let attempt = 0; attempt <= VOICE_CONFIG.maxRetries; attempt++) {
    try {
      const fd = new FormData();
      fd.append('file', { uri: audioUri, type: 'audio/mp4', name: 'rec.m4a' } as any);
      fd.append('model', 'gpt-4o-mini-transcribe');
      fd.append('language', 'el');
      fd.append('prompt', TRANSCRIBE_PROMPT);

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: fd,
      });

      if (res.ok) {
        const data = await res.json();
        const text = (data.text ?? '').trim();
        console.log('[STT] Response:', text);
        if (isHallucination(text)) return '';
        return text;
      }

      if (res.status >= 500 && attempt < VOICE_CONFIG.maxRetries) {
        await delay(1500 * (attempt + 1));
        continue;
      }

      console.warn('[STT] Error:', res.status);
      return '';
    } catch (e: any) {
      if (attempt < VOICE_CONFIG.maxRetries) {
        await delay(1500);
        continue;
      }
      console.warn('[STT] Exception:', e.message);
      return '';
    }
  }
  return '';
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function enableRecording(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {}
}

async function enablePlayback(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {}
}

async function speak(text: string): Promise<void> {
  await enablePlayback();
  await new Promise<void>(resolve => {
    const done = (): void => { setTimeout(resolve, VOICE_CONFIG.postSpeakDelayMs); };
    Speech.stop();
    Speech.speak(text, {
      language: 'el-GR',
      rate: 0.92,
      onDone: done,
      onError: (_err: Error): void => { setTimeout(resolve, VOICE_CONFIG.postSpeakDelayMs); },
      onStopped: (): void => { setTimeout(resolve, 200); },
    });
  });
  await enableRecording();
  await delay(300);
}

async function recordAndTranscribe(
  durationMs: number,
  minFileSize: number,
): Promise<string> {
  let recording: Audio.Recording | null = null;
  let uri: string | null = null;

  try {
    recording = new Audio.Recording();
    await recording.prepareToRecordAsync(RECORDING_OPTIONS);
    await recording.startAsync();
    await delay(durationMs);
    await recording.stopAndUnloadAsync();
    uri = recording.getURI();
  } catch (e: any) {
    console.warn('[Record] Error:', e.message);
    if (recording) {
      try { await recording.stopAndUnloadAsync(); } catch {}
    }
    return '';
  }

  if (!uri) return '';

  let size = 0;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    size = info.exists && 'size' in info ? info.size : 0;
    console.log(`[Record] File size: ${size} bytes (threshold: ${minFileSize})`);

    if (!info.exists || size < VOICE_CONFIG.minFileSizeHardFloor) {
      console.log('[Record] File below hard floor, skipping STT');
      try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
      return '';
    }
  } catch {}

  if (size < minFileSize) {
    console.log(`[Record] Below soft threshold but sending anyway (${size}/${minFileSize})`);
  }

  try {
    return await transcribeAudio(uri);
  } finally {
    try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
  }
}

// ─── VOICE SESSION CLASS ────────────────────────────────────────────────────
export class VoiceSession {
  private state: SessionState = 'idle';
  private mode: SessionMode = 'inspection';
  private cb: SessionCallbacks | null = null;
  private isRunning = false;
  private shouldStop = false;
  private savedCount = 0;

  getState(): SessionState { return this.state; }

  private setState(s: SessionState): void {
    this.state = s;
    this.cb?.onStateChange(s);
  }

  async start(mode: SessionMode, callbacks: SessionCallbacks): Promise<void> {
    if (this.isRunning) return;

    this.mode = mode;
    this.cb = callbacks;
    this.isRunning = true;
    this.shouldStop = false;
    this.savedCount = 0;

    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      this.cb.onError('Δεν δόθηκε άδεια μικροφώνου.');
      this.isRunning = false;
      return;
    }

    await enableRecording();
    this.setState('waiting_hive');

    // FIX v7.2: αφαίρεση "πείτε" από το greeting (δεν χρειάζεται)
    const greeting = mode === 'harvest'
      ? 'Έναρξη τρύγου.'
      : 'Έναρξη επιθεώρησης.';
    await speak(greeting);

    this.runMainLoop();
  }

  reset(): void {
    this.shouldStop = true;
    this.isRunning = false;
    Speech.stop();
    this.setState('idle');
  }

  forceStop(): void { this.reset(); }

  private async runMainLoop(): Promise<void> {
    let emptyStreak = 0;

    while (this.isRunning && !this.shouldStop) {
      const text = await recordAndTranscribe(
        VOICE_CONFIG.hiveListenMs,
        VOICE_CONFIG.minFileSizeActive,
      );

      if (!text) {
        emptyStreak++;
        if (emptyStreak >= 6) {
          emptyStreak = 0;
          // FIX v7.2: σύντομο reminder χωρίς "έτοιμος"
          await speak('Αναμένω.');
        }
        continue;
      }

      emptyStreak = 0;
      this.cb?.onAnswer(text);
      console.log('[Voice] Main heard:', text);

      if (isFinalEnd(text)) {
        await this.finishSession();
        return;
      }

      const num = parseNumber(text);
      if (num !== null && num > 0) {
        const hive = this.cb?.getHiveByNumber(num);
        if (hive) {
          await this.runHiveFlow(hive.id, hive.name, num);
          if (this.shouldStop) return;
          this.setState('waiting_hive');
        } else {
          await speak(`Δεν βρέθηκε κυψέλη ${num}.`);
        }
      }
    }
  }

  private async runHiveFlow(
    hiveId: string, hiveName: string, hiveNumber: number,
  ): Promise<void> {
    this.cb?.onHiveStart(hiveName, hiveNumber);

    this.setState('paused_ready');
    // FIX v7.2: το prompt ΔΕΝ περιέχει "έτοιμος" — αποφυγή self-echo
    await speak(`Κυψέλη ${hiveNumber}.`);

    const ready = await this.waitForReady();
    if (!ready || this.shouldStop) return;

    this.setState('asking');
    if (this.mode === 'inspection') {
      await this.runInspectionQuestions(hiveId, hiveName, hiveNumber);
    } else {
      await this.runHarvestQuestion(hiveId, hiveName, hiveNumber);
    }
  }

  /**
   * FIX v7.2: Grace period 1500ms πριν αρχίσει η ακρόαση
   * — δίνει χρόνο στο TTS echo να σβήσει.
   */
  private async waitForReady(): Promise<boolean> {
    // Επιπλέον buffer πριν αρχίσουμε να ακούμε
    await delay(VOICE_CONFIG.pauseGracePeriodMs);

    while (this.isRunning && !this.shouldStop) {
      const text = await recordAndTranscribe(
        VOICE_CONFIG.pausePollingMs,
        VOICE_CONFIG.minFileSizePause,
      );

      if (!text) continue;
      console.log('[Voice] Pause heard:', text);

      this.cb?.onAnswer(`(ακούστηκε: "${text}")`);

      if (isFinalEnd(text)) {
        await this.finishSession();
        return false;
      }

      if (isReady(text)) {
        this.cb?.onAnswer('✓ Έτοιμος');
        return true;
      }
    }
    return false;
  }

  private async runInspectionQuestions(
    hiveId: string, hiveName: string, hiveNumber: number,
  ): Promise<void> {
    const result: InspectionResult = {
      hive_id: hiveId, hive_name: hiveName, hive_number: hiveNumber,
      population_frames: null, brood_frames: null,
      honey_frames: null, pollen_frames: null,
      queen_present: null, queen_status: null, queen_cells: null,
      has_swarmed: false, temperament: null,
      feeding_raw: null, feeding_type: null, feeding_amount: null,
      notes: null, urgent: false, is_dead: false,
    };

    const pop = await this.askNumber('Πληθυσμός;');
    if (this.shouldStop) return;
    if (pop === 0) {
      result.is_dead = true;
      result.population_frames = 0;
      result.urgent = true;
      result.notes = 'Νεκρό μελίσσι';
      await speak(`Κυψέλη ${hiveNumber} νεκρή.`);
      await this.saveInspectionResult(result);
      return;
    }
    result.population_frames = pop;

    result.brood_frames  = await this.askNumber('Γόνος;');
    if (this.shouldStop) return;
    result.honey_frames  = await this.askNumber('Μέλι;');
    if (this.shouldStop) return;
    result.pollen_frames = await this.askNumber('Γύρη;');
    if (this.shouldStop) return;

    const queenFound = await this.askYesNo('Βρέθηκε βασίλισσα;');
    if (this.shouldStop) return;
    result.queen_present = queenFound;

    let dayBrood: boolean | null = null;
    if (queenFound === false) {
      dayBrood = await this.askYesNo('Γόνος ημέρας;');
      if (this.shouldStop) return;
      if (dayBrood === true) {
        result.queen_status = 'Δεν εντοπίστηκε';
      } else if (dayBrood === false) {
        result.queen_status = 'Ορφανό';
        result.urgent = true;
      }
    } else if (queenFound === true) {
      result.queen_status = 'Παρούσα';
    }

    const skipCells = queenFound === false && dayBrood === true;
    if (!skipCells) {
      const hasCells = await this.askYesNo('Βασιλικά κελιά;');
      if (this.shouldStop) return;
      if (hasCells === true) {
        result.queen_cells = await this.askNumber('Πόσα;');
        if (this.shouldStop) return;
      } else {
        result.queen_cells = 0;
      }
    }

    const swarm = await this.askYesNo('Τάση σμηνουργίας;');
    if (this.shouldStop) return;
    result.has_swarmed = swarm === true;

    const calm = await this.askYesNo('Ήρεμο μελίσσι;');
    if (this.shouldStop) return;
    if (calm === true)       result.temperament = 'ήρεμο';
    else if (calm === false) result.temperament = 'επιθετικό';

    const feedText = await this.askOpen('Με τι τροφοδότησες και πόσο;');
    if (this.shouldStop) return;
    if (feedText) {
      result.feeding_raw = feedText;
      const parsed = parseFeedingResponse(feedText);
      result.feeding_type = parsed.type ?? feedText;
      result.feeding_amount = parsed.amount;
    }

    const notes = await this.askNotes('Σημειώσεις ή τέλος;');
    if (this.shouldStop) return;
    if (notes) {
      result.notes = result.notes ? `${result.notes}. ${notes}` : notes;
    }

    await this.saveInspectionResult(result);
  }

  private async runHarvestQuestion(
    hiveId: string, hiveName: string, hiveNumber: number,
  ): Promise<void> {
    const frames = await this.askNumber(
      `Πόσα πλαίσια μέλι πήρες;`
    );
    if (this.shouldStop) return;
    if (frames === null) {
      // FIX v7.2: ΔΕΝ αποθηκεύουμε αν δεν δόθηκε αριθμός
      await speak('Δεν κατάλαβα. Δεν αποθηκεύτηκε.');
      return;
    }

    const result: HarvestResult = {
      hive_id: hiveId, hive_name: hiveName, hive_number: hiveNumber,
      frames_harvested: frames,
    };

    this.setState('processing');
    try {
      await this.cb?.saveHarvest?.(result);
      this.savedCount++;
      this.cb?.onHiveSaved(hiveName, this.savedCount);
      // FIX v7.2: σύντομη επιβεβαίωση χωρίς "έτοιμος"
      await speak(
        `Καταχωρήθηκε τρύγος κυψέλης ${hiveNumber}: ${frames} πλαίσια.`
      );
    } catch (e: any) {
      this.cb?.onError(`Αποθήκευση: ${e.message}`);
    }
  }

  private async askNumber(question: string): Promise<number | null> {
    this.cb?.onQuestion(question);
    await speak(question);
    for (let attempt = 0; attempt < 3 && !this.shouldStop; attempt++) {
      const text = await recordAndTranscribe(
        VOICE_CONFIG.answerListenMs,
        VOICE_CONFIG.minFileSizeActive,
      );
      if (text) {
        this.cb?.onAnswer(text);
        if (isFinalEnd(text)) { await this.finishSession(); return null; }
        const n = parseNumber(text);
        if (n !== null) return n;
      }
      if (attempt < 2) await speak('Δεν κατάλαβα. Πες έναν αριθμό.');
    }
    return null;
  }

  private async askYesNo(question: string): Promise<boolean | null> {
    this.cb?.onQuestion(question);
    await speak(question);
    for (let attempt = 0; attempt < 3 && !this.shouldStop; attempt++) {
      const text = await recordAndTranscribe(
        VOICE_CONFIG.answerListenMs,
        VOICE_CONFIG.minFileSizeActive,
      );
      if (text) {
        this.cb?.onAnswer(text);
        if (isFinalEnd(text)) { await this.finishSession(); return null; }
        if (isYes(text)) return true;
        if (isNo(text))  return false;
      }
      if (attempt < 2) await speak('Πες ναι ή όχι.');
    }
    return null;
  }

  private async askOpen(question: string): Promise<string | null> {
    this.cb?.onQuestion(question);
    await speak(question);
    const text = await recordAndTranscribe(
      VOICE_CONFIG.answerListenMs,
      VOICE_CONFIG.minFileSizeActive,
    );
    if (text) {
      this.cb?.onAnswer(text);
      if (isFinalEnd(text)) { await this.finishSession(); return null; }
      return text;
    }
    return null;
  }

  private async askNotes(question: string): Promise<string | null> {
    this.cb?.onQuestion(question);
    await speak(question);

    let notes = '';
    let emptyCount = 0;

    while (!this.shouldStop) {
      const text = await recordAndTranscribe(
        VOICE_CONFIG.notesListenMs,
        VOICE_CONFIG.minFileSizeActive,
      );

      if (!text) {
        emptyCount++;
        if (emptyCount >= 2) break;
        continue;
      }
      emptyCount = 0;
      this.cb?.onAnswer(text);

      if (isFinalEnd(text)) { await this.finishSession(); return null; }

      if (isEnd(text)) {
        const cleaned = text.replace(/τέλος/gi, '').replace(/τελος/gi, '').trim();
        if (cleaned) notes += ' ' + cleaned;
        break;
      }

      notes += ' ' + text;
    }

    return notes.trim() || null;
  }

  private async saveInspectionResult(result: InspectionResult): Promise<void> {
    this.setState('processing');
    try {
      await this.cb?.saveInspection?.(result);
      this.savedCount++;
      this.cb?.onHiveSaved(result.hive_name, this.savedCount);
      // FIX v7.2: σύντομη επιβεβαίωση χωρίς "έτοιμος"
      await speak(`Κυψέλη ${result.hive_number} αποθηκεύτηκε.`);
    } catch (e: any) {
      this.cb?.onError(`Αποθήκευση κυψέλης ${result.hive_number}: ${e.message}`);
    }
  }

  private async finishSession(): Promise<void> {
    await speak(`Τέλος. ${this.savedCount} κυψέλες καταγράφηκαν.`);
    this.setState('finished');
    this.cb?.onFinished(this.savedCount);
    this.isRunning = false;
  }
}

export const voiceSession = new VoiceSession();
