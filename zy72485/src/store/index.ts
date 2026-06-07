import { create } from 'zustand';
import type {
  ConstructionNotice,
  RampRecord,
  Point,
  ReviewTask,
  ChangeLog,
  User,
  NoticeVersion,
  RampVersion,
  ImportResult,
} from '../types';
import {
  mockNotices,
  mockRamps,
  mockPoints,
  mockReviewTasks,
  mockChangeLogs,
  mockUsers,
  mockNoticeVersions,
  mockRampVersions,
} from '../data/mockData';

interface AppState {
  currentUser: User;
  notices: ConstructionNotice[];
  noticeVersions: NoticeVersion[];
  ramps: RampRecord[];
  rampVersions: RampVersion[];
  points: Point[];
  reviewTasks: ReviewTask[];
  changeLogs: ChangeLog[];
  selectedNoticeId: string | null;
  selectedRampId: string | null;
  selectedPointId: string | null;
  importResult: ImportResult | null;

  setSelectedNoticeId: (id: string | null) => void;
  setSelectedRampId: (id: string | null) => void;
  setSelectedPointId: (id: string | null) => void;

  importNotices: (newNotices: Partial<ConstructionNotice>[]) => ImportResult;
  updateNotice: (id: string, updates: Partial<ConstructionNotice>, reason: string) => void;
  getNoticeVersions: (noticeId: string) => NoticeVersion[];

  createRamp: (ramp: Partial<RampRecord>, reason: string) => void;
  updateRamp: (id: string, updates: Partial<RampRecord>, reason: string) => void;
  getRampVersions: (rampId: string) => RampVersion[];

  updatePoint: (id: string, updates: Partial<Point>, reason: string) => void;
  updatePointDetourSync: (pointId: string, synced: boolean) => void;

  reviewTask: (taskId: string, status: 'approved' | 'rejected', opinion: string) => void;

  addChangeLog: (log: Omit<ChangeLog, 'id' | 'createdAt'>) => void;

  getStats: () => {
    totalNotices: number;
    totalPoints: number;
    pendingReview: number;
    exceptionCount: number;
    todayChanges: number;
  };
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const generateHash = (notice: Partial<ConstructionNotice>) => {
  const str = `${notice.title}-${notice.noticeNo}-${notice.location}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: mockUsers[0],
  notices: mockNotices,
  noticeVersions: mockNoticeVersions,
  ramps: mockRamps,
  rampVersions: mockRampVersions,
  points: mockPoints,
  reviewTasks: mockReviewTasks,
  changeLogs: mockChangeLogs,
  selectedNoticeId: null,
  selectedRampId: null,
  selectedPointId: null,
  importResult: null,

  setSelectedNoticeId: (id) => set({ selectedNoticeId: id }),
  setSelectedRampId: (id) => set({ selectedRampId: id }),
  setSelectedPointId: (id) => set({ selectedPointId: id }),

  importNotices: (newNotices) => {
    const state = get();
    const existingHashes = new Set(state.notices.map(n => n.importHash));
    const success: ConstructionNotice[] = [];
    const duplicates: string[] = [];

    newNotices.forEach(noticeData => {
      const hash = generateHash(noticeData);
      if (existingHashes.has(hash)) {
        duplicates.push(noticeData.title || '未命名告示');
      } else {
        const newNotice: ConstructionNotice = {
          id: generateId(),
          title: noticeData.title || '',
          noticeNo: noticeData.noticeNo || '',
          constructionType: noticeData.constructionType || 'road',
          location: noticeData.location || '',
          startDate: noticeData.startDate || '',
          endDate: noticeData.endDate || '',
          description: noticeData.description || '',
          status: noticeData.status || 'draft',
          importHash: hash,
          remark: noticeData.remark || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        success.push(newNotice);
        existingHashes.add(hash);

        const newPoint: Point = {
          id: generateId(),
          name: `${noticeData.location}点位`,
          location: noticeData.location || '',
          lat: 30.27 + Math.random() * 0.02,
          lng: 120.15 + Math.random() * 0.02,
          type: 'notice',
          status: noticeData.status === 'active' ? 'warning' : 'normal',
          keepReason: '施工告示导入生成的点位',
          missingMaterials: [],
          nextHandler: 'planner',
          noticeId: newNotice.id,
          detourSynced: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set(state => ({
          points: [...state.points, newPoint],
        }));

        state.addChangeLog({
          entityType: 'notice',
          entityId: newNotice.id,
          action: 'import',
          beforeChange: null,
          afterChange: newNotice,
          operatorId: state.currentUser.id,
          operatorName: state.currentUser.name,
          reason: '导入施工告示',
          affectedResults: [`生成点位 ${newPoint.name}`],
        });
      }
    });

    set(state => ({
      notices: [...state.notices, ...success],
      importResult: {
        success: success.length,
        duplicate: duplicates.length,
        failed: 0,
        duplicateItems: duplicates,
      },
    }));

    return {
      success: success.length,
      duplicate: duplicates.length,
      failed: 0,
      duplicateItems: duplicates,
    };
  },

  updateNotice: (id, updates, reason) => {
    const state = get();
    const notice = state.notices.find(n => n.id === id);
    if (!notice) return;

    const beforeChange = { ...notice };
    const updatedNotice = { ...notice, ...updates, updatedAt: new Date().toISOString() };

    const newVersion: NoticeVersion = {
      id: generateId(),
      noticeId: id,
      version: state.noticeVersions.filter(v => v.noticeId === id).length + 1,
      content: updates,
      remark: reason,
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      createdAt: new Date().toISOString(),
    };

    set(state => ({
      notices: state.notices.map(n => n.id === id ? updatedNotice : n),
      noticeVersions: [...state.noticeVersions, newVersion],
    }));

    state.addChangeLog({
      entityType: 'notice',
      entityId: id,
      action: 'update',
      beforeChange,
      afterChange: updates,
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      reason,
      affectedResults: ['更新施工告示信息'],
    });

    const point = state.points.find(p => p.noticeId === id);
    if (point) {
      let newStatus = point.status;
      if (updates.status === 'active') newStatus = 'warning';
      if (updates.status === 'completed') newStatus = 'normal';
      if (updates.status === 'cancelled') newStatus = 'normal';

      set(state => ({
        points: state.points.map(p => p.id === point.id ? {
          ...p,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        } : p),
      }));
    }
  },

  getNoticeVersions: (noticeId) => {
    return get().noticeVersions.filter(v => v.noticeId === noticeId).sort((a, b) => b.version - a.version);
  },

  createRamp: (rampData, reason) => {
    const state = get();
    const newRamp: RampRecord = {
      id: generateId(),
      location: rampData.location || '',
      rampType: rampData.rampType || 'slope',
      slope: rampData.slope || '',
      width: rampData.width || '',
      hasHandrail: rampData.hasHandrail || false,
      status: rampData.status || 'normal',
      remark: rampData.remark || '',
      relatedNoticeId: rampData.relatedNoticeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set(state => ({
      ramps: [...state.ramps, newRamp],
    }));

    state.addChangeLog({
      entityType: 'ramp',
      entityId: newRamp.id,
      action: 'create',
      beforeChange: null,
      afterChange: newRamp,
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      reason,
      affectedResults: ['创建无障碍坡道记录'],
    });

    if (rampData.relatedNoticeId) {
      const point = state.points.find(p => p.noticeId === rampData.relatedNoticeId);
      if (point) {
        set(state => ({
          points: state.points.map(p => p.id === point.id ? {
            ...p,
            rampId: newRamp.id,
            type: 'both',
            status: 'normal',
            keepReason: '关联坡道记录，点位信息完整',
            updatedAt: new Date().toISOString(),
          } : p),
        }));
      }
    }
  },

  updateRamp: (id, updates, reason) => {
    const state = get();
    const ramp = state.ramps.find(r => r.id === id);
    if (!ramp) return;

    const beforeChange = { ...ramp };
    const updatedRamp = { ...ramp, ...updates, updatedAt: new Date().toISOString() };

    const newVersion: RampVersion = {
      id: generateId(),
      rampId: id,
      version: state.rampVersions.filter(v => v.rampId === id).length + 1,
      content: updates,
      remark: reason,
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      createdAt: new Date().toISOString(),
    };

    set(state => ({
      ramps: state.ramps.map(r => r.id === id ? updatedRamp : r),
      rampVersions: [...state.rampVersions, newVersion],
    }));

    state.addChangeLog({
      entityType: 'ramp',
      entityId: id,
      action: 'update',
      beforeChange,
      afterChange: updates,
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      reason,
      affectedResults: ['更新坡道记录信息'],
    });
  },

  getRampVersions: (rampId) => {
    return get().rampVersions.filter(v => v.rampId === rampId).sort((a, b) => b.version - a.version);
  },

  updatePoint: (id, updates, reason) => {
    const state = get();
    const point = state.points.find(p => p.id === id);
    if (!point) return;

    const beforeChange = { ...point };
    const updatedPoint = { ...point, ...updates, updatedAt: new Date().toISOString() };

    set(state => ({
      points: state.points.map(p => p.id === id ? updatedPoint : p),
    }));

    state.addChangeLog({
      entityType: 'point',
      entityId: id,
      action: 'update',
      beforeChange,
      afterChange: updates,
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      reason,
      affectedResults: ['更新点位信息'],
    });
  },

  updatePointDetourSync: (pointId, synced) => {
    const state = get();
    const point = state.points.find(p => p.id === pointId);
    if (!point) return;

    const beforeChange = { detourSynced: point.detourSynced, status: point.status };
    
    let newStatus: Point['status'] = point.status;
    let affected: string[] = [];

    if (!synced) {
      newStatus = 'exception';
      const newTask: ReviewTask = {
        id: generateId(),
        pointId,
        pointName: point.name,
        type: 'detour_not_synced',
        status: 'pending',
        description: '施工临时改道未同步到地图，需要居民代表现场复核',
        assignee: 'u2',
        assigneeName: '王代表',
        createdAt: new Date().toISOString(),
      };
      set(state => ({
        reviewTasks: [...state.reviewTasks, newTask],
      }));
      affected.push(`创建复核任务，指派给居民代表`);
    } else {
      newStatus = 'normal';
      affected.push('改道已同步，点位恢复正常');
    }

    set(state => ({
      points: state.points.map(p => p.id === pointId ? {
        ...p,
        detourSynced: synced,
        status: newStatus,
        nextHandler: synced ? 'planner' : 'resident_rep',
        updatedAt: new Date().toISOString(),
      } : p),
    }));

    state.addChangeLog({
      entityType: 'point',
      entityId: pointId,
      action: 'update',
      beforeChange,
      afterChange: { detourSynced: synced, status: newStatus },
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      reason: synced ? '确认改道已同步到地图' : '发现改道未同步到地图',
      affectedResults: affected,
    });
  },

  reviewTask: (taskId, status, opinion) => {
    const state = get();
    const task = state.reviewTasks.find(t => t.id === taskId);
    if (!task) return;

    set(state => ({
      reviewTasks: state.reviewTasks.map(t => t.id === taskId ? {
        ...t,
        status,
        reviewerOpinion: opinion,
        reviewedAt: new Date().toISOString(),
      } : t),
    }));

    if (status === 'approved') {
      set(state => ({
        points: state.points.map(p => p.id === task.pointId ? {
          ...p,
          status: 'normal',
          detourSynced: true,
          nextHandler: 'planner',
          updatedAt: new Date().toISOString(),
        } : p),
      }));

      state.addChangeLog({
        entityType: 'point',
        entityId: task.pointId,
        action: 'update',
        beforeChange: null,
        afterChange: { status: 'normal', detourSynced: true },
        operatorId: 'u2',
        operatorName: '王代表',
        reason: `复核通过：${opinion}`,
        affectedResults: ['复核通过，点位恢复正常'],
      });
    } else {
      set(state => ({
        points: state.points.map(p => p.id === task.pointId ? {
          ...p,
          status: 'exception',
          nextHandler: 'planner',
          updatedAt: new Date().toISOString(),
        } : p),
      }));

      state.addChangeLog({
        entityType: 'point',
        entityId: task.pointId,
        action: 'update',
        beforeChange: null,
        afterChange: { status: 'exception', nextHandler: 'planner' },
        operatorId: 'u2',
        operatorName: '王代表',
        reason: `复核不通过：${opinion}`,
        affectedResults: ['复核不通过，退回规划员处理'],
      });
    }
  },

  addChangeLog: (log) => {
    const newLog: ChangeLog = {
      id: generateId(),
      ...log,
      createdAt: new Date().toISOString(),
    };
    set(state => ({
      changeLogs: [newLog, ...state.changeLogs],
    }));
  },

  getStats: () => {
    const state = get();
    const today = new Date().toISOString().split('T')[0];
    const todayChanges = state.changeLogs.filter(l => l.createdAt.startsWith(today)).length;
    
    return {
      totalNotices: state.notices.length,
      totalPoints: state.points.length,
      pendingReview: state.reviewTasks.filter(t => t.status === 'pending').length,
      exceptionCount: state.points.filter(p => p.status === 'exception').length,
      todayChanges,
    };
  },
}));
