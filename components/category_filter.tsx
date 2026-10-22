import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React, { useState } from 'react';
import { StyleSheet, View, Modal, FlatList, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Palette, Radius, Typography, Shadows } from '@/constants/theme';
import { PRODUCT_CATEGORIES } from '@/constants/config';

export type CategoryFilterOperator = 'is' | 'is not' | 'is any of';

export interface CategoryFilterState {
  enabled: boolean;
  operator: CategoryFilterOperator;
  values: string[];
}

export interface CategoryFiltersProps {
  categoryFilter: CategoryFilterState;
  onFilterChange: (newFilter: CategoryFilterState) => void;
  categoryCounts?: Record<string, number>;
  isModalOpen?: boolean;
  onOpenModalChange?: (open: boolean) => void;
}

const CATEGORY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  Grocery: 'local-grocery-store',
  Snacks: 'fastfood',
  Beverages: 'local-cafe',
  Dairy: 'egg',
  Produce: 'eco',
  Apparel: 'checkroom',
  Electronics: 'devices',
  Other: 'category',
};

export const CategoryFilters: React.FC<CategoryFiltersProps> = ({
  categoryFilter,
  onFilterChange,
  categoryCounts = {},
  isModalOpen,
  onOpenModalChange,
}) => {
  const [internalModalVisible, setInternalModalVisible] = useState(false);
  const modalVisible = isModalOpen !== undefined ? isModalOpen : internalModalVisible;
  const setModalVisible = (open: boolean) => {
    setInternalModalVisible(open);
    onOpenModalChange?.(open);
  };
  const [operatorMenuVisible, setOperatorMenuVisible] = useState(false);

  const hasActiveFilter = categoryFilter.enabled && categoryFilter.values.length > 0;

  const handleToggleCategory = (cat: string) => {
    const isSelected = categoryFilter.values.includes(cat);
    let updatedValues: string[];

    if (isSelected) {
      updatedValues = categoryFilter.values.filter((v) => v !== cat);
    } else {
      updatedValues = [...categoryFilter.values, cat];
    }

    // Auto-adjust operator when transitioning to or from multiple selections
    let nextOperator = categoryFilter.operator;
    if (updatedValues.length > 1 && nextOperator === 'is') {
      nextOperator = 'is any of';
    } else if (updatedValues.length <= 1 && nextOperator === 'is any of') {
      nextOperator = 'is';
    }

    onFilterChange({
      enabled: updatedValues.length > 0,
      operator: nextOperator,
      values: updatedValues,
    });
  };

  const handleRemoveCategory = (cat: string) => {
    const updatedValues = categoryFilter.values.filter((v) => v !== cat);
    let nextOperator = categoryFilter.operator;
    if (updatedValues.length <= 1 && nextOperator === 'is any of') {
      nextOperator = 'is';
    }
    onFilterChange({
      enabled: updatedValues.length > 0,
      operator: nextOperator,
      values: updatedValues,
    });
  };

  const handleSetOperator = (op: CategoryFilterOperator) => {
    setOperatorMenuVisible(false);
    onFilterChange({
      ...categoryFilter,
      operator: op,
    });
  };

  const handleClear = () => {
    onFilterChange({
      enabled: false,
      operator: 'is',
      values: [],
    });
  };

  const operatorOptions: CategoryFilterOperator[] =
    categoryFilter.values.length > 1
      ? ['is any of', 'is not']
      : ['is', 'is not'];

  return (
    <View style={hasActiveFilter ? styles.container : null}>
      {/* Active Filter Pill Group shown only when filter is applied */}
      {hasActiveFilter && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.filterPillGroup}>
            {/* Type Header Tag */}
            <View style={styles.typeSegment}>
              <MaterialIcons name="category" size={13} color={Palette.primary} />
              <Text style={styles.typeText}>Category</Text>
            </View>

            {/* Operator Dropdown Trigger */}
            <TouchableOpacity
              style={styles.operatorSegment}
              onPress={() => setOperatorMenuVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.operatorText}>{categoryFilter.operator}</Text>
              <MaterialIcons name="arrow-drop-down" size={14} color={Palette.textSecondary} />
            </TouchableOpacity>

            {/* Selected Values display */}
            <TouchableOpacity
              style={styles.valuesSegment}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              {categoryFilter.values.length === 1 ? (
                <View style={styles.singleValueContent}>
                  <MaterialIcons
                    name={CATEGORY_ICONS[categoryFilter.values[0]] || 'label'}
                    size={12}
                    color={Palette.text}
                  />
                  <Text style={styles.valueText} numberOfLines={1}>
                    {categoryFilter.values[0]}
                  </Text>
                </View>
              ) : (
                <Text style={styles.valueText}>
                  {categoryFilter.values.length} selected
                </Text>
              )}
            </TouchableOpacity>

            {/* Remove Filter Button */}
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <MaterialIcons name="close" size={13} color={Palette.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Clear All action */}
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Operator Dropdown / Modal */}
      <Modal
        visible={operatorMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOperatorMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOperatorMenuVisible(false)}
        >
          <View style={styles.operatorMenuCard}>
            <Text style={styles.modalHeaderTitle}>Filter Condition</Text>
            {operatorOptions.map((op) => {
              const selected = categoryFilter.operator === op;
              return (
                <TouchableOpacity
                  key={op}
                  style={[styles.operatorMenuItem, selected && styles.operatorMenuItemActive]}
                  onPress={() => handleSetOperator(op)}
                >
                  <Text
                    style={[
                      styles.operatorMenuItemText,
                      selected && styles.operatorMenuItemTextActive,
                    ]}
                  >
                    {op}
                  </Text>
                  {selected && (
                    <MaterialIcons name="check" size={16} color={Palette.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Category Selection Combobox Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.comboboxSheet}>
            {/* Header */}
            <View style={styles.comboboxHeader}>
              <View>
                <Text style={styles.comboboxTitle}>Filter by Category</Text>
                <Text style={styles.comboboxSubtitle}>
                  Select one or more categories to filter products
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <MaterialIcons name="close" size={20} color={Palette.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Selected Categories Tags */}
            {categoryFilter.values.length > 0 && (
              <View style={styles.selectedTagsContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectedTagsScroll}
                >
                  {categoryFilter.values.map((val) => (
                    <View key={val} style={styles.selectedTag}>
                      <MaterialIcons
                        name={CATEGORY_ICONS[val] || 'label'}
                        size={12}
                        color={Palette.primary}
                      />
                      <Text style={styles.selectedTagText}>{val}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveCategory(val)}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                      >
                        <MaterialIcons name="close" size={12} color={Palette.primary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Category Option List */}
            <FlatList
              data={PRODUCT_CATEGORIES}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.categoryListContent}
              renderItem={({ item }) => {
                const checked = categoryFilter.values.includes(item);
                const count = categoryCounts[item] ?? 0;
                const iconName = CATEGORY_ICONS[item] || 'category';

                return (
                  <TouchableOpacity
                    style={[styles.categoryItemRow, checked && styles.categoryItemRowSelected]}
                    onPress={() => handleToggleCategory(item)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        checked && styles.checkboxBoxChecked,
                      ]}
                    >
                      {checked && (
                        <MaterialIcons name="check" size={13} color="#ffffff" />
                      )}
                    </View>

                    <View style={styles.categoryIconCircle}>
                      <MaterialIcons
                        name={iconName}
                        size={15}
                        color={checked ? Palette.primary : Palette.textSecondary}
                      />
                    </View>

                    <Text
                      style={[
                        styles.categoryItemLabel,
                        checked && styles.categoryItemLabelSelected,
                      ]}
                    >
                      {item}
                    </Text>

                    {count > 0 && (
                      <View style={styles.categoryCountBadge}>
                        <Text style={styles.categoryCountText}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />

            {/* Footer Actions */}
            <View style={styles.comboboxFooter}>
              {categoryFilter.values.length > 0 && (
                <TouchableOpacity
                  style={styles.footerClearBtn}
                  onPress={handleClear}
                >
                  <Text style={styles.footerClearText}>Clear Filter</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.footerDoneBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.footerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  filterPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  typeSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: '100%',
    backgroundColor: Palette.primarySurface,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Palette.primary,
  },
  operatorSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    height: '100%',
    backgroundColor: '#e2e8f0',
  },
  operatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.textSecondary,
  },
  valuesSegment: {
    paddingHorizontal: 8,
    height: '100%',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  singleValueContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 130,
  },
  valueText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.text,
  },
  removeBtn: {
    height: '100%',
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  clearBtn: {
    paddingHorizontal: 8,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.borderLight,
    backgroundColor: Palette.surface,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 27, 46, 0.45)',
    justifyContent: 'flex-end',
  },
  operatorMenuCard: {
    position: 'absolute',
    alignSelf: 'center',
    top: '35%',
    width: 240,
    backgroundColor: '#ffffff',
    borderRadius: Radius.md,
    padding: 12,
    ...Shadows.overlay,
  },
  modalHeaderTitle: {
    ...Typography.caption,
    fontWeight: '700',
    color: Palette.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  operatorMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  operatorMenuItemActive: {
    backgroundColor: Palette.primarySurface,
  },
  operatorMenuItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: Palette.text,
  },
  operatorMenuItemTextActive: {
    color: Palette.primary,
    fontWeight: '700',
  },
  comboboxSheet: {
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '75%',
    paddingBottom: 24,
    ...Shadows.overlay,
  },
  comboboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Palette.borderLight,
  },
  comboboxTitle: {
    ...Typography.subheading,
    color: Palette.text,
  },
  comboboxSubtitle: {
    fontSize: 12,
    color: Palette.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  selectedTagsContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
  },
  selectedTagsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySurface,
    borderWidth: 1,
    borderColor: Palette.primarySurfaceStrong,
  },
  selectedTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.primary,
  },
  categoryListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    gap: 10,
  },
  categoryItemRowSelected: {
    backgroundColor: Palette.surfaceSubtle,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxBoxChecked: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  categoryIconCircle: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryItemLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: Palette.text,
  },
  categoryItemLabelSelected: {
    fontWeight: '700',
    color: Palette.primary,
  },
  categoryCountBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.textSecondary,
  },
  comboboxFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Palette.borderLight,
  },
  footerClearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  footerClearText: {
    fontSize: 13,
    fontWeight: '600',
    color: Palette.error,
  },
  footerDoneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primary,
  },
  footerDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
