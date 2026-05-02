const fs = require('fs');
const path = require('path');
const Handover = require('../models/handover');
const HandoverItem = require('../models/handoverItem');
const AuditLog = require('../models/auditLog');
const ColdBoxTimeline = require('../models/coldBoxTimeline');

const exportService = {
  exportHandoverToMarkdown: async (handoverCode) => {
    const handover = await Handover.findByCode(handoverCode);
    if (!handover) {
      throw new Error('交接记录不存在');
    }

    const items = await HandoverItem.getByHandoverId(handover.id);
    
    let markdown = `# 血袋样本配对交接报告\n\n`;
    markdown += `## 基本信息\n\n`;
    markdown += `- **交接编号**: ${handover.handover_code}\n`;
    markdown += `- **移交人**: ${handover.from_operator}\n`;
    markdown += `- **接收人**: ${handover.to_operator}\n`;
    markdown += `- **状态**: ${handover.status}\n`;
    markdown += `- **创建时间**: ${handover.created_at}\n`;
    if (handover.completed_at) {
      markdown += `- **完成时间**: ${handover.completed_at}\n`;
    }
    if (handover.notes) {
      markdown += `- **备注**: ${handover.notes}\n`;
    }
    
    markdown += `\n## 交接明细\n\n`;
    markdown += `| 序号 | 献血者条码 | 血袋编号 | 样本管编号 | 状态 | 检查结果 | 异常原因 |\n`;
    markdown += `|------|-----------|---------|-----------|------|---------|----------|\n`;
    
    items.forEach((item, index) => {
      markdown += `| ${index + 1} | ${item.donor_code || '-'} | ${item.bag_code || '-'} | ${item.tube_code || '-'} | ${item.status || '-'} | ${item.check_result || '-'} | ${item.exception_reason || '-'} |\n`;
    });
    
    markdown += `\n## 统计信息\n\n`;
    const total = items.length;
    const passed = items.filter(i => i.status === 'passed').length;
    const failed = items.filter(i => i.status === 'failed').length;
    const pending = items.filter(i => i.status === 'pending').length;
    
    markdown += `- **总数量**: ${total}\n`;
    markdown += `- **通过**: ${passed}\n`;
    markdown += `- **退回**: ${failed}\n`;
    markdown += `- **待处理**: ${pending}\n`;
    
    if (failed > 0) {
      markdown += `\n## 异常明细\n\n`;
      const failedItems = items.filter(i => i.status === 'failed');
      failedItems.forEach((item, index) => {
        markdown += `### ${index + 1}. 献血者: ${item.donor_code}\n\n`;
        markdown += `- 血袋编号: ${item.bag_code}\n`;
        markdown += `- 样本管编号: ${item.tube_code}\n`;
        markdown += `- 异常原因: ${item.exception_reason || '未记录'}\n\n`;
      });
    }
    
    markdown += `\n---\n`;
    markdown += `*报告生成时间: ${new Date().toISOString()}*\n`;
    
    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    const fileName = `handover_${handoverCode}_${Date.now()}.md`;
    const filePath = path.join(exportsDir, fileName);
    fs.writeFileSync(filePath, markdown, 'utf-8');
    
    return {
      fileName,
      filePath,
      content: markdown
    };
  },

  exportAuditToJSON: async (startTime, endTime, operator) => {
    let auditLogs;
    
    if (startTime && endTime) {
      auditLogs = await AuditLog.getByTimeRange(startTime, endTime);
    } else if (operator) {
      auditLogs = await AuditLog.getByOperator(operator);
    } else {
      auditLogs = await AuditLog.getAll();
    }
    
    const auditPackage = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      filters: {
        startTime,
        endTime,
        operator
      },
      totalRecords: auditLogs.length,
      records: auditLogs
    };
    
    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    const fileName = `audit_${Date.now()}.json`;
    const filePath = path.join(exportsDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(auditPackage, null, 2), 'utf-8');
    
    return {
      fileName,
      filePath,
      content: auditPackage
    };
  },

  exportColdBoxTimeline: async (boxCode, startTime, endTime) => {
    let timeline;
    
    if (boxCode) {
      timeline = await ColdBoxTimeline.getByBoxCode(boxCode);
    } else if (startTime && endTime) {
      timeline = await ColdBoxTimeline.getByTimeRange(startTime, endTime);
    } else {
      timeline = await ColdBoxTimeline.getAll();
    }
    
    let markdown = `# 冷箱温度时间线报告\n\n`;
    markdown += `## 报告信息\n\n`;
    markdown += `- **冷箱编号**: ${boxCode || '全部'}\n`;
    markdown += `- **时间范围**: ${startTime || '开始'} 至 ${endTime || '现在'}\n`;
    markdown += `- **记录总数**: ${timeline.length}\n`;
    markdown += `- **生成时间**: ${new Date().toISOString()}\n\n`;
    
    if (timeline.length > 0) {
      markdown += `## 时间线明细\n\n`;
      markdown += `| 时间 | 冷箱编号 | 事件类型 | 温度(°C) | 血袋编号 | 操作人 | 备注 |\n`;
      markdown += `|------|---------|---------|----------|---------|--------|------|\n`;
      
      timeline.forEach(t => {
        markdown += `| ${t.event_time} | ${t.box_code || '-'} | ${t.event_type} | ${t.temperature || '-'} | ${t.blood_bag_code || '-'} | ${t.operator || '-'} | ${t.notes || '-'} |\n`;
      });
    }
    
    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    const fileName = `coldbox_timeline_${Date.now()}.md`;
    const filePath = path.join(exportsDir, fileName);
    fs.writeFileSync(filePath, markdown, 'utf-8');
    
    return {
      fileName,
      filePath,
      content: markdown
    };
  }
};

module.exports = exportService;
