// ╔════════════════════════════════════════════════════════════════════╗
// ║           Finance Service - Activity-Based Costing (ABC)           ║
// ║                    Core Calculation Engine                         ║
// ║         SESSION 16 FIX — PARALLEL QUERIES + FALLBACK              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { supabase } from '../supabase';
import {
  Product,
  ProductCategory,
  ExpenseProduction,
  FixedAsset,
  ProductionLog,
  Sale,
  RevenueMixEstimate,
  CostBreakdown,
  SuggestedPricing,
  ExpenseSummaryByCategory,
  FinanceSummary,
  DepreciationDefault,
  AssetInventory,
  CATEGORY_INFO,
} from '../types/beemanager_finance_types';

// ╔════════════════════════════════════════════════════════════════════╗
// ║ ENRICHED BREAKDOWN (per product + category info)
// ╚════════════════════════════════════════════════════════════════════╝

export interface ProductBreakdownResult extends CostBreakdown {
  category: ProductCategory;
  categoryLabel: string;
  categoryEmoji: string;
  allocationMethod: 'revenue' | 'production' | 'equal';
}

export interface AllBreakdownsResult {
  breakdowns: ProductBreakdownResult[];
  allocationMethod: 'revenue' | 'production' | 'equal';
  sharedExpensesTotal: number;
  sharedDepreciationTotal: number;
}


// ╔════════════════════════════════════════════════════════════════════╗
// ║ 1. PRODUCTS SERVICE
// ╚════════════════════════════════════════════════════════════════════╝

export const productsService = {
  async getAll(userId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(productId: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async create(userId: string, input: any) {
    if (!userId) throw new Error('User ID is required to create a product');

    const { data, error } = await supabase
      .from('products')
      .insert([{ user_id: userId, ...input }])
      .select()
      .single();

    if (error) {
      console.error("DEBUG -> Supabase Error:", error.message);
      throw error;
    }
    return data;
  },

  async update(productId: string, updates: any) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(productId: string) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', productId);

    if (error) throw error;
  },
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ 2. PACKAGING SERVICE
// ╚════════════════════════════════════════════════════════════════════╝

export const packagingService = {
  async getByProduct(productId: string) {
    const { data, error } = await supabase
      .from('packaging_presets')
      .select('*')
      .eq('product_id', productId)
      .order('is_default', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getAllByUser(userId: string) {
    const { data, error } = await supabase
      .from('packaging_presets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(userId: string, input: any) {
    if (!userId) throw new Error('User ID is required to create a packaging');

    const { data, error } = await supabase
      .from('packaging_presets')
      .insert([{ user_id: userId, ...input }])
      .select()
      .single();

    if (error) {
      console.error("DEBUG -> Supabase Error (packaging):", error.message);
      throw error;
    }
    return data;
  },

  async createMany(userId: string, inputs: any[]) {
    if (!userId) throw new Error('User ID is required to create packagings');
    if (!inputs || inputs.length === 0) return [];

    const rows = inputs.map((input) => ({ user_id: userId, ...input }));

    const { data, error } = await supabase
      .from('packaging_presets')
      .insert(rows)
      .select();

    if (error) {
      console.error("DEBUG -> Supabase Error (packaging bulk):", error.message);
      throw error;
    }
    return data || [];
  },

  async delete(packagingId: string) {
    const { error } = await supabase
      .from('packaging_presets')
      .delete()
      .eq('id', packagingId);

    if (error) throw error;
  },

  async setAsDefault(productId: string, packagingId: string) {
    await supabase
      .from('packaging_presets')
      .update({ is_default: false })
      .eq('product_id', productId);

    const { error } = await supabase
      .from('packaging_presets')
      .update({ is_default: true })
      .eq('id', packagingId);

    if (error) throw error;
  },
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ 3. EXPENSES SERVICE
// ╚════════════════════════════════════════════════════════════════════╝

export const expensesService = {
  async getByYear(userId: string, year: number): Promise<ExpenseProduction[]> {
    const { data, error } = await supabase
      .from('expenses_production')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getSharedByYear(userId: string, year: number): Promise<ExpenseProduction[]> {
    const { data, error } = await supabase
      .from('expenses_production')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('allocation_type', 'shared')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getDirectByProduct(productId: string, year: number): Promise<ExpenseProduction[]> {
    const { data, error } = await supabase
      .from('expenses_production')
      .select('*')
      .eq('product_id', productId)
      .eq('year', year)
      .eq('allocation_type', 'direct_to_product')
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(userId: string, input: any) {
    if (!userId) throw new Error('User ID is required to create an expense');

    const { data, error } = await supabase
      .from('expenses_production')
      .insert([{ user_id: userId, ...input }])
      .select()
      .single();

    if (error) {
      console.error("DEBUG -> Supabase Error:", error.message);
      throw error;
    }
    return data;
  },

  async delete(expenseId: string) {
    const { error } = await supabase
      .from('expenses_production')
      .delete()
      .eq('id', expenseId);

    if (error) throw error;
  },

  async sumSharedByYear(userId: string, year: number): Promise<number> {
    const { data, error } = await supabase
      .from('expenses_production')
      .select('amount')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('allocation_type', 'shared');

    if (error) throw error;
    return (data || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  },

  async sumDirectByProduct(productId: string, year: number): Promise<number> {
    const { data, error } = await supabase
      .from('expenses_production')
      .select('amount')
      .eq('product_id', productId)
      .eq('year', year)
      .eq('allocation_type', 'direct_to_product');

    if (error) throw error;
    return (data || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  },

  async summaryByCategory(userId: string, year: number): Promise<ExpenseSummaryByCategory> {
    const expenses = await this.getByYear(userId, year);
    const assets = await assetsService.getByUser(userId);

    const summary: ExpenseSummaryByCategory = {
      year,
      fuel: 0, feed: 0, labor: 0, packaging: 0,
      chemicals: 0, clothing: 0, maintenance: 0, other: 0,
      total: 0, depreciation: 0, grandTotal: 0,
    };

    expenses.forEach((exp) => {
      if (exp.allocation_type === 'shared') {
        summary[exp.type as keyof typeof summary] =
          (summary[exp.type as keyof typeof summary] as number) + (exp.amount || 0);
      }
    });

    summary.total = Object.keys(summary)
      .filter((k) => k !== 'year' && k !== 'depreciation' && k !== 'grandTotal')
      .reduce((sum, key) => sum + (summary[key as keyof typeof summary] as number), 0);

    const depreciation = assets
      .filter((a) => a.allocation_type === 'shared')
      .reduce((sum, a) => sum + (a.annual_depreciation || 0), 0);

    summary.depreciation = depreciation;
    summary.grandTotal = summary.total + depreciation;

    return summary;
  },
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ 4. FIXED ASSETS SERVICE (Depreciation)
// ╚════════════════════════════════════════════════════════════════════╝

export const assetsService = {
  async getByUser(userId: string): Promise<FixedAsset[]> {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByProduct(productId: string): Promise<FixedAsset[]> {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('product_id', productId)
      .eq('allocation_type', 'direct_to_product')
      .order('purchase_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByCategory(userId: string, category: string): Promise<FixedAsset[]> {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category);

    if (error) throw error;
    return data || [];
  },

  async create(userId: string, input: any) {
    if (!userId) throw new Error('User ID is required to create an asset');

    const { data: defaults } = await supabase
      .from('depreciation_defaults')
      .select('*')
      .eq('category', input.category)
      .single();

    const rate = input.depreciation_rate || defaults?.depreciation_rate || 10;
    const life = input.useful_life_years || defaults?.useful_life_years || 10;

    const { total_cost, annual_depreciation, ...rest } = input;

    const { data, error } = await supabase
      .from('fixed_assets')
      .insert([{
        user_id: userId,
        ...rest,
        depreciation_rate: rate,
        useful_life_years: life,
      }])
      .select()
      .single();

    if (error) {
      console.error("DEBUG -> Supabase Error:", error.message);
      throw error;
    }
    return data;
  },

  async delete(assetId: string) {
    const { error } = await supabase
      .from('fixed_assets')
      .delete()
      .eq('id', assetId);

    if (error) throw error;
  },

  async sumDirectDepreciation(productId: string): Promise<number> {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select('annual_depreciation')
      .eq('product_id', productId)
      .eq('allocation_type', 'direct_to_product');

    if (error) throw error;
    return (data || []).reduce((sum, a) => sum + (a.annual_depreciation || 0), 0);
  },

  async sumSharedDepreciation(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select('annual_depreciation')
      .eq('user_id', userId)
      .eq('allocation_type', 'shared');

    if (error) throw error;
    return (data || []).reduce((sum, a) => sum + (a.annual_depreciation || 0), 0);
  },

  async getInventory(userId: string): Promise<AssetInventory> {
    const assets = await this.getByUser(userId);

    const inventory: AssetInventory = {
      assets,
      byCategory: {
        mechanical: assets.filter((a) => a.category === 'mechanical'),
        hives: assets.filter((a) => a.category === 'hives'),
        transport: assets.filter((a) => a.category === 'transport'),
        consumable: assets.filter((a) => a.category === 'consumable'),
      },
      totalValue: assets.reduce((sum, a) => sum + (a.total_cost || 0), 0),
      totalAnnualDepreciation: assets.reduce((sum, a) => sum + (a.annual_depreciation || 0), 0),
      directToProducts: [],
    };

    const grouped = assets
      .filter((a) => a.allocation_type === 'direct_to_product')
      .reduce((acc, a) => {
        if (!acc[a.product_id!]) acc[a.product_id!] = [];
        acc[a.product_id!].push(a);
        return acc;
      }, {} as Record<string, FixedAsset[]>);

    inventory.directToProducts = Object.entries(grouped).map(([productId, assetList]) => ({
      productId,
      assets: assetList,
      totalDepreciation: assetList.reduce((sum, a) => sum + (a.annual_depreciation || 0), 0),
    }));

    return inventory;
  },
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ 5. PRODUCTION SERVICE
// ╚════════════════════════════════════════════════════════════════════╝

export const productionService = {
  async getByProduct(productId: string, year: number): Promise<ProductionLog[]> {
    const { data, error } = await supabase
      .from('production_logs')
      .select('*')
      .eq('product_id', productId)
      .eq('year', year)
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // ★ ΝΕΟ: 1 query αντί N — φέρνει ΟΛΑ τα production logs του έτους
  async getAllByYear(userId: string, year: number): Promise<ProductionLog[]> {
    const { data, error } = await supabase
      .from('production_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year);

    if (error) throw error;
    return data || [];
  },

  async getTotalByProduct(productId: string, year: number): Promise<number> {
    const logs = await this.getByProduct(productId, year);
    return logs.reduce((sum, log) => sum + (log.quantity || 0), 0);
  },

  async create(userId: string, input: any) {
    if (!userId) throw new Error('User ID is required to create a production log');

    const { data, error } = await supabase
      .from('production_logs')
      .insert([{ user_id: userId, ...input }])
      .select()
      .single();

    if (error) {
      console.error("DEBUG -> Supabase Error:", error.message);
      throw error;
    }
    return data;
  },

  async delete(logId: string) {
    const { error } = await supabase
      .from('production_logs')
      .delete()
      .eq('id', logId);

    if (error) throw error;
  },
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ 6. SALES SERVICE
// ╚════════════════════════════════════════════════════════════════════╝

export const salesService = {
  async getByProduct(productId: string, year: number): Promise<Sale[]> {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('product_id', productId)
      .gte('sale_date', `${year}-01-01`)
      .lte('sale_date', `${year}-12-31`)
      .order('sale_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getTotalByProduct(productId: string, year: number): Promise<number> {
    const sales = await this.getByProduct(productId, year);
    return sales.reduce((sum, s) => sum + (s.quantity || 0), 0);
  },

  async getTotalRevenueByProduct(productId: string, year: number): Promise<number> {
    const sales = await this.getByProduct(productId, year);
    return sales.reduce((sum, s) => sum + (s.total_amount || s.quantity * s.unit_price || 0), 0);
  },

  async getByYear(userId: string, year: number): Promise<Sale[]> {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', userId)
      .gte('sale_date', `${year}-01-01`)
      .lte('sale_date', `${year}-12-31`)
      .order('sale_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(userId: string, input: any) {
    if (!userId) throw new Error('User ID is required to create a sale');

    const { data, error } = await supabase
      .from('sales')
      .insert([{ user_id: userId, ...input }])
      .select()
      .single();

    if (error) {
      console.error('DEBUG -> Supabase Error:', error.message);
      throw error;
    }
    return data;
  },

  async delete(saleId: string) {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);

    if (error) throw error;
  },
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ 7. REVENUE MIX SERVICE
// ╚════════════════════════════════════════════════════════════════════╝

export const revenueMixService = {
  async getEstimate(userId: string, year: number, productId: string): Promise<RevenueMixEstimate | null> {
    const { data, error } = await supabase
      .from('revenue_mix_estimate')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('product_id', productId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async getAllEstimates(userId: string, year: number): Promise<RevenueMixEstimate[]> {
    const { data, error } = await supabase
      .from('revenue_mix_estimate')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year);

    if (error) throw error;
    return data || [];
  },

  async upsert(userId: string, input: any) {
    if (!userId) throw new Error('User ID is required');

    const { data, error } = await supabase
      .from('revenue_mix_estimate')
      .upsert(
        [{ user_id: userId, ...input }],
        { onConflict: 'user_id,year,product_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async calculateActualMix(userId: string, year: number): Promise<Record<string, number>> {
    const sales = await salesService.getByYear(userId, year);
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    if (totalRevenue === 0) return {};

    const mix: Record<string, number> = {};
    sales.forEach((sale) => {
      if (!mix[sale.product_id]) mix[sale.product_id] = 0;
      mix[sale.product_id] += (sale.total_amount || 0) / totalRevenue;
    });
    return mix;
  },

  async getMixPercentage(userId: string, year: number, productId: string): Promise<number> {
    const actualMix = await this.calculateActualMix(userId, year);
    if (actualMix[productId]) return actualMix[productId] * 100;

    const estimate = await this.getEstimate(userId, year, productId);
    return estimate?.estimated_percentage || 0;
  },
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ 8. CORE COSTING LOGIC
// ║    ★ getAllBreakdowns: 5 PARALLEL queries αντί 110+ σειριακά ★
// ║    ★ Fallback: Έσοδα → Παραγωγή → Ίση κατανομή ★
// ╚════════════════════════════════════════════════════════════════════╝

export const costingService = {

  // ─────────────────────────────────────────────────────────────────
  // ★ ΚΕΝΤΡΙΚΟ METHOD — 5 parallel queries, υπολογισμός σε μνήμη
  // ─────────────────────────────────────────────────────────────────
  async getAllBreakdowns(userId: string, year: number): Promise<AllBreakdownsResult> {
    try {
      // ── FETCH — 5 queries, ΠΑΡΑΛΛΗΛΑ ──
      const [products, allExpenses, allAssets, allSales, allProduction] = await Promise.all([
        productsService.getAll(userId),
        expensesService.getByYear(userId, year),
        assetsService.getByUser(userId),
        salesService.getByYear(userId, year),
        productionService.getAllByYear(userId, year),
      ]);

      if (products.length === 0) {
        return {
          breakdowns: [], allocationMethod: 'equal',
          sharedExpensesTotal: 0, sharedDepreciationTotal: 0,
        };
      }

      // ── PRE-COMPUTE σε μνήμη ──

      const sharedExpensesTotal = allExpenses
        .filter(e => e.allocation_type === 'shared')
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const sharedDepreciationTotal = allAssets
        .filter(a => a.allocation_type === 'shared')
        .reduce((sum, a) => sum + (a.annual_depreciation || 0), 0);

      const prodByProduct: Record<string, number> = {};
      allProduction.forEach(p => {
        prodByProduct[p.product_id] =
          (prodByProduct[p.product_id] || 0) + (p.quantity || 0);
      });

      const revenueByProduct: Record<string, number> = {};
      const soldByProduct: Record<string, number> = {};
      allSales.forEach(s => {
        revenueByProduct[s.product_id] =
          (revenueByProduct[s.product_id] || 0) + (s.total_amount || 0);
        soldByProduct[s.product_id] =
          (soldByProduct[s.product_id] || 0) + (s.quantity || 0);
      });

      const directExpByProduct: Record<string, number> = {};
      allExpenses
        .filter(e => e.allocation_type === 'direct_to_product' && e.product_id)
        .forEach(e => {
          directExpByProduct[e.product_id!] =
            (directExpByProduct[e.product_id!] || 0) + (e.amount || 0);
        });

      const directDepByProduct: Record<string, number> = {};
      allAssets
        .filter(a => a.allocation_type === 'direct_to_product' && a.product_id)
        .forEach(a => {
          directDepByProduct[a.product_id!] =
            (directDepByProduct[a.product_id!] || 0) + (a.annual_depreciation || 0);
        });

      // ── ΚΑΤΑΝΟΜΗ με 3-βάθμιο fallback ──
      let allocationMethod: 'revenue' | 'production' | 'equal' = 'equal';
      const allocation: Record<string, number> = {};

      const totalRevenue = Object.values(revenueByProduct).reduce((a, b) => a + b, 0);

      if (totalRevenue > 0) {
        // 1ο: Βάσει εσόδων
        allocationMethod = 'revenue';
        products.forEach(p => {
          allocation[p.id] = ((revenueByProduct[p.id] || 0) / totalRevenue) * 100;
        });
      } else {
        const totalProd = Object.values(prodByProduct).reduce((a, b) => a + b, 0);
        if (totalProd > 0) {
          // 2ο: Βάσει παραγωγής
          allocationMethod = 'production';
          products.forEach(p => {
            allocation[p.id] = ((prodByProduct[p.id] || 0) / totalProd) * 100;
          });
        } else {
          // 3ο: Ίση κατανομή
          allocationMethod = 'equal';
          const pct = 100 / products.length;
          products.forEach(p => { allocation[p.id] = pct; });
        }
      }

      // ── BUILD BREAKDOWNS — 0 extra queries ──
      const sharedPool = sharedExpensesTotal + sharedDepreciationTotal;

      const breakdowns: ProductBreakdownResult[] = products.map(product => {
        const pid = product.id;

        const directExp = directExpByProduct[pid] || 0;
        const directDep = directDepByProduct[pid] || 0;
        const directTotal = directExp + directDep;

        const mixPct = allocation[pid] || 0;
        const allocatedShared = sharedPool * (mixPct / 100);

        const totalCost = directTotal + allocatedShared;
        const production = prodByProduct[pid] || 0;
        const unitCost = production > 0 ? totalCost / production : 0;

        const productRevenue = revenueByProduct[pid] || 0;
        const quantitySold = soldByProduct[pid] || 0;
        const grossProfit = productRevenue - totalCost;
        const grossMarginPct = productRevenue > 0
          ? (grossProfit / productRevenue) * 100 : 0;

        const catInfo = CATEGORY_INFO[product.category]
          || { label: 'Άλλο', emoji: '📦', defaultUnit: 'kg' };

        return {
          productId: pid,
          productName: product.name,
          year,
          quantityProduced: production,
          unit: product.unit_type,

          directCosts: {
            expenses: directExp,
            depreciation: directDep,
            total: directTotal,
          },
          sharedCosts: {
            expenses: sharedExpensesTotal,
            depreciation: sharedDepreciationTotal,
            allocatedPercentage: mixPct,
            total: allocatedShared,
          },
          summary: {
            totalCost,
            unitCost,
            quantitySold,
            totalRevenue: productRevenue,
            grossProfit,
            grossMarginPct,
          },

          category: product.category,
          categoryLabel: catInfo.label,
          categoryEmoji: catInfo.emoji,
          allocationMethod,
        };
      });

      return {
        breakdowns,
        allocationMethod,
        sharedExpensesTotal,
        sharedDepreciationTotal,
      };
    } catch (error) {
      console.error('[Costing] getAllBreakdowns error:', error);
      return {
        breakdowns: [], allocationMethod: 'equal',
        sharedExpensesTotal: 0, sharedDepreciationTotal: 0,
      };
    }
  },

  // Legacy — τώρα χρησιμοποιεί getAllBreakdowns εσωτερικά
  async calculateUnitCost(userId: string, productId: string, year: number): Promise<number> {
    try {
      const result = await this.getAllBreakdowns(userId, year);
      const bd = result.breakdowns.find(b => b.productId === productId);
      return bd?.summary.unitCost || 0;
    } catch (error) {
      console.error('[Costing] Error calculating unit cost:', error);
      return 0;
    }
  },

  async getCostBreakdown(userId: string, productId: string, year: number): Promise<CostBreakdown | null> {
    try {
      const result = await this.getAllBreakdowns(userId, year);
      const bd = result.breakdowns.find(b => b.productId === productId);
      if (!bd) return null;
      return {
        productId: bd.productId,
        productName: bd.productName,
        year: bd.year,
        quantityProduced: bd.quantityProduced,
        unit: bd.unit,
        directCosts: bd.directCosts,
        sharedCosts: bd.sharedCosts,
        summary: bd.summary,
      };
    } catch (error) {
      console.error('[Costing] Error getting cost breakdown:', error);
      return null;
    }
  },

  async calculateSuggestedPrice(
    userId: string,
    productId: string,
    year: number,
    desiredMarginPct: number
  ): Promise<SuggestedPricing> {
    const unitCost = await this.calculateUnitCost(userId, productId, year);
    const marginFraction = desiredMarginPct / 100;
    const suggestedPrice = unitCost / (1 - marginFraction);
    const withTax = suggestedPrice * 1.19;

    return {
      unitCost,
      desiredMarginPct,
      suggestedPrice,
      withoutTax: suggestedPrice,
      withTax,
      breakdownNote: `Με ${desiredMarginPct}% margin, η τιμή θα πρέπει να είναι τουλάχιστον €${suggestedPrice.toFixed(2)}/kg (€${withTax.toFixed(2)} με ΦΠΑ)`,
    };
  },

  calculateDiscountImpact(
    unitCost: number,
    originalPrice: number,
    discountPct: number
  ): { discountedPrice: number; profitPerUnit: number; marginPct: number; marginLoss: number } {
    const discountedPrice = originalPrice * (1 - discountPct / 100);
    const profitPerUnit = discountedPrice - unitCost;
    const marginPct = (profitPerUnit / discountedPrice) * 100;
    const marginLoss = ((originalPrice - discountedPrice) / originalPrice) * 100;

    return { discountedPrice, profitPerUnit, marginPct, marginLoss };
  },
};

// ╔════════════════════════════════════════════════════════════════════╗
// ║ 9. DASHBOARD DATA
// ╚════════════════════════════════════════════════════════════════════╝

export const dashboardService = {
  async getSummaryForYear(userId: string, year: number): Promise<any> {
    if (!userId) throw new Error('User ID is required');

    const [
      allResult,
      expenseSummary,
      assetInventory,
    ] = await Promise.all([
      costingService.getAllBreakdowns(userId, year),
      expensesService.summaryByCategory(userId, year),
      assetsService.getInventory(userId),
    ]);

    const { breakdowns, sharedExpensesTotal, sharedDepreciationTotal } = allResult;

    const totalRevenue = breakdowns.reduce((s, b) => s + b.summary.totalRevenue, 0);
    const totalCost = breakdowns.reduce((s, b) => s + b.summary.totalCost, 0);
    const grossProfit = totalRevenue - totalCost;
    const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      year,
      products: breakdowns,
      breakdowns,
      expenseSummary,
      assetInventory,
      totals: {
        sharedCosts: sharedExpensesTotal + sharedDepreciationTotal,
        production: breakdowns.reduce((s, b) => s + b.quantityProduced, 0),
        revenue: totalRevenue,
        cost: totalCost,
        profit: grossProfit,
        marginPct: grossMarginPct,
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────
// END OF SERVICE
// ─────────────────────────────────────────────────────────────────────