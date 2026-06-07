import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Case, Evidence, ConflictItem, HistoryLog, ConflictStatus, CaseStatus } from '../types';
import { mockCases, mockEvidences, mockConflicts, mockHistoryLogs } from '../data/mockData';

interface CaseState {
  cases: Case[];
  evidences: Evidence[];
  conflicts: ConflictItem[];
  historyLogs: HistoryLog[];
  selectedCaseId: string | null;
  
  selectCase: (caseId: string) => void;
  getCaseById: (caseId: string) => Case | undefined;
  getEvidencesByCaseId: (caseId: string) => Evidence[];
  getConflictsByCaseId: (caseId: string) => ConflictItem[];
  getHistoryByCaseId: (caseId: string) => HistoryLog[];
  
  updateConflictStatus: (conflictId: string, status: ConflictStatus, reviewer: string, remark?: string) => void;
  updateCaseStatus: (caseId: string, status: CaseStatus) => void;
  addHistoryLog: (caseId: string, action: string, operator: string, detail: string) => void;
  advanceStep: (caseId: string) => void;
  resetToInitialData: () => void;
}

export const useCaseStore = create<CaseState>()(
  persist(
    (set, get) => ({
      cases: mockCases,
      evidences: mockEvidences,
      conflicts: mockConflicts,
      historyLogs: mockHistoryLogs,
      selectedCaseId: null,

      selectCase: (caseId) => set({ selectedCaseId: caseId }),

      getCaseById: (caseId) => get().cases.find(c => c.id === caseId),

      getEvidencesByCaseId: (caseId) => get().evidences.filter(e => e.caseId === caseId),

      getConflictsByCaseId: (caseId) => get().conflicts.filter(c => c.caseId === caseId),

      getHistoryByCaseId: (caseId) => get().historyLogs.filter(h => h.caseId === caseId).sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),

      updateConflictStatus: (conflictId, status, reviewer, remark) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        set(state => {
          const conflict = state.conflicts.find(c => c.id === conflictId);
          const updatedConflicts = state.conflicts.map(c =>
            c.id === conflictId
              ? { ...c, status, reviewer, reviewedAt: now, remark }
              : c
          );
          
          if (conflict) {
            const caseItem = state.cases.find(c => c.id === conflict.caseId);
            if (caseItem && status !== 'pending') {
              const pendingConflicts = updatedConflicts.filter(
                c => c.caseId === conflict.caseId && c.status === 'pending'
              );
              if (pendingConflicts.length === 0) {
                return {
                  conflicts: updatedConflicts,
                  cases: state.cases.map(c =>
                    c.id === conflict.caseId
                      ? { ...c, status: status === 'confirmed' ? 'normal' : 'pending_review' as CaseStatus, updatedAt: now }
                      : c
                  ),
                };
              }
            }
          }
          
          return { conflicts: updatedConflicts };
        });
      },

      updateCaseStatus: (caseId, status) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        set(state => ({
          cases: state.cases.map(c =>
            c.id === caseId ? { ...c, status, updatedAt: now } : c
          ),
        }));
      },

      addHistoryLog: (caseId, action, operator, detail) => {
        const now = new Date().toLocaleString('zh-CN', { hour12: false });
        const newLog: HistoryLog = {
          id: `log-${Date.now()}`,
          caseId,
          action,
          operator,
          timestamp: now,
          detail,
        };
        set(state => ({
          historyLogs: [...state.historyLogs, newLog],
        }));
      },

      advanceStep: (caseId) => {
        set(state => ({
          cases: state.cases.map(c =>
            c.id === caseId && c.currentStep < 3
              ? { ...c, currentStep: c.currentStep + 1, updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }) }
              : c
          ),
        }));
      },

      resetToInitialData: () => {
        set({
          cases: mockCases,
          evidences: mockEvidences,
          conflicts: mockConflicts,
          historyLogs: mockHistoryLogs,
          selectedCaseId: null,
        });
      },
    }),
    {
      name: 'noise-mediation-storage',
    }
  )
);
