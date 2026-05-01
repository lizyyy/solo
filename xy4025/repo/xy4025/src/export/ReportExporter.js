import { AnomalyType } from '../models/types.js';

export class ReportExporter {
  constructor(analysisEngine) {
    this.analysisEngine = analysisEngine;
    this.simulationData = analysisEngine.simulationData;
  }

  generateMarkdownReport() {
    const summary = this.analysisEngine.getSummary();
    const personsWithAnomalies = this.analysisEngine.getPersonsWithAnomalies();
    const congestionEvents = this.analysisEngine.getCongestionEvents();
    
    let md = '# 消防演练复盘报告\n\n';
    
    md += '## 一、演练基本信息\n\n';
    md += `- 演练时间范围: ${this.formatTime(summary.minTime || 0)} - ${this.formatTime(summary.maxTime || this.simulationData.metadata.endTime)}\n`;
    md += `- 参与人员总数: ${summary.totalPersons}\n`;
    md += `- 安全出口数量: ${this.simulationData.exits.length}\n`;
    md += `- 楼层数量: ${this.simulationData.floors.size}\n\n`;
    
    md += '## 二、总体统计\n\n';
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 总参与人数 | ${summary.totalPersons} |\n`;
    md += `| 有异常记录的人数 | ${summary.personsWithAnomalies} (${(summary.anomalyRatio * 100).toFixed(1)}%) |\n`;
    md += `| 成功到达出口人数 | ${summary.reachedExitCount} (${(summary.reachedExitRatio * 100).toFixed(1)}%) |\n`;
    md += `| 选择最近出口人数 | ${summary.reachedNearestExitCount} (${(summary.reachedNearestExitRatio * 100).toFixed(1)}% 的出口到达者) |\n`;
    md += `| 经过封闭通道人数 | ${summary.usedBlockedPathCount} (${(summary.usedBlockedPathRatio * 100).toFixed(1)}%) |\n`;
    md += `| 平均绕行距离 | ${summary.avgDetourDistance.toFixed(2)} 米 |\n`;
    md += `| 拥堵事件数量 | ${summary.congestionEvents} |\n\n`;
    
    md += '## 三、异常类型统计\n\n';
    if (Object.keys(summary.anomalyTypeCounts).length > 0) {
      md += `| 异常类型 | 数量 | 说明 |\n`;
      md += `|----------|------|------|\n`;
      
      const typeNames = {
        [AnomalyType.WRONG_EXIT]: '走错出口',
        [AnomalyType.BLOCKED_PATH]: '经过封闭通道',
        [AnomalyType.STAY_TOO_LONG]: '异常停留',
        [AnomalyType.WRONG_DIRECTION]: '方向错误',
        [AnomalyType.CONGESTION]: '通道拥堵'
      };
      
      for (const [type, count] of Object.entries(summary.anomalyTypeCounts)) {
        md += `| ${typeNames[type] || type} | ${count} | ${this.getAnomalyDescription(type)} |\n`;
      }
      md += '\n';
    } else {
      md += '无异常记录\n\n';
    }
    
    if (congestionEvents.length > 0) {
      md += '## 四、拥堵事件详情\n\n';
      for (let i = 0; i < congestionEvents.length; i++) {
        const event = congestionEvents[i];
        md += `### 拥堵事件 ${i + 1}\n\n`;
        md += `- 位置: ${event.edge.id}\n`;
        md += `- 时间: ${this.formatTime(event.timeStart)} - ${this.formatTime(event.timeEnd)}\n`;
        md += `- 涉及人数: ${event.personCount}\n`;
        md += `- 涉及人员: ${event.personIds.slice(0, 5).join(', ')}${event.personIds.length > 5 ? '...' : ''}\n\n`;
      }
    }
    
    if (personsWithAnomalies.length > 0) {
      md += '## 五、异常人员详情\n\n';
      
      for (const { person, analysis } of personsWithAnomalies) {
        md += `### ${person.name} (ID: ${person.id})\n\n`;
        md += `- 所属分组: ${person.group}\n`;
        md += `- 实际用时: ${this.formatDuration(analysis.actualTime)}\n`;
        md += `- 实际移动距离: ${analysis.actualDistance.toFixed(2)} 米\n`;
        md += `- 最优路径距离: ${analysis.optimalDistance.toFixed(2)} 米\n`;
        md += `- 绕行距离: ${analysis.detourDistance.toFixed(2)} 米 (${(analysis.detourRatio * 100).toFixed(1)}%)\n`;
        if (analysis.reachedExit) {
          md += `- 到达出口: ${analysis.reachedExit.id}\n`;
          md += `- 是否选择最近出口: ${analysis.reachedNearestExit ? '是' : '否'}\n`;
        } else {
          md += `- 是否到达出口: 否\n`;
        }
        if (analysis.usedBlockedPaths.length > 0) {
          md += `- 经过封闭通道次数: ${analysis.usedBlockedPaths.length}\n`;
        }
        
        md += '\n#### 异常记录\n\n';
        for (const anomaly of analysis.anomalies) {
          md += `- [${this.formatTime(anomaly.time)}] ${this.getAnomalyTypeName(anomaly.type)}: ${anomaly.description}\n`;
        }
        
        if (person.observations.length > 0) {
          md += '\n#### 观察员备注\n\n';
          for (const obs of person.observations) {
            md += `- [${this.formatTime(obs.time)}] ${obs.observer}: ${obs.note}\n`;
          }
        }
        
        md += '\n';
      }
    }
    
    md += '## 六、改进建议\n\n';
    md += this.generateRecommendations(summary, congestionEvents, personsWithAnomalies);
    
    return md;
  }

  generateJSONReport() {
    const summary = this.analysisEngine.getSummary();
    const personsWithAnomalies = this.analysisEngine.getPersonsWithAnomalies();
    const congestionEvents = this.analysisEngine.getCongestionEvents();
    
    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        startTime: this.simulationData.metadata.startTime,
        endTime: this.simulationData.metadata.endTime
      },
      summary: {
        ...summary,
        floors: Array.from(this.simulationData.floors.values()).map(f => ({
          id: f.id,
          name: f.name,
          level: f.level
        })),
        exits: this.simulationData.exits.map(e => ({
          id: e.id,
          type: e.type,
          isSafe: e.isSafe,
          position: {
            x: e.position.x,
            y: e.position.y,
            floor: e.position.floor
          }
        }))
      },
      congestionEvents: congestionEvents.map(event => ({
        edgeId: event.edge.id,
        timeStart: event.timeStart,
        timeEnd: event.timeEnd,
        personCount: event.personCount,
        personIds: event.personIds,
        description: event.description
      })),
      personsWithAnomalies: personsWithAnomalies.map(({ person, analysis }) => ({
        personId: person.id,
        personName: person.name,
        group: person.group,
        analysis: {
          actualTime: analysis.actualTime,
          actualDistance: analysis.actualDistance,
          optimalDistance: analysis.optimalDistance,
          detourDistance: analysis.detourDistance,
          detourRatio: analysis.detourRatio,
          reachedExit: analysis.reachedExit ? analysis.reachedExit.id : null,
          reachedNearestExit: analysis.reachedNearestExit,
          usedBlockedPathsCount: analysis.usedBlockedPaths.length,
          anomalies: analysis.anomalies.map(a => ({
            type: a.type,
            time: a.time,
            position: {
              x: a.position.x,
              y: a.position.y,
              floor: a.position.floor
            },
            description: a.description
          })),
          stayPoints: analysis.stayPoints.map(s => ({
            timeStart: s.timeStart,
            timeEnd: s.timeEnd,
            position: {
              x: s.position.x,
              y: s.position.y,
              floor: s.position.floor
            },
            duration: s.duration
          }))
        },
        observations: person.observations.map(o => ({
          time: o.time,
          observer: o.observer,
          note: o.note
        }))
      })),
      allPersons: Array.from(this.simulationData.persons.values()).map(p => ({
        id: p.id,
        name: p.name,
        group: p.group,
        hasAnomalies: p.analysis && p.analysis.anomalies.length > 0,
        anomalyCount: (p.analysis && p.analysis.anomalies.length) || 0
      }))
    };
    
    return report;
  }

  generateRecommendations(summary, congestionEvents, personsWithAnomalies) {
    const recommendations = [];
    
    if (summary.reachedNearestExitRatio < 0.8) {
      recommendations.push(`1. **出口标识优化**: 只有 ${(summary.reachedNearestExitRatio * 100).toFixed(1)}% 的人员选择了最近的安全出口。建议加强出口标识的可见性，并在演练前进行更多的路线指引培训。`);
    }
    
    if (summary.usedBlockedPathRatio > 0.1) {
      recommendations.push(`2. **封闭通道管理**: ${(summary.usedBlockedPathRatio * 100).toFixed(1)}% 的人员经过了封闭通道。建议在演练前明确告知所有人员哪些通道是封闭的，并考虑在封闭位置设置明显的物理障碍或标识。`);
    }
    
    if (congestionEvents.length > 0) {
      const worstCongestion = congestionEvents.reduce((max, event) => 
        event.personCount > max.personCount ? event : max
      );
      recommendations.push(`3. **通道拥堵问题**: 检测到 ${congestionEvents.length} 个拥堵事件。最严重的拥堵发生在 ${worstCongestion.edge.id}，有 ${worstCongestion.personCount} 人同时通过。建议:
   - 分析该通道是否为瓶颈点
   - 考虑增加备用疏散路线
   - 优化人流引导策略`);
    }
    
    if (summary.anomalyTypeCounts[AnomalyType.STAY_TOO_LONG] > 0) {
      recommendations.push(`4. **异常停留问题**: 有 ${summary.anomalyTypeCounts[AnomalyType.STAY_TOO_LONG]} 人次出现异常停留。建议:
   - 检查是否有人员在疏散过程中迷失方向
   - 考虑在关键节点设置引导人员
   - 评估疏散指示系统的有效性`);
    }
    
    if (summary.avgDetourDistance > 5) {
      recommendations.push(`5. **路径优化**: 平均绕行距离为 ${summary.avgDetourDistance.toFixed(2)} 米。建议:
   - 分析人员的实际移动路线与最优路线的差异
   - 检查是否存在指示不清的问题
   - 考虑增加中间引导标识`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('本次演练整体表现良好，未发现重大问题。建议定期进行类似演练以保持应急响应能力。');
    }
    
    return recommendations.join('\n\n');
  }

  downloadMarkdownReport(filename = 'fire-drill-report.md') {
    const content = this.generateMarkdownReport();
    this.downloadFile(content, filename, 'text/markdown');
  }

  downloadJSONReport(filename = 'fire-drill-report.json') {
    const content = JSON.stringify(this.generateJSONReport(), null, 2);
    this.downloadFile(content, filename, 'application/json');
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
      return `${mins} 分 ${secs} 秒`;
    }
    return `${secs} 秒`;
  }

  getAnomalyTypeName(type) {
    const names = {
      [AnomalyType.WRONG_EXIT]: '走错出口',
      [AnomalyType.BLOCKED_PATH]: '经过封闭通道',
      [AnomalyType.STAY_TOO_LONG]: '异常停留',
      [AnomalyType.WRONG_DIRECTION]: '方向错误',
      [AnomalyType.CONGESTION]: '通道拥堵'
    };
    return names[type] || type;
  }

  getAnomalyDescription(type) {
    const descriptions = {
      [AnomalyType.WRONG_EXIT]: '人员没有选择最近的安全出口',
      [AnomalyType.BLOCKED_PATH]: '人员经过了被标记为封闭的通道',
      [AnomalyType.STAY_TOO_LONG]: '人员在某个位置停留时间过长',
      [AnomalyType.WRONG_DIRECTION]: '人员移动方向与最优疏散方向偏差较大',
      [AnomalyType.CONGESTION]: '多个人员同时通过同一通道导致拥堵'
    };
    return descriptions[type] || '';
  }
}

export default ReportExporter;
