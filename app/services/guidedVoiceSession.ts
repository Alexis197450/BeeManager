// app/services/guidedVoiceSession.ts — BeeManager v6.2
// = v5.3 με δύο αλλαγές μόνο:
//   1. Direct save (saveInspection callback) αντί για preview
//   2. Διορθωμένο pause flow ώστε multi-hive να ξανα-καλεί σωστά waitForHive

import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';

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

const SORTED_NUMBER_ENTRIES = Object.entries(GREEK_NUMBERS)
  .sort((a, b) => b[0].length - a[0].length);

function parseNumber(text: string): number | null {
  const t = normalizeGreek(text);
  const digits = t.match(/\d+/);
  if (digits) return parseInt(digits[0], 10);
  for (const [word, num] of SORTED_NUMBER_ENTRIES) {
    if (t.includes(normalizeGreek(word))) return num;
  }
  return null;
}

function isYes(text: string): boolean {
  const t = normalizeGreek(text);
  return t.includes('ναι') || t === 'ν' ||
         t.includes('μαλιστα') || t.includes('βεβαια') || t.includes('σωστα');
}

function isNo(text: string): boolean {
  const t = normalizeGreek(text);
  return t.includes('οχι') || t.includes('τιποτα');
}

function isSkip(text: string): boolean {
  const t = normalizeGreek(text);
  return t.includes('παραλειψ') || t.includes('skip');
}

export function isWakeWord(text: string): boolean {
  return normalizeGreek(text).includes('ετοιμ');
}

export function isStopWord(text: string): boolean {
  const t = normalizeGreek(text);
  return t.includes('stop') || t.includes('στοπ') || t.includes('παυση');
}

export function isFinalEnd(text: string): boolean {
  const t = normalizeGreek(text).replace(/\s+/g, ' ');
  return t.includes('οριστικο τελος') || t.includes('οριστικοτελος');
}

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16_000, numberOfChannels: 1, bitRate: 64_000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16_000, numberOfChannels: 1, bitRate: 64_000,
    linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64_000 },
};

const STT_MODEL = 'gpt-4o-mini-transcribe';
const STT_PROMPT =
  'Ελληνικά μελισσοκομικά: έτοιμος, στοπ, ναι, όχι, μηδέν, παράλειψη, ' +
  'ένα, δύο, τρία, τέσσερα, πέντε, έξι, επτά, οκτώ, εννέα, δέκα, ' +
  'τέλος, οριστικό τέλος, κυψέλη, πλαίσια';

const BEEP_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface GuidedInspectionResult {
  hive_id: string; hive_name: string;
  population_frames: number | null; brood_frames: number | null;
  honey_frames: number | null; queen_present: boolean | null;
  queen_status: string | null; queen_cells: number | null;
  temperament: string | null; has_swarmed: boolean;
  feeding_type: string | null; feeding_label: string | null;
  notes: string | null; urgent: boolean; is_dead: boolean;
}

export interface GuidedSessionCallbacks {
  onQuestion:      (question: string) => void;
  onAnswer:        (answer: string) => void;
  onListening:     () => void;
  onHiveStart:     (hiveName: string) => void;
  onHiveSaved:     (hiveName: string, count: number) => void;
  onError:         (msg: string) => void;
  onFinished:      (count: number) => void;
  onStateChange:   (state: string) => void;
  saveInspection:  (result: GuidedInspectionResult) => Promise<void>;
  getHiveByNumber: (num: number) => { id: string; name: string } | null;
}

type NumResult   = { kind: 'ok'; value: number | null } | { kind: 'paused' } | { kind: 'ended' };
type BoolResult  = { kind: 'ok'; value: boolean | null } | { kind: 'paused' } | { kind: 'ended' };
type AskResult   = { kind: 'ok'; text: string } | { kind: 'failed' } | { kind: 'paused' } | { kind: 'ended' };
type SessionOutcome = 'done' | 'ended';
type Resume = 'continue' | 'end';

// ─── CLASS ───────────────────────────────────────────────────────────────────

export class GuidedVoiceSession {
  private running  = false;
  private stop     = false;
  private apiKey   = '';
  private cb: GuidedSessionCallbacks | null = null;
  private completedCount = 0;
  private activeRecording: Audio.Recording | null = null;
  private gen = 0;

  private dead(g: number): boolean { return this.stop || g !== this.gen; }

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

  private async beep(): Promise<void> {
    try {
      await this.setPlayback();
      const { sound } = await Audio.Sound.createAsync(
        { uri: BEEP_URL }, { shouldPlay: true, volume: 1.0 }
      );
      await delay(400);
      await sound.unloadAsync();
    } catch {}
    await this.setRecording();
    await delay(200);
  }

  private async speak(g: number, text: string): Promise<void> {
    if (this.dead(g)) return;
    await this.setPlayback();
    await new Promise<void>(resolve => {
      const done = (): void => { setTimeout(resolve, 200); };
      Speech.stop();
      Speech.speak(text, {
        language: 'el-GR', rate: 0.95,
        onDone:    () => done(),
        onError:   () => done(),
        onStopped: () => { setTimeout(resolve, 100); },
      });
    });
    await this.setRecording();
    await delay(150);
  }

  private async record(g: number, durationMs: number): Promise<string> {
    if (this.dead(g)) return '';
    this.cb?.onListening();
    await this.beep();
    if (this.dead(g)) return '';
    let uri: string | null = null;
    try {
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(RECORDING_OPTIONS);
      this.activeRecording = rec;
      await rec.startAsync();
      await delay(durationMs);
      if (this.dead(g)) {
        await rec.stopAndUnloadAsync().catch(() => {});
        this.activeRecording = null;
        return '';
      }
      await rec.stopAndUnloadAsync();
      this.activeRecording = null;
      uri = rec.getURI() ?? null;
    } catch { this.activeRecording = null; return ''; }
    if (!uri) return '';
    try {
      const fd = new FormData();
      fd.append('file', { uri, type: 'audio/mp4', name: 'rec.m4a' } as any);
      fd.append('model', STT_MODEL);
      fd.append('language', 'el');
      fd.append('prompt', STT_PROMPT);
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}` }, body: fd,
      });
      if (this.dead(g)) return '';
      if (!res.ok) {
        if (res.status >= 500) {
          await delay(1200);
          if (this.dead(g)) return '';
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

  private async ask(g: number, question: string, durationMs = 3500): Promise<AskResult> {
    this.cb?.onQuestion(question);
    await this.speak(g, question);
    for (let attempt = 1; attempt <= 3 && !this.dead(g); attempt++) {
      const text = await this.record(g, durationMs);
      if (text) {
        if (isFinalEnd(text)) return { kind: 'ended' };
        if (isStopWord(text)) return { kind: 'paused' };
        this.cb?.onAnswer(text);
        return { kind: 'ok', text };
      }
      if (attempt < 3) await this.speak(g, 'Επανέλαβε, δεν κατάλαβα.');
    }
    return { kind: 'failed' };
  }

  private async askNumber(g: number, question: string, fieldLabel: string): Promise<NumResult> {
    const res = await this.ask(g, question, 3500);
    if (res.kind === 'ended')  return { kind: 'ended' };
    if (res.kind === 'paused') return { kind: 'paused' };
    if (res.kind === 'failed') {
      await this.speak(g, `${fieldLabel} δεν καταγράφηκε.`);
      return { kind: 'ok', value: null };
    }
    let n = parseNumber(res.text);
    if (n === null) {
      for (let i = 0; i < 2 && n === null && !this.dead(g); i++) {
        await this.speak(g, 'Επανέλαβε, δεν κατάλαβα.');
        const t2 = await this.record(g, 3500);
        if (t2) {
          if (isFinalEnd(t2)) return { kind: 'ended' };
          if (isStopWord(t2)) return { kind: 'paused' };
          this.cb?.onAnswer(t2);
          n = parseNumber(t2);
        }
      }
      if (n === null) await this.speak(g, `${fieldLabel} δεν καταγράφηκε.`);
    }
    return { kind: 'ok', value: n };
  }

  private async askYesNo(g: number, question: string, fieldLabel: string): Promise<BoolResult> {
    const res = await this.ask(g, question, 3000);
    if (res.kind === 'ended')  return { kind: 'ended' };
    if (res.kind === 'paused') return { kind: 'paused' };
    if (res.kind === 'failed') {
      await this.speak(g, `${fieldLabel} δεν καταγράφηκε.`);
      return { kind: 'ok', value: null };
    }
    if (isYes(res.text)) return { kind: 'ok', value: true };
    if (isNo(res.text))  return { kind: 'ok', value: false };
    for (let i = 0; i < 2 && !this.dead(g); i++) {
      await this.speak(g, 'Επανέλαβε, ναι ή όχι.');
      const t2 = await this.record(g, 3000);
      if (t2) {
        if (isFinalEnd(t2)) return { kind: 'ended' };
        if (isStopWord(t2)) return { kind: 'paused' };
        this.cb?.onAnswer(t2);
        if (isYes(t2)) return { kind: 'ok', value: true };
        if (isNo(t2))  return { kind: 'ok', value: false };
      }
    }
    await this.speak(g, `${fieldLabel} δεν καταγράφηκε.`);
    return { kind: 'ok', value: null };
  }

  /** Καθαρή σειριακή paused loop. Παίρνει "έτοιμος" → 'continue', ή "οριστικό τέλος" → 'end'. */
  private async waitForResume(g: number, msg: string): Promise<Resume> {
    this.cb?.onStateChange('paused');
    await this.speak(g, msg);
    while (!this.dead(g)) {
      const text = await this.record(g, 2_500);
      if (!text) continue;
      if (isFinalEnd(text)) return 'end';
      if (isWakeWord(text)) { this.cb?.onAnswer(text); return 'continue'; }
    }
    return 'end';
  }

  async start(cb: GuidedSessionCallbacks): Promise<void> {
    if (this.running) return;
    const key = process.env.EXPO_PUBLIC_OPENAI_KEY ?? '';
    if (!key) { cb.onError('EXPO_PUBLIC_OPENAI_KEY λείπει'); return; }
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { cb.onError('Δεν δόθηκε άδεια μικροφώνου'); return; }
    this.running = true; this.stop = false;
    this.apiKey = key; this.cb = cb; this.completedCount = 0;
    const g = ++this.gen;
    await this.setRecording();
    this.waitForHive(g);
  }

  private async waitForHive(g: number): Promise<void> {
    this.cb?.onStateChange('waiting_hive');
    await this.speak(g, 'Πείτε αριθμό κυψέλης.');
    let emptyCount = 0;
    while (!this.dead(g)) {
      const text = await this.record(g, 3_500);
      if (!text) {
        emptyCount++;
        if (emptyCount >= 3) {
          const r = await this.waitForResume(g, 'Αδράνεια. Πείτε έτοιμος για συνέχεια.');
          if (r === 'end') { await this.finishSession(g); return; }
          this.cb?.onStateChange('waiting_hive');
          await this.speak(g, 'Πείτε αριθμό κυψέλης.');
          emptyCount = 0;
          continue;
        }
        continue;
      }
      emptyCount = 0;
      if (isStopWord(text)) {
        const r = await this.waitForResume(g, 'Αδράνεια. Πείτε έτοιμος για συνέχεια.');
        if (r === 'end') { await this.finishSession(g); return; }
        this.cb?.onStateChange('waiting_hive');
        await this.speak(g, 'Πείτε αριθμό κυψέλης.');
        continue;
      }
      if (isFinalEnd(text)) { await this.finishSession(g); return; }
      this.cb?.onAnswer(text);
      const num = parseNumber(text);
      if (num !== null && num > 0) {
        const hive = this.cb?.getHiveByNumber(num);
        if (hive) {
          this.cb?.onHiveStart(hive.name);
          this.cb?.onStateChange('recording');
          const outcome = await this.runInspection(g, hive.id, hive.name, num);
          if (this.dead(g)) return;
          if (outcome === 'ended') { await this.finishSession(g); return; }
          // multi-hive: pause and continue
          const r = await this.waitForResume(g,
            'Πείτε έτοιμος για επόμενη κυψέλη ή οριστικό τέλος.');
          if (r === 'end') { await this.finishSession(g); return; }
          this.cb?.onStateChange('waiting_hive');
          await this.speak(g, 'Πείτε αριθμό κυψέλης.');
          continue;
        } else {
          await this.speak(g, `Δεν βρήκα κυψέλη ${num}. Ξαναπείτε.`);
        }
      }
    }
  }

  private async finishSession(g: number): Promise<void> {
    await this.speak(g, `Τέλος. ${this.completedCount} κυψέλες καταγράφηκαν.`);
    this.cb?.onStateChange('finished');
    this.cb?.onFinished(this.completedCount);
    this.running = false;
  }

  private async runInspection(
    g: number, hiveId: string, hiveName: string, hiveNum: number,
  ): Promise<SessionOutcome> {
    const result: GuidedInspectionResult = {
      hive_id: hiveId, hive_name: hiveName,
      population_frames: null, brood_frames: null, honey_frames: null,
      queen_present: null, queen_status: null, queen_cells: null,
      temperament: null, has_swarmed: false,
      feeding_type: 'καμία', feeding_label: null,
      notes: null, urgent: false, is_dead: false,
    };

    const getNum = async (question: string, label: string): Promise<{ value: number | null } | 'ended'> => {
      while (!this.dead(g)) {
        const r = await this.askNumber(g, question, label);
        if (r.kind === 'ended') return 'ended';
        if (r.kind === 'ok')    return { value: r.value };
        // paused
        const resume = await this.waitForResume(g, 'Αδράνεια. Πείτε έτοιμος για συνέχεια.');
        if (resume === 'end') return 'ended';
        this.cb?.onStateChange('recording');
      }
      return 'ended';
    };

    const getBool = async (question: string, label: string): Promise<{ value: boolean | null } | 'ended'> => {
      while (!this.dead(g)) {
        const r = await this.askYesNo(g, question, label);
        if (r.kind === 'ended') return 'ended';
        if (r.kind === 'ok')    return { value: r.value };
        const resume = await this.waitForResume(g, 'Αδράνεια. Πείτε έτοιμος για συνέχεια.');
        if (resume === 'end') return 'ended';
        this.cb?.onStateChange('recording');
      }
      return 'ended';
    };

    // 1. Πληθυσμός
    const pop = await getNum(`Κυψέλη ${hiveNum}. Πόσα πλαίσια πληθυσμός;`, 'Ο πληθυσμός');
    if (pop === 'ended') { await this.commitInspection(g, result, hiveNum); return 'ended'; }
    if (pop.value === 0) {
      result.is_dead = true; result.population_frames = 0;
      result.urgent = true; result.notes = 'Νεκρό μελίσσι';
      await this.commitInspection(g, result, hiveNum);
      return 'done';
    }
    result.population_frames = pop.value;

    // 2. Γόνος
    const brood = await getNum('Πόσα πλαίσια γόνος;', 'Ο γόνος');
    if (brood === 'ended') { await this.commitInspection(g, result, hiveNum); return 'ended'; }
    result.brood_frames = brood.value;

    // 3. Μέλι
    const honey = await getNum('Πόσα πλαίσια μέλι;', 'Το μέλι');
    if (honey === 'ended') { await this.commitInspection(g, result, hiveNum); return 'ended'; }
    result.honey_frames = honey.value;

    // 4. Βασίλισσα
    const queenPresent = await getBool('Βασίλισσα παρούσα;', 'Η βασίλισσα');
    if (queenPresent === 'ended') { await this.commitInspection(g, result, hiveNum); return 'ended'; }
    result.queen_present = queenPresent.value;
    if (queenPresent.value === false) {
      const dayBrood = await getBool('Είδες γόνο ημέρας;', 'Ο γόνος ημέρας');
      if (dayBrood === 'ended') { await this.commitInspection(g, result, hiveNum); return 'ended'; }
      if (dayBrood.value === true)  result.queen_status = 'Δεν εντοπίστηκε';
      if (dayBrood.value === false) { result.queen_status = 'Ορφανό'; result.urgent = true; result.notes = 'Ορφανό μελίσσι'; }
    }

    // 5. Βασιλικά κελιά
    const hasCells = await getBool('Βασιλικά κελιά;', 'Τα κελιά');
    if (hasCells === 'ended') { await this.commitInspection(g, result, hiveNum); return 'ended'; }
    if (hasCells.value === true) {
      const cells = await getNum('Πόσα;', 'Τα κελιά');
      if (cells === 'ended') { await this.commitInspection(g, result, hiveNum); return 'ended'; }
      result.queen_cells = cells.value;
    } else {
      result.queen_cells = 0;
    }

    // 6. Ιδιοσυγκρασία
    const calm = await getBool('Ήρεμο μελίσσι;', 'Η ιδιοσυγκρασία');
    if (calm === 'ended') { await this.commitInspection(g, result, hiveNum); return 'ended'; }
    if (calm.value === true)  result.temperament = 'ήρεμο';
    if (calm.value === false) result.temperament = 'επιθετικό';

    // 7. Σμηνουργία
    const swarm = await getBool('Τάση σμηνουργίας;', 'Η σμηνουργία');
    if (swarm === 'ended') { await this.commitInspection(g, result, hiveNum); return 'ended'; }
    result.has_swarmed = swarm.value === true;

    // 8. Σημειώσεις
    this.cb?.onQuestion('Σημειώσεις;');
    await this.speak(g, 'Σημειώσεις; Παράλειψη ή μιλήστε και πείτε τέλος.');
    let notesText = '';
    let notesDone = false;
    let notesEmpty = 0;
    while (!notesDone && !this.dead(g)) {
      const chunk = await this.record(g, 5000);
      if (!chunk) { notesEmpty++; if (notesEmpty >= 2) notesDone = true; continue; }
      if (isFinalEnd(chunk)) { notesDone = true; break; }
      if (isStopWord(chunk)) {
        const r = await this.waitForResume(g, 'Αδράνεια. Πείτε έτοιμος για συνέχεια σημειώσεων.');
        if (r === 'end') { notesDone = true; break; }
        this.cb?.onStateChange('recording');
        await this.speak(g, 'Συνεχίστε σημειώσεις ή πείτε τέλος.');
        continue;
      }
      this.cb?.onAnswer(chunk);
      if (isSkip(chunk)) {
        notesDone = true;
      } else if (normalizeGreek(chunk).includes('τελος')) {
        const before = normalizeGreek(chunk).replace(/τελος/g, '').trim();
        if (before) notesText += ' ' + before;
        notesDone = true;
      } else {
        notesText += ' ' + chunk;
      }
    }
    if (notesText.trim()) {
      result.notes = (result.notes ? result.notes + '. ' : '') + notesText.trim();
    }

    await this.commitInspection(g, result, hiveNum);
    return 'done';
  }

  /** Direct save + ηχητική επιβεβαίωση. Αντικαθιστά το παλιό sendToPreview. */
  private async commitInspection(g: number, result: GuidedInspectionResult, hiveNum: number): Promise<void> {
    this.cb?.onStateChange('processing');
    try {
      await this.cb!.saveInspection(result);
      this.completedCount++;
      this.cb?.onHiveSaved(result.hive_name, this.completedCount);
      await this.speak(g, `Κυψέλη ${hiveNum} αποθηκεύτηκε.`);
    } catch (e: any) {
      this.cb?.onError(`Αποθήκευση κυψέλης ${hiveNum}: ${e?.message ?? e}`);
      await this.speak(g, `Σφάλμα στην κυψέλη ${hiveNum}.`);
    }
  }

  reset(): void {
    this.gen++;
    this.stop = true;
    this.running = false;
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