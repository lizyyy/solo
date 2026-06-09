import { createContext, useContext, useState, ReactNode } from 'react';
import type { JdItem, SupplementRecord, OverrideRecord, Conclusion } from '../types';
import { mockItems } from '../data/mockItems';

interface StoreCtx {
  items: JdItem[];
  addSupplement: (s: SupplementRecord) => void;
  addOverride: (o: OverrideRecord) => void;
  updateItemConclusion: (itemId: string, c: Conclusion) => void;
  setBimNote: (itemId: string, note: string) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<JdItem[]>(() => JSON.parse(JSON.stringify(mockItems)));

  const addSupplement = (s: SupplementRecord) =>
    setItems(list =>
      list.map(it => (it.id === s.itemId ? { ...it, supplements: [...it.supplements, s], status: 'confirmed' as const } : it))
    );

  const addOverride = (o: OverrideRecord) =>
    setItems(list =>
      list.map(it =>
        it.id === o.itemId
          ? { ...it, overrides: [...it.overrides, o], conclusion: o.after, status: 'override_pending' as const }
          : it
      )
    );

  const updateItemConclusion = (itemId: string, c: Conclusion) =>
    setItems(list => list.map(it => (it.id === itemId ? { ...it, conclusion: c } : it)));

  const setBimNote = (itemId: string, note: string) =>
    setItems(list => list.map(it => (it.id === itemId ? { ...it, bimNote: note } : it)));

  return (
    <Ctx.Provider value={{ items, addSupplement, addOverride, updateItemConclusion, setBimNote }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}
