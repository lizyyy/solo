import { v4 as uuidv4 } from 'uuid';
import {
  SelfCheckType,
  SelfCheckResult,
  SelfCheckRecord,
  AuthorizationTerm,
  ProcessingStatus
} from '../types';
import dataSource from './dataSource';

export class SelfCheckEngine {
  runAllChecks(checkedBy: string): SelfCheckRecord[] {
    console.log(`[SelfCheckEngine] 开始执行全部自检项`);
    const results: SelfCheckRecord[] = [];

    results.push(this.checkDuplicateImports(checkedBy));
    results.push(this.checkMissingCities(checkedBy));
    results.push(this.checkRecalculationAfterSupplement(checkedBy));
    results.push(this.checkExportConsistency(checkedBy));

    console.log(`[SelfCheckEngine] 自检完成, 共 ${results.length} 项`);
    return results;
  }

  checkDuplicateImports(checkedBy: string): SelfCheckRecord {
    const terms = dataSource.getAuthorizationTerms();
    const now = new Date().toISOString();
    const duplicates: { key: string; count: number; ids: string[] }[] = [];

    const seen = new Map<string, string[]>();
    for (const term of terms) {
      const key = `${term.bandName}-${term.equipmentModel}-${term.authorizationStartDate}`;
      if (!seen.has(key)) {
        seen.set(key, []);
      }
      seen.get(key)!.push(term.id);
    }

    for (const [key, ids] of seen.entries()) {
      if (ids.length > 1) {
        duplicates.push({ key, count: ids.length, ids });
      }
    }

    const record: SelfCheckRecord = {
      id: uuidv4(),
      checkType: SelfCheckType.DUPLICATE_IMPORT,
      checkName: '重复导入检测',
      result: duplicates.length > 0 ? SelfCheckResult.FAIL : SelfCheckResult.PASS,
      description: duplicates.length > 0 
        ? `检测到 ${duplicates.length} 组可能重复的导入记录` 
        : '未检测到重复导入',
      detail: { duplicates },
      checkedAt: now,
      checkedBy
    };

    dataSource.addSelfCheckRecord(record);
    return record;
  }

  checkMissingCities(checkedBy: string): SelfCheckRecord {
    const terms = dataSource.getAuthorizationTerms();
    const now = new Date().toISOString();
    const missingCityTerms: { id: string; bandName: string; originalRowNumber: number; originalText: string; parsedCities: number }[] = [];

    for (const term of terms) {
      if (term.status === ProcessingStatus.VERIFICATION_REQUIRED) {
        continue;
      }

      const originalText = term.originalAuthorizedCitiesText;
      const parsedCount = term.authorizedCities.length;
      
      const expectedCities = originalText.split(/[,，;；]/).filter(s => s.trim()).length;
      
      const hasMissingCity = term.authorizedCities.some(c => {
        if (!c.city || c.city === '市') return true;
        if (c.city.endsWith('省') || c.city.endsWith('自治区')) return true;
        if (c.province && !c.city) return true;
        const directCities = ['北京市', '上海市', '天津市', '重庆市', '香港市', '澳门市'];
        const provinceNames = ['河北', '山西', '辽宁', '吉林', '黑龙江', 
                               '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
                               '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾',
                               '内蒙古', '广西', '西藏', '宁夏', '新疆'];
        if (directCities.includes(c.city)) return false;
        const looksLikeProvinceOnly = provinceNames.some(p => c.city === p + '市' || c.city === p);
        if (looksLikeProvinceOnly && !c.province) return true;
        if (!c.province && !directCities.includes(c.city)) {
          const isMajorCity = ['广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '苏州'].some(m => c.city.includes(m));
          if (!isMajorCity) return true;
        }
        return false;
      });
      
      if (parsedCount < expectedCities || hasMissingCity) {
        missingCityTerms.push({
          id: term.id,
          bandName: term.bandName,
          originalRowNumber: term.originalRowNumber,
          originalText,
          parsedCities: parsedCount
        });

        dataSource.updateAuthorizationTerm(
          term.id,
          { status: ProcessingStatus.VERIFICATION_REQUIRED },
          'system',
          '自检发现授权地区可能缺少城市, 待店长复核'
        );
      }
    }

    const record: SelfCheckRecord = {
      id: uuidv4(),
      checkType: SelfCheckType.MISSING_CITY,
      checkName: '授权地区城市缺失检测',
      result: missingCityTerms.length > 0 ? SelfCheckResult.WARNING : SelfCheckResult.PASS,
      description: missingCityTerms.length > 0
        ? `发现 ${missingCityTerms.length} 条记录可能缺少城市, 已标记待店长复核`
        : '所有授权地区城市信息完整',
      detail: { missingCityTerms },
      checkedAt: now,
      checkedBy
    };

    dataSource.addSelfCheckRecord(record);
    return record;
  }

  checkRecalculationAfterSupplement(checkedBy: string): SelfCheckRecord {
    const terms = dataSource.getAuthorizationTerms();
    const now = new Date().toISOString();
    const needRecalc: { id: string; bandName: string; originalRowNumber: number; originalFee: number; currentFee: number }[] = [];

    for (const term of terms) {
      const changeRecords = dataSource.getChangeRecords(term.id);
      const hasSupplement = changeRecords.some(c => 
        c.fieldName === 'authorizedCities' || c.fieldName === 'repairFee'
      );
      
      if (hasSupplement && term.originalRepairFee !== term.repairFee) {
        const feeChanged = changeRecords.filter(c => c.fieldName === 'repairFee').length;
        if (feeChanged === 1) {
          needRecalc.push({
            id: term.id,
            bandName: term.bandName,
            originalRowNumber: term.originalRowNumber,
            originalFee: term.originalRepairFee,
            currentFee: term.repairFee
          });
        }
      }
    }

    const record: SelfCheckRecord = {
      id: uuidv4(),
      checkType: SelfCheckType.RECALCULATION_AFTER_SUPPLEMENT,
      checkName: '补录后重算检测',
      result: needRecalc.length > 0 ? SelfCheckResult.WARNING : SelfCheckResult.PASS,
      description: needRecalc.length > 0
        ? `发现 ${needRecalc.length} 条记录补录后费用已更新`
        : '无需重算',
      detail: { needRecalc },
      checkedAt: now,
      checkedBy
    };

    dataSource.addSelfCheckRecord(record);
    return record;
  }

  checkExportConsistency(checkedBy: string): SelfCheckRecord {
    const now = new Date().toISOString();
    const consistency = dataSource.verifyDataConsistency();

    const listData = dataSource.getAuthorizationTerms('list');
    const detailData = dataSource.getAuthorizationTerms('detail');
    const exportData = dataSource.getAuthorizationTerms('export');

    const listCount = listData.length;
    const detailCount = detailData.length;
    const exportCount = exportData.length;

    const isCountConsistent = listCount === detailCount && detailCount === exportCount;
    const isDataConsistent = consistency.isConsistent;

    const record: SelfCheckRecord = {
      id: uuidv4(),
      checkType: SelfCheckType.EXPORT_CONSISTENCY,
      checkName: '导出一致性检测',
      result: isCountConsistent && isDataConsistent ? SelfCheckResult.PASS : SelfCheckResult.FAIL,
      description: isCountConsistent && isDataConsistent
        ? '列表、详情、导出三者数据一致'
        : `数据不一致: 列表${listCount}条, 详情${detailCount}条, 导出${exportCount}条, 关联问题${consistency.details.length}个`,
      detail: {
        listCount,
        detailCount,
        exportCount,
        isCountConsistent,
        isDataConsistent,
        issues: consistency.details
      },
      checkedAt: now,
      checkedBy
    };

    dataSource.addSelfCheckRecord(record);
    return record;
  }

  getCheckSummary(): { pass: number; fail: number; warning: number } {
    const records = dataSource.getSelfCheckRecords();
    const latestByType = new Map<string, SelfCheckRecord>();
    
    for (const record of records) {
      const existing = latestByType.get(record.checkType);
      if (!existing || new Date(record.checkedAt) > new Date(existing.checkedAt)) {
        latestByType.set(record.checkType, record);
      }
    }

    let pass = 0, fail = 0, warning = 0;
    for (const record of latestByType.values()) {
      if (record.result === SelfCheckResult.PASS) pass++;
      else if (record.result === SelfCheckResult.FAIL) fail++;
      else if (record.result === SelfCheckResult.WARNING) warning++;
    }

    return { pass, fail, warning };
  }
}

export const selfCheckEngine = new SelfCheckEngine();
export default selfCheckEngine;
