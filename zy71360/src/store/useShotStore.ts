import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Shot,
  ShotVersion,
  ShotStatus,
  User,
  AuditLog,
  ExportReport,
  DiffResult,
  ReportType,
  ExportFormat,
  AppState,
} from '@/types';
import {
  generateId,
  getNextVersion,
  getInitialVersion,
} from '@/utils/version';
import {
  detectFieldChanges,
  compareVersions as compareVersionsUtil,
} from '@/utils/diff';
import { validateShotNumber, parseShotNumber } from '@/utils/validation';
import { createAuditLog } from '@/utils/audit';
import { buildReportContent, exportReport as exportReportUtil } from '@/utils/export';
import {
  mockCurrentUser,
  createMockShots,
  createMockAuditLogs,
  mockExportReports,
} from '@/data/mockData';

interface ShotStore extends AppState {
  isHydrated: boolean;

  addShot: (
    shotData: { shotNumber: string; title: string; duration: number },
    versionData: Partial<ShotVersion>,
    reason: string
  ) => Shot | null;

  updateShot: (
    shotId: string,
    fieldUpdates: Partial<ShotVersion>,
    reason: string,
    isMajorChange?: boolean
  ) => ShotVersion | null;

  lockShot: (shotId: string, reason: string) => boolean;
  unlockShot: (shotId: string, reason: string) => boolean;

  rollbackToVersion: (
    shotId: string,
    targetVersionId: string,
    reason: string
  ) => ShotVersion | null;

  compareVersions: (
    shotId: string,
    versionId1: string,
    versionId2: string
  ) => DiffResult[];

  getCurrentVersion: (shotId: string) => ShotVersion | undefined;
  getVersionById: (shotId: string, versionId: string) => ShotVersion | undefined;
  getShotById: (shotId: string) => Shot | undefined;

  setFilters: (filters: Partial<AppState['filters']>) => void;
  getFilteredShots: () => Shot[];

  getAuditTrail: (
    shotId?: string,
    startDate?: string,
    endDate?: string
  ) => AuditLog[];

  generateReport: (
    type: ReportType,
    startDate: string,
    endDate: string,
    filters?: Record<string, any>
  ) => ExportReport;

  exportReport: (reportId: string, format: ExportFormat) => string;

  generateMonthlyReport: (yearMonth: string, shotId?: string) => ExportReport;

  setCurrentUser: (user: User) => void;
  hydrate: () => void;
  initializeMockData: () => void;
  clearAllData: () => void;
}

export const useShotStore = create<ShotStore>()(
  persist(
    (set, get) => ({
      currentUser: mockCurrentUser,
      shots: [],
      auditLogs: [],
      exportReports: [],
      filters: {
        search: '',
        scene: '',
        status: 'all',
        modifiedBy: '',
        dateRange: null,
      },
      isHydrated: false,

      hydrate: () => {
        set({ isHydrated: true });
      },

      initializeMockData: () => {
        const mockShots = createMockShots();
        const mockAudit = createMockAuditLogs(mockShots);
        set({
          shots: mockShots,
          auditLogs: mockAudit,
          exportReports: mockExportReports,
        });
      },

      clearAllData: () => {
        set({
          shots: [],
          auditLogs: [],
          exportReports: [],
          filters: {
            search: '',
            scene: '',
            status: 'all',
            modifiedBy: '',
            dateRange: null,
          },
        });
      },

      setCurrentUser: (user: User) => {
        set({ currentUser: user });
      },

      getShotById: (shotId: string) => {
        return get().shots.find((s) => s.id === shotId);
      },

      getCurrentVersion: (shotId: string) => {
        const shot = get().shots.find((s) => s.id === shotId);
        if (!shot) return undefined;
        return shot.versions.find((v) => v.id === shot.currentVersionId);
      },

      getVersionById: (shotId: string, versionId: string) => {
        const shot = get().shots.find((s) => s.id === shotId);
        if (!shot) return undefined;
        return shot.versions.find((v) => v.id === versionId);
      },

      addShot: (shotData, versionData, reason) => {
        const { shots, currentUser, auditLogs } = get();

        const validation = validateShotNumber(shotData.shotNumber, shots);
        if (!validation.valid) {
          return null;
        }

        const parsed = parseShotNumber(shotData.shotNumber);
        const shotId = generateId();
        const versionId = generateId();
        const initialVersion = getInitialVersion();

        const newVersion: ShotVersion = {
          id: versionId,
          shotId,
          version: initialVersion.versionString,
          majorVersion: initialVersion.major,
          minorVersion: initialVersion.minor,
          title: shotData.title,
          duration: shotData.duration,
          dialogue: versionData.dialogue || '',
          actionDescription: versionData.actionDescription || '',
          artNotes: versionData.artNotes || '',
          vfxNotes: versionData.vfxNotes || '',
          referenceLinks: versionData.referenceLinks || '',
          storyboardImage: versionData.storyboardImage,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          changeSummary: reason,
          fieldChanges: [],
        };

        const newShot: Shot = {
          id: shotId,
          shotNumber: shotData.shotNumber,
          scene: parsed.scene,
          sequence: parsed.sequence,
          currentVersionId: versionId,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          versions: [newVersion],
        };

        const auditLog = createAuditLog(
          'create',
          shotId,
          currentUser,
          reason,
          { shotNumber: shotData.shotNumber, title: shotData.title },
          versionId,
          shotData.shotNumber,
          `创建镜头 ${shotData.shotNumber}`,
          undefined,
          initialVersion.versionString
        );

        set({
          shots: [...shots, newShot],
          auditLogs: [auditLog, ...auditLogs],
        });

        return newShot;
      },

      updateShot: (shotId, fieldUpdates, reason, isMajorChange = false) => {
        const { shots, currentUser, auditLogs } = get();
        const shotIndex = shots.findIndex((s) => s.id === shotId);

        if (shotIndex === -1) return null;

        const shot = shots[shotIndex];
        const currentVersion = shot.versions.find(
          (v) => v.id === shot.currentVersionId
        );

        if (!currentVersion) return null;

        const fieldChanges = detectFieldChanges(
          currentVersion,
          fieldUpdates,
          reason,
          currentUser.id
        );

        if (fieldChanges.length === 0) return null;

        const nextVersion = getNextVersion(currentVersion, isMajorChange);
        const newVersionId = generateId();

        const newVersion: ShotVersion = {
          ...currentVersion,
          ...fieldUpdates,
          id: newVersionId,
          version: nextVersion.versionString,
          majorVersion: nextVersion.major,
          minorVersion: nextVersion.minor,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          changeSummary: reason,
          fieldChanges: fieldChanges.map((fc) => ({
            ...fc,
            id: generateId(),
            versionId: newVersionId,
          })),
        };

        const updatedShot: Shot = {
          ...shot,
          currentVersionId: newVersionId,
          updatedAt: new Date().toISOString(),
          versions: [...shot.versions, newVersion],
        };

        const newShots = [...shots];
        newShots[shotIndex] = updatedShot;

        const auditLog = createAuditLog(
          'edit',
          shotId,
          currentUser,
          reason,
          {
            fromVersion: currentVersion.version,
            toVersion: newVersion.version,
            changedFields: fieldChanges.map((f) => f.fieldName),
          },
          newVersionId,
          shot.shotNumber,
          `更新 ${shot.shotNumber} 的 ${fieldChanges.length} 个字段`,
          currentVersion.version,
          newVersion.version,
          fieldChanges.length
        );

        set({
          shots: newShots,
          auditLogs: [auditLog, ...auditLogs],
        });

        return newVersion;
      },

      lockShot: (shotId, reason) => {
        const { shots, currentUser, auditLogs } = get();
        const shotIndex = shots.findIndex((s) => s.id === shotId);

        if (shotIndex === -1) return false;

        const shot = shots[shotIndex];
        if (shot.status === 'locked') return false;

        const updatedShot: Shot = {
          ...shot,
          status: 'locked',
          lockedBy: currentUser.id,
          lockedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const newShots = [...shots];
        newShots[shotIndex] = updatedShot;

        const currentV = shot.versions.find((v) => v.id === shot.currentVersionId);
        const auditLog = createAuditLog(
          'lock',
          shotId,
          currentUser,
          reason,
          { version: currentV?.version },
          shot.currentVersionId,
          shot.shotNumber,
          `锁定 ${shot.shotNumber} 版本 v${currentV?.version}`,
          undefined,
          currentV?.version
        );

        set({
          shots: newShots,
          auditLogs: [auditLog, ...auditLogs],
        });

        return true;
      },

      unlockShot: (shotId, reason) => {
        const { shots, currentUser, auditLogs } = get();
        const shotIndex = shots.findIndex((s) => s.id === shotId);

        if (shotIndex === -1) return false;

        const shot = shots[shotIndex];
        if (shot.status !== 'locked') return false;

        const updatedShot: Shot = {
          ...shot,
          status: 'draft',
          lockedBy: undefined,
          lockedAt: undefined,
          updatedAt: new Date().toISOString(),
        };

        const newShots = [...shots];
        newShots[shotIndex] = updatedShot;

        const currentV = shot.versions.find((v) => v.id === shot.currentVersionId);
        const auditLog = createAuditLog(
          'unlock',
          shotId,
          currentUser,
          reason,
          { version: currentV?.version },
          shot.currentVersionId,
          shot.shotNumber,
          `解锁 ${shot.shotNumber} 版本 v${currentV?.version}`,
          currentV?.version
        );

        set({
          shots: newShots,
          auditLogs: [auditLog, ...auditLogs],
        });

        return true;
      },

      rollbackToVersion: (shotId, targetVersionId, reason) => {
        const { shots, currentUser, auditLogs } = get();
        const shotIndex = shots.findIndex((s) => s.id === shotId);

        if (shotIndex === -1) return null;

        const shot = shots[shotIndex];
        const targetVersion = shot.versions.find((v) => v.id === targetVersionId);
        const currentVersion = shot.versions.find(
          (v) => v.id === shot.currentVersionId
        );

        if (!targetVersion || !currentVersion) return null;
        if (targetVersionId === shot.currentVersionId) return null;

        const nextVersion = getNextVersion(currentVersion, true);
        const newVersionId = generateId();

        const fieldChanges: any[] = [];
        const trackFields = [
          'title',
          'dialogue',
          'actionDescription',
          'artNotes',
          'vfxNotes',
          'referenceLinks',
          'duration',
        ];

        for (const field of trackFields) {
          const oldVal = String(currentVersion[field as keyof ShotVersion] ?? '');
          const newVal = String(targetVersion[field as keyof ShotVersion] ?? '');
          if (oldVal !== newVal) {
            fieldChanges.push({
              id: generateId(),
              versionId: newVersionId,
              fieldName: field,
              oldValue: oldVal,
              newValue: newVal,
              diff: '',
              reason: reason,
              modifiedBy: currentUser.id,
              modifiedAt: new Date().toISOString(),
            });
          }
        }

        const newVersion: ShotVersion = {
          ...targetVersion,
          id: newVersionId,
          shotId,
          version: nextVersion.versionString,
          majorVersion: nextVersion.major,
          minorVersion: nextVersion.minor,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          rollbackFromVersionId: targetVersionId,
          rollbackReason: reason,
          changeSummary: `回滚到 v${targetVersion.version}`,
          fieldChanges,
        };

        const updatedShot: Shot = {
          ...shot,
          currentVersionId: newVersionId,
          updatedAt: new Date().toISOString(),
          versions: [...shot.versions, newVersion],
        };

        const newShots = [...shots];
        newShots[shotIndex] = updatedShot;

        const auditLog = createAuditLog(
          'rollback',
          shotId,
          currentUser,
          reason,
          {
            fromVersionId: targetVersionId,
            fromVersion: targetVersion.version,
            toVersion: newVersion.version,
          },
          newVersionId,
          shot.shotNumber,
          `回滚 ${shot.shotNumber} 到 v${targetVersion.version}`,
          currentVersion.version,
          newVersion.version,
          fieldChanges.length,
          true
        );

        set({
          shots: newShots,
          auditLogs: [auditLog, ...auditLogs],
        });

        return newVersion;
      },

      compareVersions: (shotId, versionId1, versionId2) => {
        const shot = get().shots.find((s) => s.id === shotId);
        if (!shot) return [];

        const v1 = shot.versions.find((v) => v.id === versionId1);
        const v2 = shot.versions.find((v) => v.id === versionId2);

        if (!v1 || !v2) return [];

        return compareVersionsUtil(v1, v2);
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      getFilteredShots: () => {
        const { shots, filters } = get();
        let filtered = [...shots];

        if (filters.search) {
          const search = filters.search.toLowerCase();
          filtered = filtered.filter(
            (s) =>
              s.shotNumber.toLowerCase().includes(search) ||
              s.versions[0]?.title.toLowerCase().includes(search)
          );
        }

        if (filters.scene) {
          filtered = filtered.filter((s) => s.scene === filters.scene);
        }

        if (filters.status !== 'all') {
          filtered = filtered.filter((s) => s.status === filters.status);
        }

        if (filters.modifiedBy) {
          filtered = filtered.filter(
            (s) =>
              s.versions.some((v) => v.createdBy === filters.modifiedBy) ||
              s.lockedBy === filters.modifiedBy
          );
        }

        if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
          filtered = filtered.filter(
            (s) =>
              s.updatedAt >= filters.dateRange![0] &&
              s.updatedAt <= filters.dateRange![1]
          );
        }

        return filtered.sort((a, b) => {
          if (a.scene !== b.scene) return a.scene.localeCompare(b.scene);
          return a.sequence - b.sequence;
        });
      },

      getAuditTrail: (shotId, startDate, endDate) => {
        let logs = [...get().auditLogs];

        if (shotId) {
          logs = logs.filter((l) => l.shotId === shotId);
        }
        if (startDate) {
          logs = logs.filter((l) => l.timestamp >= startDate);
        }
        if (endDate) {
          logs = logs.filter((l) => l.timestamp <= endDate);
        }

        return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      },

      generateReport: (type, startDate, endDate, filters = {}) => {
        const { shots, auditLogs, currentUser, exportReports } = get();

        const content = buildReportContent(startDate, endDate, shots, auditLogs, filters);

        const titleMap = {
          monthly: `${new Date(startDate).getFullYear()}年${new Date(startDate).getMonth() + 1}月复盘报告`,
          changes: '变更报告',
          custom: '自定义报告',
        };

        const report: ExportReport = {
          id: generateId(),
          title: titleMap[type],
          type,
          startDate,
          endDate,
          filters,
          content,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
        };

        const auditLog = createAuditLog(
          'export',
          'system',
          currentUser,
          `生成${titleMap[type]}`,
          { reportId: report.id, type, startDate, endDate },
          undefined,
          undefined,
          `导出${titleMap[type]}`
        );

        set({
          exportReports: [report, ...exportReports],
          auditLogs: [auditLog, ...auditLogs],
        });

        return report;
      },

      exportReport: (reportId, format) => {
        const report = get().exportReports.find((r) => r.id === reportId);
        if (!report) return '';
        return exportReportUtil(report, format);
      },

      generateMonthlyReport: (yearMonth, shotId) => {
        const [yearStr, monthStr] = yearMonth.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
        const filters: Record<string, any> = {};
        if (shotId) {
          filters.shotId = shotId;
        }
        return get().generateReport('monthly', startDate, endDate, filters);
      },
    }),
    {
      name: 'shot-version-lock-storage',
      partialize: (state) => ({
        shots: state.shots,
        auditLogs: state.auditLogs,
        exportReports: state.exportReports,
        currentUser: state.currentUser,
        filters: state.filters,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hydrate();
        }
      },
    }
  )
);
