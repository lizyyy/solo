import { create } from 'zustand';
import { 
  EvidenceChain, 
  StudentMistake, 
  LectureSnapshot, 
  ManualCorrection, 
  Commentary,
  FilterOptions,
  ImportResult
} from '@/types';
import { storage } from '@/utils/storage';
import { buildEvidenceChains } from '@/utils/chainBuilder';

interface AppState {
  chains: EvidenceChain[];
  mistakes: StudentMistake[];
  snapshots: LectureSnapshot[];
  corrections: ManualCorrection[];
  commentaries: Commentary[];
  filters: FilterOptions;
  selectedChainId: string | null;
  importResult: ImportResult | null;
  isLoading: boolean;
  
  loadFromStorage: () => void;
  importPackage: (data: {
    mistakes: StudentMistake[];
    snapshots: LectureSnapshot[];
    corrections: ManualCorrection[];
    commentaries: Commentary[];
  }) => ImportResult;
  setFilters: (filters: FilterOptions) => void;
  selectChain: (id: string | null) => void;
  resolveConflict: (chainId: string) => void;
  clearImportResult: () => void;
  getFilteredChains: () => EvidenceChain[];
  getMistakeById: (id: string) => StudentMistake | undefined;
  getSnapshotByQuestionId: (questionId: string) => LectureSnapshot | undefined;
  getCorrectionsByMistakeId: (mistakeId: string) => ManualCorrection[];
  getCommentaryByMistakeId: (mistakeId: string) => Commentary | undefined;
}

export const useStore = create<AppState>((set, get) => ({
  chains: [],
  mistakes: [],
  snapshots: [],
  corrections: [],
  commentaries: [],
  filters: {},
  selectedChainId: null,
  importResult: null,
  isLoading: false,

  loadFromStorage: () => {
    set({ isLoading: true });
    const chains = storage.getChains();
    const mistakes = storage.getMistakes();
    const snapshots = storage.getSnapshots();
    const corrections = storage.getCorrections();
    const commentaries = storage.getCommentaries();
    
    set({
      chains,
      mistakes,
      snapshots,
      corrections,
      commentaries,
      isLoading: false
    });
  },

  importPackage: (data) => {
    set({ isLoading: true });
    
    const result = buildEvidenceChains(
      data.mistakes,
      data.snapshots,
      data.corrections,
      data.commentaries
    );
    
    set({
      chains: result.chains,
      mistakes: data.mistakes,
      snapshots: data.snapshots,
      corrections: data.corrections,
      commentaries: data.commentaries,
      importResult: result,
      isLoading: false
    });
    
    storage.saveChains(result.chains);
    storage.saveMistakes(data.mistakes);
    storage.saveSnapshots(data.snapshots);
    storage.saveCorrections(data.corrections);
    storage.saveCommentaries(data.commentaries);
    
    return result;
  },

  setFilters: (filters) => {
    set({ filters });
  },

  selectChain: (id) => {
    set({ selectedChainId: id });
  },

  resolveConflict: (chainId) => {
    const { chains } = get();
    const updatedChains = chains.map(chain => {
      if (chain.id === chainId) {
        return {
          ...chain,
          status: 'confirmed' as const,
          currentConclusion: '冲突已人工解决，已完成处理',
          updatedAt: new Date().toISOString()
        };
      }
      return chain;
    });
    
    set({ chains: updatedChains });
    storage.saveChains(updatedChains);
  },

  clearImportResult: () => {
    set({ importResult: null });
  },

  getFilteredChains: () => {
    const { chains, mistakes, filters } = get();
    
    return chains.filter(chain => {
      const mistake = mistakes.find(m => m.id === chain.mistakeId);
      if (!mistake) return false;
      
      if (filters.difficulty && mistake.difficulty !== filters.difficulty) {
        return false;
      }
      if (filters.status && chain.status !== filters.status) {
        return false;
      }
      if (filters.hasDuplicate !== undefined && chain.hasDuplicate !== filters.hasDuplicate) {
        return false;
      }
      if (filters.missingSnapshot !== undefined && chain.missingSnapshot !== filters.missingSnapshot) {
        return false;
      }
      if (filters.studentName && !mistake.studentName.includes(filters.studentName)) {
        return false;
      }
      
      return true;
    });
  },

  getMistakeById: (id) => {
    return get().mistakes.find(m => m.id === id);
  },

  getSnapshotByQuestionId: (questionId) => {
    return get().snapshots.find(s => s.questionId === questionId);
  },

  getCorrectionsByMistakeId: (mistakeId) => {
    return get().corrections.filter(c => c.mistakeId === mistakeId);
  },

  getCommentaryByMistakeId: (mistakeId) => {
    return get().commentaries.find(c => c.mistakeId === mistakeId);
  },
}));
