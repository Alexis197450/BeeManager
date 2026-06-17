// ╔════════════════════════════════════════════════════════════════════╗
// ║              ProductionCostScreen.tsx                              ║
// ║    Ανάλυση Κόστους — Προϊόντα ομαδοποιημένα ανά κατηγορία         ║
// ║              SESSION 16 FIX — FAST + FALLBACK                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import {
  costingService,
  ProductBreakdownResult,
  AllBreakdownsResult,
} from '../../services/financeService';
import { CATEGORY_INFO, ProductCategory } from '../../types/beemanager_finance_types';

const C = {
  primary: '#F59E0B', primaryDark: '#D97706', primaryLight: '#FEF3C7',
  bg: '#FFFBF0', card: '#FFFFFF', border: '#E5E7EB',
  text: '#111827', textSub: '#6B7280', textLight: '#9CA3AF',
  green: '#16A34A', greenLight: '#DCFCE7',
  red: '#DC2626', redLight: '#FEE2E2',
  blue: '#2563EB', blueLight: '#DBEAFE',
};

function euro(n: number): string {
  return `€${n.toFixed(2)}`;
}

const METHOD_LABELS: Record<string, string> = {
  revenue:    'βάσει εσόδων',
  production: 'βάσει παραγωγής',
  equal:      'ίση κατανομή',
};

function Row({ label, value, bold, color }: {
  label: string; value: string; bold?: boolean; color?: string;
}) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, bold && s.rowLabelBold]}>{label}</Text>
      <Text style={[s.rowValue, bold && { fontWeight: '700' }, color ? { color } : {}]}>
        {value}
      </Text>
    </View>
  );
}

// ── Κατηγορία + τα προϊόντα της ──
interface CategoryGroup {
  category: ProductCategory;
  label: string;
  emoji: string;
  items: ProductBreakdownResult[];
  totalCost: number;
  totalRevenue: number;
  totalProduction: number;
}

function groupByCategory(breakdowns: ProductBreakdownResult[]): CategoryGroup[] {
  const map: Record<string, ProductBreakdownResult[]> = {};

  breakdowns.forEach(bd => {
    if (!map[bd.category]) map[bd.category] = [];
    map[bd.category].push(bd);
  });

  return Object.entries(map).map(([cat, items]) => {
    const catInfo = CATEGORY_INFO[cat as ProductCategory]
      || { label: cat, emoji: '📦', defaultUnit: 'kg' };
    return {
      category: cat as ProductCategory,
      label: catInfo.label,
      emoji: catInfo.emoji,
      items,
      totalCost: items.reduce((s, i) => s + i.summary.totalCost, 0),
      totalRevenue: items.reduce((s, i) => s + i.summary.totalRevenue, 0),
      totalProduction: items.reduce((s, i) => s + i.quantityProduced, 0),
    };
  }).sort((a, b) => b.totalCost - a.totalCost); // μεγαλύτερο κόστος πρώτα
}


export default function ProductionCostScreen({ route }: any) {
  const { year } = route.params ?? { year: new Date().getFullYear() };
  const { user } = useAuth();

  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult]         = useState<AllBreakdownsResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const res = await costingService.getAllBreakdowns(user.id, year);
      setResult(res);
    } catch (e) {
      console.error('[ProductionCost] load error:', e);
    }
  }, [user, year]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadingTxt}>Υπολογισμός κόστους...</Text>
      </View>
    );
  }

  if (!result || result.breakdowns.length === 0) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 48 }}>📊</Text>
        <Text style={s.emptyTxt}>Δεν υπάρχουν προϊόντα. Πρόσθεσε πρώτα ένα προϊόν.</Text>
      </View>
    );
  }

  const { breakdowns, allocationMethod, sharedExpensesTotal, sharedDepreciationTotal } = result;
  const groups = groupByCategory(breakdowns);
  const sharedPool = sharedExpensesTotal + sharedDepreciationTotal;

  const totalCostAll    = breakdowns.reduce((s, b) => s + b.summary.totalCost, 0);
  const totalRevenueAll = breakdowns.reduce((s, b) => s + b.summary.totalRevenue, 0);
  const totalProfitAll  = totalRevenueAll - totalCostAll;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />
      }
    >
      <Text style={s.yearBadge}>📅 Έτος {year}</Text>

      {/* ── Σύνοψη ── */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>Σύνοψη Έτους</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Κοινά Έξοδα</Text>
            <Text style={s.summaryValue}>{euro(sharedPool)}</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Συν. Έσοδα</Text>
            <Text style={[s.summaryValue, { color: C.green }]}>{euro(totalRevenueAll)}</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Κέρδος</Text>
            <Text style={[s.summaryValue, { color: totalProfitAll >= 0 ? C.green : C.red }]}>
              {euro(totalProfitAll)}
            </Text>
          </View>
        </View>
        <View style={s.methodBadge}>
          <Text style={s.methodTxt}>
            Κατανομή: {METHOD_LABELS[allocationMethod] || allocationMethod}
          </Text>
        </View>
      </View>

      {/* ── Κατηγορίες + Προϊόντα ── */}
      {groups.map(group => (
        <View key={group.category} style={s.categorySection}>

          {/* Category Header */}
          <View style={s.categoryHeader}>
            <Text style={s.categoryEmoji}>{group.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.categoryName}>{group.label}</Text>
              <Text style={s.categoryMeta}>
                {group.items.length} προϊόν{group.items.length !== 1 ? 'τα' : ''}
                {group.totalProduction > 0 ? ` · ${group.totalProduction} ${group.items[0]?.unit || ''}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.categoryCost}>{euro(group.totalCost)}</Text>
              {group.totalRevenue > 0 && (
                <Text style={[s.categoryMeta, { color: C.green }]}>
                  +{euro(group.totalRevenue)}
                </Text>
              )}
            </View>
          </View>

          {/* Products */}
          {group.items.map(bd => {
            const isExpanded = expandedId === bd.productId;

            return (
              <View key={bd.productId}>
                {/* Product row — tap to expand */}
                <TouchableOpacity
                  style={s.productCard}
                  onPress={() => setExpandedId(isExpanded ? null : bd.productId)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.productName}>{bd.productName}</Text>
                    <Text style={s.productMeta}>
                      {bd.quantityProduced > 0
                        ? `${bd.quantityProduced} ${bd.unit}`
                        : 'Χωρίς παραγωγή'}
                      {bd.summary.totalRevenue > 0
                        ? ` · Έσοδα ${euro(bd.summary.totalRevenue)}`
                        : ''}
                    </Text>
                  </View>
                  <View style={s.productRight}>
                    <Text style={s.productUnitCost}>
                      {bd.summary.unitCost > 0
                        ? `${euro(bd.summary.unitCost)}/${bd.unit}`
                        : '—'}
                    </Text>
                    <Text style={s.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded breakdown */}
                {isExpanded && (
                  <View style={s.expandedBox}>

                    <Text style={s.miniHeader}>🎯 Άμεσα Κόστη</Text>
                    <Row label="Άμεσα Έξοδα"       value={euro(bd.directCosts.expenses)} />
                    <Row label="Άμεσες Αποσβέσεις" value={euro(bd.directCosts.depreciation)} />
                    <Row label="Σύνολο Άμεσων"     value={euro(bd.directCosts.total)} bold />

                    <Text style={[s.miniHeader, { marginTop: 12 }]}>🔗 Κοινά Κόστη</Text>
                    <Row label="Κοινά Έξοδα"       value={euro(bd.sharedCosts.expenses)} />
                    <Row label="Κοινές Αποσβέσεις" value={euro(bd.sharedCosts.depreciation)} />
                    <Row
                      label="% Κατανομής"
                      value={`${bd.sharedCosts.allocatedPercentage.toFixed(1)}%`}
                    />
                    <Row label="Κατανεμημένο"       value={euro(bd.sharedCosts.total)} bold />

                    <Text style={[s.miniHeader, { marginTop: 12 }]}>📊 Σύνοψη</Text>
                    <Row label="Συνολικό Κόστος"  value={euro(bd.summary.totalCost)} bold />
                    <Row
                      label={`Κόστος/${bd.unit}`}
                      value={bd.summary.unitCost > 0 ? euro(bd.summary.unitCost) : '—'}
                      bold
                      color={C.primaryDark}
                    />
                    <Row label="Ποσ. Πωλήθηκε"   value={`${bd.summary.quantitySold} ${bd.unit}`} />
                    <Row label="Έσοδα"            value={euro(bd.summary.totalRevenue)} />
                    <Row
                      label="Μικτό Κέρδος"
                      value={euro(bd.summary.grossProfit)}
                      bold
                      color={bd.summary.grossProfit >= 0 ? C.green : C.red}
                    />
                    <Row
                      label="Περιθώριο"
                      value={`${bd.summary.grossMarginPct.toFixed(1)}%`}
                      color={bd.summary.grossMarginPct >= 20 ? C.green : C.red}
                    />

                    {/* Ενδεικτικές τιμές */}
                    {bd.summary.unitCost > 0 && (
                      <>
                        <Text style={[s.miniHeader, { marginTop: 12 }]}>💡 Ενδεικτικές Τιμές</Text>
                        {[20, 30, 40].map(margin => {
                          const price = bd.summary.unitCost / (1 - margin / 100);
                          return (
                            <Row
                              key={margin}
                              label={`Με ${margin}% περιθώριο`}
                              value={`${euro(price)}/${bd.unit}`}
                            />
                          );
                        })}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 16 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, gap: 12 },
  loadingTxt:{ color: C.textSub, marginTop: 8 },
  emptyTxt:  { color: C.textSub, textAlign: 'center', paddingHorizontal: 32 },

  yearBadge: { alignSelf: 'center', fontSize: 13, color: C.textSub, marginBottom: 12 },

  // Σύνοψη
  summaryCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  summaryTitle:{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel:{ fontSize: 11, color: C.textSub, marginBottom: 4 },
  summaryValue:{ fontSize: 16, fontWeight: '800', color: C.text },

  methodBadge: {
    backgroundColor: C.blueLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'center', marginTop: 10,
  },
  methodTxt: { fontSize: 11, color: C.blue, fontWeight: '600' },

  // Κατηγορία
  categorySection: { marginBottom: 16 },
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.primaryLight, borderRadius: 14,
    padding: 14, marginBottom: 4,
  },
  categoryEmoji: { fontSize: 28 },
  categoryName:  { fontSize: 15, fontWeight: '800', color: C.text },
  categoryMeta:  { fontSize: 11, color: C.textSub, marginTop: 2 },
  categoryCost:  { fontSize: 14, fontWeight: '700', color: C.primaryDark },

  // Προϊόν
  productCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 12,
    padding: 14, marginTop: 4, elevation: 1,
    borderLeftWidth: 3, borderLeftColor: C.primary,
  },
  productName:  { fontSize: 14, fontWeight: '600', color: C.text },
  productMeta:  { fontSize: 11, color: C.textSub, marginTop: 2 },
  productRight: { alignItems: 'flex-end', marginLeft: 8 },
  productUnitCost: { fontSize: 14, fontWeight: '700', color: C.primaryDark },
  expandIcon:   { fontSize: 10, color: C.textLight, marginTop: 4 },

  // Expanded
  expandedBox: {
    backgroundColor: '#FEFCE8', borderRadius: 12,
    padding: 14, marginTop: 2, marginLeft: 8,
    borderLeftWidth: 2, borderLeftColor: C.primary,
  },
  miniHeader: {
    fontSize: 12, fontWeight: '700', color: C.text, marginBottom: 6,
    paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: C.border,
  },

  // Row
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel:     { fontSize: 12, color: C.textSub, flex: 1 },
  rowLabelBold: { fontWeight: '700', color: C.text },
  rowValue:     { fontSize: 12, fontWeight: '600', color: C.text },
});