import { create } from 'zustand';
import type { Bubble, BubbleVersion, RevisionLog } from '../types';
import { storageGet, storageSet } from '../utils/storage';
import { generateId } from '../utils/helpers';
import { VersionManager } from '../engine/versionManager';

interface BubbleState {
  bubbles: Bubble[];
  versions: BubbleVersion[];
  revisions: RevisionLog[];
  selectedBubbleId: string | null;
  loadBubbles: () => void;
  setSelectedBubble: (id: string | null) => void;
  importBubble: (params: {
    pageId: string;
    sequenceNumber: number;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    operator: string;
    remark?: string;
  }) => { bubble: Bubble; newVersion: BubbleVersion; isConflict: boolean };
  createNewVersion: (params: {
    bubbleId: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    operator: string;
    remark?: string;
  }) => { bubble: Bubble; newVersion: BubbleVersion };
  setCurrentVersion: (bubbleId: string, versionId: string) => void;
  updateVersion: (versionId: string, updates: Partial<BubbleVersion>) => void;
  updateBubbleStatus: (bubbleId: string, newStatus: Bubble['status'], operator: string, remark?: string) => void;
  updateSequenceNumber: (bubbleId: string, newSequence: number) => void;
  reorderBubbles: (bubbleIds: string[]) => void;
  getBubbleVersions: (bubbleId: string) => BubbleVersion[];
  getCurrentVersion: (bubbleId: string) => BubbleVersion | undefined;
}

export const useBubbleStore = create<BubbleState>((set, get) => ({
  bubbles: [],
  versions: [],
  revisions: [],
  selectedBubbleId: null,

  loadBubbles: () => {
    const bubbles = storageGet<Bubble[]>('bubbles', []);
    const versions = storageGet<BubbleVersion[]>('versions', []);
    const revisions = storageGet<RevisionLog[]>('revisions', []);
    set({ bubbles, versions, revisions });
  },

  setSelectedBubble: (id) => {
    set({ selectedBubbleId: id });
  },

  importBubble: ({ pageId, sequenceNumber, text, x, y, width, height, operator, remark = '' }) => {
    const compositeKey = `${pageId}:${sequenceNumber}`;
    const existingBubble = get().bubbles.find(b => b.compositeKey === compositeKey);

    const newVersionData: Omit<BubbleVersion, 'id' | 'version' | 'createdAt'> = {
      bubbleId: compositeKey,
      text,
      x,
      y,
      width,
      height,
      status: 'PENDING',
      operator,
      remark,
    };

    const result = VersionManager.checkAndCreateVersion(existingBubble, newVersionData);

    const bubbles = existingBubble
      ? get().bubbles.map(b => b.id === existingBubble.id ? result.bubble : b)
      : [...get().bubbles, result.bubble];

    result.newVersion.bubbleId = result.bubble.id;
    const versions = [...get().versions, result.newVersion];

    storageSet('bubbles', bubbles);
    storageSet('versions', versions);
    set({ bubbles, versions });

    return result;
  },

  createNewVersion: ({ bubbleId, text, x, y, width, height, operator, remark = '' }) => {
    const bubble = get().bubbles.find(b => b.id === bubbleId);
    if (!bubble) throw new Error('Bubble not found');

    const newVersionNum = bubble.latestVersion + 1;
    const newVersion: BubbleVersion = {
      id: generateId(),
      bubbleId,
      version: newVersionNum,
      text,
      x,
      y,
      width,
      height,
      status: 'PENDING',
      operator,
      createdAt: new Date().toISOString(),
      remark,
    };

    const updatedBubble: Bubble = {
      ...bubble,
      latestVersion: newVersionNum,
      hasConflict: true,
      status: 'PENDING',
    };

    const bubbles = get().bubbles.map(b => b.id === bubbleId ? updatedBubble : b);
    const versions = [...get().versions, newVersion];

    storageSet('bubbles', bubbles);
    storageSet('versions', versions);
    set({ bubbles, versions });

    return { bubble: updatedBubble, newVersion };
  },

  setCurrentVersion: (bubbleId, versionId) => {
    const bubble = get().bubbles.find(b => b.id === bubbleId);
    const allVersions = get().getBubbleVersions(bubbleId);
    if (!bubble) return;

    const result = VersionManager.setCurrentVersion(bubble, versionId, allVersions);

    const bubbles = get().bubbles.map(b => b.id === bubbleId ? result.bubble : b);
    const versions = get().versions.map(v => {
      const updated = result.updatedVersions.find(uv => uv.id === v.id);
      return updated || v;
    });
    const revisions = [...get().revisions, ...result.revisions];

    storageSet('bubbles', bubbles);
    storageSet('versions', versions);
    storageSet('revisions', revisions);
    set({ bubbles, versions, revisions });
  },

  updateVersion: (versionId, updates) => {
    const versions = get().versions.map(v => {
      if (v.id === versionId) {
        const revision = VersionManager.createRevision(
          versionId,
          Object.keys(updates)[0] || 'unknown',
          String(Object.values(v)[Object.keys(updates).indexOf(Object.keys(updates)[0])] ?? ''),
          String(Object.values(updates)[0] ?? ''),
          'editor'
        );
        set(state => ({ revisions: [...state.revisions, revision] }));
        storageSet('revisions', [...get().revisions, revision]);
        return { ...v, ...updates };
      }
      return v;
    });
    storageSet('versions', versions);
    set({ versions });
  },

  updateBubbleStatus: (bubbleId, newStatus, operator, remark) => {
    const currentVersion = get().getCurrentVersion(bubbleId);
    if (!currentVersion) return;

    const { updatedVersion, revision } = VersionManager.updateBubbleStatus(
      currentVersion,
      newStatus,
      operator,
      remark
    );

    const versions = get().versions.map(v => v.id === currentVersion.id ? updatedVersion : v);
    const revisions = [...get().revisions, revision];
    const bubbles = get().bubbles.map(b =>
      b.id === bubbleId ? { ...b, status: newStatus } : b
    );

    storageSet('versions', versions);
    storageSet('revisions', revisions);
    storageSet('bubbles', bubbles);
    set({ versions, revisions, bubbles });
  },

  updateSequenceNumber: (bubbleId, newSequence) => {
    const bubble = get().bubbles.find(b => b.id === bubbleId);
    if (!bubble) return;

    const newCompositeKey = `${bubble.pageId}:${newSequence}`;
    const existingBubble = get().bubbles.find(b => b.compositeKey === newCompositeKey && b.id !== bubbleId);

    if (existingBubble) {
      throw new Error(`序号 ${newSequence} 已存在`);
    }

    const bubbles = get().bubbles.map(b =>
      b.id === bubbleId
        ? { ...b, sequenceNumber: newSequence, compositeKey: newCompositeKey }
        : b
    );

    storageSet('bubbles', bubbles);
    set({ bubbles });
  },

  reorderBubbles: (bubbleIds) => {
    const bubbles = get().bubbles.map(b => {
      const newIndex = bubbleIds.indexOf(b.id);
      if (newIndex === -1) return b;
      const newSequence = newIndex + 1;
      return {
        ...b,
        sequenceNumber: newSequence,
        compositeKey: `${b.pageId}:${newSequence}`,
      };
    });

    storageSet('bubbles', bubbles);
    set({ bubbles });
  },

  getBubbleVersions: (bubbleId) => {
    return get().versions
      .filter(v => v.bubbleId === bubbleId)
      .sort((a, b) => b.version - a.version);
  },

  getCurrentVersion: (bubbleId) => {
    const bubble = get().bubbles.find(b => b.id === bubbleId);
    if (!bubble) return undefined;
    return get().versions.find(v => v.id === bubble.currentVersionId);
  },
}));
