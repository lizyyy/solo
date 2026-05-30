import { create } from 'zustand';
import type { DiagnosisIssue, DiagnosisResult, IssueType } from '../types/diagnosis';

interface DiagnosisState {
  issues: DiagnosisIssue[];
  isChecking: boolean;
  lastCheckedAt: number | null;

  addIssue: (issue: DiagnosisIssue) => void;
  removeIssue: (id: string) => void;
  resolveIssue: (id: string) => void;
  setIssues: (issues: DiagnosisIssue[]) => void;
  setIsChecking: (checking: boolean) => void;
  clearIssues: () => void;
  getSummary: () => DiagnosisResult['summary'];
  getIssuesByType: (type: IssueType) => DiagnosisIssue[];
  getIssuesByMaterial: (materialId: string) => DiagnosisIssue[];
  getUnresolvedIssues: () => DiagnosisIssue[];
}

export const useDiagnosisStore = create<DiagnosisState>((set, get) => ({
  issues: [],
  isChecking: false,
  lastCheckedAt: null,

  addIssue: (issue) =>
    set((state) => ({
      issues: [...state.issues, issue],
      lastCheckedAt: Date.now(),
    })),

  removeIssue: (id) =>
    set((state) => ({
      issues: state.issues.filter((i) => i.id !== id),
    })),

  resolveIssue: (id) =>
    set((state) => ({
      issues: state.issues.map((i) =>
        i.id === id ? { ...i, resolved: true, resolvedAt: Date.now() } : i
      ),
    })),

  setIssues: (issues) =>
    set({
      issues,
      lastCheckedAt: Date.now(),
    }),

  setIsChecking: (checking) => set({ isChecking: checking }),

  clearIssues: () => set({ issues: [], lastCheckedAt: null }),

  getSummary: () => {
    const issues = get().issues;
    const byType = {
      normal_reversed: 0,
      boundary_gap: 0,
      sample_sparse: 0,
    } as Record<IssueType, number>;
    const byMaterial: Record<string, number> = {};

    issues.forEach((issue) => {
      if (!issue.resolved) {
        byType[issue.type]++;
        byMaterial[issue.location.materialId] =
          (byMaterial[issue.location.materialId] || 0) + 1;
      }
    });

    return {
      totalIssues: issues.filter((i) => !i.resolved).length,
      byType,
      byMaterial,
    };
  },

  getIssuesByType: (type) =>
    get().issues.filter((i) => i.type === type && !i.resolved),

  getIssuesByMaterial: (materialId) =>
    get().issues.filter((i) => i.location.materialId === materialId && !i.resolved),

  getUnresolvedIssues: () => get().issues.filter((i) => !i.resolved),
}));
