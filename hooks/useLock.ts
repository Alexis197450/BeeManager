// hooks/useLock.ts — BeeManager v3.0
// Επαναχρησιμοποιήσιμη λογική για lock/unlock κυψελών

import { useCallback } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';

const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 λεπτά

export interface LockResult {
  success: boolean;
  lockedBy?: string;   // Όνομα χρήστη που έχει το lock
  lockedAt?: Date;     // Πότε κλειδώθηκε
  isExpired?: boolean; // Αν έχει λήξει το 30λεπτο
}

export function useLock() {
  const { user } = useAuth();

  // ── LOCK ────────────────────────────────────────────────────────────────────

  const lockHive = useCallback(async (hiveId: string): Promise<LockResult> => {
    if (!user) return { success: false };

    // Διάβασε την τρέχουσα κατάσταση
    const { data: hive } = await supabase
      .from('hives')
      .select('locked_by, locked_at')
      .eq('id', hiveId)
      .single();

    if (!hive) return { success: false };

    // Αν είναι κλειδωμένη από άλλον
    if (hive.locked_by && hive.locked_by !== user.id) {
      const lockedAt = new Date(hive.locked_at);
      const isExpired = Date.now() - lockedAt.getTime() > LOCK_TIMEOUT_MS;

      if (!isExpired) {
        // Βρες το όνομα του χρήστη
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', hive.locked_by)
          .single();

        return {
          success: false,
          lockedBy: profile?.full_name ?? 'Άγνωστος χρήστης',
          lockedAt,
          isExpired: false,
        };
      }
      // Αν έχει λήξει → παίρνουμε το lock
    }

    // Κλείδωσε
    const { error } = await supabase
      .from('hives')
      .update({
        locked_by: user.id,
        locked_at: new Date().toISOString(),
      })
      .eq('id', hiveId);

    if (error) {
      console.error('lockHive error:', error);
      return { success: false };
    }

    return { success: true };
  }, [user]);

  // ── UNLOCK ───────────────────────────────────────────────────────────────────

  const unlockHive = useCallback(async (hiveId: string): Promise<void> => {
    if (!user) return;

    await supabase
      .from('hives')
      .update({ locked_by: null, locked_at: null })
      .eq('id', hiveId)
      .eq('locked_by', user.id); // Μόνο αν το έχει κλειδώσει ο ίδιος
  }, [user]);

  // ── UNLOCK ALL ───────────────────────────────────────────────────────────────
  // Χρησιμοποιείται στο logout και στο app background

  const unlockAll = useCallback(async (): Promise<void> => {
    if (!user) return;

    await supabase
      .from('hives')
      .update({ locked_by: null, locked_at: null })
      .eq('locked_by', user.id);
  }, [user]);

  // ── IS LOCKED BY ME ──────────────────────────────────────────────────────────

  const isLockedByMe = useCallback((lockedBy: string | null): boolean => {
    return !!user && lockedBy === user.id;
  }, [user]);

  // ── IS LOCKED BY OTHER ───────────────────────────────────────────────────────

  const isLockedByOther = useCallback((
    lockedBy: string | null,
    lockedAt: string | null
  ): boolean => {
    if (!lockedBy || lockedBy === user?.id) return false;
    if (!lockedAt) return false;
    const expired = Date.now() - new Date(lockedAt).getTime() > LOCK_TIMEOUT_MS;
    return !expired;
  }, [user]);

  // ── LOCK STATUS TEXT ─────────────────────────────────────────────────────────

  const getLockStatus = useCallback(async (
    lockedBy: string | null,
    lockedAt: string | null
  ): Promise<string | null> => {
    if (!lockedBy) return null;
    if (lockedBy === user?.id) return '🔒 Εσύ';

    if (lockedAt) {
      const expired = Date.now() - new Date(lockedAt).getTime() > LOCK_TIMEOUT_MS;
      if (expired) return null;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', lockedBy)
      .single();

    return `🔒 ${profile?.full_name ?? 'Άλλος χρήστης'}`;
  }, [user]);

  return {
    lockHive,
    unlockHive,
    unlockAll,
    isLockedByMe,
    isLockedByOther,
    getLockStatus,
    LOCK_TIMEOUT_MS,
  };
}