import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { storeApi, productApi } from '@/api';
import type { Store, Product } from '@/types';

export const useAppStore = defineStore('app', () => {
  const stores = ref<Store[]>([]);
  const products = ref<Product[]>([]);
  const categories = ref<string[]>([]);
  const loading = ref(false);

  const activeStores = computed(() => stores.value.filter((s) => s.isActive));
  const activeProducts = computed(() => products.value.filter((p) => p.isActive));

  const loadStores = async () => {
    loading.value = true;
    try {
      const response = await storeApi.list({ limit: 1000 });
      stores.value = (response.data as any)?.stores || [];
    } finally {
      loading.value = false;
    }
  };

  const loadProducts = async () => {
    loading.value = true;
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productApi.list({ limit: 1000 }),
        productApi.getCategories(),
      ]);
      products.value = (productsRes.data as any)?.products || [];
      categories.value = (categoriesRes.data as string[]) || [];
    } finally {
      loading.value = false;
    }
  };

  const getStoreById = (id: string) => {
    return stores.value.find((s) => s.id === id);
  };

  const getStoreByCode = (code: string) => {
    return stores.value.find((s) => s.code === code);
  };

  const getProductById = (id: string) => {
    return products.value.find((p) => p.id === id);
  };

  const getProductBySku = (sku: string) => {
    return products.value.find((p) => p.sku === sku);
  };

  const init = async () => {
    await Promise.all([loadStores(), loadProducts()]);
  };

  return {
    stores,
    products,
    categories,
    loading,
    activeStores,
    activeProducts,
    loadStores,
    loadProducts,
    getStoreById,
    getStoreByCode,
    getProductById,
    getProductBySku,
    init,
  };
});
