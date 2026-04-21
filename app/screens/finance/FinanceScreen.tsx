// ╔════════════════════════════════════════════════════════════════════╗
// ║                    Finance Screen (Main Dashboard)                 ║
// ║                    Activity-Based Costing View                    ║
// ║                         FIXED VERSION                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ⚠️ TEMPORARY IMPORTS - Will be available after integration
// import { useAuth } from '../contexts/AuthContext';
// import { costingService, dashboardService, ... } from '../services/financeService';
// import { CostBreakdown, Product } from '../types/beemanager_finance_types';

// For now: Mock imports to avoid errors
const useAuth = () => ({ user: { id: 'user-123' } });

// Type definitions (inline for now)
interface Product {
  id: string;
  user_id: string;
  name: string;
  unit_type: 'kg' | 'liters' | 'pieces' | 'gr';
  is_active: boolean;
}

interface CostBreakdown {
  productId: string;
  productName: string;
  quantityProduced: number;
  unit: string;
  summary: {
    unitCost: number;
    quantitySold: number;
    totalRevenue: number;
  };
}

interface DashboardState {
  year: number;
  selectedProductId?: string;
  isLoading: boolean;
  error?: string;
  summary?: any;
  products: Product[];
}

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────

const FinanceScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute();

  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'assets' | 'production' | 'sales'>('overview');
  const [state, setState] = useState<DashboardState>({
    year: new Date().getFullYear(),
    isLoading: false, // Set to false for now
    products: [
      // Mock data for UI testing
      {
        id: '1',
        user_id: 'user-123',
        name: 'Μέλι Ανθέων',
        unit_type: 'kg',
        is_active: true,
      },
      {
        id: '2',
        user_id: 'user-123',
        name: 'Μέλι Θυμαριού',
        unit_type: 'kg',
        is_active: true,
      },
    ],
  });
  const [desiredMarginPct, setDesiredMarginPct] = useState(30);

  // ──────────────────────────────────────────────────────────────────
  // Render: Empty State
  // ──────────────────────────────────────────────────────────────────

  if (state.isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Φόρτωση δεδομένων...</Text>
      </View>
    );
  }

  if (state.products.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="package-variant" size={64} color="#999" />
          <Text style={styles.emptyTitle}>Δεν έχετε προϊόντα ακόμα</Text>
          <Text style={styles.emptySubtitle}>Δημιουργήστε το πρώτο σας προϊόν για να ξεκινήσετε</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateProduct')}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Νέο Προϊόν</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────────
  // Render: Overview Tab
  // ──────────────────────────────────────────────────────────────────

  const renderOverviewTab = () => {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Year Selector */}
        <View style={styles.yearSelector}>
          <TouchableOpacity
            onPress={() => setState((prev) => ({ ...prev, year: prev.year - 1 }))}
            style={styles.yearButton}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color="#4CAF50" />
          </TouchableOpacity>
          <Text style={styles.yearText}>{state.year}</Text>
          <TouchableOpacity
            onPress={() => setState((prev) => ({ ...prev, year: prev.year + 1 }))}
            style={styles.yearButton}
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <MaterialCommunityIcons name="cash-minus" size={32} color="#FF6B6B" />
            <Text style={styles.summaryLabel}>Συνολικά Έξοδα</Text>
            <Text style={styles.summaryValue}>€0.00</Text>
          </View>

          <View style={styles.summaryCard}>
            <MaterialCommunityIcons name="cash-plus" size={32} color="#51CF66" />
            <Text style={styles.summaryLabel}>Συνολικά Έσοδα</Text>
            <Text style={styles.summaryValue}>€0.00</Text>
          </View>

          <View style={styles.summaryCard}>
            <MaterialCommunityIcons name="trending-up" size={32} color="#4CAF50" />
            <Text style={styles.summaryLabel}>Κέρδος</Text>
            <Text style={styles.summaryValue}>€0.00</Text>
          </View>

          <View style={styles.summaryCard}>
            <MaterialCommunityIcons name="percent" size={32} color="#FFD93D" />
            <Text style={styles.summaryLabel}>Περιθώριο</Text>
            <Text style={styles.summaryValue}>0.0%</Text>
          </View>
        </View>

        {/* Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🐝 Προϊόντα μου</Text>
          {state.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </View>

        {/* Info Box */}
        <InfoBox
          title="ℹ️ Σημαντικό"
          content="Αυτή η ενότητα θα δείξει την ανάλυση κόστους του κάθε προϊόντος με Activity-Based Costing (ABC)."
        />

        <View style={styles.spacer} />
      </ScrollView>
    );
  };

  // ──────────────────────────────────────────────────────────────────
  // Render: Expenses Tab
  // ──────────────────────────────────────────────────────────────────

  const renderExpensesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💰 Έξοδα Παραγωγής {state.year}</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddExpense', { year: state.year })}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <QuickExpenseButton
          label="Γρήγορο Έξοδο"
          icon="receipt"
          onPress={() => Alert.alert('Todo', 'QuickExpense screen να δημιουργηθεί')}
        />
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );

  // ──────────────────────────────────────────────────────────────────
  // Render: Assets Tab
  // ──────────────────────────────────────────────────────────────────

  const renderAssetsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏭 Πάγια Περιουσιακά</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddAsset')}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <InfoBox
          title="Πάγια Περιουσιακά"
          content="Προσθέστε τον εξοπλισμό σας εδώ. Το κόστος αποσβέσεως θα υπολογίζεται αυτόματα."
        />
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );

  // ──────────────────────────────────────────────────────────────────
  // Render: Production Tab
  // ──────────────────────────────────────────────────────────────────

  const renderProductionTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📈 Παραγωγή {state.year}</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddProduction', { year: state.year })}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <InfoBox
          title="Παραγωγή"
          content="Καταχωρήστε τις ποσότητες που παράγατε για κάθε προϊόν."
        />
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );

  // ──────────────────────────────────────────────────────────────────
  // Render: Sales Tab
  // ──────────────────────────────────────────────────────────────────

  const renderSalesTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>💳 Πωλήσεις {state.year}</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddSale', { year: state.year })}
          >
            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <InfoBox
          title="Πωλήσεις"
          content="Καταχωρήστε τις πωλήσεις σας με custom τιμή. Θα δείτε τις προτεινόμενες τιμές με βάση το επιθυμητό κέρδος."
        />
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );

  // ──────────────────────────────────────────────────────────────────
  // Main Render
  // ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        {['overview', 'expenses', 'assets', 'production', 'sales'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab && styles.tabLabelActive,
              ]}
            >
              {getTabLabel(tab)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'expenses' && renderExpensesTab()}
      {activeTab === 'assets' && renderAssetsTab()}
      {activeTab === 'production' && renderProductionTab()}
      {activeTab === 'sales' && renderSalesTab()}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────

function getTabLabel(tab: string): string {
  const labels: Record<string, string> = {
    overview: '📊 Σύνοψη',
    expenses: '💰 Έξοδα',
    assets: '🏭 Πάγια',
    production: '📈 Παραγ.',
    sales: '💳 Πωλήσεις',
  };
  return labels[tab] || tab;
}

interface ProductCardProps {
  product: Product;
}

function ProductCard({ product }: ProductCardProps) {
  return (
    <View style={styles.productCard}>
      <Text style={styles.productCardName}>{product.name}</Text>
      <Text style={styles.productCardUnit}>Μονάδα: {product.unit_type}</Text>
    </View>
  );
}

interface InfoBoxProps {
  title: string;
  content: string;
}

function InfoBox({ title, content }: InfoBoxProps) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoBoxTitle}>{title}</Text>
      <Text style={styles.infoBoxContent}>{content}</Text>
    </View>
  );
}

interface QuickExpenseButtonProps {
  label: string;
  icon: string;
  onPress: () => void;
}

function QuickExpenseButton({ label, icon, onPress }: QuickExpenseButtonProps) {
  return (
    <TouchableOpacity style={styles.quickExpenseButton} onPress={onPress}>
      <MaterialCommunityIcons name={icon as any} size={24} color="#4CAF50" />
      <Text style={styles.quickExpenseLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    color: '#333',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#4CAF50',
  },
  tabLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },

  // Tab Content
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Year Selector
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 8,
  },
  yearButton: {
    padding: 8,
  },
  yearText: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
    color: '#333',
  },

  // Summary Grid
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Product Card
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  productCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productCardUnit: {
    fontSize: 12,
    color: '#999',
  },

  // Quick Expense Button
  quickExpenseButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
  },
  quickExpenseLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 12,
  },

  // Info Box
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    marginBottom: 20,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoBoxContent: {
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 20,
  },

  // Spacer
  spacer: {
    height: 32,
  },
});

// ─────────────────────────────────────────────────────────────────────
// DEFAULT EXPORT
// ─────────────────────────────────────────────────────────────────────

export default FinanceScreen;