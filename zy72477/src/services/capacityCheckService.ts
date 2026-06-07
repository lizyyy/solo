import { capacityCheckDao, calculationParamDao } from '../dao/capacityCheckDao';
import { shelterDao } from '../dao/shelterDao';
import { redLineDao } from '../dao/redLineDao';
import { inspectorDao } from '../dao/inspectorDao';
import { CapacityCheckResult, CalculationParam } from '../types';
import { calculateDeviation, calculateDeviationRate, determineCheckLevel, getCurrentTime } from '../utils/common';

export const capacityCheckService = {
  initDefaultParams: (operator: string): void => {
    const existing = calculationParamDao.findAllActive();
    if (existing.length > 0) return;

    const defaultParams: Omit<CalculationParam, 'id'>[] = [
      {
        paramName: '人均面积标准',
        paramVersion: 'v2.0',
        paramValue: '2.0 平方米/人',
        rationale: '依据《应急避难点建设规范》GB 21734-2008，紧急避难场所人均面积不小于2.0平方米',
        effectiveFrom: getCurrentTime(),
        effectiveTo: null,
        createdBy: operator
      },
      {
        paramName: '容量折算系数',
        paramVersion: 'v1.5',
        paramValue: '0.85',
        rationale: '考虑通道、设备用房等占用面积，实际可用面积按建筑面积的85%折算',
        effectiveFrom: getCurrentTime(),
        effectiveTo: null,
        createdBy: operator
      },
      {
        paramName: '改道影响系数',
        paramVersion: 'v1.0',
        paramValue: '0.7',
        rationale: '存在临时改道时，通行效率下降，可达容量按正常情况的70%计算',
        effectiveFrom: getCurrentTime(),
        effectiveTo: null,
        createdBy: operator
      }
    ];

    for (const param of defaultParams) {
      calculationParamDao.create(param);
    }
  },

  getActiveParams: (): CalculationParam[] => {
    return calculationParamDao.findAllActive();
  },

  calculateCapacityForShelter: (shelterId: string, checkedBy: string): CapacityCheckResult | null => {
    const shelter = shelterDao.findById(shelterId);
    if (!shelter) return null;

    const latestRedLine = redLineDao.findLatestByShelterId(shelterId);
    const latestReport = inspectorDao.findLatestByShelterId(shelterId);
    const activeParams = calculationParamDao.findAllActive();

    let checkedCapacity = shelter.actualCapacity;
    let isDetourAffected = false;
    let detourInfo: string | null = null;
    let needsResidentReview = false;
    const dataSources: string[] = [];

    if (latestRedLine) {
      dataSources.push(`红线图v${latestRedLine.version}`);
    }
    if (latestReport) {
      dataSources.push(`巡查表${latestReport.reportNo}`);
      checkedCapacity = latestReport.actualCapacity;

      if (latestReport.isTemporaryDetour) {
        isDetourAffected = true;
        detourInfo = latestReport.detourDescription;
        needsResidentReview = true;
        const detourCoeff = activeParams.find(p => p.paramName === '改道影响系数');
        if (detourCoeff) {
          const coeff = parseFloat(detourCoeff.paramValue);
          checkedCapacity = Math.floor(checkedCapacity * coeff);
        }
      }
    }

    const deviation = calculateDeviation(shelter.designedCapacity, checkedCapacity);
    const deviationRate = calculateDeviationRate(shelter.designedCapacity, checkedCapacity);
    const checkLevel = determineCheckLevel(deviationRate);

    return capacityCheckDao.create({
      shelterId,
      shelterName: shelter.name,
      designedCapacity: shelter.designedCapacity,
      checkedCapacity,
      deviation,
      deviationRate,
      checkLevel,
      calculationParams: activeParams,
      dataSources,
      isDetourAffected,
      detourInfo,
      needsResidentReview,
      checkTime: getCurrentTime(),
      checkedBy
    });
  },

  calculateAll: (checkedBy: string): CapacityCheckResult[] => {
    const shelters = shelterDao.findAll();
    const results: CapacityCheckResult[] = [];

    for (const shelter of shelters) {
      const result = capacityCheckService.calculateCapacityForShelter(shelter.id, checkedBy);
      if (result) {
        results.push(result);
      }
    }

    return results;
  },

  recalculateAfterSupplement: (shelterId: string, checkedBy: string): CapacityCheckResult | null => {
    return capacityCheckService.calculateCapacityForShelter(shelterId, checkedBy);
  },

  getLatestResults: (): CapacityCheckResult[] => {
    return capacityCheckDao.findLatestAll();
  },

  getResultsForShelter: (shelterId: string): CapacityCheckResult[] => {
    return capacityCheckDao.findByShelterId(shelterId);
  },

  getAllResults: (): CapacityCheckResult[] => {
    return capacityCheckDao.findAll();
  }
};
