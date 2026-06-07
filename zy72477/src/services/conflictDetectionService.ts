import { conflictDao } from '../dao/conflictDao';
import { redLineDao } from '../dao/redLineDao';
import { inspectorDao } from '../dao/inspectorDao';
import { shelterDao } from '../dao/shelterDao';
import { ConflictRecord } from '../types';

export const conflictDetectionService = {
  detectAllConflicts: (): ConflictRecord[] => {
    const shelters = shelterDao.findAll();
    const allConflicts: ConflictRecord[] = [];

    for (const shelter of shelters) {
      const conflicts = conflictDetectionService.detectConflictsForShelter(shelter.id);
      allConflicts.push(...conflicts);
    }

    return allConflicts;
  },

  detectConflictsForShelter: (shelterId: string): ConflictRecord[] => {
    const shelter = shelterDao.findById(shelterId);
    if (!shelter) return [];

    const latestRedLine = redLineDao.findLatestByShelterId(shelterId);
    const latestReport = inspectorDao.findLatestByShelterId(shelterId);

    if (!latestRedLine || !latestReport) return [];

    const conflicts: ConflictRecord[] = [];
    const redLineSource = `红线图 v${latestRedLine.version} (${latestRedLine.importBatchNo})`;
    const reportSource = `网格员巡查表 ${latestReport.reportNo} (${latestReport.inspectorName})`;

    const redLineCapacity = extractCapacityFromRemarks(latestRedLine.remarks, shelter.designedCapacity);
    if (redLineCapacity !== latestReport.actualCapacity) {
      conflicts.push(conflictDao.create({
        shelterId,
        shelterName: shelter.name,
        conflictType: 'capacity_mismatch',
        fieldName: '实际容量',
        redLineValue: String(redLineCapacity),
        reportValue: String(latestReport.actualCapacity),
        redLineSource,
        reportSource,
        description: `红线图标注容量${redLineCapacity}人与网格员巡查实际容量${latestReport.actualCapacity}人不一致`
      }));
    }

    const redLineHasDetour = latestRedLine.remarks.includes('改道') || latestRedLine.remarks.includes('施工');
    if (redLineHasDetour !== latestReport.isTemporaryDetour) {
      conflicts.push(conflictDao.create({
        shelterId,
        shelterName: shelter.name,
        conflictType: 'detour_mismatch',
        fieldName: '临时改道',
        redLineValue: redLineHasDetour ? '存在' : '无',
        reportValue: latestReport.isTemporaryDetour ? '存在' : '无',
        redLineSource,
        reportSource,
        description: `红线图${redLineHasDetour ? '标注' : '未标注'}临时改道，网格员巡查${latestReport.isTemporaryDetour ? '发现' : '未发现'}临时改道`
      }));
    }

    const redLineStatus = inferStatusFromRemarks(latestRedLine.remarks);
    const reportStatus = inferStatusFromReport(latestReport);
    if (redLineStatus !== reportStatus) {
      conflicts.push(conflictDao.create({
        shelterId,
        shelterName: shelter.name,
        conflictType: 'status_mismatch',
        fieldName: '点位状态',
        redLineValue: statusToText(redLineStatus),
        reportValue: statusToText(reportStatus),
        redLineSource,
        reportSource,
        description: `红线图状态为${statusToText(redLineStatus)}，网格员巡查状态为${statusToText(reportStatus)}`
      }));
    }

    return conflicts;
  },

  getPendingConflicts: (): ConflictRecord[] => {
    return conflictDao.findByStatus('pending');
  },

  confirmConflict: (conflictId: string, resolvedBy: string, resolutionNote: string): void => {
    conflictDao.resolve(conflictId, 'confirmed', resolvedBy, resolutionNote);
  },

  rejectConflict: (conflictId: string, resolvedBy: string, resolutionNote: string): void => {
    conflictDao.resolve(conflictId, 'rejected', resolvedBy, resolutionNote);
  },

  getAllConflicts: (): ConflictRecord[] => {
    return conflictDao.findAll();
  }
};

const extractCapacityFromRemarks = (remarks: string, defaultCapacity: number): number => {
  const match = remarks.match(/容量[：:]\s*(\d+)/);
  if (match) return parseInt(match[1], 10);
  const match2 = remarks.match(/(\d+)\s*人/);
  if (match2) return parseInt(match2[1], 10);
  return defaultCapacity;
};

const inferStatusFromRemarks = (remarks: string): 'normal' | 'construction' | 'closed' => {
  if (remarks.includes('施工') || remarks.includes('维修') || remarks.includes('改造')) {
    return 'construction';
  }
  if (remarks.includes('关闭') || remarks.includes('停用') || remarks.includes('拆除')) {
    return 'closed';
  }
  return 'normal';
};

const inferStatusFromReport = (report: any): 'normal' | 'construction' | 'closed' => {
  if (report.foundIssues && (report.foundIssues.includes('施工') || report.foundIssues.includes('维修'))) {
    return 'construction';
  }
  if (report.roadCondition === 'blocked') {
    return 'closed';
  }
  return 'normal';
};

const statusToText = (status: string): string => {
  const map: Record<string, string> = {
    normal: '正常使用',
    construction: '施工维护',
    closed: '关闭停用',
    pending_review: '待复核'
  };
  return map[status] || status;
};
