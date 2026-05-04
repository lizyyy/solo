import { RISK_TYPE, RISK_TYPE_LABELS } from '../context/PhotoScanContext';
import DataService from './DataService';

class RiskService {
  checkAll(records, settings) {
    const risks = [];
    const seenIds = new Map();
    const minResolution = settings?.minResolution || 300;

    records.forEach(record => {
      const uniqueId = DataService.generateUniqueId(record.boxId, record.frameNumber);
      
      if (seenIds.has(uniqueId)) {
        risks.push(this.createRisk(
          record.id,
          RISK_TYPE.DUPLICATE_ID,
          `编号 [${uniqueId}] 重复，与记录 [${seenIds.get(uniqueId)}] 冲突`
        ));
      } else {
        seenIds.set(uniqueId, record.id);
      }

      if (!record.scanFile || record.scanFile.trim() === '') {
        risks.push(this.createRisk(
          record.id,
          RISK_TYPE.MISSING_FILE,
          `记录 [${uniqueId}] 缺少扫描文件`
        ));
      }

      if (record.scanResolution > 0 && record.scanResolution < minResolution) {
        risks.push(this.createRisk(
          record.id,
          RISK_TYPE.LOW_RESOLUTION,
          `记录 [${uniqueId}] 分辨率不足: ${record.scanResolution} DPI，要求最低 ${minResolution} DPI`
        ));
      }

      if (record.repairStatus === 'repaired' && (!record.deliveryFile || record.deliveryFile.trim() === '')) {
        risks.push(this.createRisk(
          record.id,
          RISK_TYPE.REPAIRED_NO_DELIVERY,
          `记录 [${uniqueId}] 已标记为修复完成，但未找到交付图`
        ));
      }
    });

    return risks;
  }

  checkMissingFiles(records) {
    const risks = [];
    records.forEach(record => {
      if (!record.scanFile || record.scanFile.trim() === '') {
        const uniqueId = DataService.generateUniqueId(record.boxId, record.frameNumber);
        risks.push(this.createRisk(
          record.id,
          RISK_TYPE.MISSING_FILE,
          `记录 [${uniqueId}] 缺少扫描文件`
        ));
      }
    });
    return risks;
  }

  checkDuplicateIds(records) {
    const risks = [];
    const seenIds = new Map();

    records.forEach(record => {
      const uniqueId = DataService.generateUniqueId(record.boxId, record.frameNumber);
      
      if (seenIds.has(uniqueId)) {
        risks.push(this.createRisk(
          record.id,
          RISK_TYPE.DUPLICATE_ID,
          `编号 [${uniqueId}] 重复，与记录 [${seenIds.get(uniqueId)}] 冲突`
        ));
      } else {
        seenIds.set(uniqueId, record.id);
      }
    });

    return risks;
  }

  checkResolution(records, minResolution = 300) {
    const risks = [];
    records.forEach(record => {
      if (record.scanResolution > 0 && record.scanResolution < minResolution) {
        const uniqueId = DataService.generateUniqueId(record.boxId, record.frameNumber);
        risks.push(this.createRisk(
          record.id,
          RISK_TYPE.LOW_RESOLUTION,
          `记录 [${uniqueId}] 分辨率不足: ${record.scanResolution} DPI，要求最低 ${minResolution} DPI`
        ));
      }
    });
    return risks;
  }

  checkRepairedWithoutDelivery(records) {
    const risks = [];
    records.forEach(record => {
      if (record.repairStatus === 'repaired' && (!record.deliveryFile || record.deliveryFile.trim() === '')) {
        const uniqueId = DataService.generateUniqueId(record.boxId, record.frameNumber);
        risks.push(this.createRisk(
          record.id,
          RISK_TYPE.REPAIRED_NO_DELIVERY,
          `记录 [${uniqueId}] 已标记为修复完成，但未找到交付图`
        ));
      }
    });
    return risks;
  }

  createRisk(recordId, riskType, description) {
    return {
      recordId,
      riskType,
      description,
      riskTypeLabel: RISK_TYPE_LABELS[riskType]
    };
  }

  getStatistics(risks) {
    const stats = {
      total: risks.length,
      byType: {},
      byStatus: {}
    };

    Object.values(RISK_TYPE).forEach(type => {
      stats.byType[type] = {
        count: 0,
        label: RISK_TYPE_LABELS[type]
      };
    });

    risks.forEach(risk => {
      if (stats.byType[risk.riskType]) {
        stats.byType[risk.riskType].count++;
      }
      if (!stats.byStatus[risk.status]) {
        stats.byStatus[risk.status] = 0;
      }
      stats.byStatus[risk.status]++;
    });

    return stats;
  }
}

export default new RiskService();
