import { create } from 'zustand';
import type { Issue, BubbleVersion } from '../types';
import { storageGet, storageSet } from '../utils/storage';
import { runAllChecks } from '../engine/sequenceChecker';

interface IssueState {
  issues: Issue[];
  loadIssues: () => void;
  runDetection: (
    bubbles: { version: BubbleVersion; sequenceNumber: number }[]
  ) => Issue[];
  clearPageIssues: (pageId: string, bubbleIds: string[]) => void;
  resolveIssue: (issueId: string) => void;
  getBubbleIssues: (bubbleId: string) => Issue[];
  getPageIssues: (pageId: string, bubbleIds: string[]) => Issue[];
}

export const useIssueStore = create<IssueState>((set, get) => ({
  issues: [],

  loadIssues: () => {
    const issues = storageGet<Issue[]>('issues', []);
    set({ issues });
  },

  runDetection: (bubbles) => {
    const newIssues = runAllChecks(bubbles);
    const issues = [...get().issues, ...newIssues];
    storageSet('issues', issues);
    set({ issues });
    return newIssues;
  },

  clearPageIssues: (pageId, bubbleIds) => {
    const issues = get().issues.filter(
      i => !(bubbleIds.includes(i.bubbleId) && i.status === 'OPEN')
    );
    storageSet('issues', issues);
    set({ issues });
  },

  resolveIssue: (issueId) => {
    const issues = get().issues.map(i =>
      i.id === issueId ? { ...i, status: 'RESOLVED' as const } : i
    );
    storageSet('issues', issues);
    set({ issues });
  },

  getBubbleIssues: (bubbleId) => {
    return get().issues.filter(i => i.bubbleId === bubbleId && i.status === 'OPEN');
  },

  getPageIssues: (pageId, bubbleIds) => {
    return get().issues.filter(i => bubbleIds.includes(i.bubbleId) && i.status === 'OPEN');
  },
}));
