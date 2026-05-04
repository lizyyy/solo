import moment from 'moment';
import DataService from './DataService';
import { REPAIR_STATUS_LABELS, RISK_STATUS_LABELS, RISK_TYPE_LABELS } from '../context/PhotoScanContext';

class ExportService {
  generateMarkdownHandover(state) {
    const { records, risks, importInfo, settings } = state;
    const exportTime = moment().format('YYYY-MM-DD HH:mm:ss');
    
    const totalRecords = records.length;
    const repairedCount = records.filter(r => r.repairStatus === 'repaired').length;
    const reviewedCount = records.filter(r => r.reviewed).length;
    const pendingRisks = risks.filter(r => r.status === 'pending').length;

    let md = `# 老照片底片扫描交接单\n\n`;
    
    md += `## 基本信息\n\n`;
    md += `| 项目 | 内容 |\n`;
    md += `|------|------|\n`;
    md += `| 导出时间 | ${exportTime} |\n`;
    md += `| 总记录数 | ${totalRecords} |\n`;
    md += `| 已修复 | ${repairedCount} |\n`;
    md += `| 已复核 | ${reviewedCount} |\n`;
    md += `| 待处理风险 | ${pendingRisks} |\n`;
    if (importInfo.importTime) {
      md += `| 数据导入时间 | ${importInfo.importTime} |\n`;
    }
    md += `\n`;

    md += `## 风险统计\n\n`;
    const riskStats = this.groupRisksByType(risks);
    if (Object.keys(riskStats).length > 0) {
      md += `| 风险类型 | 数量 | 待处理 |\n`;
      md += `|----------|------|--------|\n`;
      Object.entries(riskStats).forEach(([type, data]) => {
        const pending = data.list.filter(r => r.status === 'pending').length;
        md += `| ${data.label} | ${data.count} | ${pending} |\n`;
      });
    } else {
      md += `无风险记录\n\n`;
    }
    md += `\n`;

    md += `## 记录清单\n\n`;
    
    const grouped = this.groupRecordsByBox(records);
    Object.entries(grouped).forEach(([boxId, boxRecords]) => {
      md += `### 底片盒: ${boxId}\n\n`;
      md += `| 张号 | 扫描文件 | 分辨率(DPI) | 修复状态 | 责任人 | 复核状态 |\n`;
      md += `|------|----------|-------------|----------|--------|----------|\n`;
      
      boxRecords.sort((a, b) => {
        const na = parseInt(a.frameNumber) || 0;
        const nb = parseInt(b.frameNumber) || 0;
        return na - nb;
      });

      boxRecords.forEach(record => {
        const repairStatus = REPAIR_STATUS_LABELS[record.repairStatus] || '未知';
        const reviewStatus = record.reviewed ? (record.reviewStatus === 'pass' ? '通过' : '有问题') : '未复核';
        md += `| ${record.frameNumber} | ${record.scanFile || '-'} | ${record.scanResolution || '-'} | ${repairStatus} | ${record.responsiblePerson || '-'} | ${reviewStatus} |\n`;
      });
      md += `\n`;
    });

    if (pendingRisks > 0) {
      md += `## 待处理风险详情\n\n`;
      const pendingRisksList = risks.filter(r => r.status === 'pending');
      pendingRisksList.forEach((risk, index) => {
        const record = records.find(r => r.id === risk.recordId);
        const uniqueId = record ? DataService.generateUniqueId(record.boxId, record.frameNumber) : '未知';
        md += `### ${index + 1}. ${RISK_TYPE_LABELS[risk.riskType] || risk.riskType}\n\n`;
        md += `- 记录编号: ${uniqueId}\n`;
        md += `- 描述: ${risk.description}\n`;
        md += `- 发现时间: ${risk.createdTime}\n\n`;
      });
    }

    md += `\n---\n\n`;
    md += `*本交接单由老照片底片扫描管理系统自动生成*\n`;

    return md;
  }

  generateJSONAudit(state) {
    const auditData = {
      auditTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      auditVersion: '1.0',
      summary: {
        totalRecords: state.records.length,
        totalRisks: state.risks.length,
        repairedRecords: state.records.filter(r => r.repairStatus === 'repaired').length,
        reviewedRecords: state.records.filter(r => r.reviewed).length,
        pendingRisks: state.risks.filter(r => r.status === 'pending').length,
        resolvedRisks: state.risks.filter(r => r.status === 'resolved').length
      },
      importInfo: state.importInfo,
      settings: state.settings,
      records: state.records.map(record => ({
        ...record,
        uniqueId: DataService.generateUniqueId(record.boxId, record.frameNumber)
      })),
      risks: state.risks.map(risk => ({
        ...risk,
        riskTypeLabel: RISK_TYPE_LABELS[risk.riskType],
        statusLabel: RISK_STATUS_LABELS[risk.status]
      })),
      timeline: this.generateTimeline(state)
    };

    return JSON.stringify(auditData, null, 2);
  }

  groupRecordsByBox(records) {
    const grouped = {};
    records.forEach(record => {
      const boxId = record.boxId || '未分类';
      if (!grouped[boxId]) {
        grouped[boxId] = [];
      }
      grouped[boxId].push(record);
    });
    return grouped;
  }

  groupRisksByType(risks) {
    const grouped = {};
    risks.forEach(risk => {
      const type = risk.riskType;
      if (!grouped[type]) {
        grouped[type] = {
          count: 0,
          label: RISK_TYPE_LABELS[type] || type,
          list: []
        };
      }
      grouped[type].count++;
      grouped[type].list.push(risk);
    });
    return grouped;
  }

  generateTimeline(state) {
    const timeline = [];

    if (state.importInfo.importTime) {
      timeline.push({
        time: state.importInfo.importTime,
        event: '数据导入',
        details: '导入扫描清单和文件夹索引'
      });
    }

    state.records.forEach(record => {
      if (record.createdTime) {
        timeline.push({
          time: record.createdTime,
          event: '创建记录',
          recordId: record.id,
          uniqueId: DataService.generateUniqueId(record.boxId, record.frameNumber)
        });
      }
    });

    state.risks.forEach(risk => {
      if (risk.createdTime) {
        timeline.push({
          time: risk.createdTime,
          event: '发现风险',
          riskType: RISK_TYPE_LABELS[risk.riskType],
          recordId: risk.recordId
        });
      }
      if (risk.handledTime) {
        timeline.push({
          time: risk.handledTime,
          event: '处理风险',
          status: RISK_STATUS_LABELS[risk.status],
          handler: risk.handler
        });
      }
    });

    return timeline.sort((a, b) => new Date(a.time) - new Date(b.time));
  }

  downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default new ExportService();
