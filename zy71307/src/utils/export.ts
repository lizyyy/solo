import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Experiment, ReportConfig, DataPoint, AnomalyPoint, FittingResult, EfficiencyResult, CalculationStep } from '@/types';
import { thrustUnitLabels } from './units';

export function exportToCSV(
  experiment: Experiment,
  config: ReportConfig
): void {
  let csvContent = '';

  csvContent += '无人机桨叶推力实验报告\n';
  csvContent += `实验名称: ${experiment.name}\n`;
  csvContent += `创建时间: ${new Date(experiment.createdAt).toLocaleString()}\n`;
  csvContent += `导出时间: ${new Date().toLocaleString()}\n\n`;

  csvContent += '=== 环境参数 ===\n';
  csvContent += `空气密度,${experiment.environment.airDensity},kg/m³\n`;
  csvContent += `温度,${experiment.environment.temperature},°C\n`;
  csvContent += `湿度,${experiment.environment.humidity},%\n`;
  csvContent += `气压,${experiment.environment.pressure},kPa\n\n`;

  csvContent += '=== 拟合参数 ===\n';
  csvContent += `拟合类型,${experiment.fittingParams.fitType}\n`;
  csvContent += `多项式次数,${experiment.fittingParams.polynomialDegree}\n`;
  csvContent += `自变量,${experiment.fittingParams.independentVariable}\n`;
  csvContent += `目标推力单位,${experiment.fittingParams.thrustUnit}\n\n`;

  if (config.includeRawData) {
    csvContent += '=== 原始数据 ===\n';
    csvContent += '序号,转速(RPM),电压(V),电流(A),桨径(inch),推力,推力单位,是否排除,备注\n';
    experiment.dataPoints.forEach((p, i) => {
      csvContent += `${i + 1},${p.rpm},${p.voltage},${p.current},${p.propellerDiameter},${p.thrust},${p.thrustUnit},${p.isExcluded ? '是' : '否'},"${p.notes}"\n`;
    });
    csvContent += '\n';
  }

  if (experiment.fittingResult && config.includeCalculationSteps) {
    csvContent += '=== 拟合结果 ===\n';
    csvContent += `拟合公式,${experiment.fittingResult.formula}\n`;
    csvContent += `R²,${experiment.fittingResult.rSquared.toFixed(6)}\n`;
    csvContent += `调整后R²,${experiment.fittingResult.adjustedRSquared.toFixed(6)}\n`;
    csvContent += `置信区间,±${experiment.fittingResult.confidenceInterval.toFixed(6)}\n\n`;

    csvContent += '影响因子分析\n';
    csvContent += `转速影响,${(experiment.fittingResult.impactFactors.rpm * 100).toFixed(2)}%\n`;
    csvContent += `电压影响,${(experiment.fittingResult.impactFactors.voltage * 100).toFixed(2)}%\n`;
    csvContent += `桨径影响,${(experiment.fittingResult.impactFactors.propellerDiameter * 100).toFixed(2)}%\n\n`;

    csvContent += '=== 计算过程 ===\n';
    csvContent += '步骤,描述,公式,变量,结果\n';
    experiment.fittingResult.calculationSteps.forEach(step => {
      const vars = Object.entries(step.variables).map(([k, v]) => `${k}=${v}`).join('; ');
      csvContent += `${step.step},"${step.description}","${step.formula}","${vars}",${step.result.toFixed(6)}\n`;
    });
    csvContent += '\n';
  }

  if (experiment.efficiencyResult) {
    csvContent += '=== 效率分析 ===\n';
    csvContent += `最优工作点转速,${experiment.efficiencyResult.optimalOperatingPoint.rpm},RPM\n`;
    csvContent += `最优工作点推力,${experiment.efficiencyResult.optimalOperatingPoint.thrust.toFixed(4)},${experiment.fittingParams.thrustUnit}\n`;
    csvContent += `最优工作点效率,${experiment.efficiencyResult.optimalOperatingPoint.efficiency.toFixed(2)},%\n`;
    csvContent += `最优工作点功率,${experiment.efficiencyResult.optimalOperatingPoint.power.toFixed(2)},W\n`;
    csvContent += `高效区间转速,${experiment.efficiencyResult.efficientRange.minRpm} - ${experiment.efficiencyResult.efficientRange.maxRpm},RPM\n`;
    csvContent += `最低效率阈值,${experiment.efficiencyResult.efficientRange.minEfficiency.toFixed(2)},%\n\n`;

    csvContent += '效率曲线数据\n';
    csvContent += '转速(RPM),输入功率(W),推力,效率(%),推力功率(W)\n';
    experiment.efficiencyResult.efficiencyCurve.forEach(p => {
      csvContent += `${p.rpm},${p.power.toFixed(4)},${p.thrust.toFixed(4)},${p.efficiency.toFixed(4)},${p.thrustPower.toFixed(4)}\n`;
    });
    csvContent += '\n';
  }

  if (config.includeAnomalyDetails) {
    const reportAnomalies = experiment.anomalies.filter(a => a.isIncludedInReport);
    if (reportAnomalies.length > 0) {
      csvContent += '=== 异常点检测 ===\n';
      csvContent += '异常类型,严重程度,描述,期望值,实际值,阈值,偏差,计算公式\n';
      reportAnomalies.forEach(a => {
        const typeLabels: Record<string, string> = {
          rpm_missing: '转速缺样',
          voltage_sag: '电压骤降',
          unit_error: '单位错误',
        };
        const sevLabels: Record<string, string> = {
          warning: '警告',
          error: '错误',
          critical: '严重',
        };
        csvContent += `"${typeLabels[a.type] || a.type}","${sevLabels[a.severity] || a.severity}","${a.description}",${a.calculationDetails.expectedValue.toFixed(4)},${a.calculationDetails.actualValue.toFixed(4)},${a.calculationDetails.threshold.toFixed(4)},${a.calculationDetails.deviation.toFixed(4)},"${a.calculationDetails.formula}"\n`;
      });
    }
  }

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${experiment.name}_实验报告_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

export async function exportToPDF(
  elementId: string,
  experiment: Experiment
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#0f172a',
    useCORS: true,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const imgX = (pdfWidth - imgWidth * ratio) / 2;
  const imgY = 0;

  pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
  pdf.save(`${experiment.name}_实验报告_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function generateReportMarkdown(
  experiment: Experiment,
  config: ReportConfig
): string {
  let md = `# 无人机桨叶推力实验报告\n\n`;
  md += `**实验名称**: ${experiment.name}\n\n`;
  md += `**创建时间**: ${new Date(experiment.createdAt).toLocaleString()}\n\n`;
  md += `**导出时间**: ${new Date().toLocaleString()}\n\n`;
  md += `---\n\n`;

  if (experiment.description) {
    md += `## 实验描述\n\n${experiment.description}\n\n`;
  }

  md += `## 环境参数\n\n`;
  md += `| 参数 | 值 | 单位 |\n`;
  md += `|------|-----|------|\n`;
  md += `| 空气密度 | ${experiment.environment.airDensity} | kg/m³ |\n`;
  md += `| 温度 | ${experiment.environment.temperature} | °C |\n`;
  md += `| 湿度 | ${experiment.environment.humidity} | % |\n`;
  md += `| 气压 | ${experiment.environment.pressure} | kPa |\n\n`;

  md += `## 拟合参数\n\n`;
  md += `| 参数 | 值 |\n`;
  md += `|------|-----|\n`;
  const fitTypeLabels: Record<string, string> = { linear: '线性', polynomial: '多项式', power: '幂函数' };
  const varLabels: Record<string, string> = { rpm: '转速', voltage: '电压', propellerDiameter: '桨径' };
  md += `| 拟合类型 | ${fitTypeLabels[experiment.fittingParams.fitType] || experiment.fittingParams.fitType} |\n`;
  md += `| 多项式次数 | ${experiment.fittingParams.polynomialDegree} |\n`;
  md += `| 自变量 | ${varLabels[experiment.fittingParams.independentVariable] || experiment.fittingParams.independentVariable} |\n`;
  md += `| 目标推力单位 | ${thrustUnitLabels[experiment.fittingParams.thrustUnit]} |\n\n`;

  if (experiment.fittingResult) {
    md += `## 拟合结果\n\n`;
    md += `**拟合公式**: \`${experiment.fittingResult.formula}\`\n\n`;
    md += `- **R²**: ${experiment.fittingResult.rSquared.toFixed(6)}\n`;
    md += `- **调整后 R²**: ${experiment.fittingResult.adjustedRSquared.toFixed(6)}\n`;
    md += `- **置信区间**: ±${experiment.fittingResult.confidenceInterval.toFixed(6)}\n\n`;

    md += `### 影响因子分析\n\n`;
    md += `| 因素 | 影响权重 |\n`;
    md += `|------|----------|\n`;
    md += `| 转速 | ${(experiment.fittingResult.impactFactors.rpm * 100).toFixed(2)}% |\n`;
    md += `| 电压 | ${(experiment.fittingResult.impactFactors.voltage * 100).toFixed(2)}% |\n`;
    md += `| 桨径 | ${(experiment.fittingResult.impactFactors.propellerDiameter * 100).toFixed(2)}% |\n\n`;

    if (config.includeCalculationSteps) {
      md += `### 计算过程\n\n`;
      experiment.fittingResult.calculationSteps.forEach(step => {
        md += `**步骤 ${step.step}**: ${step.description}\n\n`;
        md += `\`\`\`\n${step.formula}\n\`\`\`\n\n`;
        const vars = Object.entries(step.variables).map(([k, v]) => `${k} = ${v}`).join(', ');
        md += `变量: ${vars}\n\n`;
        md += `结果: ${step.result.toFixed(6)}\n\n`;
      });
    }
  }

  if (experiment.efficiencyResult) {
    md += `## 效率分析\n\n`;
    md += `### 最优工作点\n\n`;
    md += `| 参数 | 值 | 单位 |\n`;
    md += `|------|-----|------|\n`;
    md += `| 转速 | ${experiment.efficiencyResult.optimalOperatingPoint.rpm} | RPM |\n`;
    md += `| 推力 | ${experiment.efficiencyResult.optimalOperatingPoint.thrust.toFixed(4)} | ${experiment.fittingParams.thrustUnit} |\n`;
    md += `| 效率 | ${experiment.efficiencyResult.optimalOperatingPoint.efficiency.toFixed(2)} | % |\n`;
    md += `| 输入功率 | ${experiment.efficiencyResult.optimalOperatingPoint.power.toFixed(2)} | W |\n\n`;

    md += `### 高效区间\n\n`;
    md += `- 转速范围: ${experiment.efficiencyResult.efficientRange.minRpm} - ${experiment.efficiencyResult.efficientRange.maxRpm} RPM\n`;
    md += `- 最低效率: ${experiment.efficiencyResult.efficientRange.minEfficiency.toFixed(2)}%\n\n`;
  }

  if (config.includeAnomalyDetails) {
    const reportAnomalies = experiment.anomalies.filter(a => a.isIncludedInReport);
    if (reportAnomalies.length > 0) {
      md += `## 异常点检测\n\n`;
      const typeLabels: Record<string, string> = { rpm_missing: '转速缺样', voltage_sag: '电压骤降', unit_error: '单位错误' };
      const sevLabels: Record<string, string> = { warning: '⚠️ 警告', error: '❌ 错误', critical: '🚨 严重' };

      const grouped = reportAnomalies.reduce((acc, a) => {
        if (!acc[a.type]) acc[a.type] = [];
        acc[a.type].push(a);
        return acc;
      }, {} as Record<string, AnomalyPoint[]>);

      Object.entries(grouped).forEach(([type, anomalies]) => {
        md += `### ${typeLabels[type] || type} (${anomalies.length}个)\n\n`;
        anomalies.forEach(a => {
          md += `${sevLabels[a.severity]} **${a.description}**\n\n`;
          md += `- 期望值: ${a.calculationDetails.expectedValue.toFixed(4)}\n`;
          md += `- 实际值: ${a.calculationDetails.actualValue.toFixed(4)}\n`;
          md += `- 阈值: ${a.calculationDetails.threshold.toFixed(4)}\n`;
          md += `- 偏差: ${a.calculationDetails.deviation.toFixed(4)}\n`;
          md += `- 计算公式: \`${a.calculationDetails.formula}\`\n\n`;
        });
      });
    }
  }

  return md;
}
