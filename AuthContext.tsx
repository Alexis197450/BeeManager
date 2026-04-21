// AuthContext.tsx — BeeManager v3.0
// Auth + Session management + Anti-duplicate login

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  fullName: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [session, setSession]   = useState<Session | null>(null);
  const [loading, setLoading]   = useState(true);
  const [fullName, setFullName] = useState<string | null>(null);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();
    setFullName(data?.full_name ?? null);
  };

  const registerSession = async (userId: string, sessionId: string) => {
    await supabase
      .from('profiles')
      .update({
        active_session_id: sessionId,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', userId);
  };

  const checkSessionValid = async (userId: string, sessionId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('profiles')
      .select('active_session_id')
      .eq('id', userId)
      .single();
    if (!data) return true;
    if (!data.active_session_id) return true;
    return data.active_session_id === sessionId;
  };

  const updateLastSeen = async (userId: string) => {
    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
        await registerSession(session.user.id, session.access_token);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
          await registerSession(session.user.id, session.access_token);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (!user) return;
      if (state === 'active') await updateLastSeen(user.id);
      if (state === 'background' || state === 'inactive') {
        await supabase
          .from('hives')
          .update({ locked_by: null, locked_at: null })
          .eq('locked_by', user.id);
      }
    });
    return () => sub.remove();
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: translateError(error.message) };
    if (!data.session) return { error: 'Αποτυχία σύνδεσης' };
    await registerSession(data.user.id, data.session.access_token);
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    return { error: error ? translateError(error.message) : null };
  };

  const signOut = async () => {
    if (user) {
      await supabase.from('hives').update({ locked_by: null, locked_at: null }).eq('locked_by', user.id);
      await supabase.from('profiles').update({ active_session_id: null }).eq('id', user.id);
    }
    await supabase.auth.signOut();
    setFullName(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, fullName, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

function translateError(error: string): string {
  if (error.includes('Invalid login credentials')) return 'Λάθος email ή κωδικός.';
  if (error.includes('Email not confirmed'))        return 'Επιβεβαίωσε πρώτα το email σου.';
  if (error.includes('User already registered'))   return 'Υπάρχει ήδη λογαριασμός με αυτό το email.';
  if (error.includes('Password should be'))        return 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.';
  if (error.includes('network'))                   return 'Πρόβλημα σύνδεσης. Έλεγξε το internet.';
  return error;
}
