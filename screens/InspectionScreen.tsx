import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { startRecording, stopRecording, transcribeWithWhisper } from '../voiceService';
import { supabase } from '../supabase';

export default function InspectionScreen({ route }: any) {
  const { hiveId, hiveName } = route.params || {};
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const addMessage = (role: string, text: string) => {
    setMessages(prev => [...prev, { role, text }]);
  };

  async function handleMicPress() {
    if (isRecording) {
      // Σταμάτα εγγραφή
      setIsRecording(false);
      setIsProcessing(true);
      try {
        const uri = await stopRecording(recordingRef.current!);
        const text = await transcribeWithWhisper(uri);
        setTranscript(text);
        addMessage('user', text);
        await processVoiceCommand(text);
      } catch {
        Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η αναγνώριση φωνής!');
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Ξεκίνα εγγραφή
      try {
        recordingRef.current = await startRecording();
        setIsRecording(true);
        addMessage('app', `Ακούω... Πες μου για την κυψέλη ${hiveName}`);
      } catch {
        Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η εκκίνηση εγγραφής!');
      }
    }
  }

  async function processVoiceCommand(text: string) {
    const lower = text.toLowerCase();

    // Πληθυσμός
    if (lower.includes('πλαίσια') || lower.includes('δυνατ') || lower.includes('αδύναμ')) {
      addMessage('app', '✅ Καταγράφηκε πληθυσμός. Πες μου για τη βασίλισσα.');
      return;
    }

    // Βασίλισσα
    if (lower.includes('βασίλισσα') || lower.includes('βασίλ')) {
      if (lower.includes('βρήκα') || lower.includes('υπάρχει')) {
        addMessage('app', '✅ Βασίλισσα παρούσα. Πες μου για τον γόνο.');
      } else if (lower.includes('δεν βρήκα') || lower.includes('δεν υπάρχει')) {
        addMessage('app', '⚠️ Δεν βρέθηκε βασίλισσα! Έλεγξε για βασιλικά κελιά. Πες μου αν υπάρχουν.');
      }
      return;
    }

    // Βαρρόα
    if (lower.includes('βαρρόα') || lower.includes('βαρόα')) {
      addMessage('app', '✅ Καταγράφηκε Βαρρόα. Χρειάζεται θεραπεία;');
      return;
    }

    // Σμηνουργία
    if (lower.includes('βασιλικά κελιά') || lower.includes('σμηνουργία')) {
      addMessage('app', '🔴 Κίνδυνος σμηνουργίας! Σπάσε σε παραφυάδες άμεσα!');
      return;
    }

    // Αρρενοτόκο
    if (lower.includes('αρρενοτόκο')) {
      addMessage('app', '🔴 Αρρενοτόκο μελίσσι! Άμεση αντικατάσταση βασίλισσας!');
      return;
    }

    // Τέλος επιθεώρησης
    if (lower.includes('τέλος') || lower.includes('ολοκλήρωση')) {
      await saveInspection();
      return;
    }

    // Γενική καταγραφή
    addMessage('app', '✅ Καταγράφηκε. Συνέχισε...');
  }

  async function saveInspection() {
    try {
      await supabase.from('inspections').insert({
        hive_id: hiveId,
        notes: messages.filter(m => m.role === 'user').map(m => m.text).join('\n'),
        mode: 'voice',
      });
      addMessage('app', '✅ Επιθεώρηση αποθηκεύτηκε! Καλή συνέχεια! 🐝');
    } catch {
      Alert.alert('Σφάλμα', 'Δεν ήταν δυνατή η αποθήκευση!');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🐝 {hiveName || 'Επιθεώρηση'}</Text>

      <ScrollView style={styles.messagesContainer}>
        {messages.map((msg, index) => (
          <View key={index} style={[
            styles.message,
            msg.role === 'user' ? styles.userMessage : styles.appMessage
          ]}>
            <Text style={[
              styles.messageText,
              msg.role === 'user' ? styles.userMessageText : styles.appMessageText
            ]}>
              {msg.role === 'app' ? '🤖 ' : '👤 '}{msg.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      {isProcessing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#F5A623" />
          <Text style={styles.processingText}>Επεξεργασία φωνής...</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.micButton, isRecording && styles.micButtonRecording]}
        onPress={handleMicPress}
        disabled={isProcessing}
      >
        <Text style={styles.micIcon}>{isRecording ? '⏹️' : '🎤'}</Text>
        <Text style={styles.micText}>
          {isRecording ? 'Σταμάτα' : 'Πάτα για Ομιλία'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={saveInspection}>
        <Text style={styles.saveButtonText}>💾 Αποθήκευση Επιθεώρησης</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8E7', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 20 },
  messagesContainer: { flex: 1, marginBottom: 20 },
  message: { padding: 12, borderRadius: 15, marginBottom: 10, maxWidth: '85%' },
  userMessage: { backgroundColor: '#F5A623', alignSelf: 'flex-end' },
  appMessage: { backgroundColor: '#fff', alignSelf: 'flex-start', elevation: 2 },
  messageText: { fontSize: 15 },
  userMessageText: { color: '#fff' },
  appMessageText: { color: '#333' },
  processingContainer: { alignItems: 'center', marginBottom: 15 },
  processingText: { color: '#888', marginTop: 8 },
  micButton: {
    backgroundColor: '#F5A623',
    padding: 20,
    borderRadius: 50,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 5,
  },
  micButtonRecording: { backgroundColor: '#FF4444' },
  micIcon: { fontSize: 40 },
  micText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  saveButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 15, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});