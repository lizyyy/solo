import { capacityCheckDao } from '../dao/capacityCheckDao';
import { selfCheckDao } from '../dao/selfCheckDao';
import { conflictDao } from '../dao/conflictDao';
import { redLineDao } from '../dao/redLineDao';
import { changeHistoryDao } from '../dao/changeHistoryDao';
import { CapacityCheckResult, SelfCheckResult, ConflictRecord, UnifiedDataResponse, ChangeHistory, RedLineMap } from '../types';
import { getCurrentTime, calculateFileHash, generateBatchNo } from '../utils/common';

const DATA_VERSION = '1.1.0';

export const unifiedDataLayer = {
  getCapacityCheckResults: (): UnifiedDataResponse<CapacityCheckResult[]> => {
    const data = capacityCheckDao.findLatestAll();
    const batches = redLineDao.getAllBatchNos();
    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer',
      batchInfo: {
        currentBatch: batches[0] || null,
        historyBatches: batches
      }
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

  getDetourAffectedResults: (): UnifiedDataResponse<CapacityCheckResult[]> => {
    const all = capacityCheckDao.findLatestAll();
    const data = all.filter(r => r.isDetourAffected);
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

  getChangeHistory: (shelterId?: string): UnifiedDataResponse<ChangeHistory[]> => {
    const data = shelterId
      ? changeHistoryDao.findByShelterId(shelterId)
      : changeHistoryDao.findAll();
    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer'
    };
  },

  getRedLineMaps: (shelterId?: string, batchNo?: string): UnifiedDataResponse<RedLineMap[]> => {
    let data: RedLineMap[];
    if (batchNo) {
      data = redLineDao.findByBatchNo(batchNo);
    } else if (shelterId) {
      data = redLineDao.findByShelterId(shelterId);
    } else {
      data = redLineDao.findAll();
    }
    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer'
    };
  },

  getAllBatches: (): string[] => {
    return redLineDao.getAllBatchNos();
  },

  generateExportData: (type: 'detail' | 'summary' | 'self_check', options?: { batchNo?: string; includeDetourOnly?: boolean }): UnifiedDataResponse<any> => {
    let data: any;
    const exportBatchNo = options?.batchNo || generateBatchNo();

    switch (type) {
      case 'detail': {
        let detailData = capacityCheckDao.findLatestAll();
        let redLineBatchInfo: { batchNo: string; shelterIds: string[]; isReimport: boolean } | null = null;

        if (options?.batchNo) {
          const redLinesInBatch = redLineDao.findByBatchNo(options.batchNo);
          if (redLinesInBatch.length > 0) {
            const shelterIds = Array.from(new Set(redLinesInBatch.map(r => r.shelterId)));
            redLineBatchInfo = {
              batchNo: options.batchNo,
              shelterIds,
              isReimport: redLinesInBatch[0].isReimport
            };
            detailData = detailData.filter(r => shelterIds.includes(r.shelterId));
          } else {
            detailData = [];
            redLineBatchInfo = {
              batchNo: options.batchNo,
              shelterIds: [],
              isReimport: false
            };
          }
        }

        if (options?.includeDetourOnly) {
          detailData = detailData.filter(r => r.isDetourAffected);
        }

        const recordsWithEnrichment = detailData.map(r => {
          const latestRedLine = redLineDao.findLatestByShelterId(r.shelterId);
          const allRedLines = redLineDao.findByShelterId(r.shelterId);
          const historyForShelter = changeHistoryDao.findByShelterId(r.shelterId);
          const remarkChanges = historyForShelter.filter(h => h.fieldName === '备注内容' || h.fieldName === '红线图备注');
          const affectedResults = historyForShelter.filter(h => h.affectedResultIds && h.affectedResultIds.includes(r.id));

          return {
            shelterId: r.shelterId,
            shelterName: r.shelterName,
            designedCapacity: r.designedCapacity,
            checkedCapacity: r.checkedCapacity,
            deviation: r.deviation,
            deviationRate: r.deviationRate,
            checkLevel: r.checkLevel,
            isDetourAffected: r.isDetourAffected,
            detourInfo: r.detourInfo,
            needsResidentReview: r.needsResidentReview,
            dataSources: r.dataSources,
            calculationParams: r.calculationParams,
            checkTime: r.checkTime,
            checkedBy: r.checkedBy,
            redLineBatchNo: latestRedLine?.importBatchNo || null,
            redLineVersion: latestRedLine?.version || null,
            redLineIsReimport: latestRedLine?.isReimport || false,
            redLineReimportNote: latestRedLine?.reimportNote || null,
            redLineRemarks: latestRedLine?.remarks || null,
            redLineAreaRange: latestRedLine?.areaRange || null,
            redLineEffectiveDate: latestRedLine?.effectiveDate || null,
            redLineImportOperator: latestRedLine?.importOperator || null,
            redLineReviewStatus: latestRedLine?.reviewStatus || null,
            redLineReviewNote: latestRedLine?.reviewNote || null,
            redLineReviewedBy: latestRedLine?.reviewedBy || null,
            redLineReviewedAt: latestRedLine?.reviewedAt || null,
            redLineImportBatchList: allRedLines.map(rl => ({
              batchNo: rl.importBatchNo,
              version: rl.version,
              isReimport: rl.isReimport,
              importTime: rl.importTime,
              reviewStatus: rl.reviewStatus,
              remarks: rl.remarks
            })),
            remarkChangeHistory: remarkChanges.map(h => ({
              changeTime: h.changeTime,
              operator: h.operator,
              changeType: h.changeType,
              oldValue: h.oldValue,
              newValue: h.newValue,
              remark: h.remark
            })),
            changeAffectingThisResult: affectedResults.map(h => ({
              changeTime: h.changeTime,
              operator: h.operator,
              changeType: h.changeType,
              fieldName: h.fieldName,
              oldValue: h.oldValue,
              newValue: h.newValue,
              remark: h.remark
            }))
          };
        });

        data = {
          exportBatchNo,
          exportType: 'detail',
          exportTime: getCurrentTime(),
          dataVersion: DATA_VERSION,
          sourceRedLineBatch: redLineBatchInfo,
          filterOptions: {
            byBatchNo: !!options?.batchNo,
            batchNo: options?.batchNo || null,
            includeDetourOnly: options?.includeDetourOnly || false
          },
          totalCount: recordsWithEnrichment.length,
          detourAffectedCount: recordsWithEnrichment.filter(r => r.isDetourAffected).length,
          needsReviewCount: recordsWithEnrichment.filter(r => r.needsResidentReview).length,
          records: recordsWithEnrichment
        };
        break;
      }
      case 'summary': {
        const all = capacityCheckDao.findLatestAll();
        data = {
          exportBatchNo,
          exportType: 'summary',
          exportTime: getCurrentTime(),
          dataVersion: DATA_VERSION,
          totalCount: all.length,
          normalCount: all.filter(r => r.checkLevel === 'normal').length,
          warningCount: all.filter(r => r.checkLevel === 'warning').length,
          dangerCount: all.filter(r => r.checkLevel === 'danger').length,
          detourAffectedCount: all.filter(r => r.isDetourAffected).length,
          needsReviewCount: all.filter(r => r.needsResidentReview).length,
          byArea: {},
          details: all
        };
        break;
      }
      case 'self_check': {
        data = {
          exportBatchNo,
          exportType: 'self_check',
          exportTime: getCurrentTime(),
          dataVersion: DATA_VERSION,
          results: selfCheckDao.findLatestBatch()
        };
        break;
      }
    }

    return {
      data,
      dataTimestamp: getCurrentTime(),
      dataVersion: DATA_VERSION,
      source: 'unified_datalayer'
    };
  },

  verifyConsistency: (): { consistent: boolean; hash: string; recordCount: number; detourRecordCount: number; pageCount: number; exportCount: number; apiCount: number } => {
    const pageData = unifiedDataLayer.getCapacityCheckResults();
    const apiData = unifiedDataLayer.getCapacityCheckResults();
    const exportData = unifiedDataLayer.generateExportData('detail');
    const exportRecords = exportData.data.records;

    const normalize = (items: any[]) => items.map(r => ({
      shelterId: r.shelterId,
      shelterName: r.shelterName,
      designedCapacity: r.designedCapacity,
      checkedCapacity: r.checkedCapacity,
      deviation: r.deviation,
      deviationRate: r.deviationRate,
      checkLevel: r.checkLevel,
      isDetourAffected: r.isDetourAffected,
      detourInfo: r.detourInfo,
      needsResidentReview: r.needsResidentReview
    })).sort((a, b) => a.shelterId.localeCompare(b.shelterId));

    const pageNorm = normalize(pageData.data);
    const apiNorm = normalize(apiData.data);
    const exportNorm = normalize(exportRecords);

    const pageHash = calculateFileHash(JSON.stringify(pageNorm));
    const apiHash = calculateFileHash(JSON.stringify(apiNorm));
    const exportHash = calculateFileHash(JSON.stringify(exportNorm));

    const detourRecords = pageNorm.filter(r => r.isDetourAffected);
    const exportDetourRecords = exportNorm.filter(r => r.isDetourAffected);

    const consistent = pageHash === apiHash &&
      apiHash === exportHash &&
      detourRecords.length === exportDetourRecords.length;

    return {
      consistent,
      hash: pageHash,
      recordCount: pageNorm.length,
      detourRecordCount: detourRecords.length,
      pageCount: pageNorm.length,
      exportCount: exportNorm.length,
      apiCount: apiNorm.length
    };
  }
};
