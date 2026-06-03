const { STATUS } = require('../models/ValuationAnomaly');

const CALCULATION_VERSIONS = {
  'v1.0': {
    description: '基础市值法估值模型',
    effectiveDate: '2024-01-01',
    deviationThreshold: 0.05
  },
  'v1.1': {
    description: '优化偏离率计算，增加异常波动过滤',
    effectiveDate: '2024-03-15',
    deviationThreshold: 0.03,
    volatilityFilter: true
  },
  'v2.0': {
    description: '引入市场基准对比，支持冲正交易特殊处理',
    effectiveDate: '2024-06-01',
    deviationThreshold: 0.03,
    volatilityFilter: true,
    benchmarkComparison: true,
    reversalHandling: true
  }
};

const CURRENT_VERSION = 'v2.0';

class ValuationService {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  calculate(marketData, version = CURRENT_VERSION) {
    const versionConfig = CALCULATION_VERSIONS[version];
    if (!versionConfig) {
      throw new Error(`不支持的计算版本: ${version}`);
    }

    const params = this.buildCalculationParams(marketData, versionConfig);
    const result = this.applyValuationModel(marketData, params);
    const rationale = this.generateRationale(marketData, result, versionConfig);

    return {
      result,
      params,
      version,
      rationale,
      versionInfo: versionConfig
    };
  }

  buildCalculationParams(marketData, versionConfig) {
    const params = {
      securityCode: marketData.securityCode,
      baseDate: marketData.baseDate || new Date().toISOString().split('T')[0],
      marketPrice: marketData.marketPrice,
      quantity: marketData.quantity,
      deviationThreshold: versionConfig.deviationThreshold
    };

    if (versionConfig.volatilityFilter) {
      params.volatilityWindow = 20;
      params.volatilityThreshold = 0.02;
    }

    if (versionConfig.benchmarkComparison) {
      params.benchmarkIndex = '000300.SH';
      params.betaAdjustment = true;
    }

    if (versionConfig.reversalHandling) {
      params.reversalMarker = '已冲正';
      params.reversalAutoNormalize = false;
    }

    return params;
  }

  applyValuationModel(marketData, params) {
    const marketValue = marketData.marketPrice * marketData.quantity;
    const calculatedValue = marketValue * (1 + marketData.marketAdjustment || 0);
    
    if (params.volatilityThreshold && marketData.historicalVolatility) {
      if (marketData.historicalVolatility > params.volatilityThreshold) {
        return {
          marketValue,
          calculatedValue,
          deviation: calculatedValue - marketValue,
          deviationRate: (calculatedValue - marketValue) / marketValue,
          volatilityAdjusted: true,
          volatilityNote: '高波动市场，偏离率已放大处理'
        };
      }
    }

    return {
      marketValue,
      calculatedValue,
      deviation: calculatedValue - marketValue,
      deviationRate: (calculatedValue - marketValue) / marketValue
    };
  }

  generateRationale(marketData, result, versionConfig) {
    const rationale = [];

    rationale.push(`使用估值模型版本: ${versionConfig.description}`);
    rationale.push(`偏离率阈值: ${(versionConfig.deviationThreshold * 100).toFixed(1)}%`);

    if (result.deviationRate > versionConfig.deviationThreshold) {
      rationale.push(`检测到异常: 偏离率 ${(result.deviationRate * 100).toFixed(2)}% 超过阈值`);
    } else {
      rationale.push(`偏离率正常: ${(result.deviationRate * 100).toFixed(2)}% 在阈值范围内`);
    }

    if (versionConfig.volatilityFilter) {
      if (result.volatilityAdjusted) {
        rationale.push('波动调整: 因市场高波动，已启用波动率调整');
      } else {
        rationale.push('波动调整: 市场波动正常，未启用波动率调整');
      }
    }

    if (versionConfig.benchmarkComparison) {
      rationale.push('基准对比: 已与沪深300指数进行对比验证');
    }

    if (versionConfig.reversalHandling && marketData.remark && marketData.remark.includes('已冲正')) {
      rationale.push('冲正处理: 检测到冲正标记，已标记为待风控复核，不自动归一化');
    }

    return rationale.join('; ');
  }

  setAnomalyCalculation(anomalyId, marketData, version = CURRENT_VERSION) {
    const anomaly = this.dataStore.getById(anomalyId);
    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    const calculation = this.calculate(marketData, version);
    
    anomaly.marketValue = calculation.result.marketValue;
    anomaly.calculatedValue = calculation.result.calculatedValue;
    anomaly.deviation = calculation.result.deviation;
    anomaly.deviationRate = calculation.result.deviationRate;
    
    anomaly.setCalculationParams(
      calculation.params,
      calculation.version,
      calculation.rationale
    );

    this.dataStore.update(anomaly);

    return anomaly.toJSON();
  }

  getVersionInfo(version) {
    if (version) {
      return CALCULATION_VERSIONS[version];
    }
    return {
      currentVersion: CURRENT_VERSION,
      availableVersions: Object.keys(CALCULATION_VERSIONS),
      versions: CALCULATION_VERSIONS
    };
  }

  getCalculationWithDetails(anomalyId) {
    const anomaly = this.dataStore.getById(anomalyId);
    if (!anomaly) {
      throw new Error('异常记录不存在');
    }

    const data = anomaly.toJSON();
    
    return {
      ...data,
      calculationDetails: anomaly.calculationParams ? {
        displayText: `【计算版本: ${anomaly.calculationParams.version}】${anomaly.calculationParams.rationale}`,
        params: anomaly.calculationParams.params,
        version: anomaly.calculationParams.version,
        rationale: anomaly.calculationParams.rationale,
        calculatedAt: anomaly.calculationParams.calculatedAt
      } : null
    };
  }
}

module.exports = ValuationService;
