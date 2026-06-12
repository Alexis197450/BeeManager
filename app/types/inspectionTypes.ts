// app/types/inspectionTypes.ts

export interface Inspection {
  id: string;
  user_id: string;
  hive_id: string;
  date: string;
  notifications_disabled: boolean;
  mode: 'guided' | 'quick' | 'audio';

  // Πληθυσμός & Βασίλισσα
  population_frames:    number | null;
  population_strength:  'αδύναμο' | 'μέτριο' | 'δυνατό' | null;
  temperament:          'ήρεμο' | 'μέτριο' | 'επιθετικό' | null;
  has_swarmed:          boolean;
  queen_present:        boolean | null;
  queen_status:         'Εξαιρετική' | 'Μέτρια' | 'κακή' | 'Σμηνουργίας' | 'Δεν εντοπίστηκε' | 'Ορφανό' | null;
  queen_laying:         'κανονική' | 'αραιή' | 'καμία' | null;
  queen_cells:          number | null;

  // Γόνος
  brood_frames:         number | null;
  brood_condition:      'Εξαιρετική' | 'Καλή' | 'Ασκοσφαίρωση' | null;
  brood_type:           'ανοιχτός' | 'κλειστός' | 'μικτός' | null;

  // Αποθέματα
  honey_frames:         number | null;
  pollen_frames:        number | null;
  feeding_type:         'καμία' | 'σιρόπι' | 'βανίλια' | 'ζαχαροζύμαρο' | 'γυρεόπιτα' | 'σόγια' | 'μέλι' | 'ζυμάρι' | 'άλλο' | null;
  feeding_amount:       number | null;

  // Υγεία
  varroa_level:         'μη_ορατή' | 'χαμηλή' | 'μέτρια' | 'υψηλή' | null;
  varroa_measurement:   number | null;
  diseases:             string | null;
  treatment_type:       string | null;
  treatment_dose:       number | null;

  // Εξοπλισμός & Διαχείριση
  equipment_status:     'καλή' | 'επισκευή' | 'κακή' | null;
  equipment_notes:      string | null;
  management_actions:   string | null;

  // Επόμενη Επίσκεψη
  next_visit:           string | null;
  next_visit_reason:    string | null;
  urgent:               boolean;

  // Σημειώσεις & Ηχογράφηση
  notes:                string | null;
  audio_url:            string | null;
  transcript:           string | null;

  created_at: string;
}

export type CreateInspectionInput = Omit<Inspection, 'id' | 'created_at'> & {
  notifications_disabled?: boolean;
};

export interface Hive {
  id:       string;
  name:     string;
  location: string | null;
  type:     string;
  status:   string;
}

export const POPULATION_STRENGTH_OPTIONS = [
  { value: 'αδύναμο', label: 'Αδύναμο', color: '#FEE2E2', textColor: '#DC2626' },
  { value: 'μέτριο',  label: 'Μέτριο',  color: '#FEF3C7', textColor: '#D97706' },
  { value: 'δυνατό',  label: 'Δυνατό',  color: '#DCFCE7', textColor: '#16A34A' },
] as const;

export const TEMPERAMENT_OPTIONS = [
  { value: 'ήρεμο',     label: '😌 Ήρεμο',     color: '#DCFCE7', textColor: '#16A34A' },
  { value: 'μέτριο',    label: '😐 Μέτριο',    color: '#FEF3C7', textColor: '#D97706' },
  { value: 'επιθετικό', label: '😤 Επιθετικό', color: '#FEE2E2', textColor: '#DC2626' },
] as const;

export const VARROA_LEVEL_OPTIONS = [
  { value: 'μη_ορατή', label: 'Μη Ορατή', color: '#DCFCE7', textColor: '#16A34A' },
  { value: 'χαμηλή',   label: 'Χαμηλή',   color: '#FEF3C7', textColor: '#D97706' },
  { value: 'μέτρια',   label: 'Μέτρια',   color: '#FED7AA', textColor: '#EA580C' },
  { value: 'υψηλή',    label: 'Υψηλή',    color: '#FEE2E2', textColor: '#DC2626' },
] as const;

export const FEEDING_TYPE_OPTIONS = [
  { value: 'καμία',        label: 'Καμία'        },
  { value: 'σιρόπι',       label: 'Σιρόπι'       },
  { value: 'βανίλια',      label: 'Βανίλια'      },
  { value: 'γυρεόπιτα',   label: 'Γυρεόπιτα'   },
  { value: 'ζαχαροζύμαρο', label: 'Ζαχαροζύμαρο' },
  { value: 'σόγια',        label: 'Σόγια'        },
  { value: 'μέλι',         label: 'Μέλι'         },
  { value: 'ζυμάρι',       label: 'Ζυμάρι'       },
  { value: 'άλλο',         label: 'Άλλο'         },
] as const;

export const BROOD_CONDITION_OPTIONS = [
  { value: 'Εξαιρετική',  label: 'Εξαιρετική',  color: '#DCFCE7', textColor: '#16A34A' },
  { value: 'Καλή',        label: 'Καλή',        color: '#FEF3C7', textColor: '#D97706' },
  { value: 'Ασκοσφαίρωση', label: 'Ασκοσφαίρωση', color: '#FEE2E2', textColor: '#DC2626' },
] as const;

export const EQUIPMENT_STATUS_OPTIONS = [
  { value: 'καλή',     label: '✅ Καλή'               },
  { value: 'επισκευή', label: '🔧 Χρειάζεται Επισκευή' },
  { value: 'κακή',     label: '❌ Κακή'               },
] as const;

export const DISEASES_OPTIONS = [
  'Βαρρόα',
  'Νοζεμίαση',
  'Ασκοσφαίρωση',
  'Αμερικανική Σηψιγονία',
  'Ευρωπαϊκή Σηψιγονία',
  'Άλλο',
];