// ╔════════════════════════════════════════════════════════════════════╗
// ║              BeeManager Finance Types                              ║
// ║            Activity-Based Costing (ABC) - Full Types              ║
// ╚════════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────────────────────
// 1. PRODUCTS
// ─────────────────────────────────────────────────────────────────────
export type UnitType = 'kg' | 'liters' | 'pieces' | 'gr';

export interface Product {
  id: string;
  user_id: string;
  
  name: string;
  description?: string;
  
  unit_type: UnitType;
  density?: number; // 1.43 (μέλι), 1.10 (πρόπολη), etc.
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
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
  
  name: string; // "500ml βάζο", "1kg κουτί"
  volume_ml?: number;
  weight_kg: number;
  
  cost_per_unit: number; // €
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

export type AllocationTypeExpense = 'shared' | 'direct_to_product';

export interface ExpenseProduction {
  id: string;
  user_id: string;
  
  year: number;
  type: ExpenseType;
  
  allocation_type: AllocationTypeExpense;
  product_id?: string; // nullable, only if direct_to_product
  
  amount: number; // €
  date: string; // YYYY-MM-DD
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
// 4. FIXED ASSETS (Πάγια Περιουσιακά)
// ─────────────────────────────────────────────────────────────────────
export type AssetCategory = 'mechanical' | 'hives' | 'transport' | 'consumable';

export type AllocationTypeAsset = 'shared' | 'direct_to_product';

export interface FixedAsset {
  id: string;
  user_id: string;
  
  name: string;
  description?: string;
  
  category: AssetCategory;
  unit_cost: number; // €
  quantity: number;
  total_cost: number; // calculated
  
  purchase_date: string; // YYYY-MM-DD
  
  depreciation_rate: number; // 10, 17.5, 13.5, 40 (%)
  is_custom_rate: boolean;
  useful_life_years: number;
  
  allocation_type: AllocationTypeAsset;
  product_id?: string; // nullable, only if direct_to_product
  
  annual_depreciation: number; // calculated €
  
  created_at: string;
}

export interface CreateFixedAssetInput {
  name: string;
  description?: string;
  category: AssetCategory;
  unit_cost: number;
  quantity?: number;
  purchase_date: string;
  
  depreciation_rate?: number; // override default
  
  allocation_type: AllocationTypeAsset;
  product_id?: string;
}

// ─────────────────────────────────────────────────────────────────────
// 5. PRODUCTION LOGS (Παραγωγή)
// ─────────────────────────────────────────────────────────────────────
export interface ProductionLog {
  id: string;
  user_id: string;
  product_id: string;
  
  year: number;
  quantity_produced: number;
  unit: UnitType;
  
  date: string; // YYYY-MM-DD
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
// 6. SALES (Πωλήσεις)
// ─────────────────────────────────────────────────────────────────────
export interface Sale {
  id: string;
  user_id: string;
  product_id: string;
  
  year: number;
  quantity_sold: number;
  custom_sale_price: number; // € (user-defined)
  total_revenue: number; // calculated
  
  date: string; // YYYY-MM-DD
  notes?: string;
  
  created_at: string;
  updated_at: string;
}

export interface CreateSaleInput {
  product_id: string;
  year: number;
  quantity_sold: number;
  custom_sale_price: number;
  date: string;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────
// 7. REVENUE MIX ESTIMATE
// ─────────────────────────────────────────────────────────────────────
export interface RevenueMixEstimate {
  id: string;
  user_id: string;
  product_id: string;
  
  year: number;
  estimated_percentage: number; // 0-100
  
  created_at: string;
  updated_at: string;
}

export interface CreateRevenueMixEstimateInput {
  product_id: string;
  year: number;
  estimated_percentage: number;
}

// ─────────────────────────────────────────────────────────────────────
// 8. FINANCE SUMMARY (Calculated Results)
// ─────────────────────────────────────────────────────────────────────
export interface FinanceSummary {
  id: string;
  user_id: string;
  product_id: string;
  year: number;
  
  // Production
  total_quantity_produced: number;
  unit: UnitType;
  
  // Direct Costs
  direct_expenses: number;
  direct_depreciation: number;
  direct_total: number;
  
  // Shared Costs
  revenue_mix_percentage: number; // 0-100
  shared_expenses_allocated: number;
  shared_depreciation_allocated: number;
  shared_total: number;
  
  // Total
  total_cost: number;
  unit_cost: number; // €/kg or €/L
  
  // Sales
  total_quantity_sold: number;
  total_revenue: number;
  
  // Margins
  gross_profit: number;
  gross_margin_pct: number;
  
  // Metadata
  calculation_type: 'actual' | 'estimated';
  calculated_at: string;
}

// ─────────────────────────────────────────────────────────────────────
// 9. DEPRECIATION DEFAULTS
// ─────────────────────────────────────────────────────────────────────
export interface DepreciationDefault {
  id: number;
  category: AssetCategory;
  depreciation_rate: number; // %
  useful_life_years: number;
  description: string;
  examples: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────
// 10. COST BREAKDOWN (for display)
// ─────────────────────────────────────────────────────────────────────
export interface CostBreakdown {
  productId: string;
  productName: string;
  year: number;
  
  // Production
  quantityProduced: number;
  unit: UnitType;
  
  // Costs
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
  withTax: number; // +19% ΦΠΑ
  
  breakdownNote: string;
  // "Με 30% margin, η τιμή θα πρέπει να είναι τουλάχιστον 3,60€/kg"
}

// ─────────────────────────────────────────────────────────────────────
// 12. FINANCE DASHBOARD STATE
// ─────────────────────────────────────────────────────────────────────
export interface FinanceDashboardState {
  selectedYear: number;
  selectedProductId?: string;
  desiredMarginPct: number; // for pricing calculator
  
  // Filters
  showOnlyActiveProducts: boolean;
  
  // Cached data
  products: Product[];
  expenses: ExpenseProduction[];
  assets: FixedAsset[];
  production: ProductionLog[];
  sales: Sale[];
  revenueMixEstimates: RevenueMixEstimate[];
  
  // Loading
  isLoading: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────
// 13. QUICK ENTRY (Fast expense logging)
// ─────────────────────────────────────────────────────────────────────
export interface QuickExpenseEntry {
  type: ExpenseType;
  amount: number;
  date: string;
  notes?: string;
  photoUri?: string; // από κιβώτιο
  
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
// 15. ASSET INVENTORY (for display)
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
  
  // By product allocation
  directToProducts: {
    productId: string;
    assets: FixedAsset[];
    totalDepreciation: number;
  }[];
}

// ─────────────────────────────────────────────────────────────────────
// END OF TYPES
// ─────────────────────────────────────────────────────────────────────
