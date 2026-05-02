import { format } from 'date-fns';
import {
  ReviewSession,
  Anomaly,
  RiskFragment,
  VaccineBatch,
  SeverityLevel,
  RiskLevel,
  AnomalyType,
} from '../types';

const ANOMALY_TYPE_NAMES: Record<AnomalyType, string> = {
  over_temp: '超温',
  under_temp: '低温',
  missing_data: '缺测',
  rapid_change: '温度波动',
  transfer_gap: '转移空档',
  probe_disconnect: '探头断线',
  door_open_long: '长时间开门',
};

const SEVERITY_LEVEL_NAMES: Record<SeverityLevel, string> = {
  critical: '严重',
  warning: '警告',
  info: '信息',
};

const RISK_LEVEL_NAMES: Record<RiskLevel, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
  none: '无风险',
};

export class MarkdownExporter {
  export(session: ReviewSession): string {
    const lines: string[] = [];

    lines.push(this.generateHeader(session));
    lines.push(this.generateSummary(session));
    lines.push(this.generateAnomaliesSection(session.analysis.anomalies));
    lines.push(this.generateRiskFragmentsSection(session.analysis.riskFragments));
    lines.push(this.generateBatchesSection(session.data.vaccineBatches, session.analysis.riskFragments));
    lines.push(this.generateSourceFilesSection(session));
    lines.push(this.generateFooter(session));

    return lines.join('\n\n');
  }

  private generateHeader(session: ReviewSession): string {
    const lines: string[] = [];
    lines.push(`# 疫苗温度异常复盘报告`);
    lines.push('');
    lines.push(`**会话名称**: ${session.name}`);
    lines.push(`**生成时间**: ${format(new Date(), 'yyyy年MM月dd日 HH:mm:ss')}`);
    lines.push(`**复盘时间范围**: ${format(session.analysis.summary.timeRange.start, 'yyyy-MM-dd HH:mm')} - ${format(session.analysis.summary.timeRange.end, 'yyyy-MM-dd HH:mm')}`);
    lines.push('');
    lines.push('---');
    return lines.join('\n');
  }

  private generateSummary(session: ReviewSession): string {
    const { summary } = session.analysis;
    const lines: string[] = [];

    lines.push('## 分析概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 温度记录总数 | ${summary.totalRecords} |`);
    lines.push(`| 异常事件总数 | ${summary.totalAnomalies} |`);
    lines.push(`| 风险片段总数 | ${summary.totalRiskFragments} |`);
    lines.push(`| 受影响疫苗批次 | ${summary.affectedBatches.length || '无'} |`);
    lines.push('');

    if (summary.totalAnomalies > 0) {
      lines.push('### 异常类型分布');
      lines.push('');
      lines.push('| 异常类型 | 数量 |');
      lines.push('|----------|------|');
      for (const [type, count] of Object.entries(summary.anomalyByType)) {
        if (count > 0) {
          lines.push(`| ${ANOMALY_TYPE_NAMES[type as AnomalyType]} | ${count} |`);
        }
      }
      lines.push('');
    }

    if (summary.totalRiskFragments > 0) {
      lines.push('### 风险等级分布');
      lines.push('');
      lines.push('| 风险等级 | 数量 |');
      lines.push('|----------|------|');
      for (const [level, count] of Object.entries(summary.riskByLevel)) {
        if (count > 0) {
          lines.push(`| ${RISK_LEVEL_NAMES[level as RiskLevel]} | ${count} |`);
        }
      }
    }

    return lines.join('\n');
  }

  private generateAnomaliesSection(anomalies: Anomaly[]): string {
    if (anomalies.length === 0) {
      return '## 异常事件\n\n未检测到异常事件。';
    }

    const lines: string[] = [];
    lines.push('## 异常事件详情');
    lines.push('');

    const grouped = this.groupAnomaliesBySeverity(anomalies);

    for (const severity of ['critical', 'warning', 'info'] as SeverityLevel[]) {
      const group = grouped.get(severity) || [];
      if (group.length === 0) continue;

      lines.push(`### ${SEVERITY_LEVEL_NAMES[severity]} (${group.length}个)`);
      lines.push('');

      group.forEach((anomaly, index) => {
        lines.push(`#### ${index + 1}. ${ANOMALY_TYPE_NAMES[anomaly.type]}`);
        lines.push('');
        lines.push(`- **冰箱ID**: ${anomaly.fridgeId}`);
        lines.push(`- **探头ID**: ${anomaly.probeId}`);
        lines.push(`- **开始时间**: ${format(anomaly.startTime, 'yyyy-MM-dd HH:mm:ss')}`);
        lines.push(`- **结束时间**: ${format(anomaly.endTime, 'yyyy-MM-dd HH:mm:ss')}`);
        lines.push(`- **持续时间**: ${anomaly.durationMinutes} 分钟`);
        lines.push(`- **描述**: ${anomaly.description}`);
        
        if (Object.keys(anomaly.metadata).length > 0) {
          lines.push('- **元数据**:');
          for (const [key, value] of Object.entries(anomaly.metadata)) {
            lines.push(`  - ${key}: ${value}`);
          }
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private generateRiskFragmentsSection(riskFragments: RiskFragment[]): string {
    if (riskFragments.length === 0) {
      return '## 疫苗风险片段\n\n未检测到疫苗相关风险。';
    }

    const lines: string[] = [];
    lines.push('## 疫苗风险片段');
    lines.push('');

    const grouped = this.groupRiskFragmentsByLevel(riskFragments);

    for (const level of ['high', 'medium', 'low', 'none'] as RiskLevel[]) {
      const group = grouped.get(level) || [];
      if (group.length === 0) continue;

      lines.push(`### ${RISK_LEVEL_NAMES[level]} (${group.length}个)`);
      lines.push('');

      group.forEach((fragment, index) => {
        lines.push(`#### ${index + 1}. ${fragment.vaccineName} (批次: ${fragment.batchId})`);
        lines.push('');
        lines.push(`- **开始时间**: ${format(fragment.startTime, 'yyyy-MM-dd HH:mm:ss')}`);
        lines.push(`- **结束时间**: ${format(fragment.endTime, 'yyyy-MM-dd HH:mm:ss')}`);
        lines.push(`- **持续时间**: ${fragment.totalDurationMinutes} 分钟`);
        lines.push(`- **涉及冰箱**: ${fragment.fridgeLocations.join(', ')}`);
        lines.push('');
        lines.push('**温度暴露情况**:');
        lines.push(`- 最低: ${fragment.temperatureExposure.min}°C`);
        lines.push(`- 最高: ${fragment.temperatureExposure.max}°C`);
        lines.push(`- 平均: ${fragment.temperatureExposure.avg}°C`);
        lines.push('');
        lines.push('**处置建议**:');
        lines.push(`- **优先级**: ${fragment.recommendedAction.priority === 'immediate' ? '立即' : fragment.recommendedAction.priority === 'urgent' ? '紧急' : fragment.recommendedAction.priority === 'standard' ? '标准' : '监控'}`);
        if (fragment.recommendedAction.deadlineHours) {
          lines.push(`- **时限**: ${fragment.recommendedAction.deadlineHours} 小时内`);
        }
        lines.push(`- **责任人**: ${fragment.recommendedAction.responsibleRole}`);
        lines.push('');
        lines.push('**具体措施**:');
        fragment.recommendedAction.actions.forEach((action, i) => {
          lines.push(`${i + 1}. ${action}`);
        });
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  private generateBatchesSection(
    batches: VaccineBatch[],
    riskFragments: RiskFragment[]
  ): string {
    const lines: string[] = [];
    lines.push('## 疫苗批次清单');
    lines.push('');
    lines.push('| 批次号 | 疫苗名称 | 生产厂家 | 数量 | 存储位置 | 入库日期 | 有效期至 | 风险状态 |');
    lines.push('|--------|----------|----------|------|----------|----------|----------|----------|');

    for (const batch of batches) {
      const batchRisks = riskFragments.filter(r => r.batchId === batch.batchId);
      const highestRisk = this.getHighestRiskLevel(batchRisks);
      
      lines.push(
        `| ${batch.batchId} | ${batch.vaccineName} | ${batch.manufacturer} | ${batch.quantity} | ${batch.fridgeId} | ${format(batch.entryDate, 'yyyy-MM-dd')} | ${format(batch.validTo, 'yyyy-MM-dd')} | ${RISK_LEVEL_NAMES[highestRisk]} |`
      );
    }

    return lines.join('\n');
  }

  private generateSourceFilesSection(session: ReviewSession): string {
    if (session.sourceFiles.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push('## 源文件信息');
    lines.push('');
    lines.push('| 文件名 | 文件类型 | 记录数 | 导入时间 |');
    lines.push('|--------|----------|--------|----------|');

    for (const file of session.sourceFiles) {
      const typeName = file.fileType === 'temperature' ? '温度记录' :
                       file.fileType === 'door' ? '开门记录' : '疫苗批次';
      lines.push(
        `| ${file.filename} | ${typeName} | ${file.recordCount} | ${format(file.importedAt, 'yyyy-MM-dd HH:mm')} |`
      );
    }

    return lines.join('\n');
  }

  private generateFooter(session: ReviewSession): string {
    const lines: string[] = [];
    lines.push('---');
    lines.push('');
    lines.push('*此报告由「疫苗温度异常复盘台」自动生成*');
    lines.push('');
    lines.push(`- 会话ID: \`${session.id}\``);
    lines.push(`- 创建时间: ${format(session.createdAt, 'yyyy年MM月dd日 HH:mm:ss')}`);
    lines.push(`- 最后更新: ${format(session.updatedAt, 'yyyy年MM月dd日 HH:mm:ss')}`);
    return lines.join('\n');
  }

  private groupAnomaliesBySeverity(anomalies: Anomaly[]): Map<SeverityLevel, Anomaly[]> {
    const grouped = new Map<SeverityLevel, Anomaly[]>();
    for (const anomaly of anomalies) {
      if (!grouped.has(anomaly.severity)) {
        grouped.set(anomaly.severity, []);
      }
      grouped.get(anomaly.severity)!.push(anomaly);
    }
    return grouped;
  }

  private groupRiskFragmentsByLevel(riskFragments: RiskFragment[]): Map<RiskLevel, RiskFragment[]> {
    const grouped = new Map<RiskLevel, RiskFragment[]>();
    for (const fragment of riskFragments) {
      if (!grouped.has(fragment.riskLevel)) {
        grouped.set(fragment.riskLevel, []);
      }
      grouped.get(fragment.riskLevel)!.push(fragment);
    }
    return grouped;
  }

  private getHighestRiskLevel(fragments: RiskFragment[]): RiskLevel {
    if (fragments.length === 0) return 'none';
    
    const levels: RiskLevel[] = ['high', 'medium', 'low', 'none'];
    for (const level of levels) {
      if (fragments.some(f => f.riskLevel === level)) {
        return level;
      }
    }
    return 'none';
  }
}
