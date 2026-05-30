import { useState, useEffect, useCallback, useRef } from 'react';

interface DataLoadingState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function depsEqual(a: any[], b: any[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

export function useDataLoading<T>(
  fetchFn: () => Promise<{ success: boolean; data?: T; error?: string }>,
  autoFetch = true,
  deps: any[] = []
): DataLoadingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchFnRef = useRef(fetchFn);
  const hasFetchedRef = useRef(false);
  const prevDepsRef = useRef<any[]>(deps);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchFnRef.current();
      if (response.success && response.data !== undefined) {
        setData(response.data);
        setError(null);
      } else {
        setError(response.error || '加载失败');
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadData();
    }
  }, [autoFetch, loadData]);

  useEffect(() => {
    if (!depsEqual(prevDepsRef.current, deps)) {
      prevDepsRef.current = deps;
      hasFetchedRef.current = false;
      if (autoFetch) {
        hasFetchedRef.current = true;
        loadData();
      }
    }
  }, [deps, autoFetch, loadData]);

  return {
    data,
    loading,
    error,
    refetch: loadData,
  };
}

export function usePaginatedDataLoading<T>(
  fetchFn: (page: number, pageSize: number) => Promise<{ success: boolean; data?: { items: T[]; total: number }; error?: string }>,
  pageSize = 20,
  deps: any[] = []
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const fetchFnRef = useRef(fetchFn);
  const pageSizeRef = useRef(pageSize);
  const hasFetchedRef = useRef(false);
  const prevDepsRef = useRef<any[]>(deps);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  const loadData = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchFnRef.current(currentPage, pageSizeRef.current);
      if (response.success && response.data) {
        if (currentPage === 1) {
          setItems(response.data.items);
        } else {
          setItems((prev) => [...prev, ...response.data.items]);
        }
        setTotal(response.data.total);
        setHasMore(currentPage * pageSizeRef.current < response.data.total);
        setPage(currentPage);
        setError(null);
      } else {
        setError(response.error || '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      loadData(1);
    }
  }, [loadData]);

  useEffect(() => {
    if (!depsEqual(prevDepsRef.current, deps)) {
      prevDepsRef.current = deps;
      hasFetchedRef.current = false;
      hasFetchedRef.current = true;
      loadData(1);
    }
  }, [deps, loadData]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadData(page + 1);
    }
  }, [loading, hasMore, page, loadData]);

  const refresh = useCallback(() => {
    loadData(1);
  }, [loadData]);

  return {
    items,
    loading,
    error,
    page,
    total,
    hasMore,
    loadMore,
    refresh,
  };
}
