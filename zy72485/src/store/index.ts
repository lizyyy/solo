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
  ImportItemDetail,
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
    const sessionId = `IMP-${Date.now().toString(36).toUpperCase()}`;
    const importedAt = new Date().toISOString();
    const { id: operatorId, name: operatorName } = state.currentUser;

    const sessionHashes = new Set<string>();
    const successNotices: ConstructionNotice[] = [];
    const details: ImportItemDetail[] = [];
    const newRecordTitles: string[] = [];
    const historyDupTitles: string[] = [];
    const sessionDupTitles: string[] = [];
    const remarkUpdatedTitles: string[] = [];

    let successCount = 0;
    let duplicateCount = 0;
    let remarkUpdatedCount = 0;

    newNotices.forEach(noticeData => {
      const hash = generateHash(noticeData);
      const title = noticeData.title || '未命名告示';
      const noticeNo = noticeData.noticeNo || '-';
      const location = noticeData.location || '-';
      const baseDetail: ImportItemDetail = {
        title, noticeNo, location, importHash: hash,
        status: 'new', conclusion: '',
      };

      const existingNotice = state.notices.find(n => n.importHash === hash);

      if (sessionHashes.has(hash)) {
        duplicateCount++;
        sessionDupTitles.push(title);
        const prevInBatch = details.find(d => d.importHash === hash);
        baseDetail.status = 'duplicate_skipped';
        baseDetail.duplicateType = 'current_session';
        baseDetail.duplicateWith = {
          id: '同批次重复项',
          existedAt: importedAt,
          remark: prevInBatch ? `本批次第${details.indexOf(prevInBatch!) + 1}条已导入` : '本批次前面已导入',
        };
        baseDetail.conclusion = `【本次重复】同一导入批次内第${sessionDupTitles.filter(x => x === title).length + 1}次出现「${title}」，按规则自动跳过，不新增告示和点位。来源：${operatorName}于${new Date(importedAt).toLocaleString('zh-CN')}发起的本次批量导入。`;
        details.push(baseDetail);
        return;
      }

      if (existingNotice) {
        sessionHashes.add(hash);
        const inputRemark = noticeData.remark || '';
        const oldRemark = existingNotice.remark || '';

        if (inputRemark && inputRemark !== oldRemark) {
          remarkUpdatedCount++;
          remarkUpdatedTitles.push(title);
          baseDetail.status = 'remark_updated';
          baseDetail.duplicateType = 'historical';
          baseDetail.duplicateWith = {
            id: existingNotice.id,
            existedAt: existingNotice.createdAt,
            remark: oldRemark || '(原备注为空)',
          };
          baseDetail.remarkChanged = {
            before: oldRemark || '(空)',
            after: inputRemark,
            operator: operatorName,
            reason: '重复导入时检测到备注差异',
          };

          const beforeChange = { ...existingNotice };
          const updatedNotice = {
            ...existingNotice,
            remark: inputRemark,
            updatedAt: new Date().toISOString(),
          };
          const version: NoticeVersion = {
            id: generateId(),
            noticeId: existingNotice.id,
            version: state.noticeVersions.filter(v => v.noticeId === existingNotice.id).length + 1,
            content: { remark: inputRemark },
            remark: `重复导入时更新备注（导入批次${sessionId}）`,
            operatorId, operatorName,
            createdAt: new Date().toISOString(),
          };
          set(st => ({
            notices: st.notices.map(n => n.id === existingNotice.id ? updatedNotice : n),
            noticeVersions: [...st.noticeVersions, version],
          }));

          const relatedPoint = state.points.find(p => p.noticeId === existingNotice.id);
          const affected = [`告示 ${existingNotice.id} 备注已从「${oldRemark || '空'}」更新为「${inputRemark}」（版本v${version.version}）`];
          if (relatedPoint) {
            affected.push(`关联点位「${relatedPoint.name}」(${relatedPoint.id}) 保留原因已同步更新引用`);
            baseDetail.affectedPointId = relatedPoint.id;
            baseDetail.affectedPointName = relatedPoint.name;
            set(st => ({
              points: st.points.map(p => p.id === relatedPoint.id ? {
                ...p,
                keepReason: `备注更新：${inputRemark}。原：${relatedPoint.keepReason}`,
                updatedAt: new Date().toISOString(),
              } : p),
            }));
          }

          state.addChangeLog({
            entityType: 'notice',
            entityId: existingNotice.id,
            action: 'update',
            beforeChange,
            afterChange: { remark: inputRemark },
            operatorId, operatorName,
            reason: `重复导入时检测到备注差异，自动更新备注（导入批次${sessionId}）`,
            affectedResults: affected,
          });

          baseDetail.conclusion = `【历史重复+备注变更】「${title}」已于${new Date(existingNotice.createdAt).toLocaleString('zh-CN')}导入。本次检测到备注变化：前「${oldRemark || '空'}」→ 后「${inputRemark}」，操作人${operatorName}。已自动创建版本v${version.version}并同步更新${relatedPoint ? '关联点位「' + relatedPoint.name + '」' : '告示记录'}。处理状态：记录保留、备注更新、点位不新增。`;
          details.push(baseDetail);
          return;
        }

        duplicateCount++;
        historyDupTitles.push(title);
        baseDetail.status = 'duplicate_skipped';
        baseDetail.duplicateType = 'historical';
        baseDetail.duplicateWith = {
          id: existingNotice.id,
          existedAt: existingNotice.createdAt,
          remark: existingNotice.remark || '(原备注为空)',
        };
        const relatedPoint = state.points.find(p => p.noticeId === existingNotice.id);
        if (relatedPoint) {
          baseDetail.affectedPointId = relatedPoint.id;
          baseDetail.affectedPointName = relatedPoint.name;
        }
        baseDetail.conclusion = `【历史重复】「${title}」（编号${noticeNo}）已于${new Date(existingNotice.createdAt).toLocaleString('zh-CN')}由${state.currentUser.name}导入，已关联${relatedPoint ? '点位「' + relatedPoint.name + '」' : '点位未生成'}。本次导入按规则跳过，告示数量不增加、点位数量不增加、预警数量不翻倍。来源：本次导入批次${sessionId}由${operatorName}发起。`;
        sessionHashes.add(hash);
        details.push(baseDetail);
        return;
      }

      sessionHashes.add(hash);
      successCount++;
      newRecordTitles.push(title);

      const newNotice: ConstructionNotice = {
        id: generateId(),
        title, noticeNo,
        constructionType: noticeData.constructionType || 'road',
        location,
        startDate: noticeData.startDate || '',
        endDate: noticeData.endDate || '',
        description: noticeData.description || '',
        status: noticeData.status || 'draft',
        importHash: hash,
        remark: noticeData.remark || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      successNotices.push(newNotice);

      const pointNeedsDetour = newNotice.description.includes('改道') || newNotice.title.includes('改道');
      const newPoint: Point = {
        id: generateId(),
        name: `${location}点位`,
        location,
        lat: 30.27 + Math.random() * 0.02,
        lng: 120.15 + Math.random() * 0.02,
        type: 'notice',
        status: pointNeedsDetour ? 'exception' : (newNotice.status === 'active' ? 'warning' : 'normal'),
        keepReason: pointNeedsDetour
          ? '施工告示导入生成的点位，检测到改道描述，地图同步需复核'
          : '施工告示第一次导入生成的点位，待规划员补看坡道记录后更新信息',
        missingMaterials: pointNeedsDetour ? ['改道路线图', '现场指示牌'] : [],
        nextHandler: pointNeedsDetour ? 'resident_rep' : 'planner',
        noticeId: newNotice.id,
        detourSynced: !pointNeedsDetour,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      baseDetail.status = 'new';
      baseDetail.affectedPointId = newPoint.id;
      baseDetail.affectedPointName = newPoint.name;

      const affected = [
        `新建施工告示 ${newNotice.id}（版本v1）`,
        `生成点位「${newPoint.name}」(${newPoint.id})，初始状态：${newPoint.status}`,
      ];

      if (pointNeedsDetour) {
        const task: ReviewTask = {
          id: generateId(),
          pointId: newPoint.id,
          pointName: newPoint.name,
          type: 'detour_not_synced',
          status: 'pending',
          description: `告示「${title}」包含改道内容，地图同步情况未确认，需居民代表现场复核`,
          assignee: 'u2',
          assigneeName: '王代表',
          createdAt: new Date().toISOString(),
        };
        set(st => ({ reviewTasks: [...st.reviewTasks, task] }));
        affected.push(`检测到改道内容，创建复核任务指派给居民代表王代表，不自动归正常`);
        baseDetail.conclusion = `【新记录】「${title}」（编号${noticeNo}）首次导入。已生成告示、点位「${newPoint.name}」；检测到含改道描述→状态标为异常、下一步由居民代表复核，已创建复核任务，不会误归为正常。三步工作流第1步（施工告示第一次导入）完成。来源：导入批次${sessionId}。`;
      } else {
        baseDetail.conclusion = `【新记录】「${title}」（编号${noticeNo}）首次导入成功。已生成告示记录${newNotice.id}、点位「${newPoint.name}」。下一步责任人：街道规划员小姜（补看无障碍坡道记录）。三步工作流第1步完成，等待进入第2步。来源：导入批次${sessionId}由${operatorName}发起。`;
      }

      set(st => ({ points: [...st.points, newPoint] }));
      state.addChangeLog({
        entityType: 'notice',
        entityId: newNotice.id,
        action: 'import',
        beforeChange: null,
        afterChange: newNotice,
        operatorId, operatorName,
        reason: `施工告示第一次导入（批次${sessionId}）`,
        affectedResults: affected,
      });

      details.push(baseDetail);
    });

    set(st => ({
      notices: [...st.notices, ...successNotices],
      importResult: {
        success: successCount,
        duplicate: duplicateCount,
        remarkUpdated: remarkUpdatedCount,
        failed: 0,
        sessionId,
        importedAt,
        operatorId, operatorName,
        details,
        summary: {
          newRecords: newRecordTitles,
          historicalDuplicates: historyDupTitles,
          sessionDuplicates: sessionDupTitles,
          remarkUpdated: remarkUpdatedTitles,
        },
      } as ImportResult,
    }));

    return {
      success: successCount,
      duplicate: duplicateCount,
      remarkUpdated: remarkUpdatedCount,
      failed: 0,
      sessionId,
      importedAt,
      operatorId, operatorName,
      details,
      summary: {
        newRecords: newRecordTitles,
        historicalDuplicates: historyDupTitles,
        sessionDuplicates: sessionDupTitles,
        remarkUpdated: remarkUpdatedTitles,
      },
    } as ImportResult;
  },

  updateNotice: (id, updates, reason) => {
    const state = get();
    const notice = state.notices.find(n => n.id === id);
    if (!notice) return;

    const beforeChange = { ...notice };
    const updatedNotice = { ...notice, ...updates, updatedAt: new Date().toISOString() };
    const operatorId = state.currentUser.id;
    const operatorName = state.currentUser.name;

    const versionNum = state.noticeVersions.filter(v => v.noticeId === id).length + 1;
    const newVersion: NoticeVersion = {
      id: generateId(),
      noticeId: id,
      version: versionNum,
      content: updates,
      remark: reason,
      operatorId, operatorName,
      createdAt: new Date().toISOString(),
    };

    set(st => ({
      notices: st.notices.map(n => n.id === id ? updatedNotice : n),
      noticeVersions: [...st.noticeVersions, newVersion],
    }));

    const affectedResults: string[] = [];
    const updateKeys = Object.keys(updates);
    updateKeys.forEach(key => {
      const beforeVal = JSON.stringify((beforeChange as any)[key] || '(空)');
      const afterVal = JSON.stringify((updates as any)[key] || '(空)');
      affectedResults.push(`字段「${key}」变更：${beforeVal} → ${afterVal}`);
    });
    affectedResults.push(`创建施工告示版本 v${versionNum}`);

    const point = state.points.find(p => p.noticeId === id);
    if (point) {
      let newStatus = point.status;
      let keepReasonAppend = '';
      if (updates.status === 'active') {
        newStatus = 'warning';
        keepReasonAppend = '；告示状态更新为进行中，点位同步预警';
      }
      if (updates.status === 'completed') {
        newStatus = 'normal';
        keepReasonAppend = '；告示已完成，点位同步正常';
      }
      if (updates.status === 'cancelled') {
        newStatus = 'normal';
        keepReasonAppend = '；告示已取消，点位同步正常';
      }

      if ('remark' in updates) {
        keepReasonAppend += `；备注由「${beforeChange.remark || '空'}」改为「${updates.remark || '空'}」（${operatorName}操作，原因：${reason}）`;
      }

      if (keepReasonAppend) {
        affectedResults.push(`点位「${point.name}」(${point.id}) 受影响：状态 ${point.status} → ${newStatus}，保留原因已同步更新引用`);
      }

      set(st => ({
        points: st.points.map(p => p.id === point.id ? {
          ...p,
          status: newStatus,
          keepReason: point.keepReason + keepReasonAppend,
          updatedAt: new Date().toISOString(),
        } : p),
      }));
    } else {
      affectedResults.push('未关联点位，无点位联动变更');
    }

    state.addChangeLog({
      entityType: 'notice',
      entityId: id,
      action: 'update',
      beforeChange,
      afterChange: updates,
      operatorId, operatorName,
      reason: `${reason}（操作人：${operatorName}，影响字段：${updateKeys.join('、')}）`,
      affectedResults,
    });
  },

  getNoticeVersions: (noticeId) => {
    return get().noticeVersions.filter(v => v.noticeId === noticeId).sort((a, b) => b.version - a.version);
  },

  createRamp: (rampData, reason) => {
    const state = get();
    const operatorId = state.currentUser.id;
    const operatorName = state.currentUser.name;
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

    set(st => ({
      ramps: [...st.ramps, newRamp],
    }));

    const affected: string[] = [`创建无障碍坡道记录 ${newRamp.id}，位置：${newRamp.location}`];

    if (rampData.relatedNoticeId) {
      const point = state.points.find(p => p.noticeId === rampData.relatedNoticeId);
      if (point) {
        let newStatus: Point['status'] = point.status;
        let newNextHandler: Point['nextHandler'] = point.nextHandler;
        let keepReasonAdd = `；街道规划员小姜补看无障碍坡道记录（${new Date().toLocaleString('zh-CN')}），已关联坡道 ${newRamp.id}`;
        let detourNeedsReview = !point.detourSynced;

        if (detourNeedsReview && point.status !== 'pending_review') {
          newStatus = 'pending_review';
          newNextHandler = 'resident_rep';
          keepReasonAdd += '；改道未同步，点位不直接归正常，提交居民代表复核';
          const existingTask = state.reviewTasks.find(
            t => t.pointId === point.id && t.status === 'pending'
          );
          if (!existingTask) {
            const task: ReviewTask = {
              id: generateId(),
              pointId: point.id,
              pointName: point.name,
              type: 'detour_not_synced',
              status: 'pending',
              description: `规划员补看坡道记录后，改道仍未同步地图，需居民代表现场复核`,
              assignee: 'u2',
              assigneeName: '王代表',
              createdAt: new Date().toISOString(),
            };
            set(st => ({ reviewTasks: [...st.reviewTasks, task] }));
            affected.push(`创建复核任务，指派居民代表王代表确认改道同步情况`);
          }
        } else if (!detourNeedsReview) {
          newStatus = 'normal';
          newNextHandler = 'planner';
          keepReasonAdd += '；坡道已关联且改道同步，点位信息完整';
        }

        affected.push(`点位「${point.name}」(${point.id}) 三步工作流第2步完成：类型 ${point.type}→both，状态 ${point.status}→${newStatus}，下一步责任人→${newNextHandler === 'resident_rep' ? '居民代表复核' : '街道规划员小姜'}`);
        affected.push(`三步工作流：第1步(告示导入)✓ → 第2步(补看坡道)✓ → 第3步(点位清单更新)${detourNeedsReview ? '待复核后完成' : '✓'}`);

        set(st => ({
          points: st.points.map(p => p.id === point.id ? {
            ...p,
            rampId: newRamp.id,
            type: 'both',
            status: newStatus,
            nextHandler: newNextHandler,
            keepReason: point.keepReason + keepReasonAdd,
            updatedAt: new Date().toISOString(),
          } : p),
        }));
      } else {
        affected.push('未找到关联施工告示的点位，点位清单不更新');
      }
    }

    state.addChangeLog({
      entityType: 'ramp',
      entityId: newRamp.id,
      action: 'create',
      beforeChange: null,
      afterChange: newRamp,
      operatorId, operatorName,
      reason: `${reason}（街道规划员小姜补看无障碍坡道记录）`,
      affectedResults: affected,
    });
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

    const beforeChange = { detourSynced: point.detourSynced, status: point.status, nextHandler: point.nextHandler };
    
    let newStatus: Point['status'] = point.status;
    let newNextHandler: Point['nextHandler'] = point.nextHandler;
    let affected: string[] = [];
    let logReason = '';

    if (!synced) {
      newStatus = 'exception';
      newNextHandler = 'resident_rep';
      logReason = '发现改道未同步到地图';
      const existingTask = state.reviewTasks.find(
        t => t.pointId === pointId && t.type === 'detour_not_synced' && t.status === 'pending'
      );
      if (!existingTask) {
        const newTask: ReviewTask = {
          id: generateId(),
          pointId,
          pointName: point.name,
          type: 'detour_not_synced',
          status: 'pending',
          description: '施工临时改道未同步到地图，需要居民代表现场复核确认改道方案和导向标识',
          assignee: 'u2',
          assigneeName: '王代表',
          createdAt: new Date().toISOString(),
        };
        set(state => ({
          reviewTasks: [...state.reviewTasks, newTask],
        }));
        affected.push(`创建复核任务[改道未同步]，指派给居民代表王代表现场复核`);
      } else {
        affected.push(`改道未同步复核任务已存在，等待居民代表处理`);
      }
    } else {
      newStatus = 'pending_review';
      newNextHandler = 'resident_rep';
      logReason = '规划员标记改道已同步，提交居民代表复核确认';
      const existingTask = state.reviewTasks.find(
        t => t.pointId === pointId && t.type === 'detour_not_synced' && t.status === 'pending'
      );
      if (!existingTask) {
        const newTask: ReviewTask = {
          id: generateId(),
          pointId,
          pointName: point.name,
          type: 'detour_not_synced',
          status: 'pending',
          description: '规划员已标记改道同步完成，需居民代表现场确认地图标识无误后才能归为正常',
          assignee: 'u2',
          assigneeName: '王代表',
          createdAt: new Date().toISOString(),
        };
        set(state => ({
          reviewTasks: [...state.reviewTasks, newTask],
        }));
        affected.push(`创建复核任务[同步确认]，指派居民代表王代表现场确认地图改道标识`);
      } else {
        affected.push(`待居民代表复核确认改道同步无误后，点位方可恢复正常`);
      }
    }

    set(state => ({
      points: state.points.map(p => p.id === pointId ? {
        ...p,
        detourSynced: synced,
        status: newStatus,
        nextHandler: newNextHandler,
        updatedAt: new Date().toISOString(),
      } : p),
    }));

    state.addChangeLog({
      entityType: 'point',
      entityId: pointId,
      action: 'update',
      beforeChange,
      afterChange: { detourSynced: synced, status: newStatus, nextHandler: newNextHandler },
      operatorId: state.currentUser.id,
      operatorName: state.currentUser.name,
      reason: logReason,
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
