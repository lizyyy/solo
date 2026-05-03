const models = require('../models');
const dayjs = require('dayjs');

/**
 * 导出服务
 * 支持生成Markdown和CSV格式的报告
 */

/**
 * 将数据转换为CSV格式
 * @param {Array} data - 数据数组
 * @param {Array} columns - 列定义数组 [{key: '字段名', label: '显示名称'}]
 * @returns {string} CSV字符串
 */
function toCSV(data, columns) {
  if (!data || data.length === 0) {
    return '';
  }
  
  // 生成表头
  const headers = columns.map(col => col.label);
  const headerLine = headers.map(h => `"${h}"`).join(',');
  
  // 生成数据行
  const lines = data.map(item => {
    return columns.map(col => {
      const value = item[col.key] !== undefined ? item[col.key] : '';
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    }).join(',');
  });
  
  return [headerLine, ...lines].join('\n');
}

/**
 * 生成综合报告
 * @returns {Promise<{markdown: string, csv: Object}>}
 */
async function generateComprehensiveReport() {
  try {
    // 获取所有数据
    const [
      equipmentStats,
      recallStats,
      workOrderStats,
      recallMatchStats,
      overdueRisks,
      activeRecalls,
      workOrders
    ] = await Promise.all([
      models.equipment.getEquipmentStats(),
      models.recall.getRecallStats(),
      models.workOrder.getWorkOrderStats(),
      models.recallMatch.getRecallMatchStats(),
      models.overdueRisk.getOverdueRiskStats(),
      models.recall.getActiveRecalls(),
      models.workOrder.getAllWorkOrders()
    ]);
    
    const reportDate = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    // 生成Markdown报告
    let markdown = `# 灭火器批次召回闭环台 - 综合报告\n\n`;
    markdown += `**生成时间**: ${reportDate}\n\n`;
    markdown += `---\n\n`;
    
    // 1. 总体统计
    markdown += `## 1. 总体统计\n\n`;
    markdown += `| 项目 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 器材总数 | ${equipmentStats.total} |\n`;
    markdown += `| 活跃器材 | ${equipmentStats.active} |\n`;
    markdown += `| 已报废器材 | ${equipmentStats.scrapped} |\n`;
    markdown += `| 召回清单总数 | ${recallStats.total} |\n`;
    markdown += `| 活跃召回 | ${recallStats.active} |\n`;
    markdown += `| 派工单总数 | ${workOrderStats.total} |\n`;
    markdown += `| 待处理匹配 | ${recallMatchStats.pending} |\n`;
    markdown += `| 未解决风险 | ${overdueRisks.unresolved} |\n\n`;
    
    // 2. 活跃召回详情
    markdown += `## 2. 活跃召回清单\n\n`;
    if (activeRecalls.length === 0) {
      markdown += `暂无活跃召回清单。\n\n`;
    } else {
      markdown += `| 召回编号 | 生产厂家 | 召回原因 | 发布日期 | 截止日期 | 状态 |\n`;
      markdown += `|----------|----------|----------|----------|----------|------|\n`;
      for (const recall of activeRecalls) {
        const batches = JSON.parse(recall.affected_batches || '[]');
        const batchStr = Array.isArray(batches) ? batches.join(', ') : batches;
        markdown += `| ${recall.recall_code} | ${recall.manufacturer} | ${recall.recall_reason.substring(0, 30)}${recall.recall_reason.length > 30 ? '...' : ''} | ${recall.recall_date || '-'} | ${recall.deadline_date || '-'} | ${recall.status} |\n`;
      }
      markdown += `\n`;
    }
    
    // 3. 派工单状态
    markdown += `## 3. 派工单状态\n\n`;
    markdown += `| 状态 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 已创建 | ${workOrderStats.created} |\n`;
    markdown += `| 已分配 | ${workOrderStats.assigned} |\n`;
    markdown += `| 处理中 | ${workOrderStats.inProgress} |\n`;
    markdown += `| 已完成 | ${workOrderStats.completed} |\n`;
    markdown += `| 已取消 | ${workOrderStats.cancelled} |\n\n`;
    
    // 4. 风险情况
    markdown += `## 4. 逾期风险情况\n\n`;
    if (overdueRisks.unresolved === 0) {
      markdown += `暂无未解决的逾期风险。\n\n`;
    } else {
      markdown += `### 风险等级分布\n\n`;
      markdown += `| 风险等级 | 数量 | 说明 |\n`;
      markdown += `|----------|------|------|\n`;
      markdown += `| 严重 | ${overdueRisks.detailed?.critical || 0} | 逾期15天以上 |\n`;
      markdown += `| 高 | ${overdueRisks.detailed?.high || 0} | 逾期8-14天 |\n`;
      markdown += `| 中 | ${overdueRisks.detailed?.medium || 0} | 逾期3-7天 |\n`;
      markdown += `| 低 | ${overdueRisks.detailed?.low || 0} | 逾期0-2天 |\n\n`;
    }
    
    // 5. 汇总
    markdown += `## 5. 汇总说明\n\n`;
    let summaryNotes = [];
    
    if (recallMatchStats.pending > 0) {
      summaryNotes.push(`- 有 ${recallMatchStats.pending} 个召回匹配待处理（未通知）`);
    }
    
    if (overdueRisks.unresolved > 0) {
      summaryNotes.push(`- 有 ${overdueRisks.unresolved} 个未解决的逾期风险需要关注`);
    }
    
    if (workOrderStats.created + workOrderStats.assigned + workOrderStats.inProgress > 0) {
      summaryNotes.push(`- 有 ${workOrderStats.created + workOrderStats.assigned + workOrderStats.inProgress} 个派工单正在处理中`);
    }
    
    if (summaryNotes.length === 0) {
      markdown += `所有任务处理正常，无待办事项。\n`;
    } else {
      markdown += summaryNotes.join('\n') + '\n';
    }
    
    // 准备CSV数据
    const csvData = {
      summary: {
        data: [
          { item: '器材总数', value: equipmentStats.total },
          { item: '活跃器材', value: equipmentStats.active },
          { item: '已报废器材', value: equipmentStats.scrapped },
          { item: '召回清单总数', value: recallStats.total },
          { item: '活跃召回', value: recallStats.active },
          { item: '派工单总数', value: workOrderStats.total },
          { item: '未解决风险', value: overdueRisks.unresolved }
        ],
        columns: [
          { key: 'item', label: '项目' },
          { key: 'value', label: '数量' }
        ]
      },
      activeRecalls: {
        data: activeRecalls.map(r => ({
          recall_code: r.recall_code,
          manufacturer: r.manufacturer,
          recall_reason: r.recall_reason,
          recall_date: r.recall_date,
          deadline_date: r.deadline_date,
          status: r.status
        })),
        columns: [
          { key: 'recall_code', label: '召回编号' },
          { key: 'manufacturer', label: '生产厂家' },
          { key: 'recall_reason', label: '召回原因' },
          { key: 'recall_date', label: '发布日期' },
          { key: 'deadline_date', label: '截止日期' },
          { key: 'status', label: '状态' }
        ]
      },
      workOrders: {
        data: workOrders.map(wo => ({
          order_code: wo.order_code,
          recall_code: wo.recall_code || '-',
          equipment_code: wo.equipment_code || '-',
          assigned_to: wo.assigned_to || '-',
          deadline_date: wo.deadline_date,
          status: wo.status
        })),
        columns: [
          { key: 'order_code', label: '派工单号' },
          { key: 'recall_code', label: '召回编号' },
          { key: 'equipment_code', label: '器材编号' },
          { key: 'assigned_to', label: '分配人' },
          { key: 'deadline_date', label: '截止日期' },
          { key: 'status', label: '状态' }
        ]
      }
    };
    
    return {
      markdown,
      csv: {
        summary: toCSV(csvData.summary.data, csvData.summary.columns),
        activeRecalls: toCSV(csvData.activeRecalls.data, csvData.activeRecalls.columns),
        workOrders: toCSV(csvData.workOrders.data, csvData.workOrders.columns)
      }
    };
    
  } catch (error) {
    throw new Error(`生成综合报告失败: ${error.message}`);
  }
}

/**
 * 生成召回详细报告
 * @param {string} recallId - 召回清单ID
 * @returns {Promise<{markdown: string, csv: Object}>}
 */
async function generateRecallDetailReport(recallId) {
  try {
    const recall = await models.recall.getRecallById(recallId);
    
    if (!recall) {
      throw new Error(`召回清单不存在: ${recallId}`);
    }
    
    const matches = await models.recallMatch.getRecallMatchesByRecallId(recallId);
    const reportDate = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    // 统计
    const notifiedCount = matches.filter(m => m.is_notified === 1).length;
    const pendingCount = matches.filter(m => m.status === 'pending').length;
    const completedCount = matches.filter(m => m.status === 'completed').length;
    
    // 解析批次
    let batches = [];
    try {
      batches = JSON.parse(recall.affected_batches || '[]');
      if (!Array.isArray(batches)) {
        batches = [batches];
      }
    } catch (e) {
      batches = recall.affected_batches?.split(/[,，;；]/) || [];
    }
    
    // 生成Markdown
    let markdown = `# 召回详细报告\n\n`;
    markdown += `**召回编号**: ${recall.recall_code}\n`;
    markdown += `**生成时间**: ${reportDate}\n\n`;
    markdown += `---\n\n`;
    
    // 基本信息
    markdown += `## 1. 召回基本信息\n\n`;
    markdown += `- **生产厂家**: ${recall.manufacturer}\n`;
    markdown += `- **召回原因**: ${recall.recall_reason}\n`;
    markdown += `- **发布日期**: ${recall.recall_date || '-'}\n`;
    markdown += `- **截止日期**: ${recall.deadline_date || '-'}\n`;
    markdown += `- **状态**: ${recall.status}\n`;
    markdown += `- **涉及批次**: ${batches.join(', ')}\n\n`;
    
    // 统计
    markdown += `## 2. 处理统计\n\n`;
    markdown += `| 状态 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 匹配总数 | ${matches.length} |\n`;
    markdown += `| 待通知 | ${pendingCount} |\n`;
    markdown += `| 已通知 | ${notifiedCount} |\n`;
    markdown += `| 已完成 | ${completedCount} |\n\n`;
    
    // 详细列表
    markdown += `## 3. 器材明细\n\n`;
    if (matches.length === 0) {
      markdown += `暂无匹配的器材。\n`;
    } else {
      markdown += `| 器材编号 | 批次号 | 器材类型 | 型号 | 存放位置 | 通知状态 | 处理状态 |\n`;
      markdown += `|----------|--------|----------|------|----------|----------|----------|\n`;
      for (const match of matches) {
        const notifiedStatus = match.is_notified === 1 ? '已通知' : '未通知';
        markdown += `| ${match.equipment_code || '-'} | ${match.batch_number || '-'} | ${match.equipment_type || '-'} | ${match.model || '-'} | ${match.location || '-'} | ${notifiedStatus} | ${match.status} |\n`;
      }
      markdown += `\n`;
    }
    
    // CSV数据
    const csvData = {
      summary: {
        data: [
          { item: '召回编号', value: recall.recall_code },
          { item: '生产厂家', value: recall.manufacturer },
          { item: '召回原因', value: recall.recall_reason },
          { item: '发布日期', value: recall.recall_date },
          { item: '截止日期', value: recall.deadline_date },
          { item: '匹配总数', value: matches.length },
          { item: '待通知', value: pendingCount },
          { item: '已通知', value: notifiedCount },
          { item: '已完成', value: completedCount }
        ],
        columns: [
          { key: 'item', label: '项目' },
          { key: 'value', label: '值' }
        ]
      },
      equipment: {
        data: matches.map(m => ({
          equipment_code: m.equipment_code || '-',
          batch_number: m.batch_number || '-',
          equipment_type: m.equipment_type || '-',
          model: m.model || '-',
          location: m.location || '-',
          notified: m.is_notified === 1 ? '已通知' : '未通知',
          status: m.status
        })),
        columns: [
          { key: 'equipment_code', label: '器材编号' },
          { key: 'batch_number', label: '批次号' },
          { key: 'equipment_type', label: '器材类型' },
          { key: 'model', label: '型号' },
          { key: 'location', label: '存放位置' },
          { key: 'notified', label: '通知状态' },
          { key: 'status', label: '处理状态' }
        ]
      }
    };
    
    return {
      markdown,
      csv: {
        summary: toCSV(csvData.summary.data, csvData.summary.columns),
        equipment: toCSV(csvData.equipment.data, csvData.equipment.columns)
      }
    };
    
  } catch (error) {
    throw new Error(`生成召回详细报告失败: ${error.message}`);
  }
}

/**
 * 生成风险报告
 * @returns {Promise<{markdown: string, csv: Object}>}
 */
async function generateRiskReport() {
  try {
    const [
      overdueStats,
      highRiskItems,
      upcomingDeadlines
    ] = await Promise.all([
      models.overdueRisk.getOverdueRiskStats(),
      models.overdueRisk.getUnresolvedOverdueRisks(),
      getUpcomingDeadlinesInternal()
    ]);
    
    const reportDate = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    // 生成Markdown
    let markdown = `# 逾期风险报告\n\n`;
    markdown += `**生成时间**: ${reportDate}\n\n`;
    markdown += `---\n\n`;
    
    // 总体风险统计
    markdown += `## 1. 总体风险统计\n\n`;
    markdown += `| 项目 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 风险记录总数 | ${overdueStats.total} |\n`;
    markdown += `| 未解决风险 | ${overdueStats.unresolved} |\n`;
    markdown += `| 已解决风险 | ${overdueStats.resolved} |\n\n`;
    
    // 风险等级分布
    markdown += `## 2. 风险等级分布\n\n`;
    const detailed = overdueStats.detailed || {};
    markdown += `| 风险等级 | 数量 | 阈值 | 说明 |\n`;
    markdown += `|----------|------|------|------|\n`;
    markdown += `| 严重 | ${detailed.critical || 0} | ≥15天 | 需要紧急处理并上报 |\n`;
    markdown += `| 高 | ${detailed.high || 0} | 8-14天 | 需要跟进并制定解决方案 |\n`;
    markdown += `| 中 | ${detailed.medium || 0} | 3-7天 | 需要提醒处理人员 |\n`;
    markdown += `| 低 | ${detailed.low || 0} | 0-2天 | 刚逾期或即将逾期，需要关注 |\n\n`;
    
    // 高风险项目
    markdown += `## 3. 高风险项目（严重和高风险）\n\n`;
    const highRisks = highRiskItems.filter(
      r => r.risk_level === 'high' || r.risk_level === 'critical'
    );
    
    if (highRisks.length === 0) {
      markdown += `暂无高风险项目。\n\n`;
    } else {
      markdown += `| 类型 | ID | 逾期天数 | 风险等级 | 截止日期 |\n`;
      markdown += `|------|----|----------|----------|----------|\n`;
      for (const risk of highRisks) {
        const levelLabel = risk.risk_level === 'critical' ? '严重' : 
                           risk.risk_level === 'high' ? '高' : 
                           risk.risk_level === 'medium' ? '中' : '低';
        markdown += `| ${risk.entity_type} | ${risk.entity_id} | ${risk.days_overdue} | ${levelLabel} | ${risk.deadline_date} |\n`;
      }
      markdown += `\n`;
    }
    
    // 即将逾期
    markdown += `## 4. 即将逾期项目（3天内到期）\n\n`;
    if (upcomingDeadlines.total === 0) {
      markdown += `暂无即将逾期的项目。\n`;
    } else {
      if (upcomingDeadlines.work_orders?.length > 0) {
        markdown += `### 派工单\n\n`;
        markdown += `| 派工单号 | 剩余天数 | 截止日期 | 状态 | 分配人 |\n`;
        markdown += `|----------|----------|----------|------|--------|\n`;
        for (const wo of upcomingDeadlines.work_orders) {
          markdown += `| ${wo.order_code} | ${wo.days_until_deadline} | ${wo.deadline_date} | ${wo.status} | ${wo.assigned_to || '-'} |\n`;
        }
        markdown += `\n`;
      }
      
      if (upcomingDeadlines.recalls?.length > 0) {
        markdown += `### 召回清单\n\n`;
        markdown += `| 召回编号 | 剩余天数 | 截止日期 | 状态 | 厂家 |\n`;
        markdown += `|----------|----------|----------|------|------|\n`;
        for (const recall of upcomingDeadlines.recalls) {
          markdown += `| ${recall.recall_code} | ${recall.days_until_deadline} | ${recall.deadline_date} | ${recall.status} | ${recall.manufacturer || '-'} |\n`;
        }
        markdown += `\n`;
      }
    }
    
    // CSV数据
    const csvData = {
      summary: {
        data: [
          { item: '风险记录总数', value: overdueStats.total },
          { item: '未解决风险', value: overdueStats.unresolved },
          { item: '已解决风险', value: overdueStats.resolved },
          { item: '严重风险', value: detailed.critical || 0 },
          { item: '高风险', value: detailed.high || 0 },
          { item: '中风险', value: detailed.medium || 0 },
          { item: '低风险', value: detailed.low || 0 }
        ],
        columns: [
          { key: 'item', label: '项目' },
          { key: 'value', label: '数量' }
        ]
      },
      highRisks: {
        data: highRisks.map(r => ({
          entity_type: r.entity_type,
          entity_id: r.entity_id,
          days_overdue: r.days_overdue,
          risk_level: r.risk_level === 'critical' ? '严重' : 
                     r.risk_level === 'high' ? '高' : 
                     r.risk_level === 'medium' ? '中' : '低',
          deadline_date: r.deadline_date
        })),
        columns: [
          { key: 'entity_type', label: '类型' },
          { key: 'entity_id', label: 'ID' },
          { key: 'days_overdue', label: '逾期天数' },
          { key: 'risk_level', label: '风险等级' },
          { key: 'deadline_date', label: '截止日期' }
        ]
      }
    };
    
    return {
      markdown,
      csv: {
        summary: toCSV(csvData.summary.data, csvData.summary.columns),
        highRisks: toCSV(csvData.highRisks.data, csvData.highRisks.columns)
      }
    };
    
  } catch (error) {
    throw new Error(`生成风险报告失败: ${error.message}`);
  }
}

/**
 * 内部函数：获取即将逾期的项目
 */
async function getUpcomingDeadlinesInternal() {
  try {
    const today = dayjs();
    const threeDaysLater = today.add(3, 'day').format('YYYY-MM-DD');
    const todayStr = today.format('YYYY-MM-DD');
    
    // 获取所有派工单
    const allWorkOrders = await models.workOrder.getAllWorkOrders();
    const upcomingWorkOrders = allWorkOrders.filter(wo => {
      if (wo.status === 'completed' || wo.status === 'cancelled') {
        return false;
      }
      if (!wo.deadline_date) {
        return false;
      }
      const deadline = dayjs(wo.deadline_date);
      return deadline.isAfter(todayStr) && deadline.isBefore(threeDaysLater) || deadline.isSame(todayStr, 'day');
    }).map(wo => ({
      id: wo.id,
      order_code: wo.order_code,
      deadline_date: wo.deadline_date,
      status: wo.status,
      assigned_to: wo.assigned_to,
      days_until_deadline: dayjs(wo.deadline_date).diff(today, 'day')
    }));
    
    // 获取所有召回清单
    const allRecalls = await models.recall.getAllRecalls();
    const upcomingRecalls = allRecalls.filter(recall => {
      if (recall.status === 'completed' || recall.status === 'closed' || recall.status === 'cancelled') {
        return false;
      }
      if (!recall.deadline_date) {
        return false;
      }
      const deadline = dayjs(recall.deadline_date);
      return deadline.isAfter(todayStr) && deadline.isBefore(threeDaysLater) || deadline.isSame(todayStr, 'day');
    }).map(recall => ({
      id: recall.id,
      recall_code: recall.recall_code,
      deadline_date: recall.deadline_date,
      status: recall.status,
      manufacturer: recall.manufacturer,
      days_until_deadline: dayjs(recall.deadline_date).diff(today, 'day')
    }));
    
    return {
      total: upcomingWorkOrders.length + upcomingRecalls.length,
      work_orders: upcomingWorkOrders,
      recalls: upcomingRecalls
    };
  } catch (error) {
    return { total: 0, work_orders: [], recalls: [] };
  }
}

/**
 * 生成器材台账报告
 * @returns {Promise<{markdown: string, csv: string}>}
 */
async function generateEquipmentReport() {
  try {
    const [allEquipment, stats] = await Promise.all([
      models.equipment.getAllEquipment(),
      models.equipment.getEquipmentStats()
    ]);
    
    const reportDate = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    // 生成Markdown
    let markdown = `# 器材台账报告\n\n`;
    markdown += `**生成时间**: ${reportDate}\n\n`;
    markdown += `---\n\n`;
    
    // 统计
    markdown += `## 1. 统计信息\n\n`;
    markdown += `| 项目 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 器材总数 | ${stats.total} |\n`;
    markdown += `| 活跃器材 | ${stats.active} |\n`;
    markdown += `| 已报废器材 | ${stats.scrapped} |\n\n`;
    
    // 明细
    markdown += `## 2. 器材明细\n\n`;
    if (allEquipment.length === 0) {
      markdown += `暂无器材数据。\n`;
    } else {
      markdown += `| 器材编号 | 批次号 | 类型 | 型号 | 厂家 | 存放位置 | 状态 |\n`;
      markdown += `|----------|--------|------|------|------|----------|------|\n`;
      for (const eq of allEquipment) {
        const status = eq.is_scrapped ? '已报废' : eq.status || '正常';
        markdown += `| ${eq.equipment_code} | ${eq.batch_number} | ${eq.equipment_type} | ${eq.model} | ${eq.manufacturer} | ${eq.location || '-'} | ${status} |\n`;
      }
      markdown += `\n`;
    }
    
    // CSV
    const csvColumns = [
      { key: 'equipment_code', label: '器材编号' },
      { key: 'batch_number', label: '批次号' },
      { key: 'equipment_type', label: '器材类型' },
      { key: 'model', label: '型号' },
      { key: 'manufacturer', label: '生产厂家' },
      { key: 'production_date', label: '生产日期' },
      { key: 'purchase_date', label: '购买日期' },
      { key: 'expiration_date', label: '有效期至' },
      { key: 'location', label: '存放位置' },
      { key: 'status', label: '状态' },
      { key: 'is_scrapped', label: '是否报废' }
    ];
    
    const csvData = allEquipment.map(eq => ({
      ...eq,
      status: eq.is_scrapped ? '已报废' : eq.status || '正常',
      is_scrapped: eq.is_scrapped ? '是' : '否'
    }));
    
    return {
      markdown,
      csv: toCSV(csvData, csvColumns)
    };
    
  } catch (error) {
    throw new Error(`生成器材台账报告失败: ${error.message}`);
  }
}

module.exports = {
  toCSV,
  generateComprehensiveReport,
  generateRecallDetailReport,
  generateRiskReport,
  generateEquipmentReport
};
