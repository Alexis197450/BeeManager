// ╔════════════════════════════════════════════════════════════════════╗
// ║                  CreateProductScreen.tsx                          ║
// ║         Δημιουργία Προϊόντος + Επιλογή/Δημιουργία Συσκευασιών    ║
// ╚════════════════════════════════════════════════════════════════════╝

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { productsService, packagingService } from '../../services/financeService';
import { useAuth } from '../../contexts/AuthContext';
import {
  CATEGORY_INFO,
  CATEGORY_LIST,
  type ProductCategory,
} from '../../types/beemanager_finance_types';

// ─── TYPES ────────────────────────────────────────────────────────────────
interface PackagingDraft {
  id: string;
  name: string;
  volume_ml: string;
  weight_kg: string;
  cost_per_unit: string;
  is_default: boolean;
}

// Existing packaging from DB (template)
interface PackagingTemplate {
  id: string;
  name: string;
  volume_ml: number | null;
  weight_kg: number | null;
  cost_per_unit: number;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────
const calcWeight = (ml: string): string => {
  const v = parseFloat(ml.replace(',', '.'));
  if (!isNaN(v) && v > 0) return ((v * 1.35) / 1000).toFixed(3);
  return '';
};

const deduplicateTemplates = (templates: PackagingTemplate[]): PackagingTemplate[] => {
  const seen = new Set<string>();
  return templates.filter((t) => {
    const key = `${t.name}|${t.volume_ml}|${t.weight_kg}|${t.cost_per_unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ─────────────────────────────────────────────────────────────────────────
export default function CreateProductScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  // ── Product State ──
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('honey');

  // ── Packaging State ──
  const [packagings, setPackagings] = useState<PackagingDraft[]>([]);
  const [showPackagingForm, setShowPackagingForm] = useState(false);
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgVolume, setNewPkgVolume] = useState('');
  const [newPkgWeight, setNewPkgWeight] = useState('');
  const [newPkgCost, setNewPkgCost] = useState('');

  // ── Templates State ──
  const [templates, setTemplates] = useState<PackagingTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // ── UI State ──
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── LOAD EXISTING PACKAGING TEMPLATES ──────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setTemplatesLoading(true);
      try {
        const all = await packagingService.getAllByUser(user.id);
        setTemplates(deduplicateTemplates(all as PackagingTemplate[]));
      } catch (e) {
        // Σιωπηλό — δεν είναι κρίσιμο
      } finally {
        setTemplatesLoading(false);
      }
    };
    load();
  }, [user?.id]);

  // ─── VALIDATION ──────────────────────────────────────────────────────────
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Το όνομα του προϊόντος είναι υποχρεωτικό';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── PACKAGING HANDLERS ──────────────────────────────────────────────────

  // Προσθήκη από template
  const addFromTemplate = (t: PackagingTemplate) => {
    const alreadyAdded = packagings.some(
      (p) => p.name === t.name && p.cost_per_unit === String(t.cost_per_unit)
    );
    if (alreadyAdded) {
      Alert.alert('', 'Αυτή η συσκευασία έχει ήδη προστεθεί.');
      return;
    }
    const draft: PackagingDraft = {
      id: `tmpl-${Date.now()}`,
      name: t.name,
      volume_ml: t.volume_ml ? String(t.volume_ml) : '',
      weight_kg: t.weight_kg ? String(t.weight_kg) : '',
      cost_per_unit: String(t.cost_per_unit),
      is_default: packagings.length === 0,
    };
    setPackagings((prev) => [...prev, draft]);
  };

  // Προσθήκη νέας
  const addPackaging = () => {
    if (!newPkgName.trim()) {
      Alert.alert('Σφάλμα', 'Δώσε όνομα στη συσκευασία (π.χ. "Βάζο 500ml")');
      return;
    }
    if (!newPkgCost || parseFloat(newPkgCost.replace(',', '.')) <= 0) {
      Alert.alert('Σφάλμα', 'Δώσε έγκυρο κόστος συσκευασίας');
      return;
    }
    const draft: PackagingDraft = {
      id: `temp-${Date.now()}`,
      name: newPkgName.trim(),
      volume_ml: newPkgVolume,
      weight_kg: newPkgWeight,
      cost_per_unit: newPkgCost,
      is_default: packagings.length === 0,
    };
    setPackagings((prev) => [...prev, draft]);
    setNewPkgName('');
    setNewPkgVolume('');
    setNewPkgWeight('');
    setNewPkgCost('');
    setShowPackagingForm(false);
  };

  const removePackaging = (id: string) => setPackagings((p) => p.filter((x) => x.id !== id));

  const setAsDefault = (id: string) =>
    setPackagings((p) => p.map((x) => ({ ...x, is_default: x.id === id })));

  // ─── CREATE PRODUCT ──────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!validateForm()) return;
    if (!user?.id) {
      Alert.alert('Σφάλμα Αυθεντικοποίησης', 'Δεν βρέθηκε ενεργή συνεδρία.');
      return;
    }
    setIsLoading(true);
    try {
      const autoUnit = CATEGORY_INFO[category].defaultUnit;
      const createdProduct = await productsService.create(user.id, {
        name: name.trim(),
        category,
        unit_type: autoUnit,
        density: null,
        is_active: true,
      });

      if (packagings.length > 0) {
        const inputs = packagings.map((p) => ({
          product_id: createdProduct.id,
          name: p.name,
          volume_ml: p.volume_ml ? parseFloat(p.volume_ml.replace(',', '.')) : null,
          weight_kg: p.weight_kg ? parseFloat(p.weight_kg.replace(',', '.')) : 0,
          cost_per_unit: parseFloat(p.cost_per_unit.replace(',', '.')),
          is_default: p.is_default,
        }));
        await packagingService.createMany(user.id, inputs);
      }

      Alert.alert(
        '✅ Επιτυχία',
        `Το προϊόν "${name}" δημιουργήθηκε${packagings.length > 0 ? ` με ${packagings.length} συσκευασίες` : ''}!`,
        [{ text: 'OK', onPress: () => { setName(''); setCategory('honey'); setPackagings([]); navigation.goBack(); } }]
      );
    } catch (error: any) {
      let msg = 'Αποτυχία δημιουργίας. Δοκιμάστε ξανά.';
      if (error.code === '42501') msg = 'Σφάλμα RLS: Η βάση δεν επιτρέπει την εγγραφή.';
      else if (error.code === '23502') msg = `Ελλιπή δεδομένα: ${error.details || error.message}`;
      else if (error.code === '23514') msg = 'Μη έγκυρη κατηγορία προϊόντος.';
      else if (error.message) msg = `Σφάλμα: ${error.message}`;
      Alert.alert('❌ Σφάλμα', msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerInfo}>
          <MaterialCommunityIcons name="plus-box" size={48} color="#4CAF50" />
          <Text style={styles.headerTitle}>Δημιουργία Νέου Προϊόντος</Text>
          <Text style={styles.headerSubtitle}>Προσθέστε ένα νέο προϊόν στη μελισσοκομία σας</Text>
        </View>

        {/* ══ ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ ══ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Βασικά Στοιχεία</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Όνομα Προϊόντος *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="π.χ. Μέλι Ελάτης, Πρόπολη Αττικής..."
              placeholderTextColor="#999"
              value={name}
              onChangeText={(t) => { setName(t); if (errors.name) setErrors((e) => ({ ...e, name: '' })); }}
              editable={!isLoading}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Κατηγορία Προϊόντος *</Text>
            <View style={styles.categoryGrid}>
              {CATEGORY_LIST.map((cat) => {
                const info = CATEGORY_INFO[cat];
                const isActive = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryButton, isActive && styles.categoryButtonActive]}
                    onPress={() => setCategory(cat)}
                    disabled={isLoading}
                  >
                    <Text style={styles.categoryEmoji}>{info.emoji}</Text>
                    <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                      {info.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.helpText}>
              Μονάδα: {CATEGORY_INFO[category].emoji} {CATEGORY_INFO[category].label} → {CATEGORY_INFO[category].defaultUnit}
            </Text>
          </View>
        </View>

        {/* ══ ΣΥΣΚΕΥΑΣΙΕΣ ══ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🍯 Συσκευασίες</Text>

          {/* Templates από DB */}
          {templatesLoading ? (
            <ActivityIndicator size="small" color="#F5A623" style={{ marginVertical: 8 }} />
          ) : templates.length > 0 ? (
            <View style={styles.templatesBox}>
              <Text style={styles.templatesLabel}>📋 Επιλογή από υπάρχουσες συσκευασίες:</Text>
              <View style={styles.chipsRow}>
                {templates.map((t) => {
                  const isAdded = packagings.some(
                    (p) => p.name === t.name && p.cost_per_unit === String(t.cost_per_unit)
                  );
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, isAdded && styles.chipAdded]}
                      onPress={() => !isAdded && addFromTemplate(t)}
                      disabled={isAdded}
                    >
                      <Text style={[styles.chipText, isAdded && styles.chipTextAdded]}>
                        {isAdded ? '✓ ' : ''}{t.name}
                        {t.volume_ml ? ` ${t.volume_ml}ml` : ''}
                        {` · €${t.cost_per_unit}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Λίστα επιλεγμένων */}
          {packagings.map((pkg) => (
            <View key={pkg.id} style={styles.packagingCard}>
              <View style={styles.packagingInfo}>
                <View style={styles.packagingHeader}>
                  <Text style={styles.packagingName}>{pkg.name}</Text>
                  {pkg.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>✓ Προεπιλογή</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.packagingDetail}>
                  {pkg.volume_ml ? `📏 ${pkg.volume_ml}ml` : ''}
                  {pkg.volume_ml && pkg.weight_kg ? ' · ' : ''}
                  {pkg.weight_kg ? `⚖️ ${pkg.weight_kg}kg` : ''}
                </Text>
                <Text style={styles.packagingCost}>💶 €{pkg.cost_per_unit}/τεμάχιο</Text>
              </View>
              <View style={styles.packagingActions}>
                {!pkg.is_default && (
                  <TouchableOpacity onPress={() => setAsDefault(pkg.id)} style={styles.actionButton}>
                    <MaterialCommunityIcons name="star-outline" size={20} color="#FFA726" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => removePackaging(pkg.id)} style={styles.actionButton}>
                  <MaterialCommunityIcons name="delete-outline" size={20} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Νέα συσκευασία form */}
          {showPackagingForm ? (
            <View style={styles.packagingForm}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Όνομα Συσκευασίας *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="π.χ. Βάζο 500ml, Δοχείο 1kg..."
                  placeholderTextColor="#999"
                  value={newPkgName}
                  onChangeText={setNewPkgName}
                />
              </View>

              <View style={styles.twoColRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Χωρητικότητα (ml)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="500"
                    placeholderTextColor="#999"
                    value={newPkgVolume}
                    onChangeText={(text) => {
                      setNewPkgVolume(text);
                      setNewPkgWeight(calcWeight(text));
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Βάρος (kg) — αυτόματο</Text>
                  <View style={[styles.input, styles.inputReadOnly]}>
                    <Text style={styles.inputReadOnlyText}>
                      {newPkgWeight ? `${newPkgWeight} kg` : '—'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Κόστος Συσκευασίας (€) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="π.χ. 0.35"
                  placeholderTextColor="#999"
                  value={newPkgCost}
                  onChangeText={setNewPkgCost}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.helpText}>Κόστος του κάθε άδειου δοχείου/βάζου</Text>
              </View>

              <View style={styles.packagingFormActions}>
                <TouchableOpacity
                  style={styles.pkgCancelButton}
                  onPress={() => { setShowPackagingForm(false); setNewPkgName(''); setNewPkgVolume(''); setNewPkgWeight(''); setNewPkgCost(''); }}
                >
                  <Text style={styles.pkgCancelButtonText}>Ακύρωση</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pkgAddButton} onPress={addPackaging}>
                  <MaterialCommunityIcons name="check" size={18} color="#fff" />
                  <Text style={styles.pkgAddButtonText}>Προσθήκη</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addPackagingButton}
              onPress={() => setShowPackagingForm(true)}
              disabled={isLoading}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#4CAF50" />
              <Text style={styles.addPackagingButtonText}>
                {packagings.length === 0 ? 'Νέα Συσκευασία' : 'Προσθήκη Άλλης'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={isLoading}>
          <Text style={styles.cancelButtonText}>Ακύρωση</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Δημιουργία</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 120 },

  headerInfo: { alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#333', marginTop: 12 },
  headerSubtitle: { fontSize: 13, color: '#999', marginTop: 6, textAlign: 'center' },

  section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, elevation: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 12 },
  formGroup: { marginBottom: 18 },
  twoColRow: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  helpText: { fontSize: 11, color: '#888', marginTop: 4, fontStyle: 'italic' },

  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    color: '#333', backgroundColor: '#f9f9f9',
  },
  inputError: { borderColor: '#FF6B6B', backgroundColor: '#FFE3E3' },
  errorText: { fontSize: 12, color: '#FF6B6B', marginTop: 4 },

  // Read-only weight field
  inputReadOnly: {
    backgroundColor: '#F0F4F0', borderColor: '#C8E6C9',
    justifyContent: 'center',
  },
  inputReadOnlyText: { fontSize: 15, color: '#2E7D32', fontWeight: '600' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton: {
    width: '31%', borderWidth: 2, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', backgroundColor: '#f9f9f9',
  },
  categoryButtonActive: { borderColor: '#4CAF50', backgroundColor: '#E8F5E9' },
  categoryEmoji: { fontSize: 24, marginBottom: 4 },
  categoryLabel: { fontSize: 11, fontWeight: '500', color: '#666', textAlign: 'center' },
  categoryLabelActive: { color: '#2E7D32', fontWeight: '700' },

  // Templates
  templatesBox: {
    backgroundColor: '#FFF8E7', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#FFE0A0',
  },
  templatesLabel: { fontSize: 12, fontWeight: '600', color: '#8B6914', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#F5A623',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  chipAdded: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },
  chipText: { fontSize: 12, color: '#8B6914', fontWeight: '600' },
  chipTextAdded: { color: '#2E7D32' },

  // Packaging Card
  packagingCard: {
    flexDirection: 'row', backgroundColor: '#FAFAFA', borderRadius: 10,
    padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#4CAF50',
  },
  packagingInfo: { flex: 1 },
  packagingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  packagingName: { fontSize: 14, fontWeight: '700', color: '#333' },
  defaultBadge: { backgroundColor: '#FFA726', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  defaultBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  packagingDetail: { fontSize: 12, color: '#666', marginTop: 4 },
  packagingCost: { fontSize: 13, color: '#4CAF50', fontWeight: '600', marginTop: 2 },
  packagingActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { padding: 6 },

  addPackagingButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 2,
    borderColor: '#4CAF50', borderStyle: 'dashed', backgroundColor: '#E8F5E9', marginTop: 8,
  },
  addPackagingButtonText: { color: '#4CAF50', fontWeight: '700', fontSize: 14 },

  packagingForm: {
    backgroundColor: '#F0F7F0', borderRadius: 10, padding: 14,
    marginTop: 8, borderWidth: 1, borderColor: '#C8E6C9',
  },
  packagingFormActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  pkgCancelButton: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#ccc', alignItems: 'center',
  },
  pkgCancelButtonText: { color: '#666', fontWeight: '600' },
  pkgAddButton: {
    flex: 1, flexDirection: 'row', backgroundColor: '#4CAF50',
    paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  pkgAddButtonText: { color: '#fff', fontWeight: '700' },

  footer: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16,
    paddingVertical: 14, paddingBottom: 24,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingVertical: 13, alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600', color: '#666' },
  createButton: {
    flex: 1.5, flexDirection: 'row', backgroundColor: '#4CAF50',
    borderRadius: 8, paddingVertical: 13,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  createButtonDisabled: { opacity: 0.6 },
  createButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
