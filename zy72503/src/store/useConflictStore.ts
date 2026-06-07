import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conflict, RemarkHistory, Review, ModelParams, KnowledgeLink, AssigneeRole } from '@/types';
import { mockConflicts, mockRemarkHistories, mockReviews, mockModelParams, mockKnowledgeLinks } from '@/utils/mockData';

interface ConflictState {
  conflicts: Conflict[];
  remarkHistories: RemarkHistory[];
  reviews: Review[];
  modelParams: ModelParams[];
  knowledgeLinks: KnowledgeLink[];
  
  addConflicts: (newConflicts: Conflict[]) => void;
  updateConflict: (id: string, updates: Partial<Conflict>) => void;
  addRemark: (conflictId: string, newRemark: string, operator: string, operatorRole: AssigneeRole) => void;
  updateReview: (conflictId: string, review: Partial<Review>) => void;
  getConflict: (id: string) => Conflict | undefined;
  getRemarkHistories: (conflictId: string) => RemarkHistory[];
  getReview: (conflictId: string) => Review | undefined;
  getModelParams: (conflictId: string) => ModelParams | undefined;
  addKnowledgeLinks: (links: KnowledgeLink[]) => void;
  resetToMock: () => void;
}

export const useConflictStore = create<ConflictState>()(
  persist(
    (set, get) => ({
      conflicts: mockConflicts,
      remarkHistories: mockRemarkHistories,
      reviews: mockReviews,
      modelParams: mockModelParams,
      knowledgeLinks: mockKnowledgeLinks,

      addConflicts: (newConflicts) => set((state) => {
        const existingIds = new Set(state.conflicts.map((c) => c.id));
        const toAdd = newConflicts.filter((c) => !existingIds.has(c.id));
        return { conflicts: [...toAdd, ...state.conflicts] };
      }),

      updateConflict: (id, updates) => set((state) => ({
        conflicts: state.conflicts.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ),
      })),

      addRemark: (conflictId, newRemark, operator, operatorRole) => set((state) => {
        const conflict = state.conflicts.find((c) => c.id === conflictId);
        const oldRemark = conflict?.currentRemark || '';
        
        const history: RemarkHistory = {
          id: `rh_${Date.now()}`,
          conflictId,
          oldRemark,
          newRemark,
          operator,
          operatorRole,
          createdAt: new Date().toISOString(),
        };

        return {
          remarkHistories: [history, ...state.remarkHistories],
          conflicts: state.conflicts.map((c) =>
            c.id === conflictId ? { ...c, currentRemark: newRemark, updatedAt: new Date().toISOString() } : c
          ),
        };
      }),

      updateReview: (conflictId, reviewData) => set((state) => {
        const existing = state.reviews.find((r) => r.conflictId === conflictId);
        
        if (existing) {
          return {
            reviews: state.reviews.map((r) =>
              r.conflictId === conflictId ? { ...r, ...reviewData } : r
            ),
          };
        } else {
          const newReview: Review = {
            id: `r_${Date.now()}`,
            conflictId,
            reason: reviewData.reason || '',
            existingMaterials: reviewData.existingMaterials || [],
            missingMaterials: reviewData.missingMaterials || [],
            nextStep: reviewData.nextStep || '',
            assignee: reviewData.assignee || 'annotator',
            assigneeName: reviewData.assigneeName || '周姐',
            status: reviewData.status || 'open',
            dueDate: reviewData.dueDate,
          };
          return { reviews: [newReview, ...state.reviews] };
        }
      }),

      getConflict: (id) => get().conflicts.find((c) => c.id === id),
      getRemarkHistories: (conflictId) => get().remarkHistories.filter((h) => h.conflictId === conflictId),
      getReview: (conflictId) => get().reviews.find((r) => r.conflictId === conflictId),
      getModelParams: (conflictId) => get().modelParams.find((p) => p.conflictId === conflictId),
      
      addKnowledgeLinks: (links) => set((state) => ({
        knowledgeLinks: [...links, ...state.knowledgeLinks],
      })),

      resetToMock: () => set({
        conflicts: mockConflicts,
        remarkHistories: mockRemarkHistories,
        reviews: mockReviews,
        modelParams: mockModelParams,
        knowledgeLinks: mockKnowledgeLinks,
      }),
    }),
    {
      name: 'conflict-store',
    }
  )
);
