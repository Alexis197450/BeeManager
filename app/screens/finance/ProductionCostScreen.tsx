// ╔════════════════════════════════════════════════════════════════════╗
// ║              ProductionCostScreen.tsx                              ║
// ║      Ανάλυση Κόστους Παραγωγής ΑΝΑ ΚΑΤΗΓΟΡΙΑ                     ║
// ║                SESSION 16 — REWRITE                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import {
  costingService,
  CategoryCostBreakdown,
} from '../../services/financeService';

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
  revenue:    'Βάσει εσόδων',
  production: 'Βάσει παραγωγής',
  equal:      'Ίση κατανομή',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, bold, color }: {
  label: string; value: string; bold?: boolean; color?: string;
}) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, bold && { fontWeight: '700', color: C.text }]}>{label}</Text>
      <Text style={[s.rowValue, bold && { fontWeight: '700' }, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

export default function ProductionCostScreen({ route }: any) {
  const { year } = route.params ?? { year: new Date().getFullYear() };
  const { user } = useAuth();

  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [breakdowns, setBreakdowns]     = useState<CategoryCostBreakdown[]>([]);
  const [selectedIdx, setSelectedIdx]   = useState(0);

  useEffect(() => {
    if (user) loadData();
  }, [user, year]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const bds = await costingService.getAllCategoryBreakdowns(user.id, year);
      setBreakdowns(bds);
      if (selectedIdx >= bds.length) setSelectedIdx(0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

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

  if (breakdowns.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyIcon}>📊</Text>
        <Text style={s.emptyTxt}>Δεν υπάρχουν προϊόντα. Πρόσθεσε πρώτα ένα προϊόν.</Text>
      </View>
    );
  }

  const bd = breakdowns[selectedIdx];

  // Σύνοψη όλων των κατηγοριών
  const totalCostAll    = breakdowns.reduce((s, b) => s + b.totalCost, 0);
  const totalRevenueAll = breakdowns.reduce((s, b) => s + b.totalRevenue, 0);
  const totalProfitAll  = totalRevenueAll - totalCostAll;
  const sharedTotal     = (bd?.sharedExpensesTotal || 0) + (bd?.sharedDepreciationTotal || 0);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
    >
      <Text style={s.yearBadge}>📅 Έτος {year}</Text>

      {/* ── Σύνοψη έτους ── */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>Σύνοψη Έτους</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Κοινά Έξοδα</Text>
            <Text style={s.summaryValue}>{euro(sharedTotal)}</Text>
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
      </View>

      {/* ── Επιλογή κατηγορίας (tabs) ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs}>
        {breakdowns.map((b, i) => (
          <TouchableOpacity
            key={b.category}
            style={[s.tab, selectedIdx === i && s.tabActive]}
            onPress={() => setSelectedIdx(i)}
            activeOpacity={0.8}
          >
            <Text style={s.tabEmoji}>{b.categoryEmoji}</Text>
            <Text style={[s.tabTxt, selectedIdx === i && s.tabTxtActive]}>
              {b.categoryLabel}
            </Text>
            {b.totalProduction > 0 && (
              <Text style={s.tabSub}>{b.totalProduction} {b.productionUnit}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Header κατηγορίας ── */}
      <View style={[s.card, s.categoryHeader]}>
        <Text style={s.categoryEmoji}>{bd.categoryEmoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.categoryName}>{bd.categoryLabel}</Text>
          <Text style={s.categoryMeta}>
            {bd.products.length} προϊόν{bd.products.length !== 1 ? 'τα' : ''}
            {bd.totalProduction > 0 ? ` · ${bd.totalProduction} ${bd.productionUnit}` : ''}
          </Text>
        </View>
        <View style={s.unitCostBadge}>
          <Text style={s.unitCostLabel}>Κόστος/{bd.productionUnit}</Text>
          <Text style={s.unitCostValue}>
            {bd.totalProduction > 0 ? euro(bd.unitCost) : '—'}
          </Text>
        </View>
      </View>

      {/* ── Άμεσα κόστη ── */}
      <Section title="🎯 Άμεσα Κόστη">
        <Row label="Άμεσα Έξοδα"       value={euro(bd.directExpenses)} />
        <Row label="Άμεσες Αποσβέσεις" value={euro(bd.directDepreciation)} />
        <Row label="Σύνολο Άμεσων"     value={euro(bd.directTotal)} bold />
      </Section>

      {/* ── Κοινά κόστη ── */}
      <Section title="🔗 Κατανεμημένα Κοινά Κόστη">
        <Row label="Κοινά Έξοδα (σύνολο)"  value={euro(bd.sharedExpensesTotal)} />
        <Row label="Κοινές Αποσβέσεις"     value={euro(bd.sharedDepreciationTotal)} />
        <Row
          label="% Κατανομής"
          value={`${bd.allocationPercentage.toFixed(1)}%`}
        />
        <View style={s.methodBadge}>
          <Text style={s.methodTxt}>
            Μέθοδος: {METHOD_LABELS[bd.allocationMethod] || bd.allocationMethod}
          </Text>
        </View>
        <Row label="Κατανεμημένο Ποσό" value={euro(bd.allocatedShared)} bold />
      </Section>

      {/* ── Σύνοψη κατηγορίας ── */}
      <Section title="📊 Σύνοψη">
        <Row label="Συνολικό Κόστος"   value={euro(bd.totalCost)} bold />
        <Row
          label={`Κόστος/${bd.productionUnit}`}
          value={bd.totalProduction > 0 ? `${euro(bd.unitCost)}/${bd.productionUnit}` : '—'}
          bold
          color={C.primaryDark}
        />
        <Row label="Συν. Έσοδα"       value={euro(bd.totalRevenue)} />
        <Row
          label="Μικτό Κέρδος"
          value={euro(bd.grossProfit)}
          bold
          color={bd.grossProfit >= 0 ? C.green : C.red}
        />
        <Row
          label="Περιθώριο"
          value={`${bd.grossMarginPct.toFixed(1)}%`}
          color={bd.grossMarginPct >= 20 ? C.green : C.red}
        />
      </Section>

      {/* ── Ενδεικτικές τιμές πώλησης ── */}
      {bd.unitCost > 0 && (
        <Section title="💡 Ενδεικτικές Τιμές Πώλησης">
          {[20, 30, 40].map(margin => {
            const price = bd.unitCost / (1 - margin / 100);
            return (
              <Row
                key={margin}
                label={`Με ${margin}% περιθώριο`}
                value={`${euro(price)}/${bd.productionUnit}`}
              />
            );
          })}
        </Section>
      )}

      {/* ── Ανάλυση ανά προϊόν ── */}
      {bd.productBreakdowns.length > 0 && (
        <Section title="📦 Προϊόντα Κατηγορίας">
          {bd.productBreakdowns.map((pb) => (
            <View key={pb.productId} style={s.productRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.productName}>{pb.productName}</Text>
                <Text style={s.productMeta}>
                  Παραγωγή: {pb.production} {bd.productionUnit}
                  {pb.revenue > 0 ? ` · Έσοδα: ${euro(pb.revenue)}` : ''}
                </Text>
              </View>
              <Text style={s.productCost}>
                {pb.production > 0 ? `${euro(pb.unitCost)}/${bd.productionUnit}` : '—'}
              </Text>
            </View>
          ))}
        </Section>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { padding: 16 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, gap: 12 },
  loadingTxt:{ color: C.textSub, marginTop: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTxt:  { color: C.textSub, textAlign: 'center', paddingHorizontal: 32 },

  yearBadge: { alignSelf: 'center', fontSize: 13, color: C.textSub, marginBottom: 12 },

  summaryCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  summaryTitle:{ fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 12 },
  summaryRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel:{ fontSize: 11, color: C.textSub, marginBottom: 4 },
  summaryValue:{ fontSize: 16, fontWeight: '800', color: C.text },

  tabs:      { marginBottom: 16 },
  tab:       { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card, marginRight: 8, alignItems: 'center', minWidth: 80 },
  tabActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  tabEmoji:  { fontSize: 22, marginBottom: 2 },
  tabTxt:    { fontSize: 12, color: C.textSub, fontWeight: '500' },
  tabTxtActive: { color: C.primaryDark, fontWeight: '700' },
  tabSub:    { fontSize: 10, color: C.textLight, marginTop: 2 },

  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },

  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryEmoji:  { fontSize: 40 },
  categoryName:   { fontSize: 18, fontWeight: '800', color: C.text },
  categoryMeta:   { fontSize: 12, color: C.textSub, marginTop: 3 },

  unitCostBadge: { backgroundColor: C.primaryLight, borderRadius: 12, padding: 10, alignItems: 'center' },
  unitCostLabel: { fontSize: 10, color: C.primaryDark, fontWeight: '600' },
  unitCostValue: { fontSize: 16, fontWeight: '800', color: C.primaryDark, marginTop: 2 },

  section:      { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 8 },

  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel:  { fontSize: 13, color: C.textSub, flex: 1 },
  rowValue:  { fontSize: 13, fontWeight: '600', color: C.text },

  methodBadge: { backgroundColor: C.blueLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginVertical: 4 },
  methodTxt:   { fontSize: 11, color: C.blue, fontWeight: '600' },

  productRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  productName: { fontSize: 13, fontWeight: '600', color: C.text },
  productMeta: { fontSize: 11, color: C.textSub, marginTop: 2 },
  productCost: { fontSize: 14, fontWeight: '700', color: C.primaryDark },
});