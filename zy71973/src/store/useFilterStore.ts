import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RecordStatus, RecordType } from '@/types';

interface FilterState {
  status: RecordStatus | 'all';
  source: string;
  type: RecordType | 'all';
  handlerId: string;
  dateStart: string;
  dateEnd: string;
  currentPage: number;
  pageSize: number;
  
  setStatus: (status: RecordStatus | 'all') => void;
  setSource: (source: string) => void;
  setType: (type: RecordType | 'all') => void;
  setHandlerId: (handlerId: string) => void;
  setDateStart: (date: string) => void;
  setDateEnd: (date: string) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  resetFilters: () => void;
  getFilters: () => {
    status: RecordStatus | 'all';
    source: string;
    type: RecordType | 'all';
    handlerId: string;
    dateStart: string;
    dateEnd: string;
  };
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set, get) => ({
      status: 'all',
      source: '',
      type: 'all',
      handlerId: '',
      dateStart: '',
      dateEnd: '',
      currentPage: 1,
      pageSize: 10,

      setStatus: (status) => set({ status, currentPage: 1 }),
      setSource: (source) => set({ source, currentPage: 1 }),
      setType: (type) => set({ type, currentPage: 1 }),
      setHandlerId: (handlerId) => set({ handlerId, currentPage: 1 }),
      setDateStart: (dateStart) => set({ dateStart, currentPage: 1 }),
      setDateEnd: (dateEnd) => set({ dateEnd, currentPage: 1 }),
      setCurrentPage: (currentPage) => set({ currentPage }),
      setPageSize: (pageSize) => set({ pageSize, currentPage: 1 }),

      resetFilters: () =>
        set({
          status: 'all',
          source: '',
          type: 'all',
          handlerId: '',
          dateStart: '',
          dateEnd: '',
          currentPage: 1,
        }),

      getFilters: () => {
        const { status, source, type, handlerId, dateStart, dateEnd } = get();
        return { status, source, type, handlerId, dateStart, dateEnd };
      },
    }),
    {
      name: 'filter-storage',
    }
  )
);
