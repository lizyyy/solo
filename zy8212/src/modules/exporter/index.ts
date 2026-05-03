import dayjs from 'dayjs';
import Papa from 'papaparse';
import { RiskType } from '../../types';
import type { RiskEvent, ParsedData } from '../../types';

export class Exporter {
  static exportRiskEventsCSV(risks: RiskEvent[]): string {
    const rows = risks.map(risk => ({
      id: risk.id,
      type: this.getRiskTypeName(risk.type),
      type_enum: risk.type,
      pondId: risk.pondId,
      timestamp: risk.timestamp.format('YYYY-MM-DD HH:mm:ss'),
      endTimestamp: risk.endTimestamp?.format('YYYY-MM-DD HH:mm:ss') || '',
      severity: this.getSeverityName(risk.severity),
      description: risk.description,
      details: JSON.stringify(risk.details),
    }));

    return Papa.unparse(rows, {
      header: true,
      columns: [
        'id', 'type', 'type_enum', 'pondId', 'timestamp',
        'endTimestamp', 'severity', 'description', 'details'
      ],
    });
  }

  static exportReviewReportMD(
    risks: RiskEvent[],
    parsedData: ParsedData,
    reportDate: dayjs.Dayjs = dayjs()
  ): string {
    const pondIds = Array.from(new Set([
      ...parsedData.sensorReadings.map((r) => r.pondId),
      ...parsedData.feedingEvents.map((e) => e.pondId),
      ...parsedData.aeratorLogs.map((l) => l.pondId),
      ...parsedData.mortalityRecords.map((m) => m.pondId),
    ]));

    const riskCountByType: Record<string, number> = {};
    const riskCountByPond: Record<string, number> = {};
    const riskCountBySeverity: Record<string, number> = {};

    risks.forEach(risk => {
      riskCountByType[risk.type] = (riskCountByType[risk.type] || 0) + 1;
      riskCountByPond[risk.pondId] = (riskCountByPond[risk.pondId] || 0) + 1;
      riskCountBySeverity[risk.severity] = (riskCountBySeverity[risk.severity] || 0) + 1;
    });

    const criticalRisks = risks.filter(r => r.severity === 'critical');
    const highRisks = risks.filter(r => r.severity === 'high');

    let md = `# 水产养殖溶氧-投喂异常复盘报告\n\n`;
    md += `> 报告生成时间: ${reportDate.format('YYYY-MM-DD HH:mm:ss')}\n\n`;

    md += `## 摘要\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 涉及池塘数 | ${pondIds.length} |\n`;
    md += `| 检测到风险事件总数 | ${risks.length} |\n`;
    md += `| 严重(Critical)风险 | ${criticalRisks.length} |\n`;
    md += `| 高(High)风险 | ${highRisks.length} |\n\n`;

    if (risks.length === 0) {
      md += `**结论**: 本次分析未检测到异常风险事件，养殖状态良好。\n\n`;
    } else {
      const primaryConcern = this.getPrimaryConcern(risks);
      md += `**主要关注点**: ${primaryConcern}\n\n`;
    }

    md += `## 数据概览\n\n`;
    md += `| 数据类型 | 记录数 |\n`;
    md += `|----------|--------|\n`;
    md += `| 传感器读数 | ${parsedData.sensorReadings.length} |\n`;
    md += `| 投喂事件 | ${parsedData.feedingEvents.length} |\n`;
    md += `| 增氧机日志 | ${parsedData.aeratorLogs.length} |\n`;
    md += `| 死亡巡检 | ${parsedData.mortalityRecords.length} |\n\n`;

    if (risks.length > 0) {
      md += `## 风险分布\n\n`;

      md += `### 按类型分布\n\n`;
      Object.entries(riskCountByType).forEach(([type, count]) => {
        md += `- **${this.getRiskTypeName(type as RiskType)}**: ${count} 次\n`;
      });
      md += `\n`;

      md += `### 按严重程度分布\n\n`;
      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        const count = riskCountBySeverity[severity] || 0;
        if (count > 0) {
          md += `- **${this.getSeverityName(severity as any)}**: ${count} 次\n`;
        }
      });
      md += `\n`;

      md += `### 按池塘分布\n\n`;
      Object.entries(riskCountByPond).forEach(([pondId, count]) => {
        md += `- **池塘 ${pondId}**: ${count} 次\n`;
      });
      md += `\n`;

      md += `## 风险事件详情\n\n`;

      if (criticalRisks.length > 0) {
        md += `### 严重(Critical)风险\n\n`;
        criticalRisks.forEach((risk, idx) => {
          md += `#### 事件 ${idx + 1}: ${this.getRiskTypeName(risk.type)}\n\n`;
          md += `- **池塘**: ${risk.pondId}\n`;
          md += `- **时间**: ${risk.timestamp.format('YYYY-MM-DD HH:mm:ss')}`;
          if (risk.endTimestamp) {
            md += ` 至 ${risk.endTimestamp.format('YYYY-MM-DD HH:mm:ss')}`;
          }
          md += `\n`;
          md += `- **描述**: ${risk.description}\n\n`;
          md += `**详细信息**:\n\n`;
          md += `\`\`\`json\n${JSON.stringify(risk.details, null, 2)}\n\`\`\`\n\n`;
        });
      }

      if (highRisks.length > 0) {
        md += `### 高(High)风险\n\n`;
        highRisks.forEach((risk, idx) => {
          md += `#### 事件 ${idx + 1}: ${this.getRiskTypeName(risk.type)}\n\n`;
          md += `- **池塘**: ${risk.pondId}\n`;
          md += `- **时间**: ${risk.timestamp.format('YYYY-MM-DD HH:mm:ss')}`;
          if (risk.endTimestamp) {
            md += ` 至 ${risk.endTimestamp.format('YYYY-MM-DD HH:mm:ss')}`;
          }
          md += `\n`;
          md += `- **描述**: ${risk.description}\n\n`;
        });
      }

      const otherRisks = risks.filter(r => r.severity !== 'critical' && r.severity !== 'high');
      if (otherRisks.length > 0) {
        md += `### 中/低风险\n\n`;
        md += `| 类型 | 池塘 | 时间 | 严重程度 | 描述 |\n`;
        md += `|------|------|------|----------|------|\n`;
        otherRisks.forEach(risk => {
          md += `| ${this.getRiskTypeName(risk.type)} | ${risk.pondId} | ${risk.timestamp.format('YYYY-MM-DD HH:mm')} | ${this.getSeverityName(risk.severity)} | ${risk.description} |\n`;
        });
        md += `\n`;
      }

      md += `## 建议措施\n\n`;
      md += this.generateRecommendations(risks);
      md += `\n`;
    }

    md += `---\n\n`;
    md += `*本报告由水产养殖溶氧-投喂异常复盘系统自动生成。*\n`;

    return md;
  }

  private static getRiskTypeName(type: RiskType): string {
    const names: Record<RiskType, string> = {
      [RiskType.LOW_DO_SUSTAINED]: '低溶氧持续',
      [RiskType.DO_DROP_AFTER_FEEDING]: '投喂后溶氧下坠',
      [RiskType.AERATOR_RESPONSE_DELAY]: '增氧机响应延迟',
      [RiskType.SENSOR_DRIFT]: '传感器漂移',
      [RiskType.UNEXPLAINED_MORTALITY]: '不明原因死亡',
    };
    return names[type] || type;
  }

  private static getSeverityName(severity: 'low' | 'medium' | 'high' | 'critical'): string {
    const names = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '严重',
    };
    return names[severity] || severity;
  }

  private static getPrimaryConcern(risks: RiskEvent[]): string {
    const criticalRisks = risks.filter(r => r.severity === 'critical');
    const mortalityRisks = risks.filter(r => r.type === RiskType.UNEXPLAINED_MORTALITY);
    const lowDoRisks = risks.filter(r => r.type === RiskType.LOW_DO_SUSTAINED);

    if (mortalityRisks.length > 0) {
      return `检测到 ${mortalityRisks.length} 起不明原因死亡事件，需紧急关注。`;
    }
    if (criticalRisks.length > 0) {
      return `存在 ${criticalRisks.length} 个严重风险事件，建议立即处理。`;
    }
    if (lowDoRisks.length > 0) {
      return `发现 ${lowDoRisks.length} 次低溶氧持续情况，需关注增氧策略。`;
    }
    return `共检测到 ${risks.length} 个风险事件，建议逐一排查。`;
  }

  private static generateRecommendations(
    risks: RiskEvent[]
  ): string {
    let recommendations = '';

    const lowDoRisks = risks.filter(r => r.type === RiskType.LOW_DO_SUSTAINED);
    if (lowDoRisks.length > 0) {
      const ponds = [...new Set(lowDoRisks.map(r => r.pondId))];
      recommendations += `### 1. 低溶氧问题\n\n`;
      recommendations += `- **涉及池塘**: ${ponds.join(', ')}\n`;
      recommendations += `- **建议**: \n`;
      recommendations += `  - 检查增氧机运行状态和维护记录\n`;
      recommendations += `  - 评估当前增氧策略是否覆盖高风险时段(凌晨、阴天)\n`;
      recommendations += `  - 考虑增加底层增氧设施\n\n`;
    }

    const doDropRisks = risks.filter(r => r.type === RiskType.DO_DROP_AFTER_FEEDING);
    if (doDropRisks.length > 0) {
      recommendations += `### 2. 投喂后溶氧下降\n\n`;
      recommendations += `- **建议**: \n`;
      recommendations += `  - 评估投喂量是否过大，考虑分多次少量投喂\n`;
      recommendations += `  - 投喂前后开启增氧机\n`;
      recommendations += `  - 检查水质指标(氨氮、亚硝酸盐)\n`;
      recommendations += `  - 考虑调整饲料配方\n\n`;
    }

    const aeratorDelayRisks = risks.filter(r => r.type === RiskType.AERATOR_RESPONSE_DELAY);
    if (aeratorDelayRisks.length > 0) {
      recommendations += `### 3. 增氧机响应延迟\n\n`;
      recommendations += `- **建议**: \n`;
      recommendations += `  - 检查自动增氧控制器的阈值设置\n`;
      recommendations += `  - 验证增氧机启停功能是否正常\n`;
      recommendations += `  - 考虑设置溶氧预警通知\n\n`;
    }

    const sensorDriftRisks = risks.filter(r => r.type === RiskType.SENSOR_DRIFT);
    if (sensorDriftRisks.length > 0) {
      recommendations += `### 4. 传感器校准问题\n\n`;
      recommendations += `- **建议**: \n`;
      recommendations += `  - 对涉险传感器进行校准\n`;
      recommendations += `  - 检查传感器安装位置是否合适(避免气泡、附着物)\n`;
      recommendations += `  - 制定定期校准计划(建议每月一次)\n\n`;
    }

    const mortalityRisks = risks.filter(r => r.type === RiskType.UNEXPLAINED_MORTALITY);
    if (mortalityRisks.length > 0) {
      const totalDead = mortalityRisks.reduce((sum, r) => sum + (r.details.mortalityCount || 0), 0);
      recommendations += `### 5. 死亡事件调查\n\n`;
      recommendations += `- **统计**: 累计死亡 ${totalDead} 尾\n`;
      recommendations += `- **建议**: \n`;
      recommendations += `  - 取样进行病理解剖，确定死因\n`;
      recommendations += `  - 检查水质全指标(pH、氨氮、亚硝酸盐、硫化氢)\n`;
      recommendations += `  - 回顾投喂历史，排除饲料问题\n`;
      recommendations += `  - 检查是否有用药记录\n\n`;
    }

    if (recommendations === '') {
      recommendations += `养殖状况总体良好。建议:\n\n`;
      recommendations += `- 继续保持当前的养殖管理模式\n`;
      recommendations += `- 定期检查设备运行状态\n`;
      recommendations += `- 做好日常巡检记录\n`;
    }

    return recommendations;
  }
}

export default Exporter;
