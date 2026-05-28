import { create } from 'zustand';

interface FilterStore {
  activeDomainIds: Set<string>;
  toggleDomain: (domainId: string) => void;
  selectOnly: (domainId: string) => void;
  clearFilter: () => void;
  isDomainActive: (domainId: string) => boolean;
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  activeDomainIds: new Set<string>(),
  toggleDomain: (domainId: string) => {
    const next = new Set(get().activeDomainIds);
    if (next.has(domainId)) {
      next.delete(domainId);
    } else {
      next.add(domainId);
    }
    set({ activeDomainIds: next });
  },
  selectOnly: (domainId: string) => {
    set({ activeDomainIds: new Set([domainId]) });
  },
  clearFilter: () => {
    set({ activeDomainIds: new Set() });
  },
  isDomainActive: (domainId: string) => {
    return get().activeDomainIds.has(domainId);
  },
}));
