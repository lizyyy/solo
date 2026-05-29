import { ExposureLog, ContaminationType, UserBucket, OperationChange, CheckConfig, DEFAULT_CHECK_CONFIG } from '../types';
import { BucketValidationEngine } from './BucketValidationEngine';
import { ChangeSlicingEngine } from './ChangeSlicingEngine';

export interface DuplicateInfo {
  isDuplicate: boolean;
  firstExposure?: ExposureLog;
  duplicateCount: number;
  exposures: ExposureLog[];
}

export class ContaminationMarkingEngine {
  static markAll(
    exposures: ExposureLog[],
    userBuckets: UserBucket[],
    operationChanges: OperationChange[],
    config: CheckConfig = DEFAULT_CHECK_CONFIG
  ): {
    markedExposures: ExposureLog[];
    crossGroupCount: number;
    duplicateCount: number;
    configChangeCount: number;
  } {
    const bucketResult = BucketValidationEngine.validate(userBuckets);
    const duplicateMap = this.buildDuplicateMap(exposures, config.duplicateExposureThresholdMinutes);

    let crossGroupCount = 0;
    let duplicateCount = 0;
    let configChangeCount = 0;

    const markedExposures = exposures.map(exposure => {
      const marked = { ...exposure };
      
      if (config.markCrossGroup) {
        const isCrossGroup = BucketValidationEngine.isUserCrossGroup(
          exposure.userId,
          exposure.experimentId,
          bucketResult.crossGroupUsers
        );
        if (isCrossGroup) {
          marked.isContaminated = true;
          marked.contaminationType = ContaminationType.CROSS_GROUP;
          marked.contaminationReason = BucketValidationEngine.getCrossGroupReason(
            exposure.userId,
            exposure.experimentId,
            bucketResult.crossGroupUsers
          );
          crossGroupCount++;
          return marked;
        }
      }

      if (config.markDuplicate) {
        const duplicateInfo = this.checkDuplicate(exposure, duplicateMap);
        if (duplicateInfo.isDuplicate && duplicateInfo.firstExposure?.exposureId !== exposure.exposureId) {
          marked.isContaminated = true;
          marked.contaminationType = ContaminationType.DUPLICATE_EXPOSURE;
          marked.contaminationReason = this.getDuplicateReason(exposure, duplicateInfo);
          duplicateCount++;
          return marked;
        }
      }

      if (config.markConfigChange) {
        const windowResult = ChangeSlicingEngine.isInConfigChangeWindow(
          exposure.exposureTime,
          operationChanges,
          config.configChangeWindowMinutes
        );
        if (windowResult.isInWindow) {
          marked.isContaminated = true;
          marked.contaminationType = ContaminationType.CONFIG_CHANGE;
          marked.contaminationReason = ChangeSlicingEngine.getConfigChangeReason(
            exposure.exposureTime,
            operationChanges,
            config.configChangeWindowMinutes
          );
          configChangeCount++;
          return marked;
        }
      }

      marked.isContaminated = false;
      marked.contaminationType = ContaminationType.NONE;
      marked.contaminationReason = undefined;
      return marked;
    });

    return {
      markedExposures,
      crossGroupCount,
      duplicateCount,
      configChangeCount
    };
  }

  private static buildDuplicateMap(
    exposures: ExposureLog[],
    thresholdMinutes: number
  ): Map<string, ExposureLog[]> {
    const map = new Map<string, ExposureLog[]>();
    const thresholdMs = thresholdMinutes * 60 * 1000;

    exposures.forEach(exposure => {
      const key = `${exposure.userId}_${exposure.experimentId}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(exposure);
    });

    map.forEach((exposures, key) => {
      const sorted = exposures.sort((a, b) => a.exposureTime - b.exposureTime);
      
      if (thresholdMs === 0) {
        map.set(key, sorted);
      } else {
        const filtered: ExposureLog[] = [];
        let lastTime = -Infinity;
        
        sorted.forEach(exp => {
          if (exp.exposureTime - lastTime >= thresholdMs) {
            filtered.push(exp);
            lastTime = exp.exposureTime;
          }
        });
        
        map.set(key, sorted);
      }
    });

    return map;
  }

  static checkDuplicate(
    exposure: ExposureLog,
    duplicateMap: Map<string, ExposureLog[]>
  ): DuplicateInfo {
    const key = `${exposure.userId}_${exposure.experimentId}`;
    const exposures = duplicateMap.get(key) || [];
    const sorted = exposures.sort((a, b) => a.exposureTime - b.exposureTime);
    
    const isDuplicate = sorted.length > 1;
    const firstExposure = sorted[0];
    const duplicateCount = sorted.length - 1;

    return {
      isDuplicate,
      firstExposure,
      duplicateCount,
      exposures: sorted
    };
  }

  private static getDuplicateReason(exposure: ExposureLog, duplicateInfo: DuplicateInfo): string {
    const { firstExposure, exposures } = duplicateInfo;
    if (!firstExposure) return '';

    const times = exposures.map(e => new Date(e.exposureTime).toLocaleString()).join(', ');
    const timeDiff = (exposure.exposureTime - firstExposure.exposureTime) / (60 * 1000);
    
    return `用户重复曝光，首次曝光时间：${new Date(firstExposure.exposureTime).toLocaleString()}，本次曝光距首次 ${timeDiff.toFixed(1)} 分钟，所有曝光时间：${times}`;
  }

  static getUserExposures(userId: string, experimentId: string, exposures: ExposureLog[]): ExposureLog[] {
    return exposures
      .filter(e => e.userId === userId && e.experimentId === experimentId)
      .sort((a, b) => a.exposureTime - b.exposureTime);
  }

  static getContaminationSummary(exposures: ExposureLog[]): {
    [key in ContaminationType]: number;
  } {
    const summary = {
      [ContaminationType.CROSS_GROUP]: 0,
      [ContaminationType.DUPLICATE_EXPOSURE]: 0,
      [ContaminationType.CONFIG_CHANGE]: 0,
      [ContaminationType.NONE]: 0
    };

    exposures.forEach(e => {
      summary[e.contaminationType]++;
    });

    return summary;
  }

  static getAffectedUsers(exposures: ExposureLog[]): string[] {
    const affected = new Set<string>();
    exposures.forEach(e => {
      if (e.isContaminated) {
        affected.add(e.userId);
      }
    });
    return Array.from(affected);
  }

  static getContaminatedExposures(exposures: ExposureLog[]): string[] {
    return exposures
      .filter(e => e.isContaminated)
      .map(e => e.exposureId);
  }
}
