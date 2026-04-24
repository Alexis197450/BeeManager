// ╔════════════════════════════════════════════════════════════════════╗
// ║                     AddExpenseScreen.tsx                          ║
// ║              Διαχείριση Εξόδων - BeeManager                       ║
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { expensesService, productsService } from '../../services/financeService';
import {
  EXPENSE_TYPE_INFO,
  type ExpenseType,
  type AllocationTypeExpense,
  type ExpenseProduction,
  type Product,
} from '../../types/beemanager_finance_types';

// ─── HELPERS ─────────────────────────────────────────────────────────────
const EXPENSE_TYPES = Object.keys(EXPENSE_TYPE_INFO) as ExpenseType[];

const todayISO = () => new Date().toISOString().split('T')[0];

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const fmtAmount = (n: number) =>
  n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── FORM STATE ───────────────────────────────────────────────────────────
interface FormState {
  type: ExpenseType;
  allocation_type: AllocationTypeExpense;
  product_id: string;
  amount: string;
  date: string;
  notes: string;
}

const emptyForm = (): FormState => ({
  type: 'fuel',
  allocation_type: 'shared',
  product_id: '',
  amount: '',
  date: todayISO(),
  notes: '',
});

const expenseToForm = (e: ExpenseProduction): FormState => ({
  type: e.type,
  allocation_type: e.allocation_type,
  product_id: e.product_id || '',
  amount: String(e.amount),
  date: e.date,
  notes: e.notes || '',
});

// ─────────────────────────────────────────────────────────────────────────
export default function AddExpenseScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const year: number = route.params?.year ?? new Date().getFullYear();

  // ── Data ──
  const [expenses, setExpenses] = useState<ExpenseProduction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Form ──
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Filter ──
  const [filterType, setFilterType] = useState<ExpenseType | 'all'>('all');

  // ─── LOAD DATA ────────────────────────────────────────────────────────
  const loadData = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const [exp, prod] = await Promise.all([
        expensesService.getByYear(user.id, year),
        productsService.getAll(user.id),
      ]);
      setExpenses(exp);
      setProducts(prod);
    } catch {
      Alert.alert('Σφάλμα', 'Αδυναμία φόρτωσης δεδομένων.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, year]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── VALIDATION ───────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    const amt = parseFloat(form.amount.replace(',', '.'));
    if (!form.amount || isNaN(amt) || amt <= 0) e.amount = 'Εισάγετε έγκυρο ποσό';
    if (!form.date) e.date = 'Εισάγετε ημερομηνία';
    if (form.allocation_type === 'direct_to_product' && !form.product_id)
      e.product_id = 'Επιλέξτε προϊόν';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ─── SAVE ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate() || !user?.id) return;
    setIsSaving(true);
    try {
      const input = {
        year,
        type: form.type,
        allocation_type: form.allocation_type,
        product_id: form.allocation_type === 'direct_to_product' ? form.product_id : undefined,
        amount: parseFloat(form.amount.replace(',', '.')),
        date: form.date,
        notes: form.notes.trim() || undefined,
      };

      if (editingId) {
        // Update: delete + re-create (no update method needed)
        await expensesService.delete(editingId);
        await expensesService.create(user.id, input);
      } else {
        await expensesService.create(user.id, input);
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

  // ─── DELETE ──────────────────────────────────────────────────────────
  const handleDelete = (expense: ExpenseProduction) => {
    const info = EXPENSE_TYPE_INFO[expense.type];
    Alert.alert(
      '🗑️ Διαγραφή',
      `Να διαγραφεί το έξοδο "${info.emoji} ${info.label}" €${fmtAmount(expense.amount)} (${fmtDate(expense.date)});`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            try {
              await expensesService.delete(expense.id);
              await loadData();
            } catch {
              Alert.alert('Σφάλμα', 'Αδυναμία διαγραφής.');
            }
          },
        },
      ]
    );
  };

  // ─── EDIT ────────────────────────────────────────────────────────────
  const handleEdit = (expense: ExpenseProduction) => {
    setForm(expenseToForm(expense));
    setEditingId(expense.id);
    setErrors({});
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setErrors({});
  };

  // ─── FILTERED EXPENSES ────────────────────────────────────────────────
  const filtered = filterType === 'all'
    ? expenses
    : expenses.filter((e) => e.type === filterType);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  // ─── LOADING ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F5A623" />
        <Text style={styles.loadingText}>Φόρτωση εξόδων...</Text>
      </View>
    );
  }

  // ─── RENDER ──────────────────────────────────────────────────────────
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

        {/* ── YEAR HEADER ── */}
        <View style={styles.yearHeader}>
          <Text style={styles.yearText}>📅 Έξοδα {year}</Text>
          <Text style={styles.yearTotal}>Σύνολο: €{fmtAmount(total)}</Text>
        </View>

        {/* ── FORM ── */}
        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId ? '✏️ Επεξεργασία Εξόδου' : '➕ Νέο Έξοδο'}
            </Text>

            {/* Τύπος εξόδου */}
            <Text style={styles.label}>Τύπος Εξόδου *</Text>
            <View style={styles.typeGrid}>
              {EXPENSE_TYPES.map((t) => {
                const info = EXPENSE_TYPE_INFO[t];
                const active = form.type === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, active && styles.typeBtnActive]}
                    onPress={() => setForm((f) => ({ ...f, type: t }))}
                  >
                    <Text style={styles.typeEmoji}>{info.emoji}</Text>
                    <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
                      {info.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Κατανομή */}
            <Text style={styles.label}>Κατανομή *</Text>
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
            <Text style={styles.helpText}>
              {form.allocation_type === 'shared'
                ? 'Το κόστος μοιράζεται σε όλα τα προϊόντα βάσει mix %'
                : 'Το κόστος αποδίδεται απευθείας σε ένα προϊόν'}
            </Text>

            {/* Επιλογή προϊόντος αν direct */}
            {form.allocation_type === 'direct_to_product' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Προϊόν *</Text>
                {products.length === 0 ? (
                  <Text style={styles.helpText}>Δεν υπάρχουν προϊόντα. Δημιουργήστε πρώτα ένα προϊόν.</Text>
                ) : (
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
                )}
                {errors.product_id && <Text style={styles.errorText}>{errors.product_id}</Text>}
              </View>
            )}

            {/* Ποσό */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Ποσό (€) *</Text>
              <TextInput
                style={[styles.input, errors.amount && styles.inputError]}
                placeholder="π.χ. 150.00"
                placeholderTextColor="#999"
                value={form.amount}
                onChangeText={(t) => setForm((f) => ({ ...f, amount: t }))}
                keyboardType="decimal-pad"
              />
              {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
            </View>

            {/* Ημερομηνία */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Ημερομηνία * (ΕΕΕΕ-ΜΜ-ΗΗ)</Text>
              <TextInput
                style={[styles.input, errors.date && styles.inputError]}
                placeholder="π.χ. 2026-04-24"
                placeholderTextColor="#999"
                value={form.date}
                onChangeText={(t) => setForm((f) => ({ ...f, date: t }))}
                keyboardType="numeric"
                maxLength={10}
              />
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>

            {/* Σημειώσεις */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Σημειώσεις (προαιρετικό)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="π.χ. Αγορά καυσίμων για μεταφορά κυψελών"
                placeholderTextColor="#999"
                value={form.notes}
                onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Actions */}
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelForm} disabled={isSaving}>
                <Text style={styles.cancelBtnText}>Ακύρωση</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
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
            <Text style={styles.addBtnText}>Νέο Έξοδο</Text>
          </TouchableOpacity>
        )}

        {/* ── FILTER CHIPS ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
              onPress={() => setFilterType('all')}
            >
              <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
                Όλα ({expenses.length})
              </Text>
            </TouchableOpacity>
            {EXPENSE_TYPES.filter((t) => expenses.some((e) => e.type === t)).map((t) => {
              const info = EXPENSE_TYPE_INFO[t];
              const count = expenses.filter((e) => e.type === t).length;
              const active = filterType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilterType(t)}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {info.emoji} {info.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* ── EXPENSE LIST ── */}
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyText}>Δεν υπάρχουν έξοδα για το {year}</Text>
          </View>
        ) : (
          filtered.map((expense) => {
            const info = EXPENSE_TYPE_INFO[expense.type];
            const product = products.find((p) => p.id === expense.product_id);
            return (
              <View key={expense.id} style={styles.expenseCard}>
                <View style={styles.expenseLeft}>
                  <View style={styles.expenseIconBox}>
                    <Text style={styles.expenseEmoji}>{info.emoji}</Text>
                  </View>
                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseType}>{info.label}</Text>
                    <Text style={styles.expenseMeta}>
                      {fmtDate(expense.date)}
                      {expense.allocation_type === 'direct_to_product' && product
                        ? ` · 🎯 ${product.name}`
                        : ' · 🔀 Κοινό'}
                    </Text>
                    {expense.notes ? (
                      <Text style={styles.expenseNotes} numberOfLines={1}>{expense.notes}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.expenseRight}>
                  <Text style={styles.expenseAmount}>€{fmtAmount(expense.amount)}</Text>
                  <View style={styles.expenseActions}>
                    <TouchableOpacity
                      style={styles.expenseActionBtn}
                      onPress={() => handleEdit(expense)}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={18} color="#F5A623" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.expenseActionBtn}
                      onPress={() => handleDelete(expense)}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={18} color="#E74C3C" />
                    </TouchableOpacity>
                  </View>
                </View>
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

  yearHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12,
    elevation: 2,
  },
  yearText: { fontSize: 16, fontWeight: '700', color: '#2C3E50' },
  yearTotal: { fontSize: 15, fontWeight: '700', color: '#E74C3C' },

  // Form
  formCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 18,
    marginBottom: 12, elevation: 2,
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: '#2C3E50', marginBottom: 16 },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  helpText: { fontSize: 11, color: '#888', marginTop: 4, fontStyle: 'italic' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    color: '#333', backgroundColor: '#f9f9f9',
  },
  inputError: { borderColor: '#E74C3C', backgroundColor: '#FFF0EE' },
  errorText: { fontSize: 12, color: '#E74C3C', marginTop: 4 },
  notesInput: { height: 80, textAlignVertical: 'top', paddingTop: 10 },

  // Type grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn: {
    width: '30%', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#f9f9f9',
  },
  typeBtnActive: { borderColor: '#F5A623', backgroundColor: '#FFF8E7' },
  typeEmoji: { fontSize: 22, marginBottom: 4 },
  typeLabel: { fontSize: 11, color: '#666', fontWeight: '500' },
  typeLabelActive: { color: '#C47A00', fontWeight: '700' },

  // Allocation
  allocRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  allocBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#f9f9f9',
  },
  allocBtnActive: { borderColor: '#F5A623', backgroundColor: '#FFF8E7' },
  allocText: { fontSize: 13, color: '#666', fontWeight: '600' },
  allocTextActive: { color: '#C47A00' },

  // Product chips
  productChips: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  productChip: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#f9f9f9',
  },
  productChipActive: { borderColor: '#F5A623', backgroundColor: '#FFF8E7' },
  productChipText: { fontSize: 13, color: '#555' },
  productChipTextActive: { color: '#C47A00', fontWeight: '700' },

  // Form actions
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
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Add button
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#F5A623', borderRadius: 12,
    paddingVertical: 14, marginBottom: 12, elevation: 2,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Filter
  filterScroll: { marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  filterChip: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#fff',
  },
  filterChipActive: { borderColor: '#F5A623', backgroundColor: '#FFF8E7' },
  filterChipText: { fontSize: 12, color: '#555' },
  filterChipTextActive: { color: '#C47A00', fontWeight: '700' },

  // Empty
  emptyBox: {
    alignItems: 'center', paddingVertical: 40, backgroundColor: '#fff',
    borderRadius: 12, marginTop: 8,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: '#888', fontSize: 14 },

  // Expense Card
  expenseCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    marginBottom: 8, elevation: 1, borderLeftWidth: 3, borderLeftColor: '#F5A623',
  },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  expenseIconBox: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FFF8E7', alignItems: 'center', justifyContent: 'center',
  },
  expenseEmoji: { fontSize: 20 },
  expenseInfo: { flex: 1 },
  expenseType: { fontSize: 14, fontWeight: '700', color: '#2C3E50' },
  expenseMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  expenseNotes: { fontSize: 11, color: '#AAA', marginTop: 2, fontStyle: 'italic' },
  expenseRight: { alignItems: 'flex-end', gap: 4 },
  expenseAmount: { fontSize: 16, fontWeight: '800', color: '#E74C3C' },
  expenseActions: { flexDirection: 'row', gap: 4 },
  expenseActionBtn: { padding: 4 },
});
