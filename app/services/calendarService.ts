import { supabase } from '../supabase';

export type CalendarEvent = {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
  related_apiary_id: string | null;
  notes: string | null;
  is_completed: boolean;
};

const EVENT_TYPE_INFO: Record<string, { color: string; label: string }> = {
  inspection:    { color: '#3B82F6', label: 'Επιθεώρηση' },
  feeding:       { color: '#10B981', label: 'Τροφοδοσία' },
  treatment:     { color: '#F59E0B', label: 'Θεραπεία' },
  queen_rearing: { color: '#EF4444', label: 'Βασιλοτροφία' },
  harvest:       { color: '#F97316', label: 'Τρύγος' },
  reminder:      { color: '#8B5CF6', label: 'Υπενθύμιση' },
};

export function getEventTypeInfo(type: string) {
  return EVENT_TYPE_INFO[type] ?? EVENT_TYPE_INFO.reminder;
}

export async function getEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .gte('event_date', startDate)
    .lte('event_date', endDate)
    .order('event_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getEventsForDate(date: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('event_date', date)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addEvent(event: {
  title: string;
  event_date: string;
  event_type: string;
  related_apiary_id?: string;
  notes?: string;
}): Promise<CalendarEvent> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({ ...event, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleEventCompleted(id: string, completed: boolean) {
  const { error } = await supabase
    .from('calendar_events')
    .update({ is_completed: completed })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ── Auto-generated events from queen rearing ──────────────────

const STEPS_STARTER = [
  { day: -30, action: 'Κηφηνοτροφία' },
  { day: -15, action: 'Τάισμα μελισσιών Έναρξης' },
  { day:  -6, action: 'Αφαίρεση Βασίλισσας Έναρξης' },
  { day:  -5, action: 'Μαύρο Πλαίσιο σε Επιλεγμένο Μελίσσι' },
  { day:   0, action: 'Εμβολιασμός' },
  { day:  +4, action: 'Έλεγχος Σφραγισμένων Β.Κ.' },
  { day: +10, action: 'Κατανομή Βασιλικών Κελιών' },
  { day: +12, action: 'Έλεγχος Εκκόλαψης' },
  { day: +25, action: 'Έλεγχος Ωοτοκίας' },
];

const STEPS_STARTER_FINISHER = [
  { day: -30, action: 'Κηφηνοτροφία' },
  { day: -15, action: 'Τάισμα μελισσιών Έναρξης' },
  { day:  -6, action: 'Αφαίρεση Βασίλισσας Έναρξης' },
  { day:  -5, action: 'Μαύρο Πλαίσιο σε Επιλεγμένο Μελίσσι' },
  { day:   0, action: 'Εμβολιασμός & Προετοιμασία Αποπεράτωσης' },
  { day:  +1, action: 'Μεταφορά Β.Κ. στα Αποπεράτωσης' },
  { day:  +4, action: 'Έλεγχος Σφραγισμένων Β.Κ.' },
  { day: +10, action: 'Κατανομή Βασιλικών Κελιών' },
  { day: +12, action: 'Έλεγχος Εκκόλαψης' },
  { day: +25, action: 'Έλεγχος Ωοτοκίας' },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function getBreedingEventsForDate(date: string): Promise<CalendarEvent[]> {
  // Φέρνουμε όλους τους ενεργούς κύκλους
  const { data: cycles, error } = await supabase
    .from('queen_rearing')
    .select('*')
    .order('start_date', { ascending: false });

  if (error || !cycles) return [];

  const events: CalendarEvent[] = [];

  for (const cycle of cycles) {
    const steps = cycle.method === 'starter_finisher'
      ? STEPS_STARTER_FINISHER
      : STEPS_STARTER;

    const completedSteps: number[] = cycle.completed_steps ?? [];

    steps.forEach((step, index) => {
      const stepDate = addDays(cycle.start_date, step.day);
      if (stepDate === date) {
      events.push({
          id: `breeding_${cycle.id}_${index}`,
          title: step.action,
          event_date: date,
          event_type: 'queen_rearing',
          related_apiary_id: null,
          notes: cycle.queen_breed ? `Φυλή: ${cycle.queen_breed}` : null,
          is_completed: completedSteps.includes(index),
        });
      }
    });
  }

  return events;
}

export async function getBreedingEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const { data: cycles, error } = await supabase
    .from('queen_rearing')
    .select('*')
    .order('start_date', { ascending: false });

  if (error || !cycles) return [];

  const events: CalendarEvent[] = [];
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  for (const cycle of cycles) {
    const steps = cycle.method === 'starter_finisher'
      ? STEPS_STARTER_FINISHER
      : STEPS_STARTER;

    const completedSteps: number[] = cycle.completed_steps ?? [];

    steps.forEach((step, index) => {
      const stepDate = addDays(cycle.start_date, step.day);
      const stepTime = new Date(stepDate).getTime();
            if (stepTime >= start && stepTime <= end) {

      events.push({
          id: `breeding_${cycle.id}_${index}`,
          title: step.action,
          event_date: stepDate,
          event_type: 'queen_rearing',
          related_apiary_id: null,
          notes: cycle.queen_breed ? `Φυλή: ${cycle.queen_breed}` : null,
          is_completed: completedSteps.includes(index),
        });
      }
    });
  }

  return events;
}

// ── Unified: manual + auto events ──────────────────────────

export async function getAllEventsForDate(date: string): Promise<CalendarEvent[]> {
  const [manual, breeding] = await Promise.all([
    getEventsForDate(date),
    getBreedingEventsForDate(date),
  ]);
  return [...breeding, ...manual];
}

export async function getAllEventsForRange(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const [manual, breeding] = await Promise.all([
    getEventsForRange(startDate, endDate),
    getBreedingEventsForRange(startDate, endDate),
  ]);
  return [...breeding, ...manual];
}

export async function toggleBreedingStep(eventId: string): Promise<void> {
  // eventId format: "breeding_{cycleId}_{stepIndex}"
  const parts = eventId.split('_');
  const stepIndex = parseInt(parts.pop()!, 10);
  const cycleId = parts.slice(1).join('_'); // handle UUIDs with dashes

  const { data: cycle, error: fetchErr } = await supabase
    .from('queen_rearing')
    .select('completed_steps')
    .eq('id', cycleId)
    .single();

  if (fetchErr || !cycle) throw new Error('Κύκλος δεν βρέθηκε');

  const completed: number[] = cycle.completed_steps ?? [];
  const newCompleted = completed.includes(stepIndex)
    ? completed.filter((i: number) => i !== stepIndex)
    : [...completed, stepIndex];

  const { error } = await supabase
    .from('queen_rearing')
    .update({ completed_steps: newCompleted })
    .eq('id', cycleId);

  if (error) throw error;
}