import type { 
  Batch, DataRecord, InspectionData, PhysicsParams, ThresholdConfig,
  AbnormalRecord, CalculationResult, ConflictInfo
} from '@/types';
import { UnitConverter } from './unitConverter';
import { DataCleaner } from './dataCleaner';
import { CoolingLoadCalculator } from './coolingLoadCalculator';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

const DEFAULT_PARAMS: PhysicsParams = {
  iceArea: 1800,
  iceAreaUnit: 'm²',
  iceThickness: 30,
  iceThicknessUnit: 'mm',
  iceTemperature: -5,
  iceTemperatureUnit: '°C',
  ambientTemperature: 22,
  ambientTemperatureUnit: '°C',
  ambientHumidity: 60,
  peopleCount: 50,
  equipmentPower: 15,
  equipmentPowerUnit: 'kW',
  lightingPower: 8,
  lightingPowerUnit: 'kW',
};

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  maxCoolingLoad: 800,
  maxCoolingLoadUnit: 'kW',
  warningRatio: 0.8,
  extremeOutlierThreshold: 1.5,
  expectedIntervalMinutes: 30,
};

export function generateSampleData(): Batch {
  const batchId = generateId();
  const now = new Date();

  const records: DataRecord[] = [
    {
      id: generateId(),
      batchId,
      timestamp: new Date(now.getTime() - 3 * 60 * 60000),
      temperature: 10,
      temperatureUnit: '°C',
      humidity: 40,
      dataStatus: 'clean',
      recordStatus: 'normal',
      sources: [{
        id: generateId(),
        recordId: '',
        sourceType: 'import',
        sourceFile: '冰场监测数据_2024.csv',
        sourceLine: 2,
        originalValue: '10,40',
        originalUnit: '°C',
        importTimestamp: now,
      }],
      missingFields: [],
      unitIssues: [],
    },
    {
      id: generateId(),
      batchId,
      timestamp: new Date(now.getTime() - 2 * 60 * 60000),
      temperature: 14,
      temperatureUnit: '°C',
      humidity: 48,
      dataStatus: 'missing',
      recordStatus: 'pending',
      sources: [{
        id: generateId(),
        recordId: '',
        sourceType: 'import',
        sourceFile: '冰场监测数据_2024.csv',
        sourceLine: 3,
        originalValue: '14,48',
        originalUnit: '°C',
        importTimestamp: now,
      }],
      missingFields: ['coolingLoad'],
      unitIssues: ['该时间点缺少冷量实测数据，需人工确认'],
    },
    {
      id: generateId(),
      batchId,
      timestamp: new Date(now.getTime() - 1.5 * 60 * 60000),
      temperature: 64,
      temperatureUnit: '°F',
      humidity: 50,
      dataStatus: 'unit_mismatch',
      recordStatus: 'pending',
      sources: [{
        id: generateId(),
        recordId: '',
        sourceType: 'import',
        sourceFile: '冰场监测数据_2024.csv',
        sourceLine: 4,
        originalValue: '64,50',
        originalUnit: 'F',
        importTimestamp: now,
      }],
      missingFields: [],
      unitIssues: ['温度单位"F"识别为°F（64°F≈17.8°C），置信度70%'],
    },
    {
      id: generateId(),
      batchId,
      timestamp: new Date(now.getTime() - 1 * 60 * 60000),
      temperature: 22,
      temperatureUnit: '°C',
      humidity: 55,
      dataStatus: 'clean',
      recordStatus: 'pending',
      sources: [{
        id: generateId(),
        recordId: '',
        sourceType: 'import',
        sourceFile: '冰场监测数据_2024.csv',
        sourceLine: 5,
        originalValue: '22,55',
        originalUnit: '°C',
        importTimestamp: now,
      }],
      missingFields: [],
      unitIssues: [],
    },
    {
      id: generateId(),
      batchId,
      timestamp: new Date(now.getTime() - 30 * 60000),
      temperature: 32,
      temperatureUnit: '°C',
      humidity: 85,
      dataStatus: 'clean',
      recordStatus: 'extreme',
      sources: [{
        id: generateId(),
        recordId: '',
        sourceType: 'import',
        sourceFile: '冰场监测数据_2024.csv',
        sourceLine: 6,
        originalValue: '32,85',
        originalUnit: '°C',
        importTimestamp: now,
      }],
      missingFields: [],
      unitIssues: [],
    },
    {
      id: generateId(),
      batchId,
      timestamp: new Date(now.getTime() - 15 * 60000),
      temperature: 21,
      temperatureUnit: '°C',
      humidity: 50,
      coolingLoad: 546120,
      coolingLoadUnit: 'BTU/h',
      dataStatus: 'unit_mismatch',
      recordStatus: 'old_caliber',
      sources: [{
        id: generateId(),
        recordId: '',
        sourceType: 'inspection',
        sourceFile: '设备巡检表_2024Q3.xlsx',
        sourceLine: 12,
        originalValue: '21,50,546120',
        originalUnit: '°C',
        importTimestamp: now,
      }],
      missingFields: [],
      unitIssues: ['冷量单位"BTU/h"与主数据集"kW"不一致，需要换算', '来源: 设备巡检表旧口径'],
    },
  ];

  records.forEach(record => {
    record.sources.forEach(source => {
      source.recordId = record.id;
    });
  });

  const inspectionData: InspectionData[] = [
    {
      id: generateId(),
      batchId,
      source: '设备巡检表_2024Q3.xlsx',
      caliber: 'old',
      recordDate: new Date(now.getTime() - 45 * 24 * 60 * 60000),
      rawData: {
        temperature: 21,
        temperatureUnit: '°C',
        humidity: 50,
        coolingLoad: 546000,
        coolingLoadUnit: 'BTU/h',
        remark: '旧口径：按设备铭牌功率直接累加，未扣除效率系数',
      },
      conflictStatus: 'pending',
      conflictingFields: ['coolingLoad', 'coolingLoadUnit'],
      conflictEvidence: {
        importedData: {
          source: '冰场监测数据_2024.csv (第5行, 22°C)',
          coolingLoad: '约702 kW（计算值）',
          coolingLoadUnit: 'kW',
          temperature: '22°C',
          timestamp: new Date(now.getTime() - 1 * 60 * 60000),
        },
        inspectionData: {
          source: '设备巡检表_2024Q3.xlsx (第12行, 21°C)',
          coolingLoad: 546120,
          coolingLoadUnit: 'BTU/h',
          recordDate: new Date(now.getTime() - 45 * 24 * 60 * 60000),
          caliber: 'old',
          remark: '旧口径：按设备铭牌功率直接累加，未扣除效率系数',
        },
        suggestions: [
          '546120 BTU/h ≈ 160.1 kW，与同温区计算值约672 kW差异显著',
          '巡检表使用旧口径（铭牌功率直接累加），未扣除效率系数',
          '旧口径仅统计设备铭牌功率，不含对流、辐射、湿负荷等环境热负荷',
          '建议以当前物理模型计算结果为准，巡检表数据仅作设备容量参考',
        ],
      },
    },
  ];

  const batch: Batch = {
    id: batchId,
    name: '冰场制冷负荷诊断-示例批次',
    createdAt: now,
    updatedAt: now,
    parameters: { ...DEFAULT_PARAMS },
    thresholds: { ...DEFAULT_THRESHOLDS },
    status: 'processing',
    createdBy: '系统',
    records,
    calculationResults: [],
    abnormalRecords: [],
    inspectionData,
    decisionTraces: [],
  };

  const calculator = new CoolingLoadCalculator(batch.parameters);
  const calculationResults: CalculationResult[] = [];
  const abnormalRecords: AbnormalRecord[] = [];

  records.forEach(record => {
    const result = calculator.calculateTotal(record);
    calculationResults.push(result);

    const maxLoadKw = UnitConverter.convertPower(
      batch.thresholds.maxCoolingLoad,
      batch.thresholds.maxCoolingLoadUnit,
      'kW'
    );

    if (result.totalLoad > maxLoadKw) {
      abnormalRecords.push({
        id: generateId(),
        recordId: record.id,
        type: 'threshold_exceed',
        severity: result.totalLoad > maxLoadKw * 1.5 ? 'critical' : 'high',
        threshold: maxLoadKw,
        actualValue: result.totalLoad,
        description: `制冷负荷 ${result.totalLoad.toFixed(2)} kW 超过安全阈值 ${maxLoadKw.toFixed(0)} kW`,
        confirmStatus: 'pending',
      });
      if (record.recordStatus !== 'old_caliber') {
        record.recordStatus = 'extreme';
      }
    } else if (result.totalLoad > maxLoadKw * batch.thresholds.warningRatio) {
      abnormalRecords.push({
        id: generateId(),
        recordId: record.id,
        type: 'threshold_exceed',
        severity: 'medium',
        threshold: maxLoadKw * batch.thresholds.warningRatio,
        actualValue: result.totalLoad,
        description: `制冷负荷 ${result.totalLoad.toFixed(2)} kW 接近安全阈值 ${maxLoadKw.toFixed(0)} kW（警告线${(batch.thresholds.warningRatio * 100).toFixed(0)}%）`,
        confirmStatus: 'pending',
      });
      if (record.recordStatus === 'normal') {
        record.recordStatus = 'pending';
      }
    }
  });

  const allLoads = calculationResults.map(r => r.totalLoad);
  const outlierResult = DataCleaner.detectExtremes(allLoads, batch.thresholds.extremeOutlierThreshold);
  
  outlierResult.outlierIndices.forEach(idx => {
    const record = records[idx];
    if (record && !abnormalRecords.find(a => a.recordId === record.id)) {
      abnormalRecords.push({
        id: generateId(),
        recordId: record.id,
        type: 'extreme_value',
        severity: 'high',
        threshold: outlierResult.bounds.upper,
        actualValue: allLoads[idx],
        description: `极端值检测: ${allLoads[idx].toFixed(2)} kW 超出IQR上限 ${outlierResult.bounds.upper.toFixed(2)} kW，该值不参与稳健平均值计算`,
        confirmStatus: 'pending',
      });
    }
    if (record) {
      record.recordStatus = 'extreme';
    }
  });

  batch.calculationResults = calculationResults;
  batch.abnormalRecords = abnormalRecords;

  return batch;
}

export function generateReportMarkdown(batch: Batch): string {
  const lines: string[] = [];
  lines.push(`# 冰场制冷负荷诊断报告`);
  lines.push(``);
  lines.push(`**批次**: ${batch.name}`);
  lines.push(`**创建时间**: ${new Date(batch.createdAt).toLocaleString('zh-CN')}`);
  lines.push(`**操作人**: ${batch.createdBy}`);
  lines.push(`**报告生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(``);
  
  lines.push(`## 一、物理参数`);
  lines.push(``);
  lines.push(`| 参数 | 值 | 单位 |`);
  lines.push(`|------|-----|------|`);
  lines.push(`| 冰面面积 | ${batch.parameters.iceArea} | ${batch.parameters.iceAreaUnit} |`);
  lines.push(`| 冰层厚度 | ${batch.parameters.iceThickness} | ${batch.parameters.iceThicknessUnit} |`);
  lines.push(`| 冰面温度 | ${batch.parameters.iceTemperature} | ${batch.parameters.iceTemperatureUnit} |`);
  lines.push(`| 环境温度 | ${batch.parameters.ambientTemperature} | ${batch.parameters.ambientTemperatureUnit} |`);
  lines.push(`| 环境湿度 | ${batch.parameters.ambientHumidity} | % |`);
  lines.push(`| 人员数量 | ${batch.parameters.peopleCount} | 人 |`);
  lines.push(`| 设备功率 | ${batch.parameters.equipmentPower} | ${batch.parameters.equipmentPowerUnit} |`);
  lines.push(`| 照明功率 | ${batch.parameters.lightingPower} | ${batch.parameters.lightingPowerUnit} |`);
  lines.push(``);

  lines.push(`## 二、安全阈值配置`);
  lines.push(``);
  lines.push(`| 阈值项 | 值 | 单位 |`);
  lines.push(`|--------|-----|------|`);
  lines.push(`| 最大制冷负荷 | ${batch.thresholds.maxCoolingLoad} | ${batch.thresholds.maxCoolingLoadUnit} |`);
  lines.push(`| 警告比例 | ${(batch.thresholds.warningRatio * 100).toFixed(0)}% | - |`);
  lines.push(`| 极端值检测阈值 | ${batch.thresholds.extremeOutlierThreshold} | IQR倍数 |`);
  lines.push(``);

  lines.push(`## 三、数据质量报告`);
  lines.push(``);
  const totalRecords = batch.records.length;
  const cleanRecords = batch.records.filter(r => r.dataStatus === 'clean').length;
  const missingRecords = batch.records.filter(r => r.dataStatus === 'missing').length;
  const unitMismatchRecords = batch.records.filter(r => r.dataStatus === 'unit_mismatch').length;
  const expectedInterval = batch.thresholds?.expectedIntervalMinutes ?? 30;
  const gapResult = batch.records.length >= 2 ? DataCleaner.detectGaps(batch.records, expectedInterval) : { gaps: [] };
  lines.push(`- 总记录数: ${totalRecords}`);
  lines.push(`- 完整记录: ${cleanRecords}`);
  lines.push(`- 缺失字段记录: ${missingRecords}`);
  lines.push(`- 单位混写记录: ${unitMismatchRecords}`);
  lines.push(`- 时间序列采样缺口: ${gapResult.gaps.length}（期望间隔: ${expectedInterval}分钟）`);
  gapResult.gaps.forEach((g, i) => {
    lines.push(`  - 缺口#${i + 1}: 预期 ${new Date(g.expectedTime).toLocaleString('zh-CN')}，实际 ${new Date(g.actualTime).toLocaleString('zh-CN')}（间隔 ${g.gapMinutes.toFixed(0)} 分钟）`);
  });
  lines.push(``);

  lines.push(`## 四、计算结果`);
  lines.push(``);
  lines.push(`| 序号 | 时间 | 温度 | 湿度 | 总负荷 | 状态 | 来源 |`);
  lines.push(`|------|------|------|------|--------|------|------|`);
  batch.records.forEach((record, i) => {
    const result = batch.calculationResults.find(r => r.recordId === record.id);
    const loadStr = result ? `${result.totalLoad.toFixed(2)} ${result.totalLoadUnit}` : '-';
    const statusMap: Record<string, string> = {
      normal: '✅ 正常',
      pending: '⚠️ 待确认',
      old_caliber: '📋 旧口径',
      extreme: '🔴 极端值',
    };
    const source = record.sources[0];
    const sourceStr = source ? `${source.sourceFile}#${source.sourceLine}` : '-';
    lines.push(`| ${i + 1} | ${new Date(record.timestamp).toLocaleString('zh-CN')} | ${record.temperature}${record.temperatureUnit} | ${record.humidity}% | ${loadStr} | ${statusMap[record.recordStatus] || record.recordStatus} | ${sourceStr} |`);
  });
  lines.push(``);

  const nonExtremeResults = batch.calculationResults.filter(
    r => !batch.records.find(rec => rec.id === r.recordId && rec.recordStatus === 'extreme')
  );
  const allLoads = nonExtremeResults.map(r => r.totalLoad);
  const robustMean = allLoads.length > 0 ? allLoads.reduce((s, v) => s + v, 0) / allLoads.length : 0;
  const allLoadsFull = batch.calculationResults.map(r => r.totalLoad);
  const fullMean = allLoadsFull.length > 0 ? allLoadsFull.reduce((s, v) => s + v, 0) / allLoadsFull.length : 0;

  lines.push(`### 统计摘要`);
  lines.push(``);
  lines.push(`- 稳健平均值（排除极端值）: ${robustMean.toFixed(2)} kW`);
  lines.push(`- 全量平均值: ${fullMean.toFixed(2)} kW`);
  lines.push(``);

  lines.push(`## 五、极端值与异常记录`);
  lines.push(``);
  const abnormalRecords = batch.abnormalRecords;
  if (abnormalRecords.length === 0) {
    lines.push(`未检测到异常记录。`);
  } else {
    abnormalRecords.forEach(abnormal => {
      const record = batch.records.find(r => r.id === abnormal.recordId);
      const severityMap: Record<string, string> = {
        low: '低',
        medium: '中',
        high: '高',
        critical: '严重',
      };
      lines.push(`### 异常 #${abnormal.id.slice(0, 8)}`);
      lines.push(``);
      lines.push(`- **类型**: ${abnormal.type === 'threshold_exceed' ? '超阈值' : abnormal.type === 'extreme_value' ? '极端值' : '数据冲突'}`);
      lines.push(`- **严重程度**: ${severityMap[abnormal.severity] || abnormal.severity}`);
      lines.push(`- **实际值**: ${abnormal.actualValue.toFixed(2)} kW`);
      lines.push(`- **阈值**: ${abnormal.threshold.toFixed(2)} kW`);
      lines.push(`- **描述**: ${abnormal.description}`);
      lines.push(`- **确认状态**: ${abnormal.confirmStatus === 'pending' ? '待确认' : abnormal.confirmStatus === 'confirmed' ? '已确认' : '已驳回'}`);
      if (record) {
        const source = record.sources[0];
        lines.push(`- **数据来源**: ${source ? `${source.sourceFile} 第${source.sourceLine}行` : '-'}`);
      }
      if (abnormal.notes) {
        lines.push(`- **备注**: ${abnormal.notes}`);
      }
      lines.push(``);
    });
  }

  if (batch.inspectionData.length > 0) {
    lines.push(`## 六、巡检表数据冲突`);
    lines.push(``);
    batch.inspectionData.forEach(inspection => {
      lines.push(`### 巡检表: ${inspection.source}`);
      lines.push(``);
      lines.push(`- **口径**: ${inspection.caliber === 'old' ? '旧口径' : '新口径'}`);
      lines.push(`- **记录日期**: ${new Date(inspection.recordDate).toLocaleDateString('zh-CN')}`);
      lines.push(`- **冲突状态**: ${inspection.conflictStatus === 'pending' ? '待处理' : inspection.conflictStatus === 'resolved' ? '已解决' : '无冲突'}`);
      
      if (inspection.conflictEvidence) {
        lines.push(``);
        lines.push(`**冲突详情**:`);
        lines.push(``);
        lines.push(`- 导入数据: ${JSON.stringify(inspection.conflictEvidence.importedData)}`);
        lines.push(`- 巡检表数据: ${JSON.stringify(inspection.conflictEvidence.inspectionData)}`);
        lines.push(`- 建议动作:`);
        inspection.conflictEvidence.suggestions.forEach(s => {
          lines.push(`  - ${s}`);
        });
      }
      lines.push(``);
    });
  }

  if (batch.decisionTraces.length > 0) {
    lines.push(`## 七、决策留痕`);
    lines.push(``);
    lines.push(`| 时间 | 操作人 | 类型 | 变更前 | 变更后 | 原因 |`);
    lines.push(`|------|--------|------|--------|--------|------|`);
    batch.decisionTraces.forEach(trace => {
      const typeMap: Record<string, string> = {
        parameter_change: '参数变更',
        status_change: '状态变更',
        conflict_resolve: '冲突处理',
        extreme_handle: '极端值处理',
      };
      lines.push(`| ${new Date(trace.timestamp).toLocaleString('zh-CN')} | ${trace.operator} | ${typeMap[trace.decisionType] || trace.decisionType} | ${JSON.stringify(trace.beforeValue)} | ${JSON.stringify(trace.afterValue)} | ${trace.reason} |`);
    });
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`*本报告由冰场制冷负荷诊断工具自动生成*`);

  return lines.join('\n');
}
