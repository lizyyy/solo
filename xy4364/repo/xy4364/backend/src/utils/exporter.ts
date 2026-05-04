import { Batch, TemperatureCurve, Formula, ReviewRecord, RiskAssessment } from '../types';
import { Parser } from 'json2csv';

export function generateReworkOrderMarkdown(
  batch: Batch,
  temperatureCurve?: TemperatureCurve,
  formula?: Formula,
  reviewRecord?: ReviewRecord,
  riskAssessment?: RiskAssessment
): string {
  const lines: string[] = [];

  lines.push(`# 返工单 - 批次 ${batch.batchNumber}`);
  lines.push('');
  lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  lines.push('## 基本信息');
  lines.push('');
  lines.push(`| 项目 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| 批次号 | ${batch.batchNumber} |`);
  lines.push(`| 客户 | ${batch.customerName} |`);
  lines.push(`| 面料类型 | ${batch.fabricType} |`);
  lines.push(`| 返工优先级 | ${riskAssessment?.reworkPriority ?? '未评估'} |`);
  lines.push(`| 风险等级 | ${riskAssessment?.riskLevel ?? '未评估'} |`);
  lines.push('');

  lines.push('## 色差信息');
  lines.push('');
  lines.push(`### 目标色 (Lab)`);
  lines.push(`- L: ${batch.targetColor.L}`);
  lines.push(`- a: ${batch.targetColor.a}`);
  lines.push(`- b: ${batch.targetColor.b}`);
  lines.push('');

  if (batch.measuredColor) {
    lines.push(`### 实际测量色 (Lab)`);
    lines.push(`- L: ${batch.measuredColor.L}`);
    lines.push(`- a: ${batch.measuredColor.a}`);
    lines.push(`- b: ${batch.measuredColor.b}`);
    lines.push('');
    lines.push(`### DeltaE: **${batch.deltaE?.toFixed(2) ?? '未计算'}**`);
    lines.push('');
  }

  if (temperatureCurve) {
    lines.push('## 温度曲线偏差');
    lines.push('');
    lines.push(`**平均温度偏差**: ${temperatureCurve.temperatureDeviation?.toFixed(2) ?? '未计算'}°C`);
    lines.push('');

    if (temperatureCurve.targetCurve.length > 0) {
      lines.push('### 目标温度曲线');
      lines.push('');
      lines.push(`| 时间(分钟) | 温度(°C) |`);
      lines.push(`|------------|----------|`);
      for (const point of temperatureCurve.targetCurve) {
        lines.push(`| ${point.time} | ${point.temperature} |`);
      }
      lines.push('');
    }

    if (temperatureCurve.actualCurve.length > 0) {
      lines.push('### 实际温度曲线');
      lines.push('');
      lines.push(`| 时间(分钟) | 温度(°C) |`);
      lines.push(`|------------|----------|`);
      for (const point of temperatureCurve.actualCurve) {
        lines.push(`| ${point.time} | ${point.temperature} |`);
      }
      lines.push('');
    }
  }

  if (formula) {
    lines.push('## 配方信息');
    lines.push('');

    if (formula.missingChemicals.length > 0) {
      lines.push(`### ⚠️ 漏加助剂: **${formula.missingChemicals.join(', ')}**`);
      lines.push('');
    }

    if (formula.targetFormula.length > 0) {
      lines.push('### 目标配方');
      lines.push('');
      lines.push(`| 助剂名称 | 用量 | 单位 |`);
      lines.push(`|----------|------|------|`);
      for (const item of formula.targetFormula) {
        lines.push(`| ${item.chemicalName} | ${item.dosage} | ${item.unit} |`);
      }
      lines.push('');
    }

    if (formula.actualFormula.length > 0) {
      lines.push('### 实际配方');
      lines.push('');
      lines.push(`| 助剂名称 | 用量 | 单位 | 实际添加 |`);
      lines.push(`|----------|------|------|----------|`);
      for (const item of formula.actualFormula) {
        lines.push(`| ${item.chemicalName} | ${item.dosage} | ${item.unit} | ${item.added ? '✓' : '✗'} |`);
      }
      lines.push('');
    }
  }

  if (reviewRecord) {
    lines.push('## 复核记录');
    lines.push('');
    lines.push(`| 项目 | 内容 |`);
    lines.push(`|------|------|`);
    lines.push(`| 复核人 | ${reviewRecord.reviewer} |`);
    lines.push(`| 判定结果 | ${getJudgementText(reviewRecord.judgement)} |`);
    lines.push(`| 复核时间 | ${new Date(reviewRecord.updatedAt).toLocaleString('zh-CN')} |`);
    lines.push('');

    if (reviewRecord.notes) {
      lines.push(`### 备注`);
      lines.push('');
      lines.push(reviewRecord.notes);
      lines.push('');
    }

    if (reviewRecord.reworkReason) {
      lines.push(`### 返工原因`);
      lines.push('');
      lines.push(reviewRecord.reworkReason);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('> 此返工单由色差复盘台系统自动生成');

  return lines.join('\n');
}

function getJudgementText(judgement: string): string {
  switch (judgement) {
    case 'pass': return '合格通过';
    case 'rework': return '需要返工';
    case 'pending': return '待复核';
    default: return judgement;
  }
}

export function generateRiskListCSV(riskAssessments: RiskAssessment[]): string {
  const fields = [
    { label: '批次号', value: 'batchNumber' },
    { label: '客户', value: 'customerName' },
    { label: 'DeltaE', value: 'deltaE' },
    { label: '温度偏差', value: 'temperatureDeviation' },
    { label: '漏加助剂数', value: 'missingChemicalsCount' },
    { label: '返工优先级', value: 'reworkPriority' },
    { label: '风险等级', value: 'riskLevel' }
  ];

  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(riskAssessments);
}

export function generateAuditPackageJSON(
  batch: Batch,
  temperatureCurve?: TemperatureCurve,
  formula?: Formula,
  reviewRecord?: ReviewRecord,
  riskAssessment?: RiskAssessment
): string {
  const auditData = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    batch: {
      id: batch.id,
      batchNumber: batch.batchNumber,
      fabricType: batch.fabricType,
      customerName: batch.customerName,
      targetColor: batch.targetColor,
      measuredColor: batch.measuredColor,
      deltaE: batch.deltaE,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt
    },
    temperatureCurve: temperatureCurve ? {
      id: temperatureCurve.id,
      targetCurve: temperatureCurve.targetCurve,
      actualCurve: temperatureCurve.actualCurve,
      temperatureDeviation: temperatureCurve.temperatureDeviation
    } : null,
    formula: formula ? {
      id: formula.id,
      targetFormula: formula.targetFormula,
      actualFormula: formula.actualFormula,
      missingChemicals: formula.missingChemicals
    } : null,
    reviewRecord: reviewRecord ? {
      id: reviewRecord.id,
      reviewer: reviewRecord.reviewer,
      judgement: reviewRecord.judgement,
      notes: reviewRecord.notes,
      reworkPriority: reviewRecord.reworkPriority,
      reworkReason: reviewRecord.reworkReason,
      createdAt: reviewRecord.createdAt,
      updatedAt: reviewRecord.updatedAt
    } : null,
    riskAssessment: riskAssessment,
    history: {
      importedAt: batch.createdAt,
      lastUpdatedAt: Math.max(
        batch.updatedAt,
        reviewRecord?.updatedAt ?? 0
      )
    }
  };

  return JSON.stringify(auditData, null, 2);
}
