const { allAsync } = require('../config/database');
const Animal = require('../models/Animal');
const ValidationViolation = require('../models/ValidationViolation');
const TransferRecord = require('../models/TransferRecord');
const VeterinaryOrder = require('../models/VeterinaryOrder');
const SensorAlert = require('../models/SensorAlert');

class MarkdownExporter {
  static async generateReviewReport(options = {}) {
    const { startDate, endDate, includeDetails = true } = options;
    
    const reportParts = [];
    
    reportParts.push(this.generateHeader());
    reportParts.push(await this.generateSummarySection(startDate, endDate));
    reportParts.push(await this.generateViolationsSection());
    reportParts.push(await this.generateTimelineSection(startDate, endDate));
    
    if (includeDetails) {
      reportParts.push(await this.generateAnimalDetailsSection());
      reportParts.push(await this.generateAlertDetailsSection());
      reportParts.push(await this.generateTransferDetailsSection(startDate, endDate));
      reportParts.push(await this.generateVeterinaryDetailsSection());
    }
    
    reportParts.push(this.generateFooter());
    
    return reportParts.join('\n\n---\n\n');
  }

  static generateHeader() {
    const now = new Date().toISOString().substring(0, 19).replace('T', ' ');
    return `# 笼位健康事件复盘报告

> 生成时间: ${now}
> 
> **系统名称**: 笼位健康事件仲裁器 (Cage Health Event Arbitrator)
> 
> **报告目的**: 本报告汇总当前系统检测到的风险事件、动物时间线及处置状态，供值班人员复核和闭环处理。

---`;
  }

  static async generateSummarySection(startDate, endDate) {
    const stats = await ValidationViolation.getStatistics();
    
    const [animalCount, cageCount, alertCount, transferCount, orderCount] = await Promise.all([
      allAsync('SELECT COUNT(*) as count FROM animals WHERE status = "active"'),
      allAsync('SELECT COUNT(*) as count FROM cages'),
      allAsync('SELECT COUNT(*) as count FROM sensor_alerts WHERE status IN ("open", "acknowledged")'),
      allAsync(`SELECT COUNT(*) as count FROM transfer_records WHERE status = "pending"`),
      allAsync(`SELECT COUNT(*) as count FROM veterinary_orders WHERE status IN ("draft", "observing")`)
    ]);

    return `## 📊 风险概览

### 当前风险统计

| 风险类型 | 待处理 | 已解决 | 已驳回 |
|---------|--------|--------|--------|
| 违规记录 | **${stats.total.open}** | ${stats.total.resolved} | ${stats.total.dismissed} |

### 待处理事项汇总

| 事项类型 | 数量 | 优先级 |
|---------|------|--------|
| 活跃动物 | ${animalCount[0]?.count || 0} | 持续监控 |
| 未闭环告警 | ${alertCount[0]?.count || 0} | 🔴 高 |
| 待执行转笼 | ${transferCount[0]?.count || 0} | 🟡 中 |
| 待签署处置单/观察中 | ${orderCount[0]?.count || 0} | 🟡 中 |
| 笼位总数 | ${cageCount[0]?.count || 0} | - |

### 按类型分布`;
  }

  static async generateViolationsSection() {
    const violations = await ValidationViolation.getOpenViolations();
    
    if (violations.length === 0) {
      return `## ✅ 当前无待处理违规

系统检测完毕，当前没有待处理的违规记录。`;
    }

    const typeGroups = {};
    violations.forEach(v => {
      if (!typeGroups[v.violation_type]) {
        typeGroups[v.violation_type] = [];
      }
      typeGroups[v.violation_type].push(v);
    });

    const typeNames = {
      'cage_occupancy_conflict': '🔴 笼位占用冲突',
      'multiple_active_cages': '🔴 多笼位占用',
      'open_alert': '🟠 未闭环告警',
      'unsigned_veterinary_order': '🟡 处置单缺签',
      'observation_timeout': '🟡 观察期超时',
      'duplicate_transfer': '🟡 重复转笼',
      'cage_capacity_overload': '🔴 笼位容量过载'
    };

    let content = `## ⚠️ 待处理违规详情\n\n`;

    for (const [type, items] of Object.entries(typeGroups)) {
      const typeName = typeNames[type] || type;
      content += `### ${typeName} (${items.length}条)\n\n`;
      
      items.forEach((v, index) => {
        const severityIcon = v.severity === 'critical' ? '🔴' : 
                             v.severity === 'high' ? '🟠' : 
                             v.severity === 'medium' ? '🟡' : '🟢';
        
        content += `#### ${severityIcon} 违规 #${index + 1}\n\n`;
        content += `- **ID**: ${v.id}\n`;
        content += `- **严重级别**: ${v.severity}\n`;
        content += `- **检测时间**: ${v.detected_at}\n`;
        content += `- **描述**: ${v.description}\n\n`;
        
        if (v.review_decision) {
          content += `> 💬 复核意见: ${v.review_decision}\n\n`;
        }
      });
    }

    return content;
  }

  static async generateTimelineSection(startDate, endDate) {
    const animals = await Animal.findAll({ status: 'active', limit: 50 });
    
    if (animals.length === 0) {
      return `## 🐭 动物时间线

当前无活跃动物记录。`;
    }

    let content = `## 📅 近期事件时间线\n\n`;
    
    const allEvents = [];
    const dateFilter = startDate && endDate;
    
    for (const animal of animals) {
      const timeline = await Animal.getTimeline(animal.animal_id);
      timeline.forEach(event => {
        let include = true;
        if (dateFilter) {
          const eventDate = new Date(event.event_time);
          include = eventDate >= new Date(startDate) && eventDate <= new Date(endDate);
        }
        if (include) {
          allEvents.push({
            ...event,
            animal_id: animal.animal_id
          });
        }
      });
    }

    allEvents.sort((a, b) => new Date(a.event_time) - new Date(b.event_time));

    if (allEvents.length === 0) {
      content += `*所选时间范围内无事件记录。*\n`;
      return content;
    }

    const eventIcons = {
      'transfer': '🔄',
      'veterinary_sign': '📋',
      'observation_start': '⏱️',
      'observation_complete': '✅',
      'alert': '⚠️',
      'inspection': '👁️'
    };

    allEvents.slice(-50).forEach(event => {
      const icon = eventIcons[event.event_type] || '📌';
      const time = event.event_time.substring(0, 19).replace('T', ' ');
      content += `- **${time}** ${icon} [${event.animal_id}] ${event.description}\n`;
    });

    if (allEvents.length > 50) {
      content += `\n> 显示最近50条事件，共${allEvents.length}条\n`;
    }

    return content;
  }

  static async generateAnimalDetailsSection() {
    const animals = await Animal.findAll({ status: 'active', limit: 100 });
    
    if (animals.length === 0) {
      return `## 🐭 活跃动物详情

当前无活跃动物。`;
    }

    let content = `## 🐭 活跃动物详情\n\n`;
    content += `| 动物编号 | 物种 | 品系 | 性别 | 入舍日期 |\n`;
    content += `|---------|------|------|------|----------|\n`;

    for (const animal of animals) {
      const timeline = await Animal.getTimeline(animal.animal_id);
      const recentEvent = timeline.length > 0 ? timeline[timeline.length - 1] : null;
      
      content += `| ${animal.animal_id} | ${animal.species || '-'} | ${animal.strain || '-'} | ${animal.gender || '-'} | ${animal.arrival_date?.substring(0, 10) || '-'} |\n`;
    }

    return content;
  }

  static async generateAlertDetailsSection() {
    const alerts = await SensorAlert.getOpenAlerts({ limit: 100 });
    
    if (alerts.length === 0) {
      return `## 🚨 未闭环告警详情

当前无未闭环告警。`;
    }

    let content = `## 🚨 未闭环告警详情\n\n`;
    content += `| 告警ID | 笼位 | 传感器类型 | 测量值 | 阈值 | 状态 | 告警时间 |\n`;
    content += `|--------|------|-----------|--------|------|------|----------|\n`;

    alerts.forEach(alert => {
      const statusIcon = alert.status === 'open' ? '🔴' : '🟡';
      content += `| ${alert.alert_id} | ${alert.cage_id} | ${alert.sensor_type} | ${alert.measured_value} | ${alert.threshold_value || '-'} | ${statusIcon}${alert.status} | ${alert.alert_time.substring(0, 16)} |\n`;
    });

    return content;
  }

  static async generateTransferDetailsSection(startDate, endDate) {
    let sql = `SELECT tr.*, a.species, a.strain
               FROM transfer_records tr
               JOIN animals a ON tr.animal_id = a.animal_id
               WHERE 1=1`;
    const params = [];

    if (startDate) {
      sql += ' AND tr.transfer_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND tr.transfer_date <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY tr.transfer_date DESC LIMIT 50';

    const transfers = await allAsync(sql, params);
    
    if (transfers.length === 0) {
      return `## 🔄 转笼记录详情

所选时间范围内无转笼记录。`;
    }

    let content = `## 🔄 近期转笼记录\n\n`;
    content += `| 转笼ID | 动物 | 原笼位 | 新笼位 | 原因 | 状态 | 转笼日期 |\n`;
    content += `|--------|------|--------|--------|------|------|----------|\n`;

    transfers.forEach(transfer => {
      const statusIcon = transfer.status === 'completed' ? '✅' : 
                          transfer.status === 'pending' ? '⏳' : '❌';
      content += `| ${transfer.transfer_id} | ${transfer.animal_id} | ${transfer.from_cage_id || '-'} | ${transfer.to_cage_id} | ${transfer.transfer_reason || '常规'} | ${statusIcon}${transfer.status} | ${transfer.transfer_date.substring(0, 10)} |\n`;
    });

    return content;
  }

  static async generateVeterinaryDetailsSection() {
    const orders = await VeterinaryOrder.getObservingOrders();
    const unsigned = await VeterinaryOrder.getUnsignedOrders();
    
    if (orders.length === 0 && unsigned.length === 0) {
      return `## 🏥 兽医处置详情

当前无观察中或待签署的处置单。`;
    }

    let content = `## 🏥 兽医处置详情\n\n`;

    if (unsigned.length > 0) {
      content += `### 📋 待签署处置单 (${unsigned.length}条)\n\n`;
      content += `| 处置单ID | 动物 | 诊断 | 检查日期 | 等待天数 |\n`;
      content += `|---------|------|------|----------|----------|\n`;

      const now = new Date();
      unsigned.forEach(order => {
        const examDate = new Date(order.examination_date);
        const daysWaiting = Math.floor((now - examDate) / (1000 * 60 * 60 * 24));
        content += `| ${order.order_id} | ${order.animal_id} | ${order.diagnosis || '未填写'} | ${order.examination_date.substring(0, 10)} | ${daysWaiting}天 |\n`;
      });
      content += `\n`;
    }

    if (orders.length > 0) {
      content += `### ⏱️ 观察中处置单 (${orders.length}条)\n\n`;
      content += `| 处置单ID | 动物 | 诊断 | 观察期 | 已观察 | 状态 |\n`;
      content += `|---------|------|------|--------|--------|------|\n`;

      const now = new Date();
      orders.forEach(order => {
        const startDate = new Date(order.start_observation_date);
        const daysObserved = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const daysOverdue = daysObserved - order.observation_period_days;
        const status = daysOverdue > 0 ? `⚠️ 超期${daysOverdue}天` : '⏳ 进行中';
        
        content += `| ${order.order_id} | ${order.animal_id} | ${order.diagnosis || '-'} | ${order.observation_period_days}天 | ${daysObserved}天 | ${status} |\n`;
      });
    }

    return content;
  }

  static generateFooter() {
    return `## 📝 操作建议

### 立即处理 (🔴 高优先级)
1. 优先处理所有 \`critical\` 和 \`high\` 级别的违规记录
2. 检查并闭环所有未处理的传感器告警
3. 核实笼位占用冲突和容量过载情况

### 常规处理 (🟡 中优先级)
1. 签署待签署的兽医处置单
2. 检查观察期是否超时
3. 核实是否存在重复转笼记录

### 复核流程
1. 查看"待处理违规详情"部分
2. 对每条违规进行人工复核
3. 确认问题后通过API提交复核决定:
   - \`resolve\`: 问题已解决
   - \`dismiss\`: 驳回，判定为误报
   - \`review\`: 需要进一步调查

---

> **本报告由笼位健康事件仲裁器自动生成，仅供内部使用。**
> 
> **最后更新**: ${new Date().toISOString()}`;
  }
}

module.exports = MarkdownExporter;
