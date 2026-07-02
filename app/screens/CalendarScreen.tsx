import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import {
  CalendarEvent, getAllEventsForDate, getAllEventsForRange,
  addEvent, toggleEventCompleted, deleteEvent, getEventTypeInfo,
  toggleBreedingStep,
} from '../services/calendarService';

// ── Helpers ────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getWeekDays(baseDate: Date): Date[] {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DAY_NAMES = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ'];
const MONTH_NAMES = [
  'Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος',
  'Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος',
];

const EVENT_TYPES = [
  { key: 'reminder',      label: 'Υπενθύμιση' },
  { key: 'inspection',    label: 'Επιθεώρηση' },
  { key: 'feeding',       label: 'Τροφοδοσία' },
  { key: 'treatment',     label: 'Θεραπεία' },
  { key: 'queen_rearing', label: 'Βασιλοτροφία' },
  { key: 'harvest',       label: 'Τρύγος' },
];

// ── Component ──────────────────────────────────────────────
export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekBase, setWeekBase] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekEventCounts, setWeekEventCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Modal form state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('reminder');
  const [newNotes, setNewNotes] = useState('');

  const weekDays = getWeekDays(weekBase);
  const todayStr = formatDate(new Date());

  // Fetch events for selected date
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = formatDate(selectedDate);
      const data = await getAllEventsForDate(dateStr);
      setEvents(data);
    } catch (e: any) {
      Alert.alert('Σφάλμα', e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Fetch event counts for week dots
  const loadWeekCounts = useCallback(async () => {
    try {
      const start = formatDate(weekDays[0]);
      const end = formatDate(weekDays[6]);
      const data = await getAllEventsForRange(start, end);
      const counts: Record<string, number> = {};
      data.forEach(ev => {
        counts[ev.event_date] = (counts[ev.event_date] || 0) + 1;
      });
      setWeekEventCounts(counts);
    } catch (_) {}
  }, [weekBase]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { loadWeekCounts(); }, [loadWeekCounts]);

  // Navigation
  const goToPrevWeek = () => {
    const d = new Date(weekBase);
    d.setDate(d.getDate() - 7);
    setWeekBase(d);
  };
  const goToNextWeek = () => {
    const d = new Date(weekBase);
    d.setDate(d.getDate() + 7);
    setWeekBase(d);
  };
  const goToToday = () => {
    const today = new Date();
    setWeekBase(today);
    setSelectedDate(today);
  };

  // Add event
  const handleAddEvent = async () => {
    if (!newTitle.trim()) {
      Alert.alert('', 'Συμπλήρωσε τίτλο');
      return;
    }
    try {
      await addEvent({
        title: newTitle.trim(),
        event_date: formatDate(selectedDate),
        event_type: newType,
        notes: newNotes.trim() || undefined,
      });
      setNewTitle('');
      setNewType('reminder');
      setNewNotes('');
      setShowAddModal(false);
      loadEvents();
      loadWeekCounts();
    } catch (e: any) {
      Alert.alert('Σφάλμα', e.message);
    }
  };

  // Toggle completed
 const handleToggle = async (ev: CalendarEvent) => {
    try {
      if (ev.id.startsWith('breeding_')) {
        await toggleBreedingStep(ev.id);
      } else {
        await toggleEventCompleted(ev.id, !ev.is_completed);
      }
      loadEvents();
      loadWeekCounts();
    } catch (e: any) {
      Alert.alert('Σφάλμα', e.message);
    }
  };

  // Delete
  const handleDelete = (ev: CalendarEvent) => {
    if (ev.id.startsWith('breeding_')) {
      Alert.alert('', 'Τα βήματα βασιλοτροφίας διαγράφονται από την οθόνη Βασιλοτροφία');
      return;
    }
    Alert.alert('Διαγραφή', `Διαγραφή "${ev.title}";`, [
      { text: 'Άκυρο', style: 'cancel' },
      {
        text: 'Διαγραφή', style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(ev.id);
            loadEvents();
            loadWeekCounts();
          } catch (e: any) { Alert.alert('Σφάλμα', e.message); }
        },
      },
    ]);
  };
  const selectedDateStr = formatDate(selectedDate);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 100 }} 
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={true}
      >
        {/* ── Week strip ── */}
        <View style={styles.weekHeader}>
          <TouchableOpacity onPress={goToPrevWeek} style={styles.navArrow}>
            <Text style={styles.navArrowText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToToday}>
            <Text style={styles.monthTitle}>
              {MONTH_NAMES[weekDays[3].getMonth()]} {weekDays[3].getFullYear()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToNextWeek} style={styles.navArrow}>
            <Text style={styles.navArrowText}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekStrip}>
          {weekDays.map(day => {
            const dayStr = formatDate(day);
            const isSelected = dayStr === selectedDateStr;
            const isToday = dayStr === todayStr;
            const hasEvents = (weekEventCounts[dayStr] || 0) > 0;
            return (
              <TouchableOpacity
                key={dayStr}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDate(day)}
              >
                <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>
                  {DAY_NAMES[day.getDay()]}
                </Text>
                <Text style={[
                  styles.dayNumber,
                  isSelected && styles.dayTextSelected,
                  isToday && !isSelected && styles.dayNumberToday,
                ]}>
                  {day.getDate()}
                </Text>
                {hasEvents && (
                  <View style={[styles.eventDot, isSelected && styles.eventDotSelected]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Events ── */}
        <View style={styles.eventsHeader}>
          <Text style={styles.eventsTitle}>
            {selectedDateStr === todayStr ? 'Σήμερα' : `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}`}
          </Text>
          <Text style={styles.eventsCount}>
            {events.length} {events.length === 1 ? 'εργασία' : 'εργασίες'}
          </Text>
        </View>

        <View style={styles.eventsContent}>
          {loading ? (
            <ActivityIndicator color="#F5A623" style={{ marginTop: 40 }} />
          ) : events.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Καμία εργασία για αυτή την ημέρα</Text>
              <Text style={styles.emptySubtext}>Πάτα + για να προσθέσεις</Text>
            </View>
          ) : (
            events.map(ev => {
              const typeInfo = getEventTypeInfo(ev.event_type);
              return (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.eventCard, ev.is_completed && styles.eventCardCompleted]}
                  onPress={() => handleToggle(ev)}
                  onLongPress={() => handleDelete(ev)}
                >
                  <View style={[styles.eventColorBar, { backgroundColor: typeInfo.color }]} />
                  <View style={styles.eventContent}>
                    <View style={styles.eventTopRow}>
                      <View style={[styles.eventBadge, { backgroundColor: typeInfo.color + '20' }]}>
                        <Text style={[styles.eventBadgeText, { color: typeInfo.color }]}>
                          {typeInfo.label}
                        </Text>
                      </View>
                      <View style={[
                        styles.checkbox,
                        ev.is_completed && { backgroundColor: typeInfo.color, borderColor: typeInfo.color },
                      ]}>
                        {ev.is_completed && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </View>
                    <Text style={[styles.eventTitle, ev.is_completed && styles.eventTitleCompleted]}>
                      {ev.title}
                    </Text>
                    {ev.notes ? <Text style={styles.eventNotes}>{ev.notes}</Text> : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── Add Modal ── */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Νέα εργασία</Text>
            <Text style={styles.modalDate}>
              {selectedDate.getDate()}/{selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Τίτλος εργασίας"
              placeholderTextColor="#aaa"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.inputLabel}>Τύπος:</Text>
            <View style={styles.typeGrid}>
              {EVENT_TYPES.map(t => {
                const info = getEventTypeInfo(t.key);
                const selected = newType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[
                      styles.typeChip,
                      selected && { backgroundColor: info.color, borderColor: info.color },
                    ]}
                    onPress={() => setNewType(t.key)}
                  >
                    <Text style={[styles.typeChipText, selected && { color: '#fff' }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              placeholder="Σημειώσεις (προαιρετικά)"
              placeholderTextColor="#aaa"
              value={newNotes}
              onChangeText={setNewNotes}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalBtnCancelText}>Άκυρο</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleAddEvent}>
                <Text style={styles.modalBtnSaveText}>Αποθήκευση</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
// ── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },

  // Week header
  weekHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
  },
  navArrow: { padding: 8 },
  navArrowText: { fontSize: 28, color: '#F5A623', fontWeight: 'bold' },
  monthTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  // Week strip
  weekStrip: {
    flexDirection: 'row', paddingHorizontal: 12,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0e6d0',
  },
  dayCell: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, marginHorizontal: 2,
  },
  dayCellSelected: { backgroundColor: '#F5A623' },
  dayCellToday: { backgroundColor: '#FFF0D0' },
  dayName: { fontSize: 11, color: '#999', marginBottom: 4 },
  dayNumber: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  dayNumberToday: { color: '#F5A623' },
  dayTextSelected: { color: '#fff' },
  eventDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: '#F5A623', marginTop: 4,
  },
  eventDotSelected: { backgroundColor: '#fff' },

  // Events
  eventsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  eventsTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  eventsCount: { fontSize: 13, color: '#999' },

  eventsList: { flex: 1 },
  eventsContent: { paddingHorizontal: 20, paddingBottom: 100 },

  eventCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    marginBottom: 10, elevation: 3, overflow: 'hidden',
  },
  eventCardCompleted: { opacity: 0.5 },
  eventColorBar: { width: 4 },
  eventContent: { flex: 1, padding: 14 },
  eventTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  eventBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 8 },
  eventBadgeText: { fontSize: 11, fontWeight: 'bold' },
  eventTitle: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  eventTitleCompleted: { textDecorationLine: 'line-through', color: '#aaa' },
  eventNotes: { fontSize: 12, color: '#888', marginTop: 4 },

  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#ddd',
    alignItems: 'center', justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 50, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#999', fontWeight: 'bold' },
  emptySubtext: { fontSize: 13, color: '#bbb', marginTop: 4 },

  // FAB
  fab: {
    position: 'absolute', bottom: 80, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#F5A623', alignItems: 'center', justifyContent: 'center',
    elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: -2 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF8E7', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  modalDate: { fontSize: 13, color: '#999', marginBottom: 20 },
  inputLabel: { fontSize: 13, color: '#666', marginBottom: 8 },
  input: {
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1,
    borderColor: '#e8dcc8', padding: 14, fontSize: 15,
    color: '#333', marginBottom: 16,
  },
  typeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
  },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#e8dcc8', backgroundColor: '#fff',
  },
  typeChipText: { fontSize: 13, fontWeight: 'bold', color: '#666' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalBtnCancel: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: '#fff', alignItems: 'center',
    borderWidth: 1, borderColor: '#e8dcc8',
  },
  modalBtnCancelText: { color: '#999', fontWeight: 'bold', fontSize: 15 },
  modalBtnSave: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: '#F5A623', alignItems: 'center',
  },
  modalBtnSaveText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});