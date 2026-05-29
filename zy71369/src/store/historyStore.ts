import { create } from 'zustand';
import type { RevisionLog, BubbleVersion } from '../types';
import { storageGet } from '../utils/storage';

interface HistoryState {
  getVersionRevisions: (versionId: string) => RevisionLog[];
  getBubbleRevisions: (bubbleId: string, versions: BubbleVersion[]) => RevisionLog[];
  compareVersions: (v1: BubbleVersion, v2: BubbleVersion) => {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

export const useHistoryStore = create<HistoryState>((get) => ({
  getVersionRevisions: (versionId) => {
    const revisions = storageGet<RevisionLog[]>('revisions', []);
    return revisions
      .filter(r => r.versionId === versionId)
      .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());
  },

  getBubbleRevisions: (bubbleId, versions) => {
    const versionIds = versions.map(v => v.id);
    const revisions = storageGet<RevisionLog[]>('revisions', []);
    return revisions
      .filter(r => versionIds.includes(r.versionId))
      .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime());
  },

  compareVersions: (v1, v2) => {
    const diffs: { field: string; oldValue: string; newValue: string }[] = [];
    const fields: (keyof BubbleVersion)[] = ['text', 'x', 'y', 'width', 'height', 'status', 'remark'];

    fields.forEach(field => {
      const val1 = String(v1[field]);
      const val2 = String(v2[field]);
      if (val1 !== val2) {
        diffs.push({ field, oldValue: val1, newValue: val2 });
      }
    });

    return diffs;
  },
}));
