import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  Session, 
  AnomalyType, 
  ReportOptions,
  JsonReport
} from '../types';
import { 
  formatTimestamp, 
  formatDuration, 
  ensureDirectoryExists
} from '../utils';

const ANOMALY_TYPE_NAMES: Record<AnomalyType, string> = {
  ice_reconnect: 'ICE 重连',
  bitrate_drop: '码率突降',
  packet_loss_high: '丢包率过高',
  jitter_high: '抖动过高',
  track_mute: '轨道静音',
  device_switch: '设备切换',
  signaling_break: '信令中断',
  audiovideo_desync: '音视频不同步',
  quality_limitation: '质量限制',
  frames_dropped: '丢帧',
  rtt_spike: 'RTT 尖峰'
};

const SEVERITY_NAMES: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低'
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢'
};

export class ReportExporter {
  constructor() {}

  exportToJson(session: Session, options: ReportOptions): JsonReport {
    const primaryRootCause = this.determinePrimaryRootCause(session);
    const contributingFactors = this.determineContributingFactors(session, primaryRootCause);

    return {
      sessionId: session.id,
      sessionName: session.name,
      analyzedAt: Date.now(),
      summary: {
        totalDuration: session.metadata.totalDuration,
        stutterDuration: session.metadata.stutterDuration,
        stutterPercentage: session.metadata.stutterPercentage,
        callQualityScore: session.metadata.callQualityScore,
        anomalyCounts: session.metadata.anomalyCount
      },
      stutterSegments: options.includeEvidence 
        ? session.stutters 
        : session.stutters.map(s => ({
            ...s,
            anomalies: s.anomalies.map(a => ({
              ...a,
              evidence: options.includeEvidence ? a.evidence : {}
            }))
          })),
      anomalies: options.includeEvidence 
        ? session.anomalies 
        : session.anomalies.map(a => ({
            ...a,
            evidence: options.includeEvidence ? a.evidence : {}
          })),
      rootCauseAnalysis: {
        primaryRootCause,
        contributingFactors,
        timelineAnalysis: this.generateTimelineAnalysis(session)
      }
    };
  }

  exportToMarkdown(session: Session, options: ReportOptions): string {
    const lines: string[] = [];
    
    lines.push(`# ${session.name}`);
    lines.push('');
    lines.push(`> 会话 ID: ${session.id}`);
    lines.push(`> 分析时间: ${formatTimestamp(Date.now())}`);
    lines.push('');

    lines.push('## 📊 通话质量概览');
    lines.push('');
    
    const qualityScore = session.metadata.callQualityScore;
    const qualityEmoji = qualityScore >= 80 ? '🟢' : qualityScore >= 60 ? '🟡' : '🔴';
    const qualityText = qualityScore >= 80 ? '良好' : qualityScore >= 60 ? '一般' : '较差';
    
    lines.push(`| 指标 | 值 | 状态 |`);
    lines.push(`|------|-----|------|`);
    lines.push(`| 通话质量评分 | ${qualityScore}/100 | ${qualityEmoji} ${qualityText} |`);
    lines.push(`| 总时长 | ${formatDuration(session.metadata.totalDuration)} | |`);
    lines.push(`| 卡顿时长 | ${formatDuration(session.metadata.stutterDuration)} | |`);
    lines.push(`| 卡顿占比 | ${session.metadata.stutterPercentage.toFixed(1)}% | |`);
    lines.push('');

    lines.push('## 📈 异常统计');
    lines.push('');
    
    const anomalyCounts = session.metadata.anomalyCount;
    const hasAnomalies = Object.values(anomalyCounts).some(c => c > 0);
    
    if (hasAnomalies) {
      lines.push('| 异常类型 | 数量 | 严重程度 |');
      lines.push('|----------|------|----------|');
      
      const severityOrder: string[] = ['low', 'medium', 'high', 'critical'];
      
      for (const [type, count] of Object.entries(anomalyCounts)) {
        if (count > 0) {
          const typeName = ANOMALY_TYPE_NAMES[type as AnomalyType] || type;
          const relatedAnomalies = session.anomalies.filter(a => a.type === type);
          let maxSeverity = 'low';
          
          if (relatedAnomalies.length > 0) {
            for (const anomaly of relatedAnomalies) {
              if (severityOrder.indexOf(anomaly.severity) > severityOrder.indexOf(maxSeverity)) {
                maxSeverity = anomaly.severity;
              }
            }
          }
          
          lines.push(`| ${typeName} | ${count} | ${SEVERITY_ICONS[maxSeverity] || ''} ${SEVERITY_NAMES[maxSeverity] || maxSeverity} |`);
        }
      }
    } else {
      lines.push('✅ 未检测到异常');
    }
    lines.push('');

    lines.push('## 🔍 卡顿片段分析');
    lines.push('');
    
    if (session.stutters.length > 0) {
      for (let i = 0; i < session.stutters.length; i++) {
        const stutter = session.stutters[i];
        const primaryCauseName = ANOMALY_TYPE_NAMES[stutter.primaryCause] || stutter.primaryCause;
        
        lines.push(`### 片段 ${i + 1}: ${formatTimestamp(stutter.startTime)}`);
        lines.push('');
        lines.push(`- **持续时间**: ${formatDuration(stutter.duration)}`);
        lines.push(`- **主要原因**: ${primaryCauseName}`);
        lines.push(`- **置信度**: ${stutter.confidence}%`);
        lines.push(`- **用户影响**: ${stutter.userImpact}`);
        lines.push('');
        
        lines.push('#### 关联异常:');
        lines.push('');
        for (const anomaly of stutter.anomalies) {
          const anomalyName = ANOMALY_TYPE_NAMES[anomaly.type] || anomaly.type;
          lines.push(`${SEVERITY_ICONS[anomaly.severity]} **${anomalyName}** (${SEVERITY_NAMES[anomaly.severity]})`);
          lines.push(`  - ${anomaly.description}`);
          lines.push(`  - 开始时间: ${formatTimestamp(anomaly.startTime)}`);
          lines.push(`  - 持续时间: ${formatDuration(anomaly.duration)}`);
          lines.push(`  - 根本原因: ${anomaly.rootCause}`);
          lines.push(`  - 建议: ${anomaly.suggestion}`);
          lines.push('');
        }
      }
    } else {
      lines.push('✅ 未检测到卡顿片段');
    }
    lines.push('');

    lines.push('## 🎯 根因分析');
    lines.push('');
    
    const primaryRootCause = this.determinePrimaryRootCause(session);
    const primaryName = ANOMALY_TYPE_NAMES[primaryRootCause] || primaryRootCause;
    
    lines.push(`### 主要原因`);
    lines.push('');
    lines.push(`**${primaryName}**`);
    lines.push('');
    
    const primaryAnomalies = session.anomalies.filter(a => a.type === primaryRootCause);
    if (primaryAnomalies.length > 0) {
      const firstAnomaly = primaryAnomalies[0];
      lines.push(`- **根本原因**: ${firstAnomaly.rootCause}`);
      lines.push(`- **建议**: ${firstAnomaly.suggestion}`);
    }
    lines.push('');

    const contributingFactors = this.determineContributingFactors(session, primaryRootCause);
    if (contributingFactors.length > 0) {
      lines.push(`### 影响因素`);
      lines.push('');
      for (const factor of contributingFactors) {
        const factorName = ANOMALY_TYPE_NAMES[factor] || factor;
        lines.push(`- ${factorName}`);
      }
      lines.push('');
    }

    lines.push('## 📝 时间轴分析');
    lines.push('');
    lines.push(this.generateTimelineAnalysis(session));
    lines.push('');

    lines.push('## 📋 日志源信息');
    lines.push('');
    lines.push(`| 源名称 | 类型 | 开始时间 | 结束时间 | 事件数 |`);
    lines.push(`|--------|------|----------|----------|--------|`);
    
    const sourceTypeNames: Record<string, string> = {
      getstats: 'getStats 统计',
      signaling: '信令日志',
      usernote: '用户备注'
    };
    
    for (const source of session.sources) {
      const eventCount = session.timeline.events.filter(e => {
        if (e.source === source.type) return true;
        return false;
      }).length;
      
      lines.push(`| ${source.name} | ${sourceTypeNames[source.type] || source.type} | ${formatTimestamp(source.startTime)} | ${formatTimestamp(source.endTime)} | ${eventCount} |`);
    }
    lines.push('');

    if (options.includeEvidence && session.anomalies.length > 0) {
      lines.push('## 📁 详细证据');
      lines.push('');
      
      for (const anomaly of session.anomalies) {
        const anomalyName = ANOMALY_TYPE_NAMES[anomaly.type] || anomaly.type;
        lines.push(`### ${SEVERITY_ICONS[anomaly.severity]} ${anomalyName} (${SEVERITY_NAMES[anomaly.severity]})`);
        lines.push('');
        lines.push(`- **ID**: ${anomaly.id}`);
        lines.push(`- **开始时间**: ${formatTimestamp(anomaly.startTime)}`);
        lines.push(`- **结束时间**: ${formatTimestamp(anomaly.endTime)}`);
        lines.push(`- **持续时间**: ${formatDuration(anomaly.duration)}`);
        lines.push('');
        lines.push('#### 证据数据:');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(anomaly.evidence, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push(`*报告生成于 ${formatTimestamp(Date.now())}*`);
    lines.push(`*工具: 通话卡顿回放台 (WebRTC Log Diagnostic Tool)*`);

    return lines.join('\n');
  }

  async saveJsonReport(session: Session, filePath: string, options: ReportOptions): Promise<void> {
    const report = this.exportToJson(session, options);
    const jsonStr = JSON.stringify(report, null, 2);
    
    const dir = path.dirname(filePath);
    ensureDirectoryExists(dir);
    
    await fs.writeFile(filePath, jsonStr, 'utf-8');
  }

  async saveMarkdownReport(session: Session, filePath: string, options: ReportOptions): Promise<void> {
    const markdown = this.exportToMarkdown(session, options);
    
    const dir = path.dirname(filePath);
    ensureDirectoryExists(dir);
    
    await fs.writeFile(filePath, markdown, 'utf-8');
  }

  private determinePrimaryRootCause(session: Session): AnomalyType {
    const anomalyCounts = session.metadata.anomalyCount;
    const typePriority: AnomalyType[] = [
      'ice_reconnect',
      'signaling_break',
      'packet_loss_high',
      'bitrate_drop',
      'jitter_high',
      'rtt_spike',
      'quality_limitation',
      'frames_dropped',
      'audiovideo_desync',
      'track_mute',
      'device_switch'
    ];

    const highSeverityTypes = new Set<AnomalyType>();
    for (const anomaly of session.anomalies) {
      if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
        highSeverityTypes.add(anomaly.type);
      }
    }

    for (const type of typePriority) {
      if (highSeverityTypes.has(type) && (anomalyCounts[type] || 0) > 0) {
        return type;
      }
    }

    for (const type of typePriority) {
      if ((anomalyCounts[type] || 0) > 0) {
        return type;
      }
    }

    return 'packet_loss_high';
  }

  private determineContributingFactors(session: Session, primary: AnomalyType): AnomalyType[] {
    const anomalyCounts = session.metadata.anomalyCount;
    const factors: AnomalyType[] = [];
    
    for (const [type, count] of Object.entries(anomalyCounts)) {
      if (type !== primary && count > 0) {
        factors.push(type as AnomalyType);
      }
    }

    return factors;
  }

  private generateTimelineAnalysis(session: Session): string {
    const lines: string[] = [];
    
    const totalDuration = session.metadata.totalDuration;
    const stutterPercentage = session.metadata.stutterPercentage;
    
    lines.push(`本次通话总时长 **${formatDuration(totalDuration)}**，`);
    
    if (stutterPercentage === 0) {
      lines.push(`**未检测到卡顿或异常**，通话质量良好。`);
    } else if (stutterPercentage < 10) {
      lines.push(`卡顿时长约 **${formatDuration(session.metadata.stutterDuration)}** (${stutterPercentage.toFixed(1)}%)，`);
      lines.push(`主要集中在以下时间点：`);
    } else {
      lines.push(`卡顿时长约 **${formatDuration(session.metadata.stutterDuration)}** (${stutterPercentage.toFixed(1)}%)，`);
      lines.push(`对用户体验有**明显影响**。卡顿主要发生在：`);
    }
    lines.push('');

    if (session.stutters.length > 0) {
      for (const stutter of session.stutters) {
        const causeName = ANOMALY_TYPE_NAMES[stutter.primaryCause] || stutter.primaryCause;
        lines.push(`- **${formatTimestamp(stutter.startTime)}**: ${causeName} (持续 ${formatDuration(stutter.duration)})`);
      }
    }

    return lines.join('\n');
  }
}

export { ReportExporter as default };
