const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const DrillSession = require('../models/DrillSession');
const Floor = require('../models/Floor');
const Exit = require('../models/Exit');
const Person = require('../models/Person');
const FirePoint = require('../models/FirePoint');
const DrillEvent = require('../models/DrillEvent');
const RiskAssessment = require('../models/RiskAssessment');
const SimulationSnapshot = require('../models/SimulationSnapshot');
const BroadcastSchedule = require('../models/BroadcastSchedule');

class ExportService {
  constructor(drillSessionId) {
    this.drillSessionId = drillSessionId;
    this.session = null;
    this.exportsDir = path.join(__dirname, '..', 'exports');
    
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  async loadSessionData() {
    this.session = DrillSession.findById(this.drillSessionId);
    if (!this.session) {
      throw new Error('Drill session not found');
    }
    return this.session;
  }

  generateMarkdownReport() {
    if (!this.session) {
      throw new Error('Session data not loaded');
    }

    const floors = Floor.findAll();
    const events = DrillEvent.findByDrillSessionId(this.drillSessionId);
    const riskAssessments = RiskAssessment.findByDrillSessionId(this.drillSessionId);
    const snapshots = SimulationSnapshot.findByDrillSessionId(this.drillSessionId);
    const broadcasts = BroadcastSchedule.findByDrillSessionId(this.drillSessionId);
    
    const statusSummary = Person.getStatusSummary();
    const totalPersons = Object.values(statusSummary).reduce((a, b) => a + b, 0);
    
    const latestRisk = RiskAssessment.findLatestByDrillSession(this.drillSessionId);
    const riskLevel = this.getRiskLevelText(latestRisk?.overall_score || 0);
    
    const duration = this.session.end_time && this.session.start_time 
      ? Math.round((new Date(this.session.end_time) - new Date(this.session.start_time)) / 1000)
      : null;

    let report = `# 消防疏散演练报告\n\n`;
    report += `## 基本信息\n\n`;
    report += `| 项目 | 内容 |\n`;
    report += `|------|------|\n`;
    report += `| 演练名称 | ${this.session.name} |\n`;
    report += `| 演练状态 | ${this.getStatusText(this.session.status)} |\n`;
    report += `| 开始时间 | ${this.session.start_time || '未开始'} |\n`;
    report += `| 结束时间 | ${this.session.end_time || '未结束'} |\n`;
    report += `| 持续时长 | ${duration ? `${duration} 秒` : '未完成'} |\n`;
    report += `| 时间步数 | ${this.session.current_time_step} |\n`;
    report += `| 当前风险等级 | ${riskLevel} |\n\n`;

    report += `## 楼层配置\n\n`;
    report += `| 楼层 | 名称 | 宽度 | 高度 |\n`;
    report += `|------|------|------|------|\n`;
    for (const floor of floors) {
      const floorExits = Exit.findByFloorId(floor.id);
      const floorPersons = Person.findByFloorId(floor.id);
      report += `| ${floor.floor_number} | ${floor.name} | ${floor.width}m | ${floor.height}m |\n`;
    }
    report += `\n`;

    report += `## 出口配置\n\n`;
    report += `| 楼层 | 出口名称 | 位置(X,Y) | 状态 | 容量 |\n`;
    report += `|------|----------|-----------|------|------|\n`;
    for (const floor of floors) {
      const floorExits = Exit.findByFloorId(floor.id);
      for (const exit of floorExits) {
        report += `| ${floor.name} | ${exit.name} | (${exit.x}, ${exit.y}) | ${this.getExitStatusText(exit.status)} | ${exit.capacity} |\n`;
      }
    }
    report += `\n`;

    report += `## 人员统计\n\n`;
    report += `| 状态 | 人数 | 占比 |\n`;
    report += `|------|------|------|\n`;
    report += `| 待疏散 | ${statusSummary.idle} | ${totalPersons > 0 ? ((statusSummary.idle / totalPersons) * 100).toFixed(1) : '0'}% |\n`;
    report += `| 疏散中 | ${statusSummary.evacuating} | ${totalPersons > 0 ? ((statusSummary.evacuating / totalPersons) * 100).toFixed(1) : '0'}% |\n`;
    report += `| 已疏散 | ${statusSummary.evacuated} | ${totalPersons > 0 ? ((statusSummary.evacuated / totalPersons) * 100).toFixed(1) : '0'}% |\n`;
    report += `| 被困 | ${statusSummary.trapped} | ${totalPersons > 0 ? ((statusSummary.trapped / totalPersons) * 100).toFixed(1) : '0'}% |\n`;
    report += `| 受伤 | ${statusSummary.injured} | ${totalPersons > 0 ? ((statusSummary.injured / totalPersons) * 100).toFixed(1) : '0'}% |\n`;
    report += `| **总计** | **${totalPersons}** | **100%** |\n\n`;

    report += `## 演练事件时间线\n\n`;
    if (events.length > 0) {
      for (const event of events) {
        const eventTypeText = this.getEventTypeText(event.event_type);
        report += `### 时间步 ${event.time_step}\n\n`;
        report += `- **类型**: ${eventTypeText}\n`;
        report += `- **描述**: ${event.description}\n`;
        if (event.data) {
          report += `- **详情**: \`\`\`json\n${JSON.stringify(event.data, null, 2)}\n\`\`\`\n`;
        }
        report += `\n`;
      }
    } else {
      report += `无演练事件记录。\n\n`;
    }

    report += `## 风险评估记录\n\n`;
    if (riskAssessments.length > 0) {
      report += `| 时间步 | 综合评分 | 拥堵评分 | 火势评分 | 出口评分 | 进度评分 | 风险等级 |\n`;
      report += `|--------|----------|----------|----------|----------|----------|----------|\n`;
      for (const assessment of riskAssessments) {
        const level = this.getRiskLevelText(assessment.overall_score);
        report += `| ${assessment.time_step} | ${assessment.overall_score} | ${assessment.congestion_score || 0} | ${assessment.fire_spread_score || 0} | ${assessment.exit_availability_score || 0} | ${assessment.evacuation_progress_score || 0} | ${level} |\n`;
      }
    } else {
      report += `无风险评估记录。\n\n`;
    }

    report += `## 起火点\n\n`;
    const firePoints = FirePoint.findByDrillSessionId(this.drillSessionId);
    if (firePoints.length > 0) {
      report += `| 时间步 | 楼层 | 位置(X,Y) | 强度 | 半径 |\n`;
      report += `|--------|------|-----------|------|------|\n`;
      for (const fp of firePoints) {
        const floor = Floor.findById(fp.floor_id);
        report += `| ${fp.time_step} | ${floor?.name || '未知'} | (${fp.x}, ${fp.y}) | ${fp.intensity} | ${fp.radius}m |\n`;
      }
    } else {
      report += `无起火点记录。\n\n`;
    }

    report += `## 广播记录\n\n`;
    const broadcastedMsgs = broadcasts.filter(b => b.is_broadcasted);
    if (broadcastedMsgs.length > 0) {
      report += `| 时间步 | 广播内容 |\n`;
      report += `|--------|----------|\n`;
      for (const msg of broadcastedMsgs) {
        report += `| ${msg.time_step} | ${msg.message} |\n`;
      }
    } else {
      report += `无广播记录。\n\n`;
    }

    report += `\n---\n`;
    report += `*报告生成时间: ${new Date().toISOString()}*\n`;

    return report;
  }

  generateJSONAuditPackage() {
    if (!this.session) {
      throw new Error('Session data not loaded');
    }

    const floors = Floor.findAll().map(f => f.toJSON());
    const exits = Exit.findAll().map(e => e.toJSON());
    const persons = Person.findAll().map(p => p.toJSON());
    const firePoints = FirePoint.findByDrillSessionId(this.drillSessionId).map(fp => fp.toJSON());
    const events = DrillEvent.findByDrillSessionId(this.drillSessionId).map(e => e.toJSON());
    const riskAssessments = RiskAssessment.findByDrillSessionId(this.drillSessionId).map(ra => ra.toJSON());
    const snapshots = SimulationSnapshot.findByDrillSessionId(this.drillSessionId).map(s => s.toJSON());
    const broadcasts = BroadcastSchedule.findByDrillSessionId(this.drillSessionId).map(b => b.toJSON());

    const auditPackage = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      session: this.session.toJSON(),
      environment: {
        floors,
        exits,
        persons: {
          snapshot: persons,
          summary: Person.getStatusSummary()
        }
      },
      drill: {
        firePoints,
        events,
        riskAssessments,
        snapshots,
        broadcasts
      },
      statistics: this.calculateStatistics()
    };

    return JSON.stringify(auditPackage, null, 2);
  }

  calculateStatistics() {
    const persons = Person.findAll();
    const statusSummary = Person.getStatusSummary();
    const totalPersons = Object.values(statusSummary).reduce((a, b) => a + b, 0);
    
    const events = DrillEvent.findByDrillSessionId(this.drillSessionId);
    const congestionEvents = events.filter(e => e.event_type === 'congestion_detected');
    const trappedEvents = events.filter(e => e.event_type === 'person_trapped');
    const exitBlockedEvents = events.filter(e => e.event_type === 'exit_blocked');

    const latestRisk = RiskAssessment.findLatestByDrillSession(this.drillSessionId);

    return {
      totalPersons,
      statusSummary,
      evacuationRate: totalPersons > 0 
        ? (statusSummary.evacuated / totalPersons * 100).toFixed(1) 
        : 0,
      eventStatistics: {
        totalEvents: events.length,
        congestionEvents: congestionEvents.length,
        trappedEvents: trappedEvents.length,
        exitBlockedEvents: exitBlockedEvents.length
      },
      finalRisk: latestRisk ? {
        score: latestRisk.overall_score,
        level: this.getRiskLevelText(latestRisk.overall_score)
      } : null,
      duration: this.session.end_time && this.session.start_time
        ? Math.round((new Date(this.session.end_time) - new Date(this.session.start_time)) / 1000)
        : null
    };
  }

  getRiskLevelText(score) {
    if (score >= 80) return '极度危险';
    if (score >= 60) return '高风险';
    if (score >= 40) return '中等风险';
    if (score >= 20) return '低风险';
    return '安全';
  }

  getStatusText(status) {
    const statusMap = {
      'created': '已创建',
      'running': '进行中',
      'paused': '已暂停',
      'completed': '已完成'
    };
    return statusMap[status] || status;
  }

  getExitStatusText(status) {
    const statusMap = {
      'available': '可用',
      'blocked': '阻塞',
      'unavailable': '不可用'
    };
    return statusMap[status] || status;
  }

  getEventTypeText(eventType) {
    const typeMap = {
      'drill_started': '演练开始',
      'drill_paused': '演练暂停',
      'drill_resumed': '演练恢复',
      'drill_completed': '演练完成',
      'fire_detected': '检测到火情',
      'exit_blocked': '出口阻塞',
      'exit_changed': '出口切换',
      'congestion_detected': '检测到拥堵',
      'person_trapped': '人员被困',
      'persons_evacuated': '人员疏散',
      'broadcast_sent': '发送广播',
      'manual_intervention': '人工干预'
    };
    return typeMap[eventType] || eventType;
  }

  async exportAll() {
    await this.loadSessionData();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionName = this.session.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    
    const reportPath = path.join(this.exportsDir, `${sessionName}_report_${timestamp}.md`);
    const jsonPath = path.join(this.exportsDir, `${sessionName}_audit_${timestamp}.json`);
    const zipPath = path.join(this.exportsDir, `${sessionName}_export_${timestamp}.zip`);

    const report = this.generateMarkdownReport();
    fs.writeFileSync(reportPath, report, 'utf8');

    const jsonPackage = this.generateJSONAuditPackage();
    fs.writeFileSync(jsonPath, jsonPackage, 'utf8');

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    archive.pipe(output);
    archive.file(reportPath, { name: path.basename(reportPath) });
    archive.file(jsonPath, { name: path.basename(jsonPath) });
    
    await archive.finalize();

    return {
      reportPath,
      jsonPath,
      zipPath,
      report,
      jsonPackage
    };
  }

  async getMarkdownReport() {
    await this.loadSessionData();
    return this.generateMarkdownReport();
  }

  async getJSONAuditPackage() {
    await this.loadSessionData();
    return this.generateJSONAuditPackage();
  }
}

module.exports = ExportService;
