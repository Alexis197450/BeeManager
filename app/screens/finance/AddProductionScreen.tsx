import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../..//supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  unit_type: string;
  category: string;
}
interface Product {
  id: string;
  name: string;
  unit_type: string;// 'kg' | 'lt' | 'τεμ'
  category: string;
}

interface ProductionRecord {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  production_date: string;
  notes: string | null;
}

// ─── Helper: format date ──────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split('T')[0];

const formatDateGR = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AddProductionScreen({ navigation }: any) {
  // Form state
  const CATEGORIES = ['Μέλι', 'Πρόπολη', 'Γύρη', 'Βασιλικός Πολτός', 'Κερί', 'Άλλο'];
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
const filteredProducts = selectedCategory
  ? products.filter(p => p.category === selectedCategory)
  : [];
  // List state
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Fetch products ──────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, unit_type, category')
      .order('name');

    if (error) {
      console.error('fetchProducts error:', error.message);
      return;
    }
    setProducts(data ?? []);
  }, []);

  // ── Fetch production records ────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from('productions')
      .select(`
        id,
        product_id,
        quantity,
        unit,
        production_date,
        notes,
        products ( name )
      `)
      .order('production_date', { ascending: false })
      .limit(50);

    if (error) {
      console.error('fetchRecords error:', error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const mapped: ProductionRecord[] = (data ?? []).map((r: any) => ({
      id: r.id,
      product_id: r.product_id,
      product_name: r.products?.name ?? '—',
      quantity: r.quantity,
      unit: r.unit,
      production_date: r.production_date,
      notes: r.notes,
    }));

    setRecords(mapped);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchRecords();
  }, [fetchProducts, fetchRecords]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecords();
  };

  // ── Reset form ──────────────────────────────────────────────────────────────
  const resetForm = () => {
  setSelectedCategory(null);
  setSelectedProduct(null);
  setQuantity('');
  setDate(todayISO());
  setNotes('');
  setEditingId(null);
};
 

  // ── Load record into form for editing ───────────────────────────────────────
  const startEdit = (r: ProductionRecord) => {
  const prod = products.find(p => p.id === r.product_id) ?? null;
  setSelectedCategory(prod?.category ?? null); // ← πρόσθεσε αυτό
  setSelectedProduct(prod);
  setQuantity(String(r.quantity));
  setDate(r.production_date);
  setNotes(r.notes ?? '');
  setEditingId(r.id);
};

  // ── Save (insert or update) ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedProduct) {
      Alert.alert('Σφάλμα', 'Επίλεξε προϊόν.');
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Σφάλμα', 'Εισάγαγε έγκυρη ποσότητα.');
      return;
    }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Σφάλμα', 'Ημερομηνία σε μορφή ΕΕΕΕ-ΜΜ-ΗΗ.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

const payload = {
  user_id: user?.id,
  product_id: selectedProduct.id,
  quantity: qty,
  unit: selectedProduct.unit_type,
  production_date: date,
  notes: notes.trim() || null,
};

    let error;

    if (editingId) {
      ({ error } = await supabase
        .from('productions')
        .update(payload)
        .eq('id', editingId));
    } else {
      ({ error } = await supabase
        .from('productions')
        .insert(payload));
    }

    setSaving(false);

    if (error) {
      Alert.alert('Σφάλμα αποθήκευσης', error.message);
      return;
    }

    resetForm();
    fetchRecords();
    Alert.alert('✅ Επιτυχία', editingId ? 'Η παραγωγή ενημερώθηκε.' : 'Η παραγωγή καταχωρήθηκε.');
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = (id: string, productName: string) => {
    Alert.alert(
      'Διαγραφή παραγωγής',
      `Να διαγραφεί η καταχώρηση για "${productName}";`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('productions').delete().eq('id', id);
            if (error) {
              Alert.alert('Σφάλμα', error.message);
            } else {
              fetchRecords();
            }
          },
        },
      ]
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A623" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F5A623" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🏭 Καταχώρηση Παραγωγής</Text>
      </View>

      {/* ── FORM ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {editingId ? '✏️ Επεξεργασία Παραγωγής' : '➕ Νέα Παραγωγή'}
        </Text>

        {/* Επιλογή Προϊόντος */}
        {/* Βήμα 1: Κατηγορία */}
<Text style={styles.label}>Κατηγορία *</Text>
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
  {CATEGORIES.map(cat => (
    <TouchableOpacity
      key={cat}
      style={[styles.chip, selectedCategory === cat && styles.chipSelected]}
      onPress={() => {
        setSelectedCategory(cat);
        setSelectedProduct(null); // reset προϊόν όταν αλλάζει κατηγορία
      }}
    >
      <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextSelected]}>
        {cat}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

{/* Βήμα 2: Προϊόν — εμφανίζεται μόνο αν επιλέχθηκε κατηγορία */}
{selectedCategory && (
  <>
    <Text style={styles.label}>Προϊόν *</Text>
    {filteredProducts.length === 0 ? (
      <Text style={styles.emptyText}>Δεν υπάρχουν προϊόντα στην κατηγορία "{selectedCategory}"</Text>
    ) : (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
        {filteredProducts.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, selectedProduct?.id === p.id && styles.chipSelected]}
            onPress={() => setSelectedProduct(p)}
          >
            <Text style={[styles.chipText, selectedProduct?.id === p.id && styles.chipTextSelected]}>
              {p.name}
            </Text>
            <Text style={[styles.chipUnit, selectedProduct?.id === p.id && styles.chipTextSelected]}>
              {p.unit_type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    )}
  </>
)}

        {/* Ποσότητα */}
        <Text style={styles.label}>
          Ποσότητα {selectedProduct ? `(${selectedProduct.unit_type})` : ''} *
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="π.χ. 120"
            placeholderTextColor="#888"
            keyboardType="decimal-pad"
          />
          {selectedProduct && (
            <View style={styles.unitBadge}>
              <Text style={styles.unitBadgeText}>{selectedProduct.unit_type}</Text>
            </View>
          )}
        </View>

        {/* Ημερομηνία */}
        <Text style={styles.label}>Ημερομηνία (ΕΕΕΕ-ΜΜ-ΗΗ) *</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="2026-04-24"
          placeholderTextColor="#888"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        {/* Notes */}
        <Text style={styles.label}>Σημειώσεις</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="π.χ. Άριστη ποιότητα, 1ο τρύγημα"
          placeholderTextColor="#888"
          multiline
          numberOfLines={3}
        />

        {/* Buttons */}
        <View style={styles.formActions}>
          {editingId && (
            <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
              <Text style={styles.cancelBtnText}>Ακύρωση</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>
                {editingId ? '💾 Αποθήκευση' : '✅ Καταχώρηση'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── LIST ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>📋 Ιστορικό Παραγωγής</Text>

        {loading ? (
          <ActivityIndicator color="#F5A623" style={{ marginVertical: 20 }} />
        ) : records.length === 0 ? (
          <Text style={styles.emptyText}>Δεν υπάρχουν καταχωρήσεις ακόμα.</Text>
        ) : (
          records.map(r => (
            <View key={r.id} style={styles.recordRow}>
              <View style={styles.recordInfo}>
                <Text style={styles.recordProduct}>{r.product_name}</Text>
                <Text style={styles.recordMeta}>
                  {r.quantity} {r.unit} · {formatDateGR(r.production_date)}
                </Text>
                {r.notes ? (
                  <Text style={styles.recordNotes}>{r.notes}</Text>
                ) : null}
              </View>
              <View style={styles.recordActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => startEdit(r)}
                >
                  <Ionicons name="pencil-outline" size={16} color="#F5A623" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(r.id, r.product_name)}
                >
                  <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: 16, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#F5A623' },

  card: {
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#F5A623', marginBottom: 14 },

  label: { fontSize: 13, color: '#aaa', marginBottom: 6, marginTop: 10 },

  chipsRow: { marginBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f3460',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1a4a8a',
  },
  chipSelected: { backgroundColor: '#F5A623', borderColor: '#F5A623' },
  chipText: { fontSize: 13, color: '#ccc', fontWeight: '600' },
  chipUnit: { fontSize: 11, color: '#888', marginLeft: 4 },
  chipTextSelected: { color: '#1a1a2e' },

  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#0f3460',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1a4a8a',
    marginBottom: 2,
  },
  textArea: { height: 80, textAlignVertical: 'top' },

  unitBadge: {
    marginLeft: 10,
    backgroundColor: '#F5A623',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unitBadgeText: { color: '#1a1a2e', fontWeight: '700', fontSize: 13 },

  formActions: { flexDirection: 'row', marginTop: 16, gap: 10 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#F5A623',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#1a1a2e', fontWeight: '700', fontSize: 15 },
  cancelBtn: {
    flex: 0.5,
    backgroundColor: '#0f3460',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a4a8a',
  },
  cancelBtnText: { color: '#aaa', fontWeight: '600', fontSize: 14 },

  emptyText: { color: '#666', textAlign: 'center', paddingVertical: 20, fontSize: 13 },

  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  recordInfo: { flex: 1 },
  recordProduct: { fontSize: 14, fontWeight: '700', color: '#fff' },
  recordMeta: { fontSize: 12, color: '#F5A623', marginTop: 2 },
  recordNotes: { fontSize: 11, color: '#888', marginTop: 2, fontStyle: 'italic' },
  recordActions: { flexDirection: 'row', gap: 10, marginLeft: 10 },
  editBtn: { padding: 6 },
  deleteBtn: { padding: 6 },

  sqlNote: {
    backgroundColor: '#0f3460',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F5A623',
  },
  sqlNoteText: { color: '#aaa', fontSize: 12, lineHeight: 18 },
  sqlCode: { color: '#F5A623', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
