import { useEffect } from 'react';
import { useBatchStore } from '@/store/useBatchStore';
import { useSearchParams } from 'react-router-dom';

export const useFilterSync = () => {
  const filters = useBatchStore((state) => state.filters);
  const applyFilters = useBatchStore((state) => state.applyFilters);
  const resetFilters = useBatchStore((state) => state.resetFilters);
  const getFilteredBatches = useBatchStore((state) => state.getFilteredBatches);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null) {
        params.set(key, JSON.stringify(value));
      }
    });

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  useEffect(() => {
    const savedFilters: Record<string, any> = {};
    let hasFilters = false;

    searchParams.forEach((value, key) => {
      try {
        savedFilters[key] = JSON.parse(value);
        hasFilters = true;
      } catch (e) {
        console.error('解析筛选参数失败:', e);
      }
    });

    if (hasFilters) {
      applyFilters(savedFilters);
    }
  }, []);

  const filteredBatches = getFilteredBatches();

  return {
    filters,
    applyFilters,
    resetFilters,
    filteredBatches,
  };
};
