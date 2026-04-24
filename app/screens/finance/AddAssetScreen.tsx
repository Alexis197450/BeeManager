// ╔════════════════════════════════════════════════════════════════════╗
// ║                     AddAssetScreen.tsx                            ║
// ║              Διαχείριση Παγίων - BeeManager                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { assetsService, productsService } from '../../services/financeService';
import type { FixedAsset, Product } from '../../types/beemanager_finance_types';

// ─── ΚΑΤΗΓΟΡΙΕΣ ΠΑΓΙΩΝ ───────────────────────────────────────────────────
const ASSET_CATEGORIES = [
  { key: 'vehicles',    label: 'Οχήματα',         emoji: '🚛', rate: 14, life: 7  },
  { key: 'real_estate', label: 'Ακίνητα',          emoji: '🏠', rate:  4, life: 25 },
  { key: 'machinery',   label: 'Μηχανήματα',       emoji: '⚙️', rate: 10, life: 10 },
  { key: 'hives',       label: 'Κυψέλες & Συναφή', emoji: '🐝', rate: 17.5, life: 6 },
  { key: 'equipment',   label: 'Εξοπλισμός',       emoji: '🔧', rate: 10, life: 10 },
  { key: 'other',       label: 'Άλλο',             emoji: '📦', rate: 10, life: 10 },
] as const;

type AssetCategoryKey = typeof ASSET_CATEGORIES[number]['key'];

// ─── HELPERS ──────────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().split('T')[0];

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmtAmt = (n: number) =>
  n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const calcDepreciation = (totalCost: number, rate: number): number =>
  Math.round(totalCost * (rate / 100) * 100) / 100;

// ─── FORM ─────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  description: string;
  category: AssetCategoryKey;
  unit_cost: string;
  quantity: string;
  purchase_date: string;
  depreciation_rate: string;
  useful_life_years: string;
  is_custom_rate: boolean;
  allocation_type: 'shared' | 'direct_to_product';
  product_id: string;
}

const defaultRateFor = (cat: AssetCategoryKey): { rate: number; life: number } => {
  const found = ASSET_CATEGORIES.find((c) => c.key === cat);
  return { rate: found?.rate ?? 10, life: found?.life ?? 10 };
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  category: 'machinery',
  unit_cost: '',
  quantity: '1',
  purchase_date: todayISO(),
  depreciation_rate: '10',
  useful_life_years: '10',
  is_custom_rate: false,
  allocation_type: 'shared',
  product_id: '',
});

const assetToForm = (a: FixedAsset): FormState => ({
  name: a.name,
  description: a.description || '',
  category: a.category as AssetCategoryKey,
  unit_cost: String(a.unit_cost),
  quantity: String(a.quantity),
  purchase_date: a.purchase_date,
  depreciation_rate: String(a.depreciation_rate),
  useful_life_years: String(a.useful_life_years),
  is_custom_rate: a.is_custom_rate,
  allocation_type: a.allocation_type as 'shared' | 'direct_to_product',
  product_id: a.product_id || '',
});

// ─────────────────────────────────────────────────────────────────────────
export default function AddAssetScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Computed preview ──
  const unitCost = parseFloat(form.unit_cost.replace(',', '.')) || 0;
  const qty = parseInt(form.quantity) || 1;
  const totalCost = unitCost * qty;
  const deprRate = parseFloat(form.depreciation_rate.replace(',', '.')) || 10;
  const annualDepr = calcDepreciation(totalCost, deprRate);

  // ─── LOAD ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const [a, p] = await Promise.all([
        assetsService.getByUser(user.id),
        productsService.getAll(user.id),
      ]);
      setAssets(a);
      setProducts(p);
    } catch {
      Alert.alert('Σφάλμα', 'Αδυναμία φόρτωσης.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── CATEGORY CHANGE → auto-fill rate ─────────────────────────────────
  const handleCategoryChange = (cat: AssetCategoryKey) => {
    if (form.is_custom_rate) {
      setForm((f) => ({ ...f, category: cat }));
      return;
    }
    const { rate, life } = defaultRateFor(cat);
    setForm((f) => ({
      ...f,
      category: cat,
      depreciation_rate: String(rate),
      useful_life_years: String(life),
    }));
  };

  // ─── VALIDATE ─────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Εισάγετε όνομα παγίου';
    if (!form.unit_cost || unitCost <= 0) e.unit_cost = 'Εισάγετε έγκυρη αξία κτήσης';
    if (!form.purchase_date) e.purchase_date = 'Εισάγετε ημερομηνία αγοράς';
    if (form.allocation_type === 'direct_to_product' && !form.product_id)
      e.product_id = 'Επιλέξτε προϊόν';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─── SAVE ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate() || !user?.id) return;
    setIsSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        unit_cost: unitCost,
        quantity: qty,
        total_cost: totalCost,
        purchase_date: form.purchase_date,
        depreciation_rate: deprRate,
        useful_life_years: parseInt(form.useful_life_years) || 10,
        is_custom_rate: form.is_custom_rate,
        annual_depreciation: annualDepr,
        allocation_type: form.allocation_type,
        product_id: form.allocation_type === 'direct_to_product' ? form.product_id : undefined,
      };

      if (editingId) {
        await assetsService.delete(editingId);
        await assetsService.create(user.id, input);
      } else {
        await assetsService.create(user.id, input);
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      setErrors({});
      await loadData();
    } catch (err: any) {
      Alert.alert('❌ Σφάλμα', err.message || 'Αδυναμία αποθήκευσης.');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── DELETE ────────────────────────────────────────────────────────────
  const handleDelete = (asset: FixedAsset) => {
    const cat = ASSET_CATEGORIES.find((c) => c.key === asset.category);
    Alert.alert(
      '🗑️ Διαγραφή Παγίου',
      `Να διαγραφεί το "${asset.name}";`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            try {
              await assetsService.delete(asset.id);
              await loadData();
            } catch {
              Alert.alert('Σφάλμα', 'Αδυναμία διαγραφής.');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (asset: FixedAsset) => {
    setForm(assetToForm(asset));
    setEditingId(asset.id);
    setErrors({});
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setErrors({});
  };

  // ─── TOTALS ────────────────────────────────────────────────────────────
  const totalAssetValue = assets.reduce((s, a) => s + (a.total_cost || 0), 0);
  const totalAnnualDepr = assets.reduce((s, a) => s + (a.annual_depreciation || 0), 0);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F5A623" />
        <Text style={styles.loadingText}>Φόρτωση παγίων...</Text>
      </View>
    );
  }

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} tintColor="#F5A623" />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── SUMMARY ── */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryEmoji}>🏭</Text>
            <Text style={styles.summaryLabel}>Αξία Παγίων</Text>
            <Text style={styles.summaryValue}>€{fmtAmt(totalAssetValue)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryEmoji}>📉</Text>
            <Text style={styles.summaryLabel}>Ετήσια Απόσβεση</Text>
            <Text style={[styles.summaryValue, { color: '#E74C3C' }]}>€{fmtAmt(totalAnnualDepr)}</Text>
          </View>
        </View>

        {/* ── FORM ── */}
        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId ? '✏️ Επεξεργασία Παγίου' : '➕ Νέο Πάγιο'}
            </Text>

            {/* Κατηγορία */}
            <Text style={styles.label}>Κατηγορία *</Text>
            <View style={styles.catGrid}>
              {ASSET_CATEGORIES.map((c) => {
                const active = form.category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.catBtn, active && styles.catBtnActive]}
                    onPress={() => handleCategoryChange(c.key)}
                  >
                    <Text style={styles.catEmoji}>{c.emoji}</Text>
                    <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Όνομα */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Όνομα Παγίου *</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="π.χ. Μελιτοεξαγωγέας 9πλαίσιος"
                placeholderTextColor="#999"
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {/* Περιγραφή */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Περιγραφή (προαιρετικό)</Text>
              <TextInput
                style={styles.input}
                placeholder="π.χ. Αγορά από εταιρεία Χ"
                placeholderTextColor="#999"
                value={form.description}
                onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              />
            </View>

            {/* Αξία & Ποσότητα */}
            <View style={styles.twoCol}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Αξία Κτήσης (€) *</Text>
                <TextInput
                  style={[styles.input, errors.unit_cost && styles.inputError]}
                  placeholder="1500.00"
                  placeholderTextColor="#999"
                  value={form.unit_cost}
                  onChangeText={(t) => setForm((f) => ({ ...f, unit_cost: t }))}
                  keyboardType="decimal-pad"
                />
                {errors.unit_cost && <Text style={styles.errorText}>{errors.unit_cost}</Text>}
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.label}>Ποσότητα</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor="#999"
                  value={form.quantity}
                  onChangeText={(t) => setForm((f) => ({ ...f, quantity: t }))}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Ημερομηνία */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Ημερομηνία Αγοράς * (ΕΕΕΕ-ΜΜ-ΗΗ)</Text>
              <TextInput
                style={[styles.input, errors.purchase_date && styles.inputError]}
                placeholder="2026-04-24"
                placeholderTextColor="#999"
                value={form.purchase_date}
                onChangeText={(t) => setForm((f) => ({ ...f, purchase_date: t }))}
                keyboardType="numeric"
                maxLength={10}
              />
              {errors.purchase_date && <Text style={styles.errorText}>{errors.purchase_date}</Text>}
            </View>

            {/* Απόσβεση */}
            <View style={styles.deprBox}>
              <View style={styles.deprHeader}>
                <Text style={styles.label}>Συντελεστής Απόσβεσης</Text>
                <TouchableOpacity
                  style={styles.customToggle}
                  onPress={() => setForm((f) => ({ ...f, is_custom_rate: !f.is_custom_rate }))}
                >
                  <Text style={styles.customToggleText}>
                    {form.is_custom_rate ? '✓ Προσαρμοσμένος' : 'Χρήση προεπιλογής'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.twoCol}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.labelSmall}>Ετήσιος Συντελεστής (%)</Text>
                  <TextInput
                    style={[styles.input, !form.is_custom_rate && styles.inputReadOnly]}
                    value={form.depreciation_rate}
                    onChangeText={(t) => form.is_custom_rate && setForm((f) => ({ ...f, depreciation_rate: t }))}
                    editable={form.is_custom_rate}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.labelSmall}>Έτη Ζωής</Text>
                  <TextInput
                    style={[styles.input, !form.is_custom_rate && styles.inputReadOnly]}
                    value={form.useful_life_years}
                    onChangeText={(t) => form.is_custom_rate && setForm((f) => ({ ...f, useful_life_years: t }))}
                    editable={form.is_custom_rate}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {/* Preview υπολογισμού */}
              {totalCost > 0 && (
                <View style={styles.deprPreview}>
                  <Text style={styles.deprPreviewTitle}>📊 Υπολογισμός Απόσβεσης</Text>
                  <Text style={styles.deprPreviewRow}>
                    Συνολική Αξία: <Text style={styles.deprBold}>€{fmtAmt(totalCost)}</Text>
                  </Text>
                  <Text style={styles.deprPreviewRow}>
                    Τύπος: <Text style={styles.deprBold}>€{fmtAmt(totalCost)} × {deprRate}%</Text>
                  </Text>
                  <Text style={styles.deprPreviewRow}>
                    Ετήσια Απόσβεση: <Text style={[styles.deprBold, { color: '#E74C3C' }]}>€{fmtAmt(annualDepr)}</Text>
                  </Text>
                </View>
              )}
            </View>

            {/* Κατανομή */}
            <Text style={styles.label}>Κατανομή Κόστους</Text>
            <View style={styles.allocRow}>
              <TouchableOpacity
                style={[styles.allocBtn, form.allocation_type === 'shared' && styles.allocBtnActive]}
                onPress={() => setForm((f) => ({ ...f, allocation_type: 'shared', product_id: '' }))}
              >
                <Text style={[styles.allocText, form.allocation_type === 'shared' && styles.allocTextActive]}>
                  🔀 Κοινό Κόστος
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.allocBtn, form.allocation_type === 'direct_to_product' && styles.allocBtnActive]}
                onPress={() => setForm((f) => ({ ...f, allocation_type: 'direct_to_product' }))}
              >
                <Text style={[styles.allocText, form.allocation_type === 'direct_to_product' && styles.allocTextActive]}>
                  🎯 Σε Προϊόν
                </Text>
              </TouchableOpacity>
            </View>

            {form.allocation_type === 'direct_to_product' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Προϊόν *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.productChips}>
                    {products.map((p) => {
                      const active = form.product_id === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.productChip, active && styles.productChipActive]}
                          onPress={() => setForm((f) => ({ ...f, product_id: p.id }))}
                        >
                          <Text style={[styles.productChipText, active && styles.productChipTextActive]}>
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                {errors.product_id && <Text style={styles.errorText}>{errors.product_id}</Text>}
              </View>
            )}

            {/* Actions */}
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelForm} disabled={isSaving}>
                <Text style={styles.cancelBtnText}>Ακύρωση</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>{editingId ? 'Αποθήκευση' : 'Καταχώρηση'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={() => { setForm(emptyForm()); setShowForm(true); }}>
            <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#fff" />
            <Text style={styles.addBtnText}>Νέο Πάγιο</Text>
          </TouchableOpacity>
        )}

        {/* ── ΛΙΣΤΑ ΠΑΓΙΩΝ ── */}
        {assets.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🏭</Text>
            <Text style={styles.emptyText}>Δεν υπάρχουν καταχωρημένα πάγια</Text>
          </View>
        ) : (
          ASSET_CATEGORIES.filter((c) => assets.some((a) => a.category === c.key)).map((cat) => {
            const catAssets = assets.filter((a) => a.category === cat.key);
            const catDepr = catAssets.reduce((s, a) => s + (a.annual_depreciation || 0), 0);
            return (
              <View key={cat.key} style={styles.catSection}>
                <View style={styles.catSectionHeader}>
                  <Text style={styles.catSectionTitle}>{cat.emoji} {cat.label}</Text>
                  <Text style={styles.catSectionDepr}>Απόσβεση: €{fmtAmt(catDepr)}/έτος</Text>
                </View>
                {catAssets.map((asset) => {
                  const product = products.find((p) => p.id === asset.product_id);
                  return (
                    <View key={asset.id} style={styles.assetCard}>
                      <View style={styles.assetInfo}>
                        <Text style={styles.assetName}>{asset.name}</Text>
                        <Text style={styles.assetMeta}>
                          Αγορά: {fmtDate(asset.purchase_date)}
                          {asset.quantity > 1 ? ` · ×${asset.quantity}` : ''}
                          {asset.allocation_type === 'direct_to_product' && product
                            ? ` · 🎯 ${product.name}` : ' · 🔀 Κοινό'}
                        </Text>
                        <View style={styles.assetNumbers}>
                          <Text style={styles.assetNumberItem}>
                            💰 €{fmtAmt(asset.total_cost)}
                          </Text>
                          <Text style={styles.assetNumberSep}>·</Text>
                          <Text style={styles.assetNumberItem}>
                            📉 {asset.depreciation_rate}%
                          </Text>
                          <Text style={styles.assetNumberSep}>·</Text>
                          <Text style={[styles.assetNumberItem, { color: '#E74C3C' }]}>
                            €{fmtAmt(asset.annual_depreciation)}/έτος
                          </Text>
                        </View>
                      </View>
                      <View style={styles.assetActions}>
                        <TouchableOpacity
                          style={styles.assetActionBtn}
                          onPress={() => handleEdit(asset)}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={18} color="#F5A623" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.assetActionBtn}
                          onPress={() => handleDelete(asset)}
                        >
                          <MaterialCommunityIcons name="delete-outline" size={18} color="#E74C3C" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  scrollContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E7' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 14 },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', elevation: 2,
  },
  summaryEmoji: { fontSize: 22 },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 4 },
  summaryValue: { fontSize: 16, fontWeight: '800', color: '#2C3E50', marginTop: 2 },

  formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 12, elevation: 2 },
  formTitle: { fontSize: 17, fontWeight: '700', color: '#2C3E50', marginBottom: 16 },
  formGroup: { marginBottom: 16 },
  twoCol: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  labelSmall: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 6 },

  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#333', backgroundColor: '#f9f9f9',
  },
  inputError: { borderColor: '#E74C3C', backgroundColor: '#FFF0EE' },
  inputReadOnly: { backgroundColor: '#F0F0F0', color: '#888' },
  errorText: { fontSize: 12, color: '#E74C3C', marginTop: 4 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catBtn: {
    width: '30%', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#f9f9f9',
  },
  catBtnActive: { borderColor: '#F5A623', backgroundColor: '#FFF8E7' },
  catEmoji: { fontSize: 22, marginBottom: 4 },
  catLabel: { fontSize: 10, color: '#666', fontWeight: '500', textAlign: 'center' },
  catLabelActive: { color: '#C47A00', fontWeight: '700' },

  deprBox: {
    backgroundColor: '#FFF8E7', borderRadius: 10, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: '#FFE0A0',
  },
  deprHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  customToggle: {
    backgroundColor: '#F5A623', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  customToggleText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  deprPreview: {
    backgroundColor: '#fff', borderRadius: 8, padding: 10, marginTop: 8,
    borderWidth: 1, borderColor: '#FFE0A0',
  },
  deprPreviewTitle: { fontSize: 12, fontWeight: '700', color: '#8B6914', marginBottom: 6 },
  deprPreviewRow: { fontSize: 12, color: '#555', marginBottom: 2 },
  deprBold: { fontWeight: '700', color: '#2C3E50' },

  allocRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  allocBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#f9f9f9',
  },
  allocBtnActive: { borderColor: '#F5A623', backgroundColor: '#FFF8E7' },
  allocText: { fontSize: 13, color: '#666', fontWeight: '600' },
  allocTextActive: { color: '#C47A00' },

  productChips: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  productChip: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#f9f9f9',
  },
  productChipActive: { borderColor: '#F5A623', backgroundColor: '#FFF8E7' },
  productChipText: { fontSize: 13, color: '#555' },
  productChipTextActive: { color: '#C47A00', fontWeight: '700' },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: '#666', fontWeight: '600' },
  saveBtn: {
    flex: 1.5, flexDirection: 'row', backgroundColor: '#F5A623', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#F5A623', borderRadius: 12,
    paddingVertical: 14, marginBottom: 12, elevation: 2,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  emptyBox: {
    alignItems: 'center', paddingVertical: 40,
    backgroundColor: '#fff', borderRadius: 12, marginTop: 8,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: '#888', fontSize: 14 },

  catSection: { marginBottom: 12 },
  catSectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 4, marginBottom: 6,
  },
  catSectionTitle: { fontSize: 14, fontWeight: '700', color: '#2C3E50' },
  catSectionDepr: { fontSize: 12, color: '#E74C3C', fontWeight: '600' },

  assetCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12,
    padding: 12, marginBottom: 6, elevation: 1,
    borderLeftWidth: 3, borderLeftColor: '#F5A623',
  },
  assetInfo: { flex: 1 },
  assetName: { fontSize: 14, fontWeight: '700', color: '#2C3E50' },
  assetMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  assetNumbers: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  assetNumberItem: { fontSize: 12, color: '#555', fontWeight: '600' },
  assetNumberSep: { fontSize: 12, color: '#ccc' },
  assetActions: { justifyContent: 'center', gap: 4 },
  assetActionBtn: { padding: 6 },
});
