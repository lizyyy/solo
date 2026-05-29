import { create } from 'zustand';
import type {
  Dependency,
  DependencyFile,
  DependencyStatus,
  DirtyDataRecord,
  FileType,
  StatusLog,
} from '../types';
import {
  generateId,
  getCurrentUser,
  isValidStatusTransition,
  DIRTY_TYPE_LABELS,
} from '../types';
import { db } from '../db';
import { parseDependencyFile } from '../services/parsers';
import { licenseMatcher } from '../services/licenseMatcher';
import { riskEngine } from '../services/riskEngine';

function detectFileType(fileName: string): FileType {
  const lower = fileName.toLowerCase();
  if (lower.includes('package.json')) return 'package_json';
  if (lower.endsWith('.json') && lower.includes('package')) return 'package_json';
  if (lower.endsWith('pom.xml')) return 'pom_xml';
  if (lower.endsWith('.xml') && lower.includes('pom')) return 'pom_xml';
  if (lower.includes('requirements.txt')) return 'requirements_txt';
  if (lower.endsWith('.txt') && lower.includes('requirement')) return 'requirements_txt';
  if (lower.endsWith('go.mod')) return 'go_mod';
  if (lower.endsWith('.mod') && lower.includes('go')) return 'go_mod';
  return 'other';
}

interface DependencyState {
  dependencies: Dependency[];
  dependencyFiles: DependencyFile[];
  loading: boolean;
  parsing: boolean;
  error: string | null;
  loadDependencies: (projectId: string) => Promise<void>;
  loadDependencyFiles: (projectId: string) => Promise<void>;
  uploadFiles: (projectId: string, files: File[]) => Promise<void>;
  parseFiles: (projectId: string, fileIds: string[]) => Promise<void>;
  updateStatus: (
    dependencyId: string,
    status: DependencyStatus,
    reason: string
  ) => Promise<void>;
  fixDirtyData: (
    dependencyId: string,
    fixData: Partial<Dependency>,
    fixNotes: string
  ) => Promise<void>;
  selectLicense: (dependencyId: string, license: string) => Promise<void>;
  updateDependency: (
    dependencyId: string,
    data: Partial<Dependency>
  ) => Promise<void>;
  deleteDependency: (dependencyId: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  reassessRisk: (dependencyId: string) => Promise<void>;
}

export const useDependencyStore = create<DependencyState>((set, get) => ({
  dependencies: [],
  dependencyFiles: [],
  loading: false,
  parsing: false,
  error: null,

  loadDependencies: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const dependencies = await db.dependencies
        .where('projectId')
        .equals(projectId)
        .reverse()
        .sortBy('updatedAt');
      set({ dependencies, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  loadDependencyFiles: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const files = await db.dependencyFiles
        .where('projectId')
        .equals(projectId)
        .reverse()
        .sortBy('uploadTime');
      set({ dependencyFiles: files, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  uploadFiles: async (projectId: string, files: File[]) => {
    set({ loading: true, error: null });
    try {
      const fileEntries: DependencyFile[] = [];

      for (const file of files) {
        const content = await file.text();
        const fileType = detectFileType(file.name);

        fileEntries.push({
          id: generateId(),
          projectId,
          fileName: file.name,
          fileType,
          fileSize: file.size,
          fileContent: content,
          uploadTime: Date.now(),
          parseStatus: 'pending',
        });
      }

      await db.dependencyFiles.bulkAdd(fileEntries);
      set((state) => ({
        dependencyFiles: [...fileEntries, ...state.dependencyFiles],
        loading: false,
      }));
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  parseFiles: async (projectId: string, fileIds: string[]) => {
    set({ parsing: true, error: null });
    try {
      await licenseMatcher.init();

      for (const fileId of fileIds) {
        const file = await db.dependencyFiles.get(fileId);
        if (!file) continue;

        await db.dependencyFiles.update(fileId, { parseStatus: 'pending' });

        const result = parseDependencyFile(file.fileName, file.fileContent);

        if (result.errors.length > 0 && result.dependencies.length === 0) {
          await db.dependencyFiles.update(fileId, {
            parseStatus: 'failed',
            parseError: result.errors.map((e) => e.message).join('; '),
            parsedAt: Date.now(),
          });
          continue;
        }

        const depsToInsert: Dependency[] = [];
        const now = Date.now();

        for (const parsedDep of result.dependencies) {
          let riskLevel: Dependency['riskLevel'] = 'unknown';
          let blockReason: string | undefined;
          let dirtyData: DirtyDataRecord | undefined;

          const errorsForDep = result.errors.filter(
            (e) => e.packageName === parsedDep.packageName
          );

          if (errorsForDep.length > 0) {
            const firstError = errorsForDep[0];
            dirtyData = {
              dirtyType: firstError.type,
              description: firstError.message,
              fixed: false,
            };
          }

          if (parsedDep.license) {
            const licenseStr = Array.isArray(parsedDep.license)
              ? parsedDep.license.join(' OR ')
              : parsedDep.license;
            const match = licenseMatcher.match(licenseStr);
            if (match.license) {
              riskLevel = match.license.riskLevel;
            }
          }

          if (riskLevel === 'critical') {
            const assessment = await riskEngine.assess({
              ...parsedDep,
              id: '',
              projectId,
              fileId,
              riskLevel,
              status: 'pending_review',
              createdAt: now,
              updatedAt: now,
              statusLogs: [],
            });
            blockReason = riskEngine.generateBlockReason(assessment);
          }

          const depId = generateId();
          depsToInsert.push({
            ...parsedDep,
            id: depId,
            projectId,
            fileId,
            status: riskLevel === 'safe' ? 'approved' : 'pending_review',
            riskLevel,
            blockReason,
            dirtyData,
            createdAt: now,
            updatedAt: now,
            statusLogs: [
              {
                id: generateId(),
                dependencyId: depId,
                fromStatus: 'pending_parse',
                toStatus:
                  riskLevel === 'safe' ? 'approved' : 'pending_review',
                operator: getCurrentUser(),
                reason: dirtyData
                  ? `解析完成，存在数据问题: ${DIRTY_TYPE_LABELS[dirtyData.dirtyType]}`
                  : '解析完成',
                timestamp: now,
              },
            ],
          });
        }

        if (depsToInsert.length > 0) {
          await db.dependencies.bulkAdd(depsToInsert);
          await db.statusLogs.bulkAdd(
            depsToInsert.flatMap((d) => d.statusLogs)
          );
        }

        await db.dependencyFiles.update(fileId, {
          parseStatus: 'success',
          parsedAt: Date.now(),
        });
      }

      await get().loadDependencies(projectId);
      await get().loadDependencyFiles(projectId);
      set({ parsing: false });
    } catch (error) {
      set({ error: (error as Error).message, parsing: false });
    }
  },

  updateStatus: async (
    dependencyId: string,
    newStatus: DependencyStatus,
    reason: string
  ) => {
    const dep = await db.dependencies.get(dependencyId);
    if (!dep) return;

    if (!isValidStatusTransition(dep.status, newStatus)) {
      console.warn(
        `Invalid status transition: ${dep.status} -> ${newStatus}`
      );
      return;
    }

    const now = Date.now();
    const statusLog: StatusLog = {
      id: generateId(),
      dependencyId,
      fromStatus: dep.status,
      toStatus: newStatus,
      operator: getCurrentUser(),
      reason,
      timestamp: now,
    };

    await db.statusLogs.add(statusLog);

    let updates: Partial<Dependency> = {
      status: newStatus,
      updatedAt: now,
      statusLogs: [...dep.statusLogs, statusLog],
    };

    if (newStatus === 'blocked' && !dep.blockReason) {
      updates.blockReason = reason;
    }

    await db.dependencies.update(dependencyId, updates);

    set((state) => ({
      dependencies: state.dependencies.map((d) =>
        d.id === dependencyId ? { ...d, ...updates } : d
      ),
    }));
  },

  fixDirtyData: async (
    dependencyId: string,
    fixData: Partial<Dependency>,
    fixNotes: string
  ) => {
    const dep = await db.dependencies.get(dependencyId);
    if (!dep || !dep.dirtyData) return;

    const now = Date.now();
    const dirtyData: DirtyDataRecord = {
      ...dep.dirtyData,
      fixed: true,
      fixedAt: now,
      fixedBy: getCurrentUser(),
      fixNotes,
    };

    let riskLevel = dep.riskLevel;
    if (fixData.license) {
      const licenseStr = Array.isArray(fixData.license)
        ? fixData.license.join(' OR ')
        : fixData.license;
      const match = licenseMatcher.match(licenseStr);
      if (match.license) {
        riskLevel = match.license.riskLevel;
      }
    }

    const statusLog: StatusLog = {
      id: generateId(),
      dependencyId,
      fromStatus: dep.status,
      toStatus: 'pending_review',
      operator: getCurrentUser(),
      reason: `修复脏数据: ${fixNotes}`,
      timestamp: now,
    };

    await db.statusLogs.add(statusLog);

    const updates: Partial<Dependency> = {
      ...fixData,
      dirtyData,
      riskLevel,
      status: 'pending_review',
      updatedAt: now,
      statusLogs: [...dep.statusLogs, statusLog],
    };

    await db.dependencies.update(dependencyId, updates);

    set((state) => ({
      dependencies: state.dependencies.map((d) =>
        d.id === dependencyId ? { ...d, ...updates } : d
      ),
    }));
  },

  selectLicense: async (dependencyId: string, license: string) => {
    const dep = await db.dependencies.get(dependencyId);
    if (!dep) return;

    const match = licenseMatcher.match(license);
    const riskLevel = match.license?.riskLevel || 'unknown';

    const now = Date.now();
    const statusLog: StatusLog = {
      id: generateId(),
      dependencyId,
      fromStatus: dep.status,
      toStatus: 'pending_review',
      operator: getCurrentUser(),
      reason: `选择许可证: ${license}`,
      timestamp: now,
    };

    await db.statusLogs.add(statusLog);

    const updates: Partial<Dependency> = {
      licenseSelected: license,
      riskLevel,
      status: 'pending_review',
      updatedAt: now,
      statusLogs: [...dep.statusLogs, statusLog],
    };

    await db.dependencies.update(dependencyId, updates);

    set((state) => ({
      dependencies: state.dependencies.map((d) =>
        d.id === dependencyId ? { ...d, ...updates } : d
      ),
    }));
  },

  updateDependency: async (dependencyId: string, data: Partial<Dependency>) => {
    const updates = { ...data, updatedAt: Date.now() };
    await db.dependencies.update(dependencyId, updates);

    set((state) => ({
      dependencies: state.dependencies.map((d) =>
        d.id === dependencyId ? { ...d, ...updates } : d
      ),
    }));
  },

  deleteDependency: async (dependencyId: string) => {
    await db.statusLogs.where('dependencyId').equals(dependencyId).delete();
    await db.dependencies.delete(dependencyId);

    set((state) => ({
      dependencies: state.dependencies.filter((d) => d.id !== dependencyId),
    }));
  },

  deleteFile: async (fileId: string) => {
    const deps = await db.dependencies.where('fileId').equals(fileId).toArray();
    const depIds = deps.map((d) => d.id);

    await db.transaction('rw', [db.dependencies, db.dependencyFiles, db.statusLogs], async () => {
      await db.statusLogs.where('dependencyId').anyOf(depIds).delete();
      await db.dependencies.where('fileId').equals(fileId).delete();
      await db.dependencyFiles.delete(fileId);
    });

    set((state) => ({
      dependencyFiles: state.dependencyFiles.filter((f) => f.id !== fileId),
      dependencies: state.dependencies.filter((d) => d.fileId !== fileId),
    }));
  },

  reassessRisk: async (dependencyId: string) => {
    const dep = await db.dependencies.get(dependencyId);
    if (!dep) return;

    const assessment = await riskEngine.assess(dep);
    const blockReason = riskEngine.generateBlockReason(assessment);

    const updates: Partial<Dependency> = {
      riskLevel: assessment.level,
      blockReason: blockReason || dep.blockReason,
      updatedAt: Date.now(),
    };

    await db.dependencies.update(dependencyId, updates);

    set((state) => ({
      dependencies: state.dependencies.map((d) =>
        d.id === dependencyId ? { ...d, ...updates } : d
      ),
    }));
  },
}));
