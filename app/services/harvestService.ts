// app/services/harvestService.ts
import { supabase } from '../supabase';

export interface Harvest {
  id: string;
  hive_id: string;
  date: string;
  frames_harvested: number;
  notes: string | null;
  user_id: string;
  created_at: string;
}

export interface CreateHarvestInput {
  hive_id: string;
  date: string;
  frames_harvested: number;
  notes?: string | null;
}

export async function createHarvest(input: CreateHarvestInput): Promise<Harvest> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Μη εξουσιοδοτημένος χρήστης');

  const { data, error } = await supabase
    .from('harvests')
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getHarvestsByHive(hiveId: string): Promise<Harvest[]> {
  const { data, error } = await supabase
    .from('harvests')
    .select('*')
    .eq('hive_id', hiveId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getTotalFramesByHive(hiveId: string, year?: number): Promise<number> {
  let query = supabase
    .from('harvests')
    .select('frames_harvested')
    .eq('hive_id', hiveId);

  if (year) {
    query = query
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reduce((sum, h) => sum + (h.frames_harvested ?? 0), 0);
}

export async function deleteHarvest(id: string): Promise<void> {
  const { error } = await supabase.from('harvests').delete().eq('id', id);
  if (error) throw error;
}