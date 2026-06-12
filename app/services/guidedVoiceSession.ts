// guidedVoiceSession.ts — BeeManager v5.0
// Άμεση έναρξη → ερωτήσεις → αδράνεια μετά από κάθε κυψέλη → "έτοιμος" για επόμενη
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';

// ─── GREEK NUMBERS ──────────────────────────────────────────────────────────
const GREEK_NUMBERS: Record<string, number> = {
  'μηδέν': 0, 'μηδεν': 0, 'τίποτα': 0, 'τιποτα': 0, 'μηδέ': 0,
  'ένα': 1, 'ενα': 1, 'μία': 1, 'μια': 1,
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

export function normalizeGreek(text: string): string {
  return text
    .toLowerCase()
    .replace(/[άέήίόύώϊϋΐΰ]/g, (c: string) =>
      ({ά:'α',έ:'ε',ή:'η',ί:'ι',ό:'ο',ύ:'υ',ώ:'ω',ϊ:'ι',ϋ:'υ',ΐ:'ι',ΰ:'υ'} as any)[c] || c)
    .replace(/[.,!?;:'"]/g, '')
    .trim();
}

function parseNumber(text: string): number | null {
  const t = text.toLowerCase().trim();
  const digits = t.match(/\d+/);
  if (digits) return parseInt(digits[0], 10);
  for (const [word, num] of Object.entries(GREEK_NUMBERS)) {
    if (t.includes(word)) return num;
  }
  return null;
}

function isYes(text: string): boolean {
  const t = normalizeGreek(text);
  return t.includes('ναι') || t === 'ν' ||
         t.includes('εννεα') || t.includes('εννια') ||
         t.includes('μαλιστα');
}

function isNo(text: string): boolean {
  const t = normalizeGreek(text);
  return t.includes('οχι');
}

function isSkip(text: string): boolean {
  const t = normalizeGreek(text);
  return t.includes('παραλειψ') || t.includes('skip');
}

export function isWakeWord(text: string): boolean {
  const t = normalizeGreek(text);
  return t.includes('ετοιμ');
}

export function isStopWord(text: string): boolean {
  const t = normalizeGreek(text);
  return t.includes('stop') || t.includes('στοπ') || t.includes('παυση');
}

export function isFinalEnd(text: string): boolean {
  const t = normalizeGreek(text).replace(/\s+/g, ' ');
  return t.includes('οριστικο τελος') || t.includes('οριστικοτελος');
}

// ─── RECORDING OPTIONS ──────────────────────────────────────────────────────
const RECORDING_OPTIONS: Audio.RecordingOptions = {
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

const STT_MODEL = 'gpt-4o-mini-transcribe';
const STT_PROMPT =
  'Ελληνικά μελισσοκομικά: έτοιμος, στοπ, ναι, όχι, μηδέν, παράλειψη, ' +
  'ένα, δύο, τρία, τέσσερα, πέντε, έξι, επτά, οκτώ, εννέα, δέκα, ' +
  'τέλος, οριστικό τέλος, κυψέλη, πλαίσια';

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── TYPES ──────────────────────────────────────────────────────────────────
export interface GuidedInspectionResult {
  hive_id:           string;
  hive_name:         string;
  population_frames: number | null;
  brood_frames:      number | null;
  honey_frames:      number | null;
  queen_present:     boolean | null;
  queen_status:      string | null;
  queen_cells:       number | null;
  temperament:       string | null;
  has_swarmed:       boolean;
  feeding_type:      string | null;
  feeding_label:     string | null;
  notes:             string | null;
  urgent:            boolean;
  is_dead:           boolean;
}

export interface GuidedSessionCallbacks {
  onQuestion:      (question: string) => void;
  onAnswer:        (answer: string) => void;
  onListening:     () => void;
  onHiveStart:     (hiveName: string) => void;
  onHiveSaved:     (hiveName: string, count: number) => void;
  onHiveDead:      (hiveName: string) => void;
  onError:         (msg: string) => void;
  onFinished:      (count: number) => void;
  onStateChange:   (state: string) => void;
  saveInspection:  (result: GuidedInspectionResult) => Promise<void>;
  getHiveByNumber: (num: number) => { id: string; name: string } | null;
}

type AskResult =
  | { kind: 'ok'; text: string }
  | { kind: 'failed' }   // 3 αποτυχίες
  | { kind: 'paused' };  // είπε "στοπ"

// ─── GUIDED SESSION ─────────────────────────────────────────────────────────
export class GuidedVoiceSession {
  private running  = false;
  private stop     = false;
  private apiKey   = '';
  private cb: GuidedSessionCallbacks | null = null;
  private savedCount = 0;
  private activeRecording: Audio.Recording | null = null;

  private async setPlayback(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, playsInSilentModeIOS: true,
        shouldDuckAndroid: true, playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch {}
  }

  private async setRecording(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, playsInSilentModeIOS: true,
        shouldDuckAndroid: true, playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch {}
  }

  private async speak(text: string): Promise<void> {
    if (this.stop) return;
    await this.setPlayback();
    await new Promise<void>(resolve => {
      const done = (): void => { setTimeout(resolve, 200); };
      Speech.stop();
      Speech.speak(text, {
        language: 'el-GR', rate: 0.95,
        onDone: () => done(), onError: () => done(),
        onStopped: () => { setTimeout(resolve, 100); },
      });
    });
    await this.setRecording();
    await delay(150);
  }

  private async record(durationMs: number, minBytes = 1000): Promise<string> {
    if (this.stop) return '';
    this.cb?.onListening();
    let uri: string | null = null;
    try {
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(RECORDING_OPTIONS);
      this.activeRecording = rec;
      await rec.startAsync();
      await delay(durationMs);
      if (this.stop) {
        await rec.stopAndUnloadAsync().catch(() => {});
        this.activeRecording = null;
        return '';
      }
      await rec.stopAndUnloadAsync();
      this.activeRecording = null;
      uri = rec.getURI() ?? null;
    } catch {
      this.activeRecording = null;
      return '';
    }
    if (!uri) return '';
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || ('size' in info && info.size < minBytes)) return '';
    } catch {}
    try {
      const fd = new FormData();
      fd.append('file', { uri, type: 'audio/mp4', name: 'rec.m4a' } as any);
      fd.append('model', STT_MODEL);
      fd.append('language', 'el');
      fd.append('prompt', STT_PROMPT);
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: fd,
      });
      if (!res.ok) {
        if (res.status >= 500) {
          await delay(1200);
          const res2 = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}` }, body: fd,
          });
          if (res2.ok) { const d2 = await res2.json(); return (d2.text ?? '').trim(); }
        }
        return '';
      }
      const data = await res.json();
      return (data.text ?? '').trim();
    } catch { return ''; }
    finally { try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {} }
  }

  // ── Ερώτηση με 3 προσπάθειες ────────────────────────────
  private async ask(question: string, durationMs = 3500): Promise<AskResult> {
    this.cb?.onQuestion(question);
    await this.speak(question);
    for (let attempt = 1; attempt <= 3 && !this.stop; attempt++) {
      const text = await this.record(durationMs);
      if (text) {
        if (isStopWord(text)) return { kind: 'paused' };
        this.cb?.onAnswer(text);
        return { kind: 'ok', text };
      }
      if (attempt < 3) await this.speak('Επανέλαβε, δεν κατάλαβα.');
    }
    return { kind: 'failed' };
  }

  private async askNumber(question: string, fieldLabel: string): Promise<number | null | 'PAUSED'> {
    const res = await this.ask(question, 3500);
    if (res.kind === 'paused') return 'PAUSED';
    if (res.kind === 'failed') {
      await this.speak(`${fieldLabel} δεν αποθηκεύτηκε.`);
      return null;
    }
    let n = parseNumber(res.text);
    if (n === null) {
      // Άκουσε κάτι αλλά όχι αριθμό — 2 ακόμα προσπάθειες
      for (let i = 0; i < 2 && n === null && !this.stop; i++) {
        await this.speak('Επανέλαβε, δεν κατάλαβα.');
        const t2 = await this.record(3500);
        if (t2) {
          if (isStopWord(t2)) return 'PAUSED';
          this.cb?.onAnswer(t2);
          n = parseNumber(t2);
        }
      }
      if (n === null) await this.speak(`${fieldLabel} δεν αποθηκεύτηκε.`);
    }
    return n;
  }

  private async askYesNo(question: string, fieldLabel: string): Promise<boolean | null | 'PAUSED'> {
    const res = await this.ask(question, 3000);
    if (res.kind === 'paused') return 'PAUSED';
    if (res.kind === 'failed') {
      await this.speak(`${fieldLabel} δεν αποθηκεύτηκε.`);
      return null;
    }
    if (isYes(res.text)) return true;
    if (isNo(res.text))  return false;
    // Άκουσε κάτι ασαφές — 2 ακόμα προσπάθειες
    for (let i = 0; i < 2 && !this.stop; i++) {
      await this.speak('Επανέλαβε, ναι ή όχι.');
      const t2 = await this.record(3000);
      if (t2) {
        if (isStopWord(t2)) return 'PAUSED';
        this.cb?.onAnswer(t2);
        if (isYes(t2)) return true;
        if (isNo(t2))  return false;
      }
    }
    await this.speak(`${fieldLabel} δεν αποθηκεύτηκε.`);
    return null;
  }

  // ── START — αμέσως ενεργό ───────────────────────────────
  async start(cb: GuidedSessionCallbacks): Promise<void> {
    if (this.running) return;
    const key = process.env.EXPO_PUBLIC_OPENAI_KEY ?? '';
    if (!key) { cb.onError('EXPO_PUBLIC_OPENAI_KEY λείπει'); return; }
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { cb.onError('Δεν δόθηκε άδεια μικροφώνου'); return; }
    this.running = true; this.stop = false;
    this.apiKey = key; this.cb = cb; this.savedCount = 0;
    await this.setRecording();
    this.activeLoop(true);
  }

  // ── PAUSED — ακούει μόνο "έτοιμος"/"οριστικό τέλος" ─────
  private async pausedLoop(): Promise<void> {
    this.cb?.onStateChange('paused');
    while (!this.stop) {
      const text = await this.record(2_500, 800);
      if (!text) continue;

      if (isFinalEnd(text)) { await this.finishSession(); return; }

      if (isWakeWord(text)) {
        this.cb?.onAnswer(text);
        this.activeLoop(true);
        return;
      }
    }
  }

  // ── ACTIVE — ζητάει αριθμό κυψέλης ─────────────────────
  private async activeLoop(announceFirst: boolean): Promise<void> {
    this.cb?.onStateChange('waiting_hive');
    if (announceFirst) await this.speak('Πείτε αριθμό κυψέλης.');

    let emptyCount = 0;
    while (!this.stop) {
      const text = await this.record(3_500);
      if (!text) {
        emptyCount++;
        if (emptyCount >= 3) {
          // Δεν ακούει κανέναν → αδράνεια
          await this.speak('Αδράνεια. Πείτε έτοιμος για συνέχεια.');
          this.pausedLoop();
          return;
        }
        continue;
      }
      emptyCount = 0;

      if (isStopWord(text)) {
        await this.speak('Αδράνεια. Πείτε έτοιμος για συνέχεια.');
        this.pausedLoop();
        return;
      }

      if (isFinalEnd(text)) { await this.finishSession(); return; }

      this.cb?.onAnswer(text);

      const num = parseNumber(text);
      if (num !== null && num > 0) {
        const hive = this.cb?.getHiveByNumber(num);
        if (hive) {
          this.cb?.onHiveStart(hive.name);
          this.cb?.onStateChange('recording');
          const paused = await this.runInspection(hive.id, hive.name, num);
          if (this.stop) return;
          if (paused) {
            await this.speak('Αδράνεια. Πείτε έτοιμος για συνέχεια.');
          } else {
            // Μετά από κάθε κυψέλη → αδράνεια
            await this.speak('Αδράνεια. Πείτε έτοιμος για επόμενη κυψέλη ή οριστικό τέλος.');
          }
          this.pausedLoop();
          return;
        } else {
          await this.speak(`Δεν βρήκα κυψέλη ${num}. Ξαναπείτε.`);
        }
      }
    }
  }

  private async finishSession(): Promise<void> {
    await this.speak(`Τέλος. ${this.savedCount} κυψέλες καταγράφηκαν.`);
    this.cb?.onStateChange('finished');
    this.cb?.onFinished(this.savedCount);
    this.running = false;
  }

  // ── INSPECTION FLOW ─────────────────────────────────────
  private async runInspection(hiveId: string, hiveName: string, hiveNum: number): Promise<boolean> {
    const result: GuidedInspectionResult = {
      hive_id: hiveId, hive_name: hiveName,
      population_frames: null, brood_frames: null, honey_frames: null,
      queen_present: null, queen_status: null, queen_cells: null,
      temperament: null, has_swarmed: false,
      feeding_type: 'καμία', feeding_label: null,
      notes: null, urgent: false, is_dead: false,
    };

    let pauseRequested = false;

    // 1. Πληθυσμός
    const pop = await this.askNumber(`Κυψέλη ${hiveNum}. Πόσα πλαίσια πληθυσμός;`, 'Ο πληθυσμός');
    if (pop === 'PAUSED') { await this.saveResult(result, hiveNum, hiveName); return true; }
    if (pop === 0) {
      result.is_dead = true; result.population_frames = 0;
      result.urgent = true; result.notes = 'Νεκρό μελίσσι';
      await this.speak(`Κυψέλη ${hiveNum} νεκρή.`);
      this.cb?.onHiveDead(hiveName);
      try { await this.cb?.saveInspection(result); } catch {}
      return false;
    }
    result.population_frames = pop;

    // 2. Γόνος
    const brood = await this.askNumber('Πόσα πλαίσια γόνος;', 'Ο γόνος');
    if (brood === 'PAUSED') { await this.saveResult(result, hiveNum, hiveName); return true; }
    result.brood_frames = brood;

    // 3. Μέλι
    const honey = await this.askNumber('Πόσα πλαίσια μέλι;', 'Το μέλι');
    if (honey === 'PAUSED') { await this.saveResult(result, hiveNum, hiveName); return true; }
    result.honey_frames = honey;

    // 4. Βασίλισσα
    const queenPresent = await this.askYesNo('Βασίλισσα παρούσα;', 'Η βασίλισσα');
    if (queenPresent === 'PAUSED') { await this.saveResult(result, hiveNum, hiveName); return true; }
    result.queen_present = queenPresent;
    if (queenPresent === false) {
      const dayBrood = await this.askYesNo('Είδες γόνο ημέρας;', 'Ο γόνος ημέρας');
      if (dayBrood === 'PAUSED') { await this.saveResult(result, hiveNum, hiveName); return true; }
      if (dayBrood === true) {
        result.queen_status = 'Δεν εντοπίστηκε';
      } else if (dayBrood === false) {
        result.queen_status = 'Ορφανό';
        result.urgent = true;
        result.notes = 'Ορφανό μελίσσι';
      }
    }

    // 5. Βασιλικά κελιά
    const hasCells = await this.askYesNo('Βασιλικά κελιά;', 'Τα κελιά');
    if (hasCells === 'PAUSED') { await this.saveResult(result, hiveNum, hiveName); return true; }
    if (hasCells === true) {
      const cells = await this.askNumber('Πόσα;', 'Τα κελιά');
      if (cells === 'PAUSED') { await this.saveResult(result, hiveNum, hiveName); return true; }
      result.queen_cells = cells;
    } else if (hasCells === false) {
      result.queen_cells = 0;
    }

    // 6. Ιδιοσυγκρασία
    const calm = await this.askYesNo('Ήρεμο μελίσσι;', 'Η ιδιοσυγκρασία');
    if (calm === 'PAUSED') { await this.saveResult(result, hiveNum, hiveName); return true; }
    if (calm === true)       result.temperament = 'ήρεμο';
    else if (calm === false) result.temperament = 'επιθετικό';

    // 7. Σμηνουργία
    const swarm = await this.askYesNo('Τάση σμηνουργίας;', 'Η σμηνουργία');
    if (swarm === 'PAUSED') { await this.saveResult(result, hiveNum, hiveName); return true; }
    result.has_swarmed = swarm === true;

    // 8. Σημειώσεις
    this.cb?.onQuestion('Σημειώσεις;');
    await this.speak('Σημειώσεις; Παράλειψη ή μιλήστε και πείτε τέλος.');
    let notesText = '';
    let done = false;
    let empty = 0;
    while (!done && !this.stop) {
      const chunk = await this.record(5000);
      if (!chunk) { empty++; if (empty >= 2) done = true; continue; }
      if (isStopWord(chunk)) { pauseRequested = true; done = true; continue; }
      this.cb?.onAnswer(chunk);
      if (isSkip(chunk)) {
        done = true;
      } else if (normalizeGreek(chunk).includes('τελος')) {
        const before = normalizeGreek(chunk).replace(/τελος/g, '').trim();
        if (before) notesText += ' ' + before;
        done = true;
      } else {
        notesText += ' ' + chunk;
      }
    }
    if (notesText.trim()) {
      result.notes = (result.notes ? result.notes + '. ' : '') + notesText.trim();
    }

    await this.saveResult(result, hiveNum, hiveName);
    return pauseRequested;
  }

  private async saveResult(result: GuidedInspectionResult, hiveNum: number, hiveName: string): Promise<void> {
    this.cb?.onStateChange('processing');
    try {
      await this.cb?.saveInspection(result);
      this.savedCount++;
      this.cb?.onHiveSaved(hiveName, this.savedCount);
      await this.speak(`Κυψέλη ${hiveNum} αποθηκεύτηκε.`);
    } catch (e: any) {
      this.cb?.onError(`Σφάλμα: ${e.message}`);
      await this.speak('Σφάλμα αποθήκευσης.');
    }
  }

  reset(): void {
    this.stop = true; this.running = false;
    Speech.stop();
    if (this.activeRecording) {
      this.activeRecording.stopAndUnloadAsync().catch(() => {});
      this.activeRecording = null;
    }
    this.cb?.onStateChange('idle');
  }

  forceStop(): void { this.reset(); }
}

export const guidedVoiceSession = new GuidedVoiceSession();