// app/services/breedingService.ts
import { supabase } from '../supabase';

export type UnitType   = 'nucleus' | 'mating' | 'q8' | 'other';
export type UnitStatus = 'active' | 'hatched' | 'failed_hatch' | 'laying' | 'upgraded_to_hive' | 'sold' | 'dead';

export interface BreedingUnit {
  id: string;
  user_id: string;
  cycle_id: string | null;
  cell_number: number | null;
  unit_type: UnitType;
  label: string | null;
  status: UnitStatus;
  hatched: boolean;
  failed_hatch: boolean;
  queen_laying: boolean;
  sealed_brood: boolean;
  queen_breed: string | null;
  destination_hive_id: string | null;
  sale_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  nucleus: 'Παραφυάδα',
  mating:  'Κυψελίδιο Σύζευξης',
  q8:      'Q8',
  other:   'Άλλο',
};

export const UNIT_TYPE_EMOJI: Record<UnitType, string> = {
  nucleus: '🐝',
  mating:  '💑',
  q8:      '🔬',
  other:   '📦',
};

export async function getUnitsByCycle(cycleId: string): Promise<BreedingUnit[]> {
  const { data, error } = await supabase
    .from('breeding_units').select('*').eq('cycle_id', cycleId).order('cell_number');
  if (error) throw error;
  return (data ?? []) as BreedingUnit[];
}

export async function getActiveUnits(): Promise<BreedingUnit[]> {
  const { data, error } = await supabase
    .from('breeding_units').select('*')
    .in('status', ['active', 'hatched', 'failed_hatch', 'laying'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BreedingUnit[];
}

export async function getAllUnits(): Promise<BreedingUnit[]> {
  const { data, error } = await supabase
    .from('breeding_units').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as BreedingUnit[];
}

export async function upsertUnitsFromCells(
  cycleId: string,
  queenBreed: string | null,
  cells: { cell_number: number; unit_type: UnitType; label: string | null }[],
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Μη εξουσιοδοτημένος χρήστης');

  const existing = await getUnitsByCycle(cycleId);
  const existingByCell = new Map(existing.map(u => [u.cell_number, u]));

  for (const c of cells) {
    const prev = existingByCell.get(c.cell_number);
    if (prev) {
      await supabase.from('breeding_units').update({
        unit_type: c.unit_type, label: c.label,
        queen_breed: queenBreed, updated_at: new Date().toISOString(),
      }).eq('id', prev.id);
    } else {
      await supabase.from('breeding_units').insert({
        user_id: user.id, cycle_id: cycleId,
        cell_number: c.cell_number, unit_type: c.unit_type,
        label: c.label, queen_breed: queenBreed, status: 'active',
        hatched: false, failed_hatch: false,
      });
    }
  }

  const keepCells = new Set(cells.map(c => c.cell_number));
  for (const u of existing) {
    if (u.cell_number !== null && !keepCells.has(u.cell_number)
        && u.status === 'active' && !u.hatched && !u.failed_hatch) {
      await supabase.from('breeding_units').delete().eq('id', u.id);
    }
  }
}

// hatched: true = εκκολάφθηκε, false + failed=true = ΔΕΝ εκκολάφθηκε, false + failed=false = επαναφορά
export async function setHatched(unitId: string, hatched: boolean, failed = false): Promise<void> {
  const status: UnitStatus = hatched ? 'hatched' : failed ? 'failed_hatch' : 'active';
  const { error } = await supabase.from('breeding_units').update({
    hatched, failed_hatch: failed, status,
    updated_at: new Date().toISOString(),
  }).eq('id', unitId);
  if (error) throw error;
}

export async function setLaying(unitId: string, queen_laying: boolean, sealed_brood: boolean): Promise<void> {
  const { error } = await supabase.from('breeding_units').update({
    queen_laying, sealed_brood,
    status: queen_laying ? 'laying' : 'hatched',
    updated_at: new Date().toISOString(),
  }).eq('id', unitId);
  if (error) throw error;
}

export async function convertUnitType(unitId: string, newType: UnitType): Promise<void> {
  const { error } = await supabase.from('breeding_units')
    .update({ unit_type: newType, updated_at: new Date().toISOString() }).eq('id', unitId);
  if (error) throw error;
}

export async function upgradeToHive(unit: BreedingUnit, hiveName: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Μη εξουσιοδοτημένος χρήστης');

  const { data: hive, error: hiveErr } = await supabase.from('hives').insert({
    name: hiveName, type: 'Langstroth', hive_type: 'production',
    status: 'active', queen_breed: unit.queen_breed, user_id: user.id,
  }).select('id').single();
  if (hiveErr) throw hiveErr;

  const { error } = await supabase.from('breeding_units').update({
    status: 'upgraded_to_hive', destination_hive_id: hive.id,
    updated_at: new Date().toISOString(),
  }).eq('id', unit.id);
  if (error) throw error;
}

export async function markSold(unitId: string, saleId?: string): Promise<void> {
  const { error } = await supabase.from('breeding_units').update({
    status: 'sold', sale_id: saleId ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', unitId);
  if (error) throw error;
}

export async function deleteUnit(unitId: string): Promise<void> {
  const { error } = await supabase.from('breeding_units').delete().eq('id', unitId);
  if (error) throw error;
}

export async function ensureBreedingProducts(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const BREEDING_PRODUCTS = [
    { name: 'Βασιλικά Κελιά',   unit_type: 'pieces' },
    { name: 'Βασίλισσες',       unit_type: 'pieces' },
    { name: 'Παραφυάδες',       unit_type: 'pieces' },
    { name: 'Βασιλικός Πολτός', unit_type: 'pieces' },
  ];

  const { data: existing } = await supabase.from('products')
    .select('name').eq('user_id', user.id).eq('category', 'breeding');

  const existingNames = new Set((existing ?? []).map((p: any) => p.name));
  const toCreate = BREEDING_PRODUCTS
    .filter(p => !existingNames.has(p.name))
    .map(p => ({ user_id: user.id, name: p.name, category: 'breeding', unit_type: p.unit_type, is_active: true }));

  if (toCreate.length > 0) await supabase.from('products').insert(toCreate);
}

export async function getBreedingProductByName(name: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('products').select('id')
    .eq('user_id', user.id).eq('category', 'breeding').eq('name', name).maybeSingle();
  return data?.id ?? null;
}