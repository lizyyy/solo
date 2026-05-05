const express = require('express');
const router = express.Router();
const moment = require('moment');

router.get('/dispatch-notes', (req, res) => {
  const db = req.app.locals.db;
  try {
    const { status, date_from, date_to } = req.query;
    
    let query = `
      SELECT r.*,
             p.plot_name,
             p.farmer_name,
             p.area as plot_area,
             p.location,
             p.crop_type,
             m.machine_name,
             m.machine_type,
             m.license_plate,
             o.operator_name,
             o.phone,
             o.license_type,
             os.subsidy_amount,
             os.fuel_consumption
      FROM reservations r
      LEFT JOIN plots p ON r.plot_id = p.id
      LEFT JOIN machines m ON r.machine_id = m.id
      LEFT JOIN operators o ON r.operator_id = o.id
      LEFT JOIN oil_subsidies os ON r.id = os.reservation_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }
    
    if (date_from) {
      query += ' AND date(r.start_time) >= ?';
      params.push(date_from);
    }
    
    if (date_to) {
      query += ' AND date(r.start_time) <= ?';
      params.push(date_to);
    }
    
    query += ' ORDER BY r.start_time ASC';
    
    const reservations = db.prepare(query).all(...params);
    
    let markdown = `# 春耕作业派工单\n\n`;
    markdown += `生成时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    markdown += `---\n\n`;
    
    reservations.forEach((r, index) => {
      const risks = db.prepare(`
        SELECT * FROM risk_assessments WHERE reservation_id = ?
      `).all(r.id);
      
      const blockedRisks = risks.filter(ris => ris.is_blocked === 1 && ris.manual_override === 0);
      const hasOverrides = risks.some(ris => ris.manual_override === 1);
      
      markdown += `## 派工单 #${index + 1}\n\n`;
      markdown += `**预约ID**: ${r.id}\n\n`;
      markdown += `**状态**: `;
      
      if (blockedRisks.length > 0 && !hasOverrides) {
        markdown += `🔴 拦截 (${blockedRisks.length} 项风险)\n\n`;
      } else if (hasOverrides) {
        markdown += `🟡 放行 (有手动改判)\n\n`;
      } else {
        markdown += `🟢 正常\n\n`;
      }
      
      markdown += `### 农户信息\n\n`;
      markdown += `- 农户姓名: ${r.farmer_name || '未填写'}\n`;
      markdown += `- 地块名称: ${r.plot_name || '未填写'}\n`;
      markdown += `- 地块面积: ${r.plot_area || 0} 亩\n`;
      markdown += `- 位置: ${r.location || '未填写'}\n`;
      markdown += `- 作物类型: ${r.crop_type || '未填写'}\n\n`;
      
      markdown += `### 作业信息\n\n`;
      markdown += `- 作业类型: ${r.work_type || '未填写'}\n`;
      markdown += `- 开始时间: ${r.start_time ? moment(r.start_time).format('YYYY-MM-DD HH:mm') : '未安排'}\n`;
      markdown += `- 结束时间: ${r.end_time ? moment(r.end_time).format('YYYY-MM-DD HH:mm') : '未安排'}\n\n`;
      
      markdown += `### 机具信息\n\n`;
      markdown += `- 机具名称: ${r.machine_name || '未安排'}\n`;
      markdown += `- 机具类型: ${r.machine_type || '未填写'}\n`;
      markdown += `- 车牌号: ${r.license_plate || '未填写'}\n\n`;
      
      markdown += `### 机手信息\n\n`;
      markdown += `- 机手姓名: ${r.operator_name || '未安排'}\n`;
      markdown += `- 联系电话: ${r.phone || '未填写'}\n`;
      markdown += `- 驾驶证类型: ${r.license_type || '未填写'}\n\n`;
      
      if (r.subsidy_amount !== undefined || r.fuel_consumption !== undefined) {
        markdown += `### 油料补贴信息\n\n`;
        markdown += `- 补贴金额: ${r.subsidy_amount || 0} 元\n`;
        markdown += `- 预计油耗: ${r.fuel_consumption || 0} L\n\n`;
      }
      
      if (risks.length > 0) {
        markdown += `### 风险评估\n\n`;
        risks.forEach(ris => {
          let statusIcon = ris.manual_override ? '🟡 [已改判]' : (ris.is_blocked ? '🔴 [拦截]' : '🟠 [警告]');
          let levelText = ris.risk_level === 'high' ? '高风险' : '中风险';
          markdown += `${statusIcon} **${levelText}**: ${ris.description}\n\n`;
          if (ris.override_reason) {
            markdown += `> 改判原因: ${ris.override_reason}\n\n`;
          }
        });
      }
      
      markdown += `---\n\n`;
    });
    
    markdown += `\n---\n\n`;
    markdown += `## 统计汇总\n\n`;
    markdown += `- 总派工单数量: ${reservations.length}\n`;
    markdown += `- 可放行: ${reservations.filter(r => {
      const risks = db.prepare('SELECT * FROM risk_assessments WHERE reservation_id = ?').all(r.id);
      const blockedRisks = risks.filter(ris => ris.is_blocked === 1 && ris.manual_override === 0);
      const hasOverrides = risks.some(ris => ris.manual_override === 1);
      return blockedRisks.length === 0 || hasOverrides;
    }).length}\n`;
    markdown += `- 被拦截: ${reservations.filter(r => {
      const risks = db.prepare('SELECT * FROM risk_assessments WHERE reservation_id = ?').all(r.id);
      const blockedRisks = risks.filter(ris => ris.is_blocked === 1 && ris.manual_override === 0);
      const hasOverrides = risks.some(ris => ris.manual_override === 1);
      return blockedRisks.length > 0 && !hasOverrides;
    }).length}\n\n`;
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=dispatch-notes-${moment().format('YYYYMMDD-HHmmss')}.md`);
    res.send(markdown);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-package', (req, res) => {
  const db = req.app.locals.db;
  try {
    const plots = db.prepare('SELECT * FROM plots').all();
    const machines = db.prepare('SELECT * FROM machines').all();
    const operators = db.prepare('SELECT * FROM operators').all();
    const reservations = db.prepare(`
      SELECT r.*,
             p.plot_name,
             p.farmer_name,
             p.area as plot_area,
             m.machine_name,
             o.operator_name
      FROM reservations r
      LEFT JOIN plots p ON r.plot_id = p.id
      LEFT JOIN machines m ON r.machine_id = m.id
      LEFT JOIN operators o ON r.operator_id = o.id
      ORDER BY r.start_time DESC
    `).all();
    const subsidies = db.prepare(`
      SELECT os.*,
             p.plot_name,
             p.farmer_name
      FROM oil_subsidies os
      LEFT JOIN plots p ON os.plot_id = p.id
    `).all();
    const riskAssessments = db.prepare(`
      SELECT ra.*,
             r.plot_id,
             p.plot_name
      FROM risk_assessments ra
      LEFT JOIN reservations r ON ra.reservation_id = r.id
      LEFT JOIN plots p ON r.plot_id = p.id
      ORDER BY ra.created_at DESC
    `).all();
    const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC').all();
    
    const auditPackage = {
      generated_at: moment().toISOString(),
      version: '1.0.0',
      summary: {
        total_plots: plots.length,
        total_machines: machines.length,
        total_operators: operators.length,
        total_reservations: reservations.length,
        total_subsidies: subsidies.length,
        total_risk_assessments: riskAssessments.length,
        blocked_reservations: riskAssessments.filter(r => r.is_blocked === 1 && r.manual_override === 0).length,
        overridden_risks: riskAssessments.filter(r => r.manual_override === 1).length
      },
      data: {
        plots,
        machines,
        operators,
        reservations,
        subsidies,
        risk_assessments: riskAssessments,
        audit_logs: auditLogs
      },
      risk_summary: {
        by_type: {},
        by_level: {},
        recent_activities: auditLogs.slice(0, 20)
      }
    };
    
    const riskTypeCounts = {};
    const riskLevelCounts = {};
    
    riskAssessments.forEach(r => {
      riskTypeCounts[r.risk_type] = (riskTypeCounts[r.risk_type] || 0) + 1;
      riskLevelCounts[r.risk_level] = (riskLevelCounts[r.risk_level] || 0) + 1;
    });
    
    auditPackage.risk_summary.by_type = riskTypeCounts;
    auditPackage.risk_summary.by_level = riskLevelCounts;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit-package-${moment().format('YYYYMMDD-HHmmss')}.json`);
    res.json(auditPackage);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/reservation/:id/dispatch-note', (req, res) => {
  const db = req.app.locals.db;
  const reservationId = req.params.id;
  
  try {
    const reservation = db.prepare(`
      SELECT r.*,
             p.plot_name,
             p.farmer_name,
             p.area as plot_area,
             p.location,
             p.crop_type,
             m.machine_name,
             m.machine_type,
             m.license_plate,
             m.last_maintenance,
             o.operator_name,
             o.phone,
             o.license_type,
             o.license_expiry,
             os.subsidy_amount,
             os.fuel_consumption
      FROM reservations r
      LEFT JOIN plots p ON r.plot_id = p.id
      LEFT JOIN machines m ON r.machine_id = m.id
      LEFT JOIN operators o ON r.operator_id = o.id
      LEFT JOIN oil_subsidies os ON r.id = os.reservation_id
      WHERE r.id = ?
    `).get(reservationId);
    
    if (!reservation) {
      return res.status(404).json({ error: '预约不存在' });
    }
    
    const risks = db.prepare(`
      SELECT * FROM risk_assessments WHERE reservation_id = ?
    `).all(reservationId);
    
    const blockedRisks = risks.filter(r => r.is_blocked === 1 && r.manual_override === 0);
    const hasOverrides = risks.some(r => r.manual_override === 1);
    
    let markdown = `# 作业派工单\n\n`;
    markdown += `生成时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n\n`;
    markdown += `---\n\n`;
    
    markdown += `## 基本信息\n\n`;
    markdown += `| 项目 | 内容 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 预约ID | ${reservation.id} |\n`;
    markdown += `| 作业状态 | ${blockedRisks.length > 0 && !hasOverrides ? '🔴 拦截' : (hasOverrides ? '🟡 放行(有改判)' : '🟢 正常')} |\n`;
    markdown += `| 作业类型 | ${reservation.work_type || '未填写'} |\n`;
    markdown += `| 开始时间 | ${reservation.start_time ? moment(reservation.start_time).format('YYYY-MM-DD HH:mm') : '未安排'} |\n`;
    markdown += `| 结束时间 | ${reservation.end_time ? moment(reservation.end_time).format('YYYY-MM-DD HH:mm') : '未安排'} |\n\n`;
    
    markdown += `## 农户与地块信息\n\n`;
    markdown += `- **农户姓名**: ${reservation.farmer_name || '未填写'}\n`;
    markdown += `- **地块名称**: ${reservation.plot_name || '未填写'}\n`;
    markdown += `- **地块面积**: ${reservation.plot_area || 0} 亩\n`;
    markdown += `- **位置**: ${reservation.location || '未填写'}\n`;
    markdown += `- **作物类型**: ${reservation.crop_type || '未填写'}\n\n`;
    
    markdown += `## 机具信息\n\n`;
    markdown += `- **机具名称**: ${reservation.machine_name || '未安排'}\n`;
    markdown += `- **机具类型**: ${reservation.machine_type || '未填写'}\n`;
    markdown += `- **车牌号**: ${reservation.license_plate || '未填写'}\n`;
    markdown += `- **上次保养日期**: ${reservation.last_maintenance || '未记录'}\n\n`;
    
    markdown += `## 机手信息\n\n`;
    markdown += `- **机手姓名**: ${reservation.operator_name || '未安排'}\n`;
    markdown += `- **联系电话**: ${reservation.phone || '未填写'}\n`;
    markdown += `- **驾驶证类型**: ${reservation.license_type || '未填写'}\n`;
    markdown += `- **驾驶证到期日期**: ${reservation.license_expiry || '未填写'}\n\n`;
    
    if (reservation.subsidy_amount !== undefined || reservation.fuel_consumption !== undefined) {
      markdown += `## 油料补贴信息\n\n`;
      markdown += `- **补贴金额**: ${reservation.subsidy_amount || 0} 元\n`;
      markdown += `- **预计油耗**: ${reservation.fuel_consumption || 0} L\n`;
      markdown += `- **单位补贴**: ${reservation.plot_area ? (reservation.subsidy_amount / reservation.plot_area).toFixed(2) : 0} 元/亩\n\n`;
    }
    
    if (risks.length > 0) {
      markdown += `## 风险评估详情\n\n`;
      
      risks.forEach((risk, index) => {
        let statusText = '';
        if (risk.manual_override) {
          statusText = '🟡 已手动改判';
        } else if (risk.is_blocked) {
          statusText = '🔴 拦截';
        } else {
          statusText = '🟠 警告';
        }
        
        markdown += `### 风险 #${index + 1} - ${statusText}\n\n`;
        markdown += `- **风险类型**: ${risk.risk_type}\n`;
        markdown += `- **风险等级**: ${risk.risk_level === 'high' ? '高风险' : '中风险'}\n`;
        markdown += `- **描述**: ${risk.description}\n`;
        
        if (risk.override_reason) {
          markdown += `- **改判原因**: ${risk.override_reason}\n`;
        }
        
        markdown += `\n`;
      });
    }
    
    markdown += `---\n\n`;
    markdown += `> 此派工单由农机合作社管理系统自动生成，仅供内部使用。\n`;
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=dispatch-note-${reservationId}-${moment().format('YYYYMMDD')}.md`);
    res.send(markdown);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
