import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlayerFeedback, Schedule, Ranking, ImportedFile, Modification } from '../types';

interface AppState {
  feedbacks: PlayerFeedback[];
  schedules: Schedule[];
  rankings: Ranking[];
  importedFiles: ImportedFile[];
  selectedDate: string;
  activeTab: string;
  
  addFeedback: (feedback: Omit<PlayerFeedback, 'id'>) => void;
  updateFeedback: (id: string, updates: Partial<PlayerFeedback>) => void;
  deleteFeedback: (id: string) => void;
  markDuplicate: (id: string, duplicateOf: string) => void;
  
  addSchedule: (schedule: Schedule) => void;
  updateSchedule: (id: string, updates: Partial<Schedule>, reason: string, operator: string) => void;
  
  addRanking: (ranking: Ranking) => void;
  updateRanking: (id: string, updates: Partial<Ranking>, reason: string, operator: string) => void;
  
  addImportedFile: (file: ImportedFile) => void;
  updateImportedFile: (id: string, updates: Partial<ImportedFile>) => void;
  
  setSelectedDate: (date: string) => void;
  setActiveTab: (tab: string) => void;
  
  resetData: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      feedbacks: [],
      schedules: [],
      rankings: [],
      importedFiles: [],
      selectedDate: new Date().toISOString().split('T')[0],
      activeTab: 'import',

      addFeedback: (feedback) =>
        set((state) => ({
          feedbacks: [
            ...state.feedbacks,
            { ...feedback, id: generateId() } as PlayerFeedback,
          ],
        })),

      updateFeedback: (id, updates) =>
        set((state) => ({
          feedbacks: state.feedbacks.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        })),

      deleteFeedback: (id) =>
        set((state) => ({
          feedbacks: state.feedbacks.filter((f) => f.id !== id),
        })),

      markDuplicate: (id, duplicateOf) =>
        set((state) => ({
          feedbacks: state.feedbacks.map((f) =>
            f.id === id ? { ...f, isDuplicate: true, duplicateOf } : f
          ),
        })),

      addSchedule: (schedule) =>
        set((state) => ({
          schedules: [...state.schedules, schedule],
        })),

      updateSchedule: (id, updates, reason, operator) =>
        set((state) => ({
          schedules: state.schedules.map((s) =>
            s.id === id
              ? {
                  ...s,
                  ...updates,
                  history: [
                    ...s.history,
                    {
                      id: generateId(),
                      timestamp: new Date().toISOString(),
                      before: s,
                      after: updates,
                      operator,
                      reason,
                    } as any,
                  ],
                }
              : s
          ),
        })),

      addRanking: (ranking) =>
        set((state) => ({
          rankings: [...state.rankings, ranking],
        })),

      updateRanking: (id, updates, reason, operator) =>
        set((state) => ({
          rankings: state.rankings.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...updates,
                  modifications: [
                    ...r.modifications,
                    {
                      id: generateId(),
                      timestamp: new Date().toISOString(),
                      before: r,
                      after: updates,
                      reason,
                      operator,
                    } as Modification,
                  ],
                }
              : r
          ),
        })),

      addImportedFile: (file) =>
        set((state) => ({
          importedFiles: [...state.importedFiles, file],
        })),

      updateImportedFile: (id, updates) =>
        set((state) => ({
          importedFiles: state.importedFiles.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        })),

      setSelectedDate: (date) => set({ selectedDate: date }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      resetData: () =>
        set({
          feedbacks: [],
          schedules: [],
          rankings: [],
          importedFiles: [],
        }),
    }),
    {
      name: 'space-mine-schedule',
    }
  )
);
