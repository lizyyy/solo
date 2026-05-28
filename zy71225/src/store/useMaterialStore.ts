import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GameMaterials, VersionComparison, ParameterDiff, ReviewReport } from '@/types';
import { defaultMaterials, generateId, cloneMaterials } from '@/data/defaultMaterials';

interface MaterialStore {
  materials: GameMaterials[];
  currentMaterials: GameMaterials | null;
  versionComparison: VersionComparison | null;
  comparisonResults: {
    oldResult?: ReviewReport;
    newResult?: ReviewReport;
  } | null;
  
  loadDefaultMaterials: () => void;
  setCurrentMaterials: (materials: GameMaterials | null) => void;
  saveMaterials: (materials: GameMaterials) => void;
  deleteMaterials: (id: string) => void;
  duplicateMaterials: (id: string) => GameMaterials;
  exportMaterials: (id: string) => string;
  importMaterials: (jsonString: string) => GameMaterials | null;
  createComparison: (oldId: string, newId: string) => void;
  setComparisonResult: (type: 'old' | 'new', result: ReviewReport) => void;
  clearComparison: () => void;
}

function deepDiff(
  obj1: Record<string, unknown>,
  obj2: Record<string, unknown>,
  path = ''
): ParameterDiff[] {
  const diffs: ParameterDiff[] = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
    const val1 = obj1[key];
    const val2 = obj2[key];

    if (val1 === undefined && val2 !== undefined) {
      diffs.push({
        path: currentPath,
        oldValue: val1,
        newValue: val2,
        category: getCategory(currentPath),
      });
    } else if (val2 === undefined && val1 !== undefined) {
      diffs.push({
        path: currentPath,
        oldValue: val1,
        newValue: val2,
        category: getCategory(currentPath),
      });
    } else if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
      if (Array.isArray(val1) && Array.isArray(val2)) {
        if (JSON.stringify(val1) !== JSON.stringify(val2)) {
          diffs.push({
            path: currentPath,
            oldValue: val1,
            newValue: val2,
            category: getCategory(currentPath),
          });
        }
      } else {
        const nestedDiffs = deepDiff(
          val1 as Record<string, unknown>,
          val2 as Record<string, unknown>,
          currentPath
        );
        diffs.push(...nestedDiffs);
      }
    } else if (val1 !== val2) {
      diffs.push({
        path: currentPath,
        oldValue: val1,
        newValue: val2,
        category: getCategory(currentPath),
      });
    }
  }

  return diffs;
}

function getCategory(path: string): ParameterDiff['category'] {
  if (path.includes('initialPositions') || path.includes('position')) return 'position';
  if (path.includes('marketEvents') || path.includes('underlyingPrice') || path.includes('volatility')) return 'market';
  if (path.includes('margin')) return 'margin';
  if (path.includes('fee') || path.includes('slippage')) return 'fee';
  if (path.includes('greekTargets') || path.includes('delta') || path.includes('gamma') || path.includes('vega')) return 'target';
  return 'position';
}

export const useMaterialStore = create<MaterialStore>()(
  persist(
    (set, get) => ({
      materials: [],
      currentMaterials: null,
      versionComparison: null,
      comparisonResults: null,

      loadDefaultMaterials: () => {
        if (get().materials.length === 0) {
          set({
            materials: [defaultMaterials],
            currentMaterials: defaultMaterials,
          });
        }
      },

      setCurrentMaterials: (materials) => {
        set({ currentMaterials: materials });
      },

      saveMaterials: (materials) => {
        const existing = get().materials.find(m => m.id === materials.id);
        if (existing) {
          set({
            materials: get().materials.map(m => 
              m.id === materials.id ? { ...materials, updatedAt: Date.now() } : m
            ),
            currentMaterials: materials,
          });
        } else {
          const newMaterials = { ...materials, id: generateId(), createdAt: Date.now() };
          set({
            materials: [...get().materials, newMaterials],
            currentMaterials: newMaterials,
          });
        }
      },

      deleteMaterials: (id) => {
        set({
          materials: get().materials.filter(m => m.id !== id),
          currentMaterials: get().currentMaterials?.id === id ? null : get().currentMaterials,
        });
      },

      duplicateMaterials: (id) => {
        const original = get().materials.find(m => m.id === id);
        if (!original) return defaultMaterials;
        
        const duplicated = cloneMaterials(original);
        duplicated.id = generateId();
        duplicated.name = `${original.name} (副本)`;
        duplicated.createdAt = Date.now();
        
        set({
          materials: [...get().materials, duplicated],
          currentMaterials: duplicated,
        });
        
        return duplicated;
      },

      exportMaterials: (id) => {
        const materials = get().materials.find(m => m.id === id) || get().currentMaterials;
        if (!materials) return '';
        return JSON.stringify(materials, null, 2);
      },

      importMaterials: (jsonString) => {
        try {
          const parsed = JSON.parse(jsonString) as GameMaterials;
          
          if (!parsed.name || !parsed.initialPositions || !parsed.marketEvents) {
            return null;
          }
          
          const newMaterials = {
            ...parsed,
            id: generateId(),
            createdAt: Date.now(),
          };
          
          set({
            materials: [...get().materials, newMaterials],
            currentMaterials: newMaterials,
          });
          
          return newMaterials;
        } catch {
          return null;
        }
      },

      createComparison: (oldId, newId) => {
        const oldMaterials = get().materials.find(m => m.id === oldId);
        const newMaterials = get().materials.find(m => m.id === newId);
        
        if (!oldMaterials || !newMaterials) return;
        
        const parameterDiffs = deepDiff(
          oldMaterials as unknown as Record<string, unknown>,
          newMaterials as unknown as Record<string, unknown>
        );
        
        set({
          versionComparison: {
            oldMaterials,
            newMaterials,
            parameterDiffs,
          },
          comparisonResults: null,
        });
      },

      setComparisonResult: (type, result) => {
        set({
          comparisonResults: {
            ...get().comparisonResults,
            [type === 'old' ? 'oldResult' : 'newResult']: result,
          },
        });
      },

      clearComparison: () => {
        set({
          versionComparison: null,
          comparisonResults: null,
        });
      },
    }),
    {
      name: 'greek-defense-material-store',
    }
  )
);
