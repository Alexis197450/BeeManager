// app/screens/finance/ProductionCostScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import {
  costingService, productsService, expensesService, assetsService,
} from '../../services/financeService';
import { CostBreakdown, CATEGORY_INFO, Product } from '../../types/beemanager_finance_types';

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

  const [loading,    setLoading]    = useState(true);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [breakdowns, setBreakdowns] = useState<(CostBreakdown | null)[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [totalShared, setTotalShared] = useState(0);

  useEffect(() => {
    if (user) loadData();
  }, [user, year]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const prods = await productsService.getAll(user.id);
      setProducts(prods);

      const bds = await Promise.all(
        prods.map(p => costingService.getCostBreakdown(user.id, p.id, year))
      );
      setBreakdowns(bds);

      const expSum = await expensesService.summaryByCategory(user.id, year);
      setTotalShared(expSum.grandTotal);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={s.loadingTxt}>Υπολογισμός κόστους...</Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyIcon}>📊</Text>
        <Text style={s.emptyTxt}>Δεν υπάρχουν προϊόντα. Πρόσθεσε πρώτα ένα προϊόν.</Text>
      </View>
    );
  }

  const bd = breakdowns[selectedIdx];
  const product = products[selectedIdx];
  const catInfo = product ? CATEGORY_INFO[product.category] : null;

  // Σύνοψη όλων των προϊόντων
  const totalCostAll    = breakdowns.reduce((s, b) => s + (b?.summary.totalCost    ?? 0), 0);
  const totalRevenueAll = breakdowns.reduce((s, b) => s + (b?.summary.totalRevenue ?? 0), 0);
  const totalProfitAll  = totalRevenueAll - totalCostAll;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.yearBadge}>📅 Έτος {year}</Text>

      {/* Σύνοψη έτους */}
      <View style={s.summaryCard}>
        <Text style={s.summaryTitle}>Σύνοψη Έτους</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Κοινά Έξοδα</Text>
            <Text style={s.summaryValue}>{euro(totalShared)}</Text>
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

      {/* Επιλογή προϊόντος */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs}>
        {products.map((p, i) => {
          const ci = CATEGORY_INFO[p.category];
          return (
            <TouchableOpacity
              key={p.id}
              style={[s.tab, selectedIdx === i && s.tabActive]}
              onPress={() => setSelectedIdx(i)}
              activeOpacity={0.8}
            >
              <Text style={s.tabEmoji}>{ci.emoji}</Text>
              <Text style={[s.tabTxt, selectedIdx === i && s.tabTxtActive]}>{p.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Ανάλυση επιλεγμένου προϊόντος */}
      {!bd ? (
        <View style={s.card}>
          <Text style={s.noData}>Δεν υπάρχουν δεδομένα για {product?.name ?? '—'}</Text>
        </View>
      ) : (
        <>
          {/* Header προϊόντος */}
          <View style={[s.card, s.productHeader]}>
            <Text style={s.productEmoji}>{catInfo?.emoji ?? '📦'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.productName}>{bd.productName}</Text>
              <Text style={s.productUnit}>
                Παραγωγή: {bd.quantityProduced} {bd.unit}
              </Text>
            </View>
            <View style={s.unitCostBadge}>
              <Text style={s.unitCostLabel}>Κόστος/μονάδα</Text>
              <Text style={s.unitCostValue}>{euro(bd.summary.unitCost)}</Text>
            </View>
          </View>

          {/* Άμεσα κόστη */}
          <Section title="🎯 Άμεσα Κόστη">
            <Row label="Άμεσα Έξοδα"        value={euro(bd.directCosts.expenses)}     />
            <Row label="Άμεσες Αποσβέσεις"  value={euro(bd.directCosts.depreciation)} />
            <Row label="Σύνολο Άμεσων"      value={euro(bd.directCosts.total)} bold    />
          </Section>

          {/* Κοινά κόστη */}
          <Section title="🔗 Κατανεμημένα Κοινά Κόστη">
            <Row label="Κοινά Έξοδα (σύνολο)"    value={euro(bd.sharedCosts.expenses)}     />
            <Row label="Κοινές Αποσβέσεις"        value={euro(bd.sharedCosts.depreciation)} />
            <Row label="% Κατανομής"              value={`${bd.sharedCosts.allocatedPercentage.toFixed(1)}%`} />
            <Row label="Κατανεμημένο Ποσό"        value={euro(bd.sharedCosts.total)} bold />
          </Section>

          {/* Σύνοψη προϊόντος */}
          <Section title="📊 Σύνοψη">
            <Row label="Συνολικό Κόστος"    value={euro(bd.summary.totalCost)}    bold />
            <Row label="Κόστος/μονάδα"      value={`${euro(bd.summary.unitCost)}/${bd.unit}`} bold color={C.primaryDark} />
            <Row label="Ποσότητα Πωλήθηκε"  value={`${bd.summary.quantitySold} ${bd.unit}`}  />
            <Row label="Συν. Έσοδα"         value={euro(bd.summary.totalRevenue)} />
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
          </Section>

          {/* Τιμολόγηση */}
          {bd.summary.unitCost > 0 && (
            <Section title="💡 Ενδεικτικές Τιμές Πώλησης">
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
            </Section>
          )}
        </>
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

  tabs:    { marginBottom: 16 },
  tab:     { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card, marginRight: 8, alignItems: 'center' },
  tabActive:{ backgroundColor: C.primaryLight, borderColor: C.primary },
  tabEmoji: { fontSize: 18, marginBottom: 2 },
  tabTxt:   { fontSize: 12, color: C.textSub, fontWeight: '500' },
  tabTxtActive: { color: C.primaryDark, fontWeight: '700' },

  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  noData: { color: C.textLight, textAlign: 'center', paddingVertical: 20 },

  productHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productEmoji:  { fontSize: 36 },
  productName:   { fontSize: 17, fontWeight: '800', color: C.text },
  productUnit:   { fontSize: 13, color: C.textSub, marginTop: 2 },
  unitCostBadge: { backgroundColor: C.primaryLight, borderRadius: 12, padding: 10, alignItems: 'center' },
  unitCostLabel: { fontSize: 10, color: C.primaryDark, fontWeight: '600' },
  unitCostValue: { fontSize: 16, fontWeight: '800', color: C.primaryDark },

  section:      { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 8 },

  row:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel:  { fontSize: 13, color: C.textSub, flex: 1 },
  rowValue:  { fontSize: 13, fontWeight: '600', color: C.text },
});