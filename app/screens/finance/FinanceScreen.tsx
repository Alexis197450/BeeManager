// ╔════════════════════════════════════════════════════════════════════╗
// ║                     FinanceScreen.tsx                             ║
// ║              Σύνοψη Οικονομικών - BeeManager                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService, productsService } from '../../services/financeService';

// ─── CATEGORY INFO ────────────────────────────────────────────────────────
const CATEGORY_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  honey:       { label: 'Μέλι',              emoji: '🍯', color: '#F5A623' },
  propolis:    { label: 'Πρόπολη',           emoji: '🟫', color: '#8B5E3C' },
  pollen:      { label: 'Γύρη',              emoji: '🌼', color: '#F9D342' },
  royal_jelly: { label: 'Βασιλικός Πολτός',  emoji: '👑', color: '#A86EAF' },
  wax:         { label: 'Κερί',              emoji: '🕯️', color: '#E8C84A' },
  other:       { label: 'Άλλο',              emoji: '📦', color: '#7F8C8D' },
};

export default function FinanceScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // ─── LOAD DATA ──────────────────────────────────────────────────────────
  const loadData = useCallback(async (showRefresh = false) => {
    if (!user?.id) return;
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await dashboardService.getSummaryForYear(user.id, year);
      setSummary(data);
    } catch (error: any) {
      Alert.alert('Σφάλμα', 'Αδυναμία φόρτωσης δεδομένων.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, year]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── GROUP PRODUCTS BY CATEGORY ─────────────────────────────────────────
  const groupedProducts = React.useMemo(() => {
    if (!summary?.products) return {};
    return summary.products.reduce((acc: any, p: any) => {
      const cat = p.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
  }, [summary]);

  const fmt = (n: number) =>
    n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ─── LOADING ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F5A623" />
        <Text style={styles.loadingText}>Φόρτωση δεδομένων...</Text>
      </View>
    );
  }

  const totals = summary?.totals || {};
  const expenseTotal = summary?.expenseSummary?.grandTotal || 0;
  const profit = (totals.revenue || 0) - expenseTotal;
  const isProfit = profit >= 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadData(true)} tintColor="#F5A623" />
      }
    >
      {/* ── YEAR SELECTOR ── */}
      <View style={styles.yearBar}>
        <TouchableOpacity onPress={() => setYear(y => y - 1)} style={styles.chevron}>
          <Text style={styles.chevronText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.yearText}>📅 {year}</Text>
        <TouchableOpacity
          onPress={() => setYear(y => y + 1)}
          style={styles.chevron}
          disabled={year >= currentYear}
        >
          <Text style={[styles.chevronText, year >= currentYear && { opacity: 0.3 }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── SUMMARY CARDS ── */}
      <View style={styles.cardsRow}>
  <View style={[styles.card, styles.cardBlue]}>
    <Text style={styles.cardEmoji}>💶</Text>
    <Text style={styles.cardLabel}>Πωλήσεις</Text>
    <Text style={styles.cardValue}>€{fmt(totals.revenue || 0)}</Text>
  </View>
  <View style={[styles.card, styles.cardRed]}>
    <Text style={styles.cardEmoji}>💸</Text>
    <Text style={styles.cardLabel}>Έξοδα</Text>
    <Text style={styles.cardValue}>€{fmt(expenseTotal)}</Text>
  </View>
</View>
      <View style={[styles.profitCard, isProfit ? styles.profitGreen : styles.profitRed]}>
        <Text style={styles.profitLabel}>{isProfit ? '📈 Καθαρό Κέρδος' : '📉 Ζημία'}</Text>
        <Text style={styles.profitValue}>€{fmt(Math.abs(profit))}</Text>
        {totals.revenue > 0 && (
          <Text style={styles.profitMargin}>
            Περιθώριο: {fmt(totals.marginPct || 0)}%
          </Text>
        )}
      </View>

      {/* ── ΚΑΤΗΓΟΡΙΕΣ ── */}
      <Text style={styles.sectionTitle}>Ανά Κατηγορία Προϊόντος</Text>

      {Object.keys(groupedProducts).length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={styles.emptyText}>Δεν υπάρχουν προϊόντα για το {year}</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('CreateProduct')}
          >
            <Text style={styles.addBtnText}>+ Νέο Προϊόν</Text>
          </TouchableOpacity>
        </View>
        
      ) : (
        Object.entries(groupedProducts).map(([cat, products]: any) => {
          const info = CATEGORY_INFO[cat] || CATEGORY_INFO.other;
          const catRevenue = products.reduce(
            (s: number, p: any) => s + (p.breakdown?.summary?.totalRevenue || 0), 0
          );
          const catCost = products.reduce(
            (s: number, p: any) => s + (p.breakdown?.summary?.totalCost || 0), 0
          );
          const catProfit = catRevenue - catCost;
          const isExpanded = expandedCategory === cat;

          return (
            <View key={cat} style={styles.categoryCard}>
              {/* Header */}
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => setExpandedCategory(isExpanded ? null : cat)}
              >
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryDot, { backgroundColor: info.color }]} />
                  <Text style={styles.categoryEmoji}>{info.emoji}</Text>
                  <Text style={styles.categoryLabel}>{info.label}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{products.length}</Text>
                  </View>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={[styles.categoryProfit, catProfit >= 0 ? styles.green : styles.red]}>
                    {catProfit >= 0 ? '+' : ''}€{fmt(catProfit)}
                  </Text>
                  <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                </View>
              </TouchableOpacity>

              {/* Expanded Products */}
              {isExpanded && (
                <View style={styles.productList}>
                  {products.map((p: any) => {
                    const bd = p.breakdown?.summary || {};
                    return (
                      <View key={p.id} style={styles.productRow}>
                        <View style={styles.productRowTop}>
                          <Text style={styles.productName}>{p.name}</Text>
                          <View style={styles.productRowActions}>
                            <TouchableOpacity
                              style={styles.productActionBtn}
                              onPress={() => navigation.navigate('CreateProduct', { editProduct: p })}
                            >
                              <Text style={styles.editIcon}>✏️</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.productActionBtn}
                              onPress={() =>
                                Alert.alert(
                                  '🗑️ Διαγραφή',
                                  `Να διαγραφεί το "${p.name}";`,
                                  [
                                    { text: 'Ακύρωση', style: 'cancel' },
                                    {
                                      text: 'Διαγραφή',
                                      style: 'destructive',
                                      onPress: async () => {
                                        try {
                                          await productsService.delete(p.id);
                                          loadData(true);
                                        } catch {
                                          Alert.alert('Σφάλμα', 'Αδυναμία διαγραφής.');
                                        }
                                      },
                                    },
                                  ]
                                )
                              }
                            >
                              <Text style={styles.deleteIcon}>🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.productStats}>
                          <Text style={styles.productStat}>💶 {fmt(bd.totalRevenue || 0)}</Text>
                          <Text style={styles.productStat}>💸 {fmt(bd.totalCost || 0)}</Text>
                          <Text style={[
                            styles.productStat,
                            (bd.totalRevenue - bd.totalCost) >= 0 ? styles.green : styles.red,
                          ]}>
                            📊 {fmt((bd.totalRevenue || 0) - (bd.totalCost || 0))}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* ── ACTION BUTTONS ── */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Ενέργειες</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#F5A623' }]}
            onPress={() => navigation.navigate('CreateProduct')}
          >
            <Text style={styles.actionEmoji}>📦</Text>
            <Text style={styles.actionLabel}>Νέο Προϊόν</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#E74C3C' }]}
            onPress={() => navigation.navigate('AddExpense', { year })}
          >
            <Text style={styles.actionEmoji}>💸</Text>
            <Text style={styles.actionLabel}>Νέο Έξοδο</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#27AE60' }]}
            onPress={() => navigation.navigate('AddProduction', { year })}
          >
            <Text style={styles.actionEmoji}>🍯</Text>
            <Text style={styles.actionLabel}>Παραγωγή</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#2980B9' }]}
            onPress={() => navigation.navigate('AddSale', { year })}
          >
            <Text style={styles.actionEmoji}>💳</Text>
            <Text style={styles.actionLabel}>Νέα Πώληση</Text>
          </TouchableOpacity>
          <TouchableOpacity
    style={[styles.actionBtn, { backgroundColor: '#8E44AD' }]}
    onPress={() => navigation.navigate('AddAsset')}
  >
    <Text style={styles.actionEmoji}>🏭</Text>
    <Text style={styles.actionLabel}>Πάγια</Text>
  </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF8E7' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 14 },

  // Year Bar
  yearBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0E0B0',
  },
  chevron: { paddingHorizontal: 20 },
  chevronText: { fontSize: 28, color: '#F5A623', fontWeight: '700' },
  yearText: { fontSize: 18, fontWeight: '700', color: '#2C3E50', minWidth: 100, textAlign: 'center' },

  // Summary Cards
  cardsRow: { flexDirection: 'row', padding: 12, gap: 10 },
  card: {
    flex: 1, borderRadius: 12, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  cardBlue: { backgroundColor: '#EAF4FB' },
  cardRed: { backgroundColor: '#FDEDEC' },
  cardEmoji: { fontSize: 22 },
  cardLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  cardValue: { fontSize: 18, fontWeight: '700', color: '#2C3E50', marginTop: 2 },

  // Profit Card
  profitCard: {
    marginHorizontal: 12, marginBottom: 12, borderRadius: 14, padding: 18,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  profitGreen: { backgroundColor: '#EAFAF1' },
  profitRed: { backgroundColor: '#FDEDEC' },
  profitLabel: { fontSize: 14, color: '#555', fontWeight: '600' },
  profitValue: { fontSize: 28, fontWeight: '800', color: '#2C3E50', marginTop: 4 },
  profitMargin: { fontSize: 12, color: '#888', marginTop: 4 },

  // Section Title
  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: '#2C3E50',
    marginHorizontal: 12, marginTop: 16, marginBottom: 8,
  },

  // Empty State
  emptyBox: {
    margin: 12, padding: 32, backgroundColor: '#fff', borderRadius: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#F0E0B0', borderStyle: 'dashed',
  },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: '#888', fontSize: 14, marginBottom: 16 },
  addBtn: {
    backgroundColor: '#F5A623', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Category Cards
  categoryCard: {
    marginHorizontal: 12, marginBottom: 10, backgroundColor: '#fff',
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14,
  },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryEmoji: { fontSize: 18 },
  categoryLabel: { fontSize: 15, fontWeight: '600', color: '#2C3E50' },
  badge: {
    backgroundColor: '#F0E6D3', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#8B5E3C' },
  categoryRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryProfit: { fontSize: 15, fontWeight: '700' },
  expandIcon: { fontSize: 12, color: '#999' },

  // Product List
  productList: { borderTopWidth: 1, borderTopColor: '#F5F0E8', paddingBottom: 8 },
  productRow: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F9F5EE',
  },
  productRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  productRowActions: { flexDirection: 'row', gap: 8 },
  productActionBtn: { padding: 4 },
  editIcon: { fontSize: 14 },
  deleteIcon: { fontSize: 14 },
  productName: { fontSize: 14, fontWeight: '600', color: '#2C3E50', flex: 1 },
  productStats: { flexDirection: 'row', gap: 12 },
  productStat: { fontSize: 12, color: '#666' },

  // Colors
  green: { color: '#27AE60' },
  red: { color: '#E74C3C' },

  // Actions
  actionsSection: { marginTop: 8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  actionBtn: {
    width: '47%', borderRadius: 12, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  actionEmoji: { fontSize: 26 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: '#fff', marginTop: 6 },
});
