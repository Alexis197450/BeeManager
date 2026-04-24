// ╔════════════════════════════════════════════════════════════════════╗
// ║              BeeManager Finance Types                              ║
// ║            Activity-Based Costing (ABC) - Full Types              ║
// ║              UPDATED: Added ProductCategory                        ║
// ╚════════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────────────────────
// 1. PRODUCTS (με κατηγορίες)
// ─────────────────────────────────────────────────────────────────────
export type UnitType = 'kg' | 'liters' | 'ml' | 'pieces' | 'gr';

// ✅ NEW: Κατηγορίες προϊόντων μελισσοκομίας
export type ProductCategory = 
  | 'honey' 
  | 'propolis' 
  | 'pollen' 
  | 'royal_jelly' 
  | 'wax' 
  | 'other';

// ✅ NEW: Metadata για κάθε κατηγορία (auto unit selection)
export const CATEGORY_INFO: Record<ProductCategory, {
  label: string;
  emoji: string;
  defaultUnit: UnitType;
}> = {
  honey:       { label: 'Μέλι',             emoji: '🍯', defaultUnit: 'kg' },
  propolis:    { label: 'Πρόπολη',          emoji: '🟫', defaultUnit: 'gr' },
  pollen:      { label: 'Γύρη',             emoji: '🌼', defaultUnit: 'gr' },
  royal_jelly: { label: 'Βασιλικός Πολτός', emoji: '👑', defaultUnit: 'gr' },
  wax:         { label: 'Κερί',             emoji: '🕯️', defaultUnit: 'kg' },
  other:       { label: 'Άλλο',             emoji: '📦', defaultUnit: 'kg' },
};

export const CATEGORY_LIST: ProductCategory[] = [
  'honey', 'propolis', 'pollen', 'royal_jelly', 'wax', 'other',
];

export interface Product {
  id: string;
  user_id: string;
  
  name: string;
  description?: string;
  
  category: ProductCategory;       // ✅ NEW
  unit_type: UnitType;              // auto από κατηγορία
  density?: number;
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  category: ProductCategory;        // ✅ NEW
  unit_type: UnitType;
  density?: number;
}

// ─────────────────────────────────────────────────────────────────────
// 2. PACKAGING PRESETS
// ─────────────────────────────────────────────────────────────────────
export interface PackagingPreset {
  id: string;
  user_id: string;
  product_id: string;
  
  name: string;
  volume_ml?: number;
  weight_kg: number;
  
  cost_per_unit: number;
  is_default: boolean;
  
  created_at: string;
}

export interface CreatePackagingPresetInput {
  product_id: string;
  name: string;
  volume_ml?: number;
  weight_kg?: number;
  cost_per_unit: number;
  is_default?: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// 3. EXPENSES (Έξοδα Παραγωγής)
// ─────────────────────────────────────────────────────────────────────
export type ExpenseType = 
  | 'fuel' 
  | 'feed' 
  | 'labor' 
  | 'packaging' 
  | 'chemicals' 
  | 'maintenance' 
  | 'other';

export const EXPENSE_TYPE_INFO: Record<ExpenseType, { label: string; emoji: string }> = {
  fuel:        { label: 'Καύσιμα',      emoji: '⛽' },
  feed:        { label: 'Τροφή',        emoji: '🍯' },
  labor:       { label: 'Εργατικά',     emoji: '👷' },
  packaging:   { label: 'Συσκευασία',   emoji: '📦' },
  chemicals:   { label: 'Χημικά',       emoji: '🧪' },
  maintenance: { label: 'Συντήρηση',    emoji: '🔧' },
  other:       { label: 'Άλλο',         emoji: '➕' },
};

export type AllocationTypeExpense = 'shared' | 'direct_to_product';

export interface ExpenseProduction {
  id: string;
  user_id: string;
  
  year: number;
  type: ExpenseType;
  
  allocation_type: AllocationTypeExpense;
  product_id?: string;
  
  amount: number;
  date: string;
  notes?: string;
  
  created_at: string;
}

export interface CreateExpenseInput {
  year: number;
  type: ExpenseType;
  allocation_type: AllocationTypeExpense;
  product_id?: string;
  amount: number;
  date: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────
// 4. FIXED ASSETS
// ─────────────────────────────────────────────────────────────────────
export type AssetCategory = 'mechanical' | 'hives' | 'transport' | 'consumable';

export type AllocationTypeAsset = 'shared' | 'direct_to_product';

export interface FixedAsset {
  id: string;
  user_id: string;
  
  name: string;
  description?: string;
  
  category: AssetCategory;
  unit_cost: number;
  quantity: number;
  total_cost: number;
  
  purchase_date: string;
  
  depreciation_rate: number;
  is_custom_rate: boolean;
  useful_life_years: number;
  
  allocation_type: AllocationTypeAsset;
  product_id?: string;
  
  annual_depreciation: number;
  
  created_at: string;
}

export interface CreateFixedAssetInput {
  name: string;
  description?: string;
  category: AssetCategory;
  unit_cost: number;
  quantity?: number;
  purchase_date: string;
  depreciation_rate?: number;
  allocation_type: AllocationTypeAsset;
  product_id?: string;
}

// ─────────────────────────────────────────────────────────────────────
// 5. PRODUCTION LOGS
// ─────────────────────────────────────────────────────────────────────
export interface ProductionLog {
  id: string;
  user_id: string;
  product_id: string;
  
  year: number;
  quantity_produced: number;
  unit: UnitType;
  
  date: string;
  notes?: string;
  
  created_at: string;
  updated_at: string;
}

export interface CreateProductionLogInput {
  product_id: string;
  year: number;
  quantity_produced: number;
  unit: UnitType;
  date: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────
// 6. SALES
// ─────────────────────────────────────────────────────────────────────
export interface Sale {
  id: string;
  user_id: string;
  product_id: string;
  packaging_id?: string | null;

  quantity: number;
  unit_price: number;
  total_amount: number;

  sale_type: 'retail' | 'wholesale';
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_lat?: number | null;
  customer_lng?: number | null;

  sale_date: string;
  notes?: string | null;

  created_at: string;
  updated_at: string;
}

export interface CreateSaleInput {
  product_id: string;
  packaging_id?: string | null;
  quantity: number;
  unit_price: number;
  sale_type: 'retail' | 'wholesale';
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_lat?: number | null;
  customer_lng?: number | null;
  sale_date: string;
  notes?: string | null;
}
// ─────────────────────────────────────────────────────────────────────
// 7. REVENUE MIX ESTIMATE
// ─────────────────────────────────────────────────────────────────────
export interface RevenueMixEstimate {
  id: string;
  user_id: string;
  product_id: string;
  
  year: number;
  estimated_percentage: number;
  
  created_at: string;
  updated_at: string;
}

export interface CreateRevenueMixEstimateInput {
  product_id: string;
  year: number;
  estimated_percentage: number;
}

// ─────────────────────────────────────────────────────────────────────
// 8. FINANCE SUMMARY
// ─────────────────────────────────────────────────────────────────────
export interface FinanceSummary {
  id: string;
  user_id: string;
  product_id: string;
  year: number;
  
  total_quantity_produced: number;
  unit: UnitType;
  
  direct_expenses: number;
  direct_depreciation: number;
  direct_total: number;
  
  revenue_mix_percentage: number;
  shared_expenses_allocated: number;
  shared_depreciation_allocated: number;
  shared_total: number;
  
  total_cost: number;
  unit_cost: number;
  
  total_quantity_sold: number;
  total_revenue: number;
  
  gross_profit: number;
  gross_margin_pct: number;
  
  calculation_type: 'actual' | 'estimated';
  calculated_at: string;
}

// ─────────────────────────────────────────────────────────────────────
// 9. DEPRECIATION DEFAULTS
// ─────────────────────────────────────────────────────────────────────
export interface DepreciationDefault {
  id: number;
  category: AssetCategory;
  depreciation_rate: number;
  useful_life_years: number;
  description: string;
  examples: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────
// 10. COST BREAKDOWN
// ─────────────────────────────────────────────────────────────────────
export interface CostBreakdown {
  productId: string;
  productName: string;
  year: number;
  
  quantityProduced: number;
  unit: UnitType;
  
  directCosts: {
    expenses: number;
    depreciation: number;
    total: number;
  };
  
  sharedCosts: {
    expenses: number;
    depreciation: number;
    allocatedPercentage: number;
    total: number;
  };
  
  summary: {
    totalCost: number;
    unitCost: number;
    quantitySold: number;
    totalRevenue: number;
    grossProfit: number;
    grossMarginPct: number;
  };
}

// ─────────────────────────────────────────────────────────────────────
// 11. SUGGESTED PRICING
// ─────────────────────────────────────────────────────────────────────
export interface SuggestedPricing {
  unitCost: number;
  desiredMarginPct: number;
  
  suggestedPrice: number;
  withoutTax: number;
  withTax: number;
  
  breakdownNote: string;
}

// ─────────────────────────────────────────────────────────────────────
// 12. FINANCE DASHBOARD STATE
// ─────────────────────────────────────────────────────────────────────
export interface FinanceDashboardState {
  selectedYear: number;
  selectedProductId?: string;
  desiredMarginPct: number;
  
  showOnlyActiveProducts: boolean;
  
  products: Product[];
  expenses: ExpenseProduction[];
  assets: FixedAsset[];
  production: ProductionLog[];
  sales: Sale[];
  revenueMixEstimates: RevenueMixEstimate[];
  
  isLoading: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────
// 13. QUICK ENTRY
// ─────────────────────────────────────────────────────────────────────
export interface QuickExpenseEntry {
  type: ExpenseType;
  amount: number;
  date: string;
  notes?: string;
  photoUri?: string;
  
  allocation_type: AllocationTypeExpense;
  product_id?: string;
}

// ─────────────────────────────────────────────────────────────────────
// 14. EXPENSE SUMMARY BY CATEGORY
// ─────────────────────────────────────────────────────────────────────
export interface ExpenseSummaryByCategory {
  year: number;
  
  fuel: number;
  feed: number;
  labor: number;
  packaging: number;
  chemicals: number;
  maintenance: number;
  other: number;
  
  total: number;
  depreciation: number;
  grandTotal: number;
}

// ─────────────────────────────────────────────────────────────────────
// 15. ASSET INVENTORY
// ─────────────────────────────────────────────────────────────────────
export interface AssetInventory {
  assets: FixedAsset[];
  
  byCategory: {
    mechanical: FixedAsset[];
    hives: FixedAsset[];
    transport: FixedAsset[];
    consumable: FixedAsset[];
  };
  
  totalValue: number;
  totalAnnualDepreciation: number;
  
  directToProducts: {
    productId: string;
    assets: FixedAsset[];
    totalDepreciation: number;
  }[];
}

// ─────────────────────────────────────────────────────────────────────
// END OF TYPES
// ─────────────────────────────────────────────────────────────────────
