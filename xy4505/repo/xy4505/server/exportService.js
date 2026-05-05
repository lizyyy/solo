const storage = require('./storage');
const dayjs = require('dayjs');

// 生成Markdown巡修清单
async function generateMarkdown() {
  const [risks, stats] = await Promise.all([
    storage.getAllRisks(),
    storage.getStatistics()
  ]);
  
  // 按道路分组
  const roadGroups = new Map();
  risks.forEach(risk => {
    if (!roadGroups.has(risk.road)) {
      roadGroups.set(risk.road, []);
    }
    roadGroups.get(risk.road).push(risk);
  });
  
  let md = `# 路灯巡修清单\n\n`;
  md += `**生成时间**: ${dayjs().format('YYYY年MM月DD日 HH:mm:ss')}\n\n`;
  md += `---\n\n`;
  
  // 统计摘要
  md += `## 一、风险统计摘要\n\n`;
  md += `| 指标 | 数量 |\n`;
  md += `|------|------|\n`;
  md += `| 总风险数 | ${stats.totalRisks} |\n`;
  md += `| 高优先级 | ${stats.priorityStats.高} |\n`;
  md += `| 中优先级 | ${stats.priorityStats.中} |\n`;
  md += `| 低优先级 | ${stats.priorityStats.低} |\n`;
  md += `| 灯具衰减 | ${stats.typeStats.灯具衰减} |\n`;
  md += `| 线路故障 | ${stats.typeStats.线路故障} |\n`;
  md += `| 误报 | ${stats.typeStats.误报} |\n\n`;
  
  // 状态统计
  md += `### 复核状态统计\n\n`;
  md += `| 状态 | 数量 |\n`;
  md += `|------|------|\n`;
  md += `| 待复核 | ${stats.statusStats.待复核} |\n`;
  md += `| 已确认 | ${stats.statusStats.已确认} |\n`;
  md += `| 已派工 | ${stats.statusStats.已派工} |\n`;
  md += `| 已完成 | ${stats.statusStats.已完成} |\n\n`;
  
  // 按优先级排序的风险列表
  md += `## 二、按优先级排序的风险清单\n\n`;
  
  // 高优先级
  const highPriorityRisks = risks.filter(r => r.priority === '高');
  if (highPriorityRisks.length > 0) {
    md += `### ⚠️ 高优先级（${highPriorityRisks.length}项）\n\n`;
    md += `| 道路 | 灯杆号 | 风险类型 | 风险原因 | 状态 |\n`;
    md += `|------|--------|----------|----------|------|\n`;
    
    highPriorityRisks.forEach(risk => {
      md += `| ${risk.road} | ${risk.poleId} | ${risk.riskType} | ${risk.reason.replace(/\n/g, ' ')} | ${risk.status} |\n`;
    });
    md += `\n`;
  }
  
  // 中优先级
  const mediumPriorityRisks = risks.filter(r => r.priority === '中');
  if (mediumPriorityRisks.length > 0) {
    md += `### ⚡ 中优先级（${mediumPriorityRisks.length}项）\n\n`;
    md += `| 道路 | 灯杆号 | 风险类型 | 风险原因 | 状态 |\n`;
    md += `|------|--------|----------|----------|------|\n`;
    
    mediumPriorityRisks.forEach(risk => {
      md += `| ${risk.road} | ${risk.poleId} | ${risk.riskType} | ${risk.reason.replace(/\n/g, ' ')} | ${risk.status} |\n`;
    });
    md += `\n`;
  }
  
  // 低优先级
  const lowPriorityRisks = risks.filter(r => r.priority === '低');
  if (lowPriorityRisks.length > 0) {
    md += `### 📋 低优先级（${lowPriorityRisks.length}项）\n\n`;
    md += `| 道路 | 灯杆号 | 风险类型 | 风险原因 | 状态 |\n`;
    md += `|------|--------|----------|----------|------|\n`;
    
    lowPriorityRisks.forEach(risk => {
      md += `| ${risk.road} | ${risk.poleId} | ${risk.riskType} | ${risk.reason.replace(/\n/g, ' ')} | ${risk.status} |\n`;
    });
    md += `\n`;
  }
  
  // 按道路分组的详细信息
  md += `## 三、按道路分组详情\n\n`;
  
  const sortedRoads = Array.from(roadGroups.keys()).sort();
  
  for (const road of sortedRoads) {
    const roadRisks = roadGroups.get(road);
    
    // 统计该道路的风险
    const roadStats = {
      high: roadRisks.filter(r => r.priority === '高').length,
      medium: roadRisks.filter(r => r.priority === '中').length,
      low: roadRisks.filter(r => r.priority === '低').length
    };
    
    md += `### ${road}\n\n`;
    md += `**风险概览**: 高${roadStats.high}项 | 中${roadStats.medium}项 | 低${roadStats.low}项\n\n`;
    
    // 按灯杆分组
    const poleGroups = new Map();
    roadRisks.forEach(risk => {
      if (!poleGroups.has(risk.poleId)) {
        poleGroups.set(risk.poleId, []);
      }
      poleGroups.get(risk.poleId).push(risk);
    });
    
    for (const [poleId, poleRisks] of poleGroups) {
      md += `#### 灯杆 ${poleId}\n\n`;
      
      poleRisks.forEach(risk => {
        md += `**风险类型**: ${risk.riskType} (${risk.priority}优先级)\n\n`;
        md += `**风险原因**: ${risk.reason}\n\n`;
        
        if (risk.suggestions && risk.suggestions.length > 0) {
          md += `**处置建议**:\n\n`;
          risk.suggestions.forEach((s, i) => {
            md += `${i + 1}. ${s}\n`;
          });
          md += `\n`;
        }
        
        if (risk.remarks) {
          md += `**复核备注**: ${risk.remarks}\n\n`;
        }
        
        md += `**当前状态**: ${risk.status}\n\n`;
        md += `---\n\n`;
      });
    }
  }
  
  // 附录：数据来源统计
  md += `## 四、附录：数据来源统计\n\n`;
  md += `| 数据类型 | 数量 |\n`;
  md += `|----------|------|\n`;
  md += `| 照度数据 | ${stats.illuminationCount} |\n`;
  md += `| 电流日志 | ${stats.currentLogsCount} |\n`;
  md += `| 居民报修 | ${stats.complaintsCount} |\n`;
  md += `| 历史工单 | ${stats.workOrdersCount} |\n\n`;
  
  md += `---\n\n`;
  md += `*本清单由路灯运维AI小工具自动生成，仅供内部巡修使用。*\n`;
  
  return md;
}

// 生成JSON明细
async function generateJSON() {
  const allData = await storage.getAllData();
  
  // 生成结构化的JSON
  const structuredData = {
    meta: {
      exportTime: allData.exportTime,
      version: '1.0.0',
      description: '路灯运维风险分析明细数据'
    },
    summary: {
      totalRisks: allData.risks.length,
      byType: {
        '灯具衰减': allData.risks.filter(r => r.riskType === '灯具衰减').length,
        '线路故障': allData.risks.filter(r => r.riskType === '线路故障').length,
        '误报': allData.risks.filter(r => r.riskType === '误报').length
      },
      byPriority: {
        '高': allData.risks.filter(r => r.priority === '高').length,
        '中': allData.risks.filter(r => r.priority === '中').length,
        '低': allData.risks.filter(r => r.priority === '低').length
      },
      byStatus: {
        '待复核': allData.risks.filter(r => r.status === '待复核').length,
        '已确认': allData.risks.filter(r => r.status === '已确认').length,
        '已派工': allData.risks.filter(r => r.status === '已派工').length,
        '已完成': allData.risks.filter(r => r.status === '已完成').length
      }
    },
    risks: allData.risks.map(risk => ({
      id: risk.id,
      road: risk.road,
      poleId: risk.poleId,
      riskType: risk.riskType,
      reason: risk.reason,
      score: risk.score,
      priority: risk.priority,
      sources: risk.sources,
      details: risk.details,
      suggestions: risk.suggestions,
      history: risk.history?.map(h => ({
        orderNo: h.orderNo,
        date: h.date,
        issueType: h.issueType,
        solution: h.solution,
        status: h.status
      })),
      remarks: risk.remarks,
      status: risk.status,
      reviewedAt: risk.reviewedAt,
      createdAt: risk.createdAt
    })),
    byRoad: {},
    sourceData: {
      illumination: allData.illumination.map(i => ({
        id: i.id,
        road: i.road,
        poleId: i.poleId,
        illumination: i.illumination,
        timestamp: i.timestamp,
        importedAt: i.importedAt
      })),
      currentLogs: allData.currentLogs.map(c => ({
        id: c.id,
        poleId: c.poleId,
        current: c.current,
        timestamp: c.timestamp,
        importedAt: c.importedAt
      })),
      complaints: allData.complaints.map(c => ({
        id: c.id,
        road: c.road,
        poleId: c.poleId,
        description: c.description,
        keywords: c.keywords,
        date: c.date,
        importedAt: c.importedAt
      })),
      workOrders: allData.workOrders.map(w => ({
        id: w.id,
        orderNo: w.orderNo,
        road: w.road,
        poleId: w.poleId,
        issueType: w.issueType,
        solution: w.solution,
        status: w.status,
        date: w.date,
        importedAt: w.importedAt
      }))
    }
  };
  
  // 构建按道路分组
  for (const risk of allData.risks) {
    if (!structuredData.byRoad[risk.road]) {
      structuredData.byRoad[risk.road] = {
        road: risk.road,
        risks: [],
        stats: {
          total: 0,
          byType: { '灯具衰减': 0, '线路故障': 0, '误报': 0 },
          byPriority: { '高': 0, '中': 0, '低': 0 }
        }
      };
    }
    
    structuredData.byRoad[risk.road].risks.push({
      id: risk.id,
      poleId: risk.poleId,
      riskType: risk.riskType,
      priority: risk.priority,
      score: risk.score,
      status: risk.status
    });
    
    structuredData.byRoad[risk.road].stats.total++;
    structuredData.byRoad[risk.road].stats.byType[risk.riskType]++;
    structuredData.byRoad[risk.road].stats.byPriority[risk.priority]++;
  }
  
  return structuredData;
}

module.exports = {
  generateMarkdown,
  generateJSON
};
