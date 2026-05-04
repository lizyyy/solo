const moment = require('moment');
const { getAsync, allAsync } = require('../config/database');

async function generateMarkdownReleaseNote() {
  const today = moment().format('YYYY-MM-DD');
  const now = moment().format('YYYY-MM-DD HH:mm:ss');

  const containers = await allAsync('SELECT * FROM containers WHERE status = "active"');
  const icePacks = await allAsync('SELECT * FROM ice_packs WHERE status = "active"');
  const loggers = await allAsync('SELECT * FROM temperature_loggers WHERE status = "active"');
  const batches = await allAsync(`
    SELECT * FROM appointment_batches 
    WHERE date(appointment_date) = date('now')
    ORDER BY appointment_date
  `);
  
  const risks = await allAsync(`
    SELECT * FROM risk_assessments 
    WHERE date(calculated_at) = date('now')
    ORDER BY 
      CASE risk_level 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
      END
  `);

  const highRisks = risks.filter(r => r.risk_level === 'high' && r.review_status !== 'cleared');
  const mediumRisks = risks.filter(r => r.risk_level === 'medium' && r.review_status !== 'cleared');
  const clearedRisks = risks.filter(r => r.review_status === 'cleared');

  const canRelease = highRisks.length === 0;

  let markdown = `# 疫苗接种点冷链设备放行单\n\n`;
  markdown += `**日期**: ${today}  \n`;
  markdown += `**生成时间**: ${now}  \n`;
  markdown += `**放行状态**: ${canRelease ? '✅ 可放行' : '❌ 不可放行'}  \n\n`;

  markdown += `---\n\n`;

  markdown += `## 一、设备清点\n\n`;

  markdown += `### 1. 冷藏箱\n\n`;
  if (containers.length > 0) {
    markdown += `| 箱体编号 | 类型 | 状态 | 是否备用 |\n`;
    markdown += `|----------|------|------|----------|\n`;
    containers.forEach(c => {
      markdown += `| ${c.container_id} | ${c.container_type} | ${c.status} | ${c.is_spare ? '是' : '否'} |\n`;
    });
  } else {
    markdown += `> 暂无冷藏箱数据\n`;
  }
  markdown += `\n`;

  markdown += `### 2. 冰排\n\n`;
  if (icePacks.length > 0) {
    markdown += `| 冰排编号 | 所属箱体 | 冻结状态 | 状态 |\n`;
    markdown += `|----------|----------|----------|------|\n`;
    icePacks.forEach(p => {
      markdown += `| ${p.pack_id} | ${p.container_id || '-'} | ${p.frozen_status} | ${p.status} |\n`;
    });
  } else {
    markdown += `> 暂无冰排数据\n`;
  }
  markdown += `\n`;

  markdown += `### 3. 温度记录仪\n\n`;
  if (loggers.length > 0) {
    markdown += `| 记录仪编号 | 所属箱体 | 状态 |\n`;
    markdown += `|------------|----------|------|\n`;
    loggers.forEach(l => {
      markdown += `| ${l.logger_id} | ${l.container_id || '-'} | ${l.status} |\n`;
    });
  } else {
    markdown += `> 暂无温度记录仪数据\n`;
  }
  markdown += `\n`;

  markdown += `---\n\n`;

  markdown += `## 二、今日预约批次\n\n`;
  if (batches.length > 0) {
    markdown += `| 批号 | 疫苗名称 | 预计箱体 | 数量 | 预约日期 |\n`;
    markdown += `|------|----------|----------|------|----------|\n`;
    batches.forEach(b => {
      markdown += `| ${b.batch_number} | ${b.vaccine_name} | ${b.expected_container_id || '-'} | ${b.quantity} | ${b.appointment_date} |\n`;
    });
  } else {
    markdown += `> 今日暂无预约批次\n`;
  }
  markdown += `\n`;

  markdown += `---\n\n`;

  markdown += `## 三、风险评估\n\n`;
  markdown += `**风险统计**: 高风险 ${highRisks.length} 项 | 中风险 ${mediumRisks.length} 项 | 已复核 ${clearedRisks.length} 项\n\n`;

  if (highRisks.length > 0) {
    markdown += `### 🔴 高风险项 (${highRisks.length})\n\n`;
    highRisks.forEach((r, i) => {
      markdown += `**${i + 1}. ${r.description}**\n\n`;
      markdown += `- 风险类型: ${r.risk_type}\n`;
      markdown += `- 影响对象: ${r.affected_item}\n`;
      markdown += `- 发现时间: ${r.calculated_at}\n`;
      if (r.review_status !== 'pending') {
        markdown += `- 复核状态: ${r.review_status}\n`;
        if (r.review_comment) markdown += `- 复核意见: ${r.review_comment}\n`;
        if (r.reviewer_name) markdown += `- 复核人: ${r.reviewer_name}\n`;
      }
      markdown += `\n`;
    });
  }

  if (mediumRisks.length > 0) {
    markdown += `### 🟡 中风险项 (${mediumRisks.length})\n\n`;
    mediumRisks.forEach((r, i) => {
      markdown += `**${i + 1}. ${r.description}**\n\n`;
      markdown += `- 风险类型: ${r.risk_type}\n`;
      markdown += `- 影响对象: ${r.affected_item}\n`;
      markdown += `- 发现时间: ${r.calculated_at}\n`;
      if (r.review_status !== 'pending') {
        markdown += `- 复核状态: ${r.review_status}\n`;
        if (r.review_comment) markdown += `- 复核意见: ${r.review_comment}\n`;
        if (r.reviewer_name) markdown += `- 复核人: ${r.reviewer_name}\n`;
      }
      markdown += `\n`;
    });
  }

  if (clearedRisks.length > 0) {
    markdown += `### 🟢 已复核项 (${clearedRisks.length})\n\n`;
    clearedRisks.forEach((r, i) => {
      markdown += `**${i + 1}. ${r.description}**\n\n`;
      markdown += `- 风险类型: ${r.risk_type}\n`;
      markdown += `- 影响对象: ${r.affected_item}\n`;
      markdown += `- 复核状态: ${r.review_status}\n`;
      if (r.review_comment) markdown += `- 复核意见: ${r.review_comment}\n`;
      if (r.reviewer_name) markdown += `- 复核人: ${r.reviewer_name}\n`;
      if (r.reviewed_at) markdown += `- 复核时间: ${r.reviewed_at}\n`;
      markdown += `\n`;
    });
  }

  if (risks.length === 0) {
    markdown += `> 暂无风险记录\n`;
  }
  markdown += `\n`;

  markdown += `---\n\n`;

  markdown += `## 四、放行结论\n\n`;
  if (canRelease) {
    markdown += `✅ **可放行** - 所有高风险项已清除或不存在。\n\n`;
  } else {
    markdown += `❌ **不可放行** - 存在 ${highRisks.length} 项高风险问题未解决。\n\n`;
    markdown += `请先处理高风险问题后再进行放行操作。\n`;
  }
  markdown += `\n`;

  markdown += `---\n\n`;

  markdown += `## 五、复核签字\n\n`;
  markdown += `| 职位 | 姓名 | 签字 | 日期 |\n`;
  markdown += `|------|------|------|------|\n`;
  markdown += `| 冷链管理员 | ____________ | ____________ | ____________ |\n`;
  markdown += `| 护士长 | ____________ | ____________ | ____________ |\n`;
  markdown += `\n`;

  markdown += `---\n\n`;
  markdown += `> 本放行单由系统自动生成，所有数据均来自冷链监控系统。\n`;
  markdown += `> 生成时间: ${now}\n`;

  return markdown;
}

async function generateJsonAuditPackage() {
  const today = moment().format('YYYY-MM-DD');
  const now = moment().format('YYYY-MM-DD HH:mm:ss');

  const systemInfo = await allAsync('SELECT * FROM system_config');
  
  const containers = await allAsync('SELECT * FROM containers');
  const icePacks = await allAsync('SELECT * FROM ice_packs');
  const loggers = await allAsync('SELECT * FROM temperature_loggers');
  const calibrationRecords = await allAsync('SELECT * FROM calibration_records');
  const batches = await allAsync(`
    SELECT * FROM appointment_batches 
    WHERE date(appointment_date) = date('now')
  `);
  const batchAssignments = await allAsync(`
    SELECT * FROM batch_assignments 
    WHERE date(assignment_date) = date('now')
  `);
  
  const temperatureRecords = await allAsync(`
    SELECT * FROM temperature_records 
    WHERE date(record_time) = date('now')
    ORDER BY logger_id, record_time
  `);
  
  const riskAssessments = await allAsync(`
    SELECT * FROM risk_assessments 
    WHERE date(calculated_at) = date('now')
    ORDER BY risk_level, calculated_at
  `);

  const highRisks = riskAssessments.filter(r => r.risk_level === 'high' && r.review_status !== 'cleared');
  const mediumRisks = riskAssessments.filter(r => r.risk_level === 'medium' && r.review_status !== 'cleared');
  const canRelease = highRisks.length === 0;

  const auditPackage = {
    audit_package_info: {
      version: '1.0',
      generated_at: now,
      audit_date: today,
      generated_by: 'Vaccine Checkpoint System'
    },
    
    system_configuration: {
      min_temperature: systemInfo.find(c => c.config_key === 'min_temp')?.config_value || 2,
      max_temperature: systemInfo.find(c => c.config_key === 'max_temp')?.config_value || 8,
      required_spare_count: systemInfo.find(c => c.config_key === 'required_spare_count')?.config_value || 2,
      calibration_warning_days: systemInfo.find(c => c.config_key === 'calibration_warning_days')?.config_value || 30
    },

    equipment_inventory: {
      containers: containers.map(c => ({
        id: c.container_id,
        type: c.container_type,
        status: c.status,
        is_spare: c.is_spare === 1,
        created_at: c.created_at,
        updated_at: c.updated_at
      })),
      ice_packs: icePacks.map(p => ({
        id: p.pack_id,
        container_id: p.container_id,
        frozen_status: p.frozen_status,
        status: p.status
      })),
      temperature_loggers: loggers.map(l => ({
        id: l.logger_id,
        container_id: l.container_id,
        status: l.status
      })),
      calibration_records: calibrationRecords.map(r => ({
        device_id: r.device_id,
        device_type: r.device_type,
        calibration_date: r.calibration_date,
        expire_date: r.expire_date,
        certificate_number: r.certificate_number,
        calibration_agency: r.calibration_agency
      }))
    },

    today_appointments: {
      batches: batches.map(b => ({
        batch_number: b.batch_number,
        vaccine_name: b.vaccine_name,
        expected_container_id: b.expected_container_id,
        quantity: b.quantity,
        appointment_date: b.appointment_date
      })),
      assignments: batchAssignments.map(a => ({
        batch_number: a.batch_number,
        container_id: a.container_id,
        assignment_date: a.assignment_date
      }))
    },

    temperature_monitoring: {
      records: temperatureRecords.map(r => ({
        logger_id: r.logger_id,
        container_id: r.container_id,
        record_time: r.record_time,
        temperature: r.temperature
      }))
    },

    risk_assessment: {
      summary: {
        total_risks: riskAssessments.length,
        high_risks: highRisks.length,
        medium_risks: mediumRisks.length,
        cleared_risks: riskAssessments.filter(r => r.review_status === 'cleared').length,
        can_release: canRelease
      },
      details: riskAssessments.map(r => ({
        id: r.id,
        risk_type: r.risk_type,
        risk_level: r.risk_level,
        description: r.description,
        affected_item: r.affected_item,
        affected_type: r.affected_type,
        calculated_at: r.calculated_at,
        review_status: r.review_status,
        review_comment: r.review_comment,
        reviewer_name: r.reviewer_name,
        reviewed_at: r.reviewed_at
      }))
    },

    release_decision: {
      status: canRelease ? 'approved' : 'denied',
      reason: canRelease 
        ? '所有高风险项已清除，符合放行条件' 
        : `存在 ${highRisks.length} 项高风险问题未解决`,
      timestamp: now
    }
  };

  return auditPackage;
}

module.exports = {
  generateMarkdownReleaseNote,
  generateJsonAuditPackage
};
