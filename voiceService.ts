import { Audio } from 'expo-av';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: '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',
  dangerouslyAllowBrowser: true,
});

const beekeepingCorrections: { [key: string]: string } = {
  'βαρόα': 'βαρρόα',
  'αρενοτόκο': 'αρρενοτόκο',
  'ασκοσφέρωση': 'ασκοσφαίρωση',
  'νοζεμίαση': 'νοζεμίαση',
  'σηψιγονία': 'σηψιγονία',
  'γονοφωλιά': 'γονοφωλιά',
  'βασιλοτροφία': 'βασιλοτροφία',
  'παραφυάδα': 'παραφυάδα',
};

function correctBeekeepingTerms(text: string): string {
  let corrected = text;
  Object.entries(beekeepingCorrections).forEach(([wrong, right]) => {
    corrected = corrected.replace(new RegExp(wrong, 'gi'), right);
  });
  return corrected;
}

export async function transcribeWithWhisper(audioUri: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/x-m4a',
      name: 'recording.m4a',
    } as any);
    formData.append('model', 'whisper-1');
    formData.append('language', 'el');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openai.apiKey}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (data.error) {
      console.error('OpenAI error:', data.error);
      throw new Error(data.error.message);
    }
    return correctBeekeepingTerms(data.text || '');
  } catch (error) {
    console.error('Whisper error:', error);
    throw error;
  }
}

export async function startRecording(): Promise<Audio.Recording> {
  try {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Δεν δόθηκε άδεια μικροφώνου!');
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    return recording;
  } catch (error) {
    console.error('Recording error:', error);
    throw error;
  }
}

export async function stopRecording(recording: Audio.Recording): Promise<string> {
  try {
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    const uri = recording.getURI();
    if (!uri) throw new Error('Δεν βρέθηκε αρχείο ήχου!');
    return uri;
  } catch (error) {
    console.error('Stop recording error:', error);
    throw error;
  }
}