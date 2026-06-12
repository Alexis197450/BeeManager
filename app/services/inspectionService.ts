// app/services/inspectionService.ts
import { supabase } from '../supabase';
import { CreateInspectionInput, Hive, Inspection } from '../types/inspectionTypes';

export async function getHives(): Promise<Hive[]> {
  const { data, error } = await supabase
    .from('hives')
    .select('id, name, location, type, status')
    .eq('status', 'active')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getInspectionsByHive(hiveId: string): Promise<Inspection[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select('*')
    .eq('hive_id', hiveId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getInspectionById(id: string): Promise<Inspection | null> {
  const { data, error } = await supabase
    .from('inspections').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createInspection(input: CreateInspectionInput): Promise<Inspection> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Μη εξουσιοδοτημένος χρήστης');
  const { data, error } = await supabase
    .from('inspections').insert({ ...input, user_id: user.id }).select().single();
  if (error) throw error;
  return data;
}

export async function updateInspection(
  id: string, input: Partial<CreateInspectionInput>
): Promise<Inspection> {
  const { data, error } = await supabase
    .from('inspections').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInspection(id: string): Promise<void> {
  const { error } = await supabase.from('inspections').delete().eq('id', id);
  if (error) throw error;
}

export async function getLatestInspections(limit = 20): Promise<Inspection[]> {
  const { data, error } = await supabase
    .from('inspections').select('*')
    .order('date', { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createHive(input: {
  name: string; location: string; type: string; status: string; user_id: string;
}): Promise<Hive> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Μη εξουσιοδοτημένος χρήστης');
  const { data, error } = await supabase
    .from('hives').insert({ ...input, user_id: user.id })
    .select('id, name, location, type, status').single();
  if (error) throw error;
  return data;
}

export async function updateHive(
  id: string,
  input: Partial<{ name: string; location: string; type: string; status: string }>
): Promise<void> {
  const { error } = await supabase.from('hives').update(input).eq('id', id);
  if (error) throw error;
}

export function scoreHiveForQueenRearing(inspection: Inspection): number {
  let score = 0;
  if (inspection.population_strength === 'δυνατό')      score += 30;
  else if (inspection.population_strength === 'μέτριο') score += 15;
  if (inspection.temperament === 'ήρεμο')               score += 25;
  else if (inspection.temperament === 'μέτριο')         score += 10;
  if (inspection.brood_condition === 'Εξαιρετική')      score += 25;
  else if (inspection.brood_condition === 'Καλή')       score += 10;
  if (inspection.varroa_level === 'μη_ορατή')           score += 20;
  else if (inspection.varroa_level === 'χαμηλή')        score += 10;
  else if (inspection.varroa_level === 'υψηλή')         score -= 20;
  if (inspection.has_swarmed)                           score -= 10;
  return Math.max(0, Math.min(100, score));
}
