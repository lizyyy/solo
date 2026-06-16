import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Notification, 
  Version, 
  Source, 
  Comment, 
  SourceInput, 
  CommentType,
  DiffEntry 
} from '../types';
import { generateId } from '../utils/id';
import { calculateDiff } from '../utils/diff';
import { 
  sampleNotifications, 
  sampleVersions, 
  sampleSources, 
  sampleComments 
} from '../data/sampleData';

interface AppState {
  notifications: Notification[];
  versions: Record<string, Version[]>;
  sources: Record<string, Source[]>;
  comments: Record<string, Comment[]>;
  currentUser: string;
  isInitialized: boolean;
  
  initializeWithSamples: () => void;
  clearAllData: () => void;
  
  addNotification: (
    data: Omit<Notification, 'id' | 'createdAt' | 'updatedAt' | 'currentVersion'>,
    sources: SourceInput[]
  ) => string;
  
  updateNotification: (
    id: string,
    data: Partial<Notification>,
    changeReason: string
  ) => void;
  
  addComment: (
    notificationId: string,
    content: string,
    type: CommentType
  ) => void;
  
  addSource: (
    notificationId: string,
    source: SourceInput
  ) => void;
  
  getNotification: (id: string) => Notification | undefined;
  getVersions: (notificationId: string) => Version[];
  getSources: (notificationId: string) => Source[];
  getComments: (notificationId: string) => Comment[];
  
  compareVersions: (
    notificationId: string,
    v1: number,
    v2: number
  ) => DiffEntry[];
  
  getExportData: (notificationId: string) => {
    notification: Notification;
    versions: Version[];
    sources: Source[];
    comments: Comment[];
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      notifications: [],
      versions: {},
      sources: {},
      comments: {},
      currentUser: '小温（琴房前台）',
      isInitialized: false,

      initializeWithSamples: () => {
        const existingIds = new Set(get().notifications.map(n => n.id));
        const newNotifications = sampleNotifications.filter(n => !existingIds.has(n.id));
        const newVersions: Record<string, Version[]> = {};
        const newSources: Record<string, Source[]> = {};
        const newComments: Record<string, Comment[]> = {};
        
        newNotifications.forEach(n => {
          if (sampleVersions[n.id]) newVersions[n.id] = sampleVersions[n.id];
          if (sampleSources[n.id]) newSources[n.id] = sampleSources[n.id];
          if (sampleComments[n.id]) newComments[n.id] = sampleComments[n.id];
        });

        set({
          notifications: [...get().notifications, ...newNotifications],
          versions: { ...get().versions, ...newVersions },
          sources: { ...get().sources, ...newSources },
          comments: { ...get().comments, ...newComments },
          isInitialized: true
        });
      },

      clearAllData: () => {
        set({
          notifications: [],
          versions: {},
          sources: {},
          comments: {},
          isInitialized: false
        });
      },

      addNotification: (data, sources) => {
        const id = generateId();
        const now = new Date().toISOString();
        const newNotification: Notification = {
          ...data,
          id,
          createdAt: now,
          updatedAt: now,
          currentVersion: 1
        };

        const initialVersion: Version = {
          id: generateId(),
          notificationId: id,
          versionNumber: 1,
          snapshot: data,
          modifiedBy: get().currentUser,
          modifiedAt: now,
          changeReason: '初始创建',
          diff: []
        };

        const newSources: Source[] = sources.map(s => ({
          id: generateId(),
          notificationId: id,
          ...s,
          uploadTime: now,
          uploadedBy: get().currentUser
        }));

        set(state => ({
          notifications: [...state.notifications, newNotification],
          versions: {
            ...state.versions,
            [id]: [initialVersion]
          },
          sources: {
            ...state.sources,
            [id]: newSources
          },
          comments: {
            ...state.comments,
            [id]: []
          }
        }));

        return id;
      },

      updateNotification: (id, data, changeReason) => {
        const state = get();
        const notification = state.notifications.find(n => n.id === id);
        if (!notification) return;

        const now = new Date().toISOString();
        const currentVersions = state.versions[id] || [];
        const lastVersion = currentVersions[currentVersions.length - 1];
        const newVersionNum = notification.currentVersion + 1;

        const newSnapshot = {
          ...lastVersion.snapshot,
          ...data
        };

        const diff = calculateDiff(lastVersion.snapshot, newSnapshot);

        if (diff.length === 0) return;

        const newVersion: Version = {
          id: generateId(),
          notificationId: id,
          versionNumber: newVersionNum,
          snapshot: newSnapshot,
          modifiedBy: state.currentUser,
          modifiedAt: now,
          changeReason,
          diff
        };

        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === id
              ? { ...n, ...data, updatedAt: now, currentVersion: newVersionNum }
              : n
          ),
          versions: {
            ...state.versions,
            [id]: [...currentVersions, newVersion]
          }
        }));
      },

      addComment: (notificationId, content, type) => {
        const newComment: Comment = {
          id: generateId(),
          notificationId,
          content,
          author: get().currentUser,
          createdAt: new Date().toISOString(),
          type
        };

        set(state => ({
          comments: {
            ...state.comments,
            [notificationId]: [...(state.comments[notificationId] || []), newComment]
          }
        }));
      },

      addSource: (notificationId, source) => {
        const existingSources = get().sources[notificationId] || [];
        const duplicateKey = `${source.type}-${source.name}-${source.reference}`;
        const isDuplicate = existingSources.some(
          s => `${s.type}-${s.name}-${s.reference}` === duplicateKey
        );
        if (isDuplicate) return;

        const newSource: Source = {
          id: generateId(),
          notificationId,
          ...source,
          uploadTime: new Date().toISOString(),
          uploadedBy: get().currentUser
        };

        set(state => ({
          sources: {
            ...state.sources,
            [notificationId]: [...(state.sources[notificationId] || []), newSource]
          }
        }));
      },

      getNotification: (id) => {
        return get().notifications.find(n => n.id === id);
      },

      getVersions: (notificationId) => {
        return get().versions[notificationId] || [];
      },

      getSources: (notificationId) => {
        const sources = get().sources[notificationId] || [];
        const seen = new Set<string>();
        return sources.filter(s => {
          const key = `${s.type}-${s.name}-${s.reference}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      },

      getComments: (notificationId) => {
        return get().comments[notificationId] || [];
      },

      compareVersions: (notificationId, v1, v2) => {
        const versions = get().versions[notificationId] || [];
        const version1 = versions.find(v => v.versionNumber === v1);
        const version2 = versions.find(v => v.versionNumber === v2);

        if (!version1 || !version2) return [];
        return calculateDiff(version1.snapshot, version2.snapshot);
      },

      getExportData: (notificationId) => {
        const state = get();
        const notification = state.notifications.find(n => n.id === notificationId);
        if (!notification) throw new Error('Notification not found');

        return {
          notification,
          versions: state.versions[notificationId] || [],
          sources: state.getSources(notificationId),
          comments: state.comments[notificationId] || []
        };
      }
    }),
    {
      name: 'orchestra-notification-store',
      version: 1,
      partialize: (state) => ({
        notifications: state.notifications,
        versions: state.versions,
        sources: state.sources,
        comments: state.comments,
        currentUser: state.currentUser,
        isInitialized: state.isInitialized
      })
    }
  )
);
