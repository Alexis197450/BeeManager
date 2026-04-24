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
import * as Location from 'expo-location';
import { supabase } from '../../supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  unit_type: string;
  category: string;
}

interface Packaging {
  id: string;
  name: string;
  volume_ml: number;
  weight_kg: number;
  cost: number;
}

interface SaleRecord {
  id: string;
  product_id: string;
  product_name: string;
  packaging_name: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  sale_type: 'retail' | 'wholesale';
  customer_name: string | null;
  customer_phone: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  sale_date: string;
  notes: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['Μέλι', 'Πρόπολη', 'Γύρη', 'Βασιλικός Πολτός', 'Κερί', 'Άλλο'];

const CATEGORY_EMOJI: Record<string, string> = {
  'Μέλι': '🍯',
  'Πρόπολη': '🟫',
  'Γύρη': '🌼',
  'Βασιλικός Πολτός': '👑',
  'Κερί': '🕯️',
  'Άλλο': '📦',
};

const todayISO = () => new Date().toISOString().split('T')[0];

const formatDateGR = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const formatEuro = (n: number) =>
  n.toLocaleString('el-GR', { style: 'currency', currency: 'EUR' });

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AddSaleScreen({ navigation, route }: any) {
  // Form — Προϊόν
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form — Συσκευασία
  const [packagings, setPackagings] = useState<Packaging[]>([]);
  const [selectedPackaging, setSelectedPackaging] = useState<Packaging | null>(null);

  // Form — Ποσότητα & Τιμή
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  // Form — Πελάτης
  const [saleType, setSaleType] = useState<'retail' | 'wholesale'>('retail');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Form — Γενικά
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');

  // State
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Computed ────────────────────────────────────────────────────────────────
  const qty = parseFloat(quantity) || 0;
  const price = parseFloat(unitPrice) || 0;
  const total = qty * price;

  const filteredProducts = selectedCategory
    ? products.filter(p => p.category === selectedCategory)
    : [];

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, unit_type, category')
      .order('name');
    if (!error) setProducts(data ?? []);
  }, []);

  const fetchPackagings = useCallback(async (productId: string) => {
    const { data, error } = await supabase
      .from('packaging_presets')
      .select('id, name, volume_ml, weight_kg, cost')
      .eq('product_id', productId)
      .order('volume_ml');
    if (!error) setPackagings(data ?? []);
  }, []);

  const fetchRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, product_id, quantity, unit_price, total_amount,
        sale_type, customer_name, customer_phone,
        customer_lat, customer_lng, sale_date, notes,
        products ( name ),
        packaging_presets ( name )
      `)
      .order('sale_date', { ascending: false })
      .limit(50);

    if (error) {
      console.error('fetchRecords error:', error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const mapped: SaleRecord[] = (data ?? []).map((r: any) => ({
      id: r.id,
      product_id: r.product_id,
      product_name: r.products?.name ?? '—',
      packaging_name: r.packaging_presets?.name ?? null,
      quantity: r.quantity,
      unit_price: r.unit_price,
      total_amount: qty * price,
      sale_type: r.sale_type,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      customer_lat: r.customer_lat,
      customer_lng: r.customer_lng,
      sale_date: r.sale_date,
      notes: r.notes,
    }));

    setRecords(mapped);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchRecords();
  }, []);

  useEffect(() => {
    if (selectedProduct) fetchPackagings(selectedProduct.id);
    else setPackagings([]);
  }, [selectedProduct]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecords();
  };

  // ── GPS ─────────────────────────────────────────────────────────────────────
  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Άρνηση πρόσβασης', 'Δεν δόθηκε άδεια τοποθεσίας.');
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCustomerLat(loc.coords.latitude);
      setCustomerLng(loc.coords.longitude);
      Alert.alert('✅ GPS', `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
    } catch (e) {
      Alert.alert('Σφάλμα GPS', 'Δεν ήταν δυνατή η λήψη τοποθεσίας.');
    }
    setGpsLoading(false);
  };

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetForm = () => {
    setSelectedCategory(null);
    setSelectedProduct(null);
    setSelectedPackaging(null);
    setQuantity('');
    setUnitPrice('');
    setSaleType('retail');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerLat(null);
    setCustomerLng(null);
    setDate(todayISO());
    setNotes('');
    setEditingId(null);
  };

  // ── Edit ────────────────────────────────────────────────────────────────────
  const startEdit = (r: SaleRecord) => {
    const prod = products.find(p => p.id === r.product_id) ?? null;
    setSelectedCategory(prod?.category ?? null);
    setSelectedProduct(prod);
    setQuantity(String(r.quantity));
    setUnitPrice(String(r.unit_price));
    setSaleType(r.sale_type);
    setCustomerName(r.customer_name ?? '');
    setCustomerPhone(r.customer_phone ?? '');
    setCustomerLat(r.customer_lat);
    setCustomerLng(r.customer_lng);
    setDate(r.sale_date);
    setNotes(r.notes ?? '');
    setEditingId(r.id);
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedProduct) {
      Alert.alert('Σφάλμα', 'Επίλεξε προϊόν.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Σφάλμα', 'Εισάγαγε έγκυρη ποσότητα.');
      return;
    }
    if (isNaN(price) || price < 0) {
      Alert.alert('Σφάλμα', 'Εισάγαγε έγκυρη τιμή.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const payload: any = {
      user_id: user?.id,
      product_id: selectedProduct.id,
      packaging_id: selectedPackaging?.id ?? null,
      quantity: qty,
      unit_price: price,
      sale_type: saleType,
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      customer_lat: customerLat,
      customer_lng: customerLng,
      sale_date: date,
      notes: notes.trim() || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('sales').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('sales').insert(payload));
    }

    setSaving(false);

    if (error) {
      Alert.alert('Σφάλμα αποθήκευσης', error.message);
      return;
    }

    resetForm();
    fetchRecords();
    Alert.alert('✅ Επιτυχία', editingId ? 'Η πώληση ενημερώθηκε.' : 'Η πώληση καταχωρήθηκε.');
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = (id: string, productName: string) => {
    Alert.alert(
      'Διαγραφή πώλησης',
      `Να διαγραφεί η πώληση "${productName}";`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Διαγραφή',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('sales').delete().eq('id', id);
            if (error) Alert.alert('Σφάλμα', error.message);
            else fetchRecords();
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
        <Text style={styles.headerTitle}>💳 Καταχώρηση Πώλησης</Text>
      </View>

      {/* ── FORM ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {editingId ? '✏️ Επεξεργασία Πώλησης' : '➕ Νέα Πώληση'}
        </Text>

        {/* Βήμα 1: Κατηγορία */}
        <Text style={styles.label}>Κατηγορία *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipSelected]}
              onPress={() => {
                setSelectedCategory(cat);
                setSelectedProduct(null);
                setSelectedPackaging(null);
              }}
            >
              <Text style={styles.chipEmoji}>{CATEGORY_EMOJI[cat]}</Text>
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextSelected]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Βήμα 2: Προϊόν */}
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
                    onPress={() => {
                      setSelectedProduct(p);
                      setSelectedPackaging(null);
                    }}
                  >
                    <Text style={[styles.chipText, selectedProduct?.id === p.id && styles.chipTextSelected]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* Βήμα 3: Συσκευασία */}
        {selectedProduct && (
          <>
            <Text style={styles.label}>Συσκευασία</Text>
            {packagings.length === 0 ? (
              <Text style={styles.emptyText}>Δεν υπάρχουν συσκευασίες για αυτό το προϊόν.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
                {packagings.map(pkg => (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[styles.chip, selectedPackaging?.id === pkg.id && styles.chipSelected]}
                    onPress={() => setSelectedPackaging(pkg)}
                  >
                    <Text style={[styles.chipText, selectedPackaging?.id === pkg.id && styles.chipTextSelected]}>
                      {pkg.name}
                    </Text>
                    <Text style={[styles.chipUnit, selectedPackaging?.id === pkg.id && styles.chipTextSelected]}>
                      {pkg.volume_ml}ml
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* Ποσότητα & Τιμή */}
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>Τεμάχια *</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              placeholder="π.χ. 10"
              placeholderTextColor="#888"
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Τιμή/τεμάχιο (€) *</Text>
            <TextInput
              style={styles.input}
              value={unitPrice}
              onChangeText={setUnitPrice}
              placeholder="π.χ. 8.50"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Σύνολο */}
        {qty > 0 && price > 0 && (
          <View style={styles.totalBadge}>
            <Text style={styles.totalLabel}>Σύνολο</Text>
            <Text style={styles.totalAmount}>{formatEuro(total)}</Text>
          </View>
        )}

        {/* Κανάλι Πώλησης */}
        <Text style={styles.label}>Κανάλι Πώλησης</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, saleType === 'retail' && styles.toggleBtnActive]}
            onPress={() => setSaleType('retail')}
          >
            <Text style={[styles.toggleText, saleType === 'retail' && styles.toggleTextActive]}>
              🛒 Λιανική
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, saleType === 'wholesale' && styles.toggleBtnActive]}
            onPress={() => setSaleType('wholesale')}
          >
            <Text style={[styles.toggleText, saleType === 'wholesale' && styles.toggleTextActive]}>
              🏭 Χονδρική
            </Text>
          </TouchableOpacity>
        </View>

        {/* Πελάτης */}
        <Text style={styles.label}>Ονοματεπώνυμο Πελάτη</Text>
        <TextInput
          style={styles.input}
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="π.χ. Γιώργος Παπαδόπουλος"
          placeholderTextColor="#888"
        />

        <Text style={styles.label}>Τηλέφωνο</Text>
        <TextInput
          style={styles.input}
          value={customerPhone}
          onChangeText={setCustomerPhone}
          placeholder="π.χ. 6901234567"
          placeholderTextColor="#888"
          keyboardType="phone-pad"
        />

        {/* GPS */}
        <Text style={styles.label}>Τοποθεσία Πελάτη</Text>
        <TouchableOpacity style={styles.gpsBtn} onPress={captureGPS} disabled={gpsLoading}>
          {gpsLoading ? (
            <ActivityIndicator color="#F5A623" size="small" />
          ) : (
            <>
              <Ionicons name="location-outline" size={18} color="#F5A623" />
              <Text style={styles.gpsBtnText}>
                {customerLat
                  ? `📍 ${customerLat.toFixed(4)}, ${customerLng?.toFixed(4)}`
                  : 'Λήψη GPS τοποθεσίας'}
              </Text>
            </>
          )}
        </TouchableOpacity>
        {customerLat && (
          <TouchableOpacity onPress={() => { setCustomerLat(null); setCustomerLng(null); }}>
            <Text style={styles.clearGps}>✕ Καθαρισμός GPS</Text>
          </TouchableOpacity>
        )}

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
          placeholder="π.χ. Παράδοση στο σπίτι"
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
        <Text style={styles.sectionTitle}>📋 Ιστορικό Πωλήσεων</Text>

        {loading ? (
          <ActivityIndicator color="#F5A623" style={{ marginVertical: 20 }} />
        ) : records.length === 0 ? (
          <Text style={styles.emptyText}>Δεν υπάρχουν καταχωρήσεις ακόμα.</Text>
        ) : (
          records.map(r => (
            <View key={r.id} style={styles.recordRow}>
              <View style={styles.recordInfo}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordProduct}>{r.product_name}</Text>
                  <View style={[styles.typeBadge, r.sale_type === 'wholesale' && styles.typeBadgeWholesale]}>
                    <Text style={styles.typeBadgeText}>
                      {r.sale_type === 'retail' ? 'Λιανική' : 'Χονδρική'}
                    </Text>
                  </View>
                </View>
                {r.packaging_name && (
                  <Text style={styles.recordPackaging}>📦 {r.packaging_name}</Text>
                )}
                <Text style={styles.recordMeta}>
                  {r.quantity} τεμ. × {formatEuro(r.unit_price)} = <Text style={styles.recordTotal}>{formatEuro(r.total_amount ?? r.quantity * r.unit_price)}</Text>
                </Text>
                {r.customer_name && (
                  <Text style={styles.recordCustomer}>
                    👤 {r.customer_name}{r.customer_phone ? ` · ${r.customer_phone}` : ''}
                    {r.customer_lat ? ' · 📍' : ''}
                  </Text>
                )}
                <Text style={styles.recordDate}>{formatDateGR(r.sale_date)}</Text>
              </View>
              <View style={styles.recordActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(r)}>
                  <Ionicons name="pencil-outline" size={16} color="#F5A623" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(r.id, r.product_name)}>
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
  chipEmoji: { fontSize: 14, marginRight: 4 },
  chipText: { fontSize: 13, color: '#ccc', fontWeight: '600' },
  chipUnit: { fontSize: 11, color: '#888', marginLeft: 4 },
  chipTextSelected: { color: '#1a1a2e' },

  row: { flexDirection: 'row', marginTop: 4 },
  input: {
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

  totalBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f3460',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#F5A623',
  },
  totalLabel: { color: '#aaa', fontSize: 13 },
  totalAmount: { color: '#F5A623', fontSize: 18, fontWeight: '800' },

  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0f3460',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a4a8a',
  },
  toggleBtnActive: { backgroundColor: '#F5A623', borderColor: '#F5A623' },
  toggleText: { color: '#aaa', fontWeight: '600', fontSize: 14 },
  toggleTextActive: { color: '#1a1a2e' },

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f3460',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1a4a8a',
    gap: 8,
  },
  gpsBtnText: { color: '#F5A623', fontSize: 13, fontWeight: '600' },
  clearGps: { color: '#e74c3c', fontSize: 12, marginTop: 4, marginLeft: 4 },

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

  emptyText: { color: '#666', textAlign: 'center', paddingVertical: 12, fontSize: 13 },

  recordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0f3460',
  },
  recordInfo: { flex: 1 },
  recordHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordProduct: { fontSize: 14, fontWeight: '700', color: '#fff' },
  typeBadge: {
    backgroundColor: '#27AE60',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeWholesale: { backgroundColor: '#2980B9' },
  typeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  recordPackaging: { fontSize: 12, color: '#aaa', marginTop: 2 },
  recordMeta: { fontSize: 12, color: '#ccc', marginTop: 2 },
  recordTotal: { color: '#F5A623', fontWeight: '700' },
  recordCustomer: { fontSize: 11, color: '#888', marginTop: 2 },
  recordDate: { fontSize: 11, color: '#666', marginTop: 2 },
  recordActions: { flexDirection: 'row', gap: 10, marginLeft: 10 },
  editBtn: { padding: 6 },
  deleteBtn: { padding: 6 },
});