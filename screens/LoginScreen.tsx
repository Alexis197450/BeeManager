// screens/LoginScreen.tsx — BeeManager

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useAuth } from '../AuthContext';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();

  const [isLogin, setIsLogin]       = useState(true);
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [fullName, setFullName]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!email.trim() || !password.trim()) {
      setError('Συμπλήρωσε email και κωδικό.'); return;
    }
    if (!isLogin && !fullName.trim()) {
      setError('Συμπλήρωσε το ονοματεπώνυμό σου.'); return;
    }
    if (password.length < 6) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.'); return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email.trim(), password);
        if (error) setError(translateError(error));
      } else {
        const { error } = await signUp(email.trim(), password, fullName.trim());
        if (error) setError(translateError(error));
        else setSuccess('Ο λογαριασμός δημιουργήθηκε! Μπορείς να συνδεθείς.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <Text style={styles.logo}>🐝</Text>
        <Text style={styles.appName}>BeeManager</Text>
        <Text style={styles.tagline}>Έξυπνη διαχείριση μελισσοκομείου</Text>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isLogin ? 'Σύνδεση' : 'Δημιουργία λογαριασμού'}</Text>

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ονοματεπώνυμο</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="π.χ. Γιώργης Παπαδόπουλος"
                placeholderTextColor={MUTED}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Κωδικός</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Τουλάχιστον 6 χαρακτήρες"
              placeholderTextColor={MUTED}
              secureTextEntry
            />
          </View>

          {/* Error / Success */}
          {!!error   && <Text style={styles.errorText}>⚠️ {error}</Text>}
          {!!success && <Text style={styles.successText}>✅ {success}</Text>}

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>
                  {isLogin ? '🔑 Σύνδεση' : '📝 Δημιουργία λογαριασμού'}
                </Text>
            }
          </TouchableOpacity>

          {/* Toggle */}
          <TouchableOpacity style={styles.toggleBtn} onPress={() => {
            setIsLogin(!isLogin); setError(''); setSuccess('');
          }}>
            <Text style={styles.toggleText}>
              {isLogin
                ? 'Δεν έχεις λογαριασμό; Δημιούργησε έναν'
                : 'Έχεις ήδη λογαριασμό; Σύνδεση'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Μετάφραση Supabase errors σε ελληνικά
function translateError(error: string): string {
  if (error.includes('Invalid login credentials')) return 'Λάθος email ή κωδικός.';
  if (error.includes('Email not confirmed'))        return 'Επιβεβαίωσε πρώτα το email σου.';
  if (error.includes('User already registered'))   return 'Υπάρχει ήδη λογαριασμός με αυτό το email.';
  if (error.includes('Password should be'))        return 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.';
  if (error.includes('network'))                   return 'Πρόβλημα σύνδεσης. Έλεγξε το internet.';
  return error;
}

// ─── THEME ────────────────────────────────────────────────────────────────────

const HONEY = '#F5A623';
const BG    = '#0E1320';
const CARD  = '#182035';
const TEXT  = '#E8ECF4';
const MUTED = '#6B7280';
const GREEN = '#22C55E';
const RED   = '#EF4444';

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  logo:     { fontSize: 72, textAlign: 'center', marginBottom: 8 },
  appName:  { fontSize: 32, fontWeight: '800', color: HONEY, textAlign: 'center', marginBottom: 4 },
  tagline:  { fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 40 },

  card: {
    backgroundColor: CARD, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', color: TEXT, marginBottom: 24, textAlign: 'center' },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, color: MUTED, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#0E1320', color: TEXT, borderRadius: 12,
    padding: 14, fontSize: 15, borderWidth: 1, borderColor: '#2A3A5A',
  },

  errorText:   { color: RED,   fontSize: 13, marginBottom: 12, lineHeight: 20 },
  successText: { color: GREEN, fontSize: 13, marginBottom: 12, lineHeight: 20 },

  submitBtn: {
    backgroundColor: HONEY, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: HONEY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

  toggleBtn:  { marginTop: 20, alignItems: 'center' },
  toggleText: { color: MUTED, fontSize: 14, textDecorationLine: 'underline' },
});
