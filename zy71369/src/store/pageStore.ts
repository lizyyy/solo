import { create } from 'zustand';
import type { ComicPage } from '../types';
import { storageGet, storageSet } from '../utils/storage';
import { generateId } from '../utils/helpers';

interface PageState {
  pages: ComicPage[];
  currentPageId: string | null;
  loadPages: () => void;
  setCurrentPage: (id: string | null) => void;
  addPage: (page: Omit<ComicPage, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => ComicPage;
  updatePage: (id: string, updates: Partial<ComicPage>) => void;
  deletePage: (id: string) => void;
}

export const usePageStore = create<PageState>((set, get) => ({
  pages: [],
  currentPageId: null,

  loadPages: () => {
    const pages = storageGet<ComicPage[]>('pages', []);
    set({ pages });
  },

  setCurrentPage: (id) => {
    set({ currentPageId: id });
  },

  addPage: (pageData) => {
    const now = new Date().toISOString();
    const newPage: ComicPage = {
      ...pageData,
      id: generateId(),
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    const pages = [...get().pages, newPage];
    storageSet('pages', pages);
    set({ pages });
    return newPage;
  },

  updatePage: (id, updates) => {
    const pages = get().pages.map(p =>
      p.id === id
        ? { ...p, ...updates, updatedAt: new Date().toISOString() }
        : p
    );
    storageSet('pages', pages);
    set({ pages });
  },

  deletePage: (id) => {
    const pages = get().pages.filter(p => p.id !== id);
    storageSet('pages', pages);
    set({ pages, currentPageId: get().currentPageId === id ? null : get().currentPageId });
  },
}));
