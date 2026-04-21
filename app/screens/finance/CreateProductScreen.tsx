import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ⚠️ TODO: Uncomment when ready
// import { productsService } from '../services/financeService';
// import { useAuth } from '../contexts/AuthContext';

export default function CreateProductScreen() {
  const navigation = useNavigation<any>();
  // const { user } = useAuth();

  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState<'kg' | 'liters' | 'pieces' | 'gr'>('kg');
  const [density, setDensity] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Το όνομα του προϊόντος είναι υποχρεωτικό';
    }

    if (unitType === 'liters' && !density) {
      newErrors.density = 'Το ειδικό βάρος είναι υποχρεωτικό για υγρά';
    }

    if (unitType === 'liters' && density) {
      const densityNum = parseFloat(density);
      if (isNaN(densityNum) || densityNum <= 0) {
        newErrors.density = 'Το ειδικό βάρος πρέπει να είναι θετικός αριθμός';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─────────────────────────────────────────────────────────────────
  // CREATE PRODUCT
  // ─────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // TODO: Uncomment when financeService is ready
      // const userId = user?.id;
      // if (!userId) {
      //   Alert.alert('Σφάλμα', 'Ο χρήστης δεν είναι συνδεδεμένος');
      //   return;
      // }

      // await productsService.create(userId, {
      //   name: name.trim(),
      //   unit_type: unitType,
      //   density: unitType === 'liters' ? parseFloat(density) : null,
      // });

      // Temporary: Just show success
      Alert.alert('✅ Επιτυχία', `Το προϊόν "${name}" δημιουργήθηκε!`, [
        {
          text: 'OK',
          onPress: () => {
            setName('');
            setUnitType('kg');
            setDensity('');
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      console.error('Error creating product:', error);
      Alert.alert('❌ Σφάλμα', 'Αποτυχία δημιουργίας προϊόντος. Δοκιμάστε ξανά.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Info */}
        <View style={styles.headerInfo}>
<MaterialCommunityIcons name="plus-box" size={48} color="#4CAF50" />          <Text style={styles.headerTitle}>Δημιουργία Νέου Προϊόντος</Text>
          <Text style={styles.headerSubtitle}>
            Προσθέστε ένα νέο προϊόν στη μελισσοκομία σας
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Όνομα Προϊόντος */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>📝 Όνομα Προϊόντος *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="π.χ. Μέλι Ανθέων, Πρόπολη, Γύρη..."
              placeholderTextColor="#999"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
              }}
              editable={!isLoading}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Μονάδα Μέτρησης */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>⚖️ Μονάδα Μέτρησης *</Text>
            <View style={styles.unitGrid}>
              {(['kg', 'liters', 'pieces', 'gr'] as const).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.unitButton,
                    unitType === unit && styles.unitButtonActive,
                  ]}
                  onPress={() => {
                    setUnitType(unit);
                    if (unit !== 'liters') setDensity('');
                  }}
                  disabled={isLoading}
                >
                  <Text
                    style={[
                      styles.unitButtonText,
                      unitType === unit && styles.unitButtonTextActive,
                    ]}
                  >
                    {unit === 'kg' && 'Κιλά (kg)'}
                    {unit === 'liters' && 'Λίτρα (L)'}
                    {unit === 'pieces' && 'Τεμάχια'}
                    {unit === 'gr' && 'Γραμμάρια (gr)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Ειδικό Βάρος (μόνο για υγρά) */}
          {unitType === 'liters' && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>🔬 Ειδικό Βάρος (Density) *</Text>
              <Text style={styles.helperText}>
                Π.χ. Μέλι: 1.43, Πρόπολη: 1.10, Βασιλικός πολτός: 1.1
              </Text>
              <TextInput
                style={[styles.input, errors.density && styles.inputError]}
                placeholder="Π.χ. 1.43"
                placeholderTextColor="#999"
                value={density}
                onChangeText={(text) => {
                  setDensity(text);
                  if (errors.density) setErrors((prev) => ({ ...prev, density: '' }));
                }}
                keyboardType="decimal-pad"
                editable={!isLoading}
              />
              {errors.density && <Text style={styles.errorText}>{errors.density}</Text>}
            </View>
          )}

          {/* Info Box */}
          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information" size={20} color="#2196F3" />
            <Text style={styles.infoText}>
              Μετά τη δημιουργία, μπορείτε να προσθέσετε έξοδα, παραγωγή και
              πωλήσεις για αυτό το προϊόν.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Button Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Ακύρωση</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createButton, isLoading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Δημιουργία</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 100,
  },

  // Header
  headerInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },

  // Form
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },

  // Input
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFE3E3',
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
  },

  // Unit Grid
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitButton: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  unitButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  unitButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  unitButtonTextActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#1565C0',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});