// ╔════════════════════════════════════════════════════════════════════╗
// ║                     ProductsScreen.tsx                             ║
// ║              Διαχείριση Προϊόντων & Συσκευασιών                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { productsService, packagingService } from '../../services/financeService';
import { CATEGORY_INFO } from '../../types/beemanager_finance_types';

interface Product {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  is_active: boolean;
}

interface Packaging {
  id: string;
  name: string;
  volume_ml: number | null;
  cost_per_unit: number;
  is_default: boolean;
}

interface ProductWithPackaging extends Product {
  packagings: Packaging[];
}

export default function ProductsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [products, setProducts] = useState<ProductWithPackaging[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await productsService.getAll(user.id);
      const withPkg: ProductWithPackaging[] = await Promise.all(
        data.map(async (p) => {
          const pkgs = await packagingService.getByProduct(p.id);
          return { ...p, packagings: pkgs as Packaging[] };
        })
      );
      setProducts(withPkg);
    } catch (e) {
      console.error('ProductsScreen load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProducts();
    }, [loadProducts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleDelete = (product: ProductWithPackaging) => {
    Alert.alert(
      'Διαγραφή Προϊόντος',
      `Να διαγραφεί το "${product.name}";`,
      [
        { text: 'Ακύρωση', style: 'cancel' },
        {
          text: 'Διαγραφή', style: 'destructive',
          onPress: async () => {
            try {
              await productsService.delete(product.id);
              setProducts(prev => prev.filter(p => p.id !== product.id));
            } catch {
              Alert.alert('Σφάλμα', 'Αδυναμία διαγραφής.');
            }
          },
        },
      ]
    );
  };

  // Ομαδοποίηση ανά κατηγορία
  const grouped = products.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, ProductWithPackaging[]>);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A623" />}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#F5A623" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>📦 Διαχείριση Προϊόντων</Text>
      </View>

      {/* Κουμπί νέου προϊόντος */}
      <TouchableOpacity
        style={s.newBtn}
        onPress={() => navigation.navigate('CreateProduct')}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={s.newBtnText}>Νέο Προϊόν</Text>
      </TouchableOpacity>

      {products.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyEmoji}>📦</Text>
          <Text style={s.emptyText}>Δεν υπάρχουν προϊόντα ακόμα.</Text>
        </View>
      ) : (
        Object.entries(grouped).map(([cat, items]) => {
            const catInfo = (CATEGORY_INFO as any)[cat] || { label: cat, emoji: '📦' };
            return (
            <View key={cat} style={s.categorySection}>
              <View style={s.categoryHeader}>
                <Text style={s.categoryEmoji}>{catInfo.emoji}</Text>
                <Text style={s.categoryLabel}>{catInfo.label}</Text>
                <View style={s.badge}>
                  <Text style={s.badgeText}>{items.length}</Text>
                </View>
              </View>

              {items.map(product => {
                const isExpanded = expandedId === product.id;
                return (
                  <View key={product.id} style={s.productCard}>
                    {/* Product row */}
                    <TouchableOpacity
                      style={s.productRow}
                      onPress={() => setExpandedId(isExpanded ? null : product.id)}
                      activeOpacity={0.7}
                    >
                      <View style={s.productInfo}>
                        <Text style={s.productName}>{product.name}</Text>
                        <Text style={s.productMeta}>
                          {product.unit_type}
                          {product.packagings.length > 0
                            ? ` · ${product.packagings.length} συσκευασίες`
                            : ' · Χωρίς συσκευασία'}
                        </Text>
                      </View>
                      <View style={s.productActions}>
                        <TouchableOpacity
                          style={s.editBtn}
                          onPress={() => navigation.navigate('CreateProduct', { editProduct: product })}
                        >
                          <Ionicons name="pencil-outline" size={16} color="#F5A623" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.deleteBtn}
                          onPress={() => handleDelete(product)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                        </TouchableOpacity>
                        <Text style={s.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Expanded — συσκευασίες */}
                    {isExpanded && (
                      <View style={s.packagingList}>
                        {product.packagings.length === 0 ? (
                          <Text style={s.noPackaging}>Δεν υπάρχουν συσκευασίες.</Text>
                        ) : (
                          product.packagings.map(pkg => (
                            <View key={pkg.id} style={s.packagingRow}>
                              <View style={s.packagingInfo}>
                                <Text style={s.packagingName}>
                                  {pkg.name}
                                  {pkg.is_default ? ' ⭐' : ''}
                                </Text>
                                <Text style={s.packagingCost}>
                                  €{pkg.cost_per_unit}/τεμ
                                  {pkg.volume_ml ? ` · ${pkg.volume_ml}ml` : ''}
                                </Text>
                              </View>
                            </View>
                          ))
                        )}
                        <TouchableOpacity
                          style={s.editPackagingBtn}
                          onPress={() => navigation.navigate('CreateProduct', { editProduct: product })}
                        >
                          <Ionicons name="pencil-outline" size={14} color="#F5A623" />
                          <Text style={s.editPackagingBtnText}>Επεξεργασία συσκευασιών</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#F5A623' },

  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#27AE60', borderRadius: 12,
    paddingVertical: 12, marginBottom: 16,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyText: { color: '#666', fontSize: 14 },

  categorySection: { marginBottom: 16 },
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#16213e', borderRadius: 12,
    padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: '#0f3460',
  },
  categoryEmoji: { fontSize: 22 },
  categoryLabel: { fontSize: 15, fontWeight: '700', color: '#F5A623', flex: 1 },
  badge: { backgroundColor: '#0f3460', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#F5A623', fontSize: 12, fontWeight: '700' },

  productCard: {
    backgroundColor: '#16213e', borderRadius: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#0f3460',
    overflow: 'hidden',
  },
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  productMeta: { fontSize: 12, color: '#aaa', marginTop: 2 },
  productActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: { padding: 6 },
  deleteBtn: { padding: 6 },
  expandIcon: { fontSize: 10, color: '#aaa', marginLeft: 4 },

  packagingList: {
    borderTopWidth: 1, borderTopColor: '#0f3460',
    padding: 12, backgroundColor: '#0f1a33',
  },
  noPackaging: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  packagingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
  packagingInfo: { flex: 1 },
  packagingName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  packagingCost: { fontSize: 12, color: '#F5A623', marginTop: 2 },
  editPackagingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: '#16213e', borderRadius: 8, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#F5A623',
  },
  editPackagingBtnText: { color: '#F5A623', fontSize: 12, fontWeight: '600' },
});