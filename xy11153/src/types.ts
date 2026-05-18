export interface CourtRecord {
  预约编号: string;
  球场编号: string;
  预约日期: string;
  开始时间: string;
  结束时间: string;
  预约时长: string;
  预约人数: string;
  天气状况: string;
  是否降雨: string;
  降雨时段: string;
  球场使用情况: string;
  补偿状态: string;
  备注: string;
  数据来源: string;
  补偿类型?: string;
  补偿比例?: string;
  标签?: string;
}

export interface RuleCondition {
  field: string;
  operator: string;
  values?: string[];
  pattern?: string;
  description?: string;
}

export interface ClassificationRule {
  description: string;
  conditions: RuleCondition[];
  matchStrategy: 'all' | 'any';
  outputFile: string;
}

export interface SpecialScenarioRule {
  description: string;
  keywords: string[];
  conditions: RuleCondition[];
  matchStrategy: 'all' | 'any';
  tag: string;
  outputFile: string;
}

export interface CompensationRule {
  description: string;
  conditions: RuleCondition[];
  compensationRate: number;
  compensationType: string;
}

export interface RulesConfig {
  version: string;
  description: string;
  recordClassification: {
    normalRecords: ClassificationRule;
    abnormalRecords: ClassificationRule;
  };
  specialScenarios: {
    partialRain: SpecialScenarioRule;
    halfCourtUsage: SpecialScenarioRule;
  };
  compensationRules: {
    fullCompensation: CompensationRule;
    partialCompensation: CompensationRule;
  };
  outputConfig: {
    encoding: string;
    delimiter: string;
    includeHeader: boolean;
    timestampFormat: string;
    stableOutput: boolean;
    sortBy: string;
    columns: string[];
  };
  validationRules: {
    requiredFields: string[];
    dataTypes: Record<string, string>;
    dateFormat: string;
    timeFormat: string;
  };
}

export interface ProcessResult {
  totalRecords: number;
  normalRecords: CourtRecord[];
  abnormalRecords: CourtRecord[];
  partialRainRecords: CourtRecord[];
  halfCourtUsageRecords: CourtRecord[];
  outputFiles: string[];
  warnings: string[];
}

export interface ProcessOptions {
  input: string;
  outputDir: string;
  mode: 'preview' | 'run';
  rulesPath: string;
}
