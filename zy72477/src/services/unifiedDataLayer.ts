import { capacityCheckDao } from '../dao/capacityCheckDao';
import { selfCheckDao } from '../dao/selfCheckDao';
import { conflictDao } from '../dao/conflictDao';
import { CapacityCheckResult, SelfCheckResult, ConflictRecord, UnifiedDataResponse } from '../types';
import { getCurrentTime, calculateFileHash } from '../utils/common';

const DATA_VERSION = '1.0.0';

export const unifiedDataLayer = {
  getCapacityCheckResults: (): UnifiedDataResponse<CapacityCheckResult[]> => {
    const data = capacityCheckDao.findLatestAll();
    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer'
    };
  },

  getCapacityCheckDetailForShelter: (shelterId: string): UnifiedDataResponse<CapacityCheckResult | null> => {
    const data = capacityCheckDao.findLatestByShelterId(shelterId);
    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer'
    };
  },

  getSelfCheckResults: (): UnifiedDataResponse<SelfCheckResult[]> => {
    const data = selfCheckDao.findLatestBatch();
    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer'
    };
  },

  getConflictRecords: (): UnifiedDataResponse<ConflictRecord[]> => {
    const data = conflictDao.findAll();
    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer'
    };
  },

  getPendingConflicts: (): UnifiedDataResponse<ConflictRecord[]> => {
    const data = conflictDao.findByStatus('pending');
    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer'
    };
  },

  generateExportData: (type: 'detail' | 'summary' | 'self_check'): UnifiedDataResponse<any> => {
    let data: any;
    switch (type) {
      case 'detail':
        data = capacityCheckDao.findLatestAll();
        break;
      case 'summary':
        const all = capacityCheckDao.findLatestAll();
        data = {
          totalCount: all.length,
          normalCount: all.filter(r => r.checkLevel === 'normal').length,
          warningCount: all.filter(r => r.checkLevel === 'warning').length,
          dangerCount: all.filter(r => r.checkLevel === 'danger').length,
          detourAffectedCount: all.filter(r => r.isDetourAffected).length,
          needsReviewCount: all.filter(r => r.needsResidentReview).length,
          details: all
        };
        break;
      case 'self_check':
        data = selfCheckDao.findLatestBatch();
        break;
    }

    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer'
    };
  },

  verifyConsistency: (): { consistent: boolean; hash: string; recordCount: number } => {
    const pageData = unifiedDataLayer.getCapacityCheckResults();
    const apiData = unifiedDataLayer.getCapacityCheckResults();
    const exportData = unifiedDataLayer.generateExportData('detail');

    const pageHash = calculateFileHash(JSON.stringify(pageData.data));
    const apiHash = calculateFileHash(JSON.stringify(apiData.data));
    const exportHash = calculateFileHash(JSON.stringify(exportData.data));

    const consistent = pageHash === apiHash && apiHash === exportHash;

    return {
      consistent,
      hash: pageHash,
      recordCount: pageData.data.length
    };
  }
};
