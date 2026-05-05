const express = require('express');
const db = require('../database');
const moment = require('moment');

const router = express.Router();

const RISK_TYPE_NAMES = {
  frequent_stop: '频繁停梯',
  overload_false_alarm: '超载误报',
  long_unreset: '长期未复位',
  maintenance_timeout: '维保超时'
};

const RISK_LEVEL_NAMES = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低'
};

const STATUS_NAMES = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决'
};

async function generateHandoverReport(options = {}) {
  const {
    station_name,
    escalator_code,
    risk_type,
    risk_level,
    is_reopened,
    reporter = false
  } = options;

  let whereClause = '1=1';
  const params = [];

  if (station_name) {
    whereClause += ' AND e.station_name = ?';
    params.push(station_name);
  }

  if (escalator_code) {
    whereClause += ' AND r.escalator_code = ?';
    params.push(escalator_code);
  }

  if (risk_type) {
    whereClause += ' AND r.risk_type = ?';
    params.push(risk_type);
  }

  if (risk_level) {
    whereClause += ' AND r.risk_level = ?';
    params.push(risk_level);
  }

  if (is_reopened) {
    whereClause += ' AND r.is_reopened = 1';
  }

  whereClause += " AND r.status = 'pending'";

  const risks = await db.all(`
    SELECT r.*, e.station_name, e.location
    FROM risks r
    LEFT JOIN escalators e ON r.escalator_code = e.escalator_code
    WHERE ${whereClause}
    ORDER BY 
      CASE r.risk_level 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
        ELSE 5 
      END,
      r.detected_time DESC
  `, params);

  const statistics = await db.get(`
    SELECT 
      COUNT(*) as total_pending,
      SUM(CASE WHEN r.risk_level = 'critical' THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN r.risk_level = 'high' THEN 1 ELSE 0 END) as high_count,
      SUM(CASE WHEN r.risk_level = 'medium' THEN 1 ELSE 0 END) as medium_count,
      SUM(CASE WHEN r.risk_level = 'low' THEN 1 ELSE 0 END) as low_count,
      SUM(CASE WHEN r.is_reopened = 1 THEN 1 ELSE 0 END) as reopened_count
    FROM risks r
    LEFT JOIN escalators e ON r.escalator_code = e.escalator_code
    WHERE ${whereClause}
  `, params);

  const escalatorsWithRisks = await db.all(`
    SELECT DISTINCT e.station_name, r.escalator_code
    FROM risks r
    LEFT JOIN escalators e ON r.escalator_code = e.escalator_code
    WHERE ${whereClause}
    ORDER BY e.station_name, r.escalator_code
  `, params);

  return {
    reportTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    filterOptions: {
      station_name,
      escalator_code,
      risk_type,
      risk_level,
      is_reopened
    },
    statistics: {
      totalPending: statistics.total_pending || 0,
      byLevel: {
        critical: statistics.critical_count || 0,
        high: statistics.high_count || 0,
        medium: statistics.medium_count || 0,
        low: statistics.low_count || 0
      },
      reopenedCount: statistics.reopened_count || 0,
      escalatorsWithRisks: escalatorsWithRisks.length
    },
    escalatorsWithRisks,
    risks: risks.map(risk => ({
      ...risk,
      riskTypeName: RISK_TYPE_NAMES[risk.risk_type] || risk.risk_type,
      riskLevelName: RISK_LEVEL_NAMES[risk.risk_level] || risk.risk_level,
      statusName: STATUS_NAMES[risk.status] || risk.status
    }))
  };
}

function formatMarkdownReport(reportData) {
  const { reportTime, statistics, escalatorsWithRisks, risks, filterOptions } = reportData;

  let markdown = `# 地铁站自动扶梯停梯复盘交班单\n\n`;
  markdown += `**生成时间**: ${reportTime}\n\n`;

  if (filterOptions.station_name || filterOptions.escalator_code || filterOptions.risk_type || filterOptions.risk_level || filterOptions.is_reopened) {
    markdown += `## 筛选条件\n\n`;
    if (filterOptions.station_name) markdown += `- 站点: ${filterOptions.station_name}\n`;
    if (filterOptions.escalator_code) markdown += `- 扶梯编号: ${filterOptions.escalator_code}\n`;
    if (filterOptions.risk_type) markdown += `- 风险类型: ${RISK_TYPE_NAMES[filterOptions.risk_type] || filterOptions.risk_type}\n`;
    if (filterOptions.risk_level) markdown += `- 风险等级: ${RISK_LEVEL_NAMES[filterOptions.risk_level] || filterOptions.risk_level}\n`;
    if (filterOptions.is_reopened) markdown += `- 仅显示重启后仍存在的风险\n`;
    markdown += `\n`;
  }

  markdown += `## 风险统计概览\n\n`;
  markdown += `| 指标 | 数量 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| **待处理风险总数** | ${statistics.totalPending} |\n`;
  markdown += `| 严重风险 | ${statistics.byLevel.critical} |\n`;
  markdown += `| 高风险 | ${statistics.byLevel.high} |\n`;
  markdown += `| 中风险 | ${statistics.byLevel.medium} |\n`;
  markdown += `| 低风险 | ${statistics.byLevel.low} |\n`;
  markdown += `| 重启后仍存在 | ${statistics.reopenedCount} |\n`;
  markdown += `| 涉及扶梯数量 | ${statistics.escalatorsWithRisks} |\n\n`;

  if (escalatorsWithRisks.length > 0) {
    markdown += `## 涉及扶梯列表\n\n`;
    markdown += `| 站点 | 扶梯编号 |\n`;
    markdown += `|------|----------|\n`;
    escalatorsWithRisks.forEach(item => {
      markdown += `| ${item.station_name || '未知'} | ${item.escalator_code} |\n`;
    });
    markdown += `\n`;
  }

  if (risks.length > 0) {
    markdown += `## 风险明细\n\n`;
    
    const groupedByEscalator = {};
    risks.forEach(risk => {
      if (!groupedByEscalator[risk.escalator_code]) {
        groupedByEscalator[risk.escalator_code] = [];
      }
      groupedByEscalator[risk.escalator_code].push(risk);
    });

    Object.keys(groupedByEscalator).forEach(escalatorCode => {
      const escalatorRisks = groupedByEscalator[escalatorCode];
      const firstRisk = escalatorRisks[0];
      
      markdown += `### ${firstRisk.station_name || '未知站点'} - ${escalatorCode}\n\n`;
      if (firstRisk.location) {
        markdown += `**位置**: ${firstRisk.location}\n\n`;
      }

      escalatorRisks.forEach((risk, index) => {
        markdown += `#### 风险 ${index + 1}: ${risk.riskTypeName}\n\n`;
        markdown += `- **风险等级**: ${risk.riskLevelName}\n`;
        markdown += `- **检测时间**: ${risk.detected_time}\n`;
        markdown += `- **描述**: ${risk.description}\n`;
        
        if (risk.is_reopened) {
          markdown += `- **状态**: ⚠️ 重启后仍存在 (已重启 ${risk.reopened_count} 次)\n`;
          if (risk.last_reopened_time) {
            markdown += `- **最后重启时间**: ${risk.last_reopened_time}\n`;
          }
        }

        if (risk.manual_judgment) {
          markdown += `- **人工判改**: ${risk.manual_judgment}\n`;
        }
        if (risk.manual_remarks) {
          markdown += `- **人工备注**: ${risk.manual_remarks}\n`;
        }

        if (risk.related_records) {
          try {
            const relatedRecords = JSON.parse(risk.related_records);
            if (relatedRecords.stopCount !== undefined) {
              markdown += `- **停梯次数**: ${relatedRecords.stopCount} 次\n`;
            }
            if (relatedRecords.falseAlarmCount !== undefined) {
              markdown += `- **疑似误报次数**: ${relatedRecords.falseAlarmCount} 次\n`;
            }
            if (relatedRecords.unresetCount !== undefined) {
              markdown += `- **未复位项数**: ${relatedRecords.unresetCount} 项\n`;
            }
            if (relatedRecords.timeoutCount !== undefined) {
              markdown += `- **超时项数**: ${relatedRecords.timeoutCount} 项\n`;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }

        markdown += `\n`;
      });
    });
  }

  markdown += `---\n\n`;
  markdown += `*本交班单由自动扶梯停梯复盘系统自动生成*\n`;

  return markdown;
}

router.get('/handover-report/markdown', async (req, res) => {
  try {
    const {
      station_name,
      escalator_code,
      risk_type,
      risk_level,
      is_reopened
    } = req.query;

    const reportData = await generateHandoverReport({
      station_name,
      escalator_code,
      risk_type,
      risk_level,
      is_reopened: is_reopened === 'true'
    });

    const markdown = formatMarkdownReport(reportData);

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=handover-report-${moment().format('YYYYMMDDHHmmss')}.md`);
    res.send(markdown);
  } catch (error) {
    console.error('生成 Markdown 交班单失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/handover-report/json', async (req, res) => {
  try {
    const {
      station_name,
      escalator_code,
      risk_type,
      risk_level,
      is_reopened
    } = req.query;

    const reportData = await generateHandoverReport({
      station_name,
      escalator_code,
      risk_type,
      risk_level,
      is_reopened: is_reopened === 'true'
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=handover-report-${moment().format('YYYYMMDDHHmmss')}.json`);
    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    console.error('生成 JSON 明细失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/escalator-detail/json/:escalator_code', async (req, res) => {
  try {
    const { escalator_code } = req.params;

    const escalator = await db.get(`
      SELECT * FROM escalators WHERE escalator_code = ?
    `, [escalator_code]);

    if (!escalator) {
      return res.status(404).json({ success: false, error: '扶梯不存在' });
    }

    const inspections = await db.all(`
      SELECT * FROM inspections 
      WHERE escalator_code = ? 
      ORDER BY inspection_date DESC
      LIMIT 20
    `, [escalator_code]);

    const currentLogs = await db.all(`
      SELECT * FROM current_logs 
      WHERE escalator_code = ? 
      ORDER BY log_time DESC
      LIMIT 100
    `, [escalator_code]);

    const repairRecords = await db.all(`
      SELECT * FROM repair_records 
      WHERE escalator_code = ? 
      ORDER BY report_time DESC
      LIMIT 50
    `, [escalator_code]);

    const maintenanceRecords = await db.all(`
      SELECT * FROM maintenance_records 
      WHERE escalator_code = ? 
      ORDER BY call_time DESC
      LIMIT 50
    `, [escalator_code]);

    const risks = await db.all(`
      SELECT * FROM risks 
      WHERE escalator_code = ? 
      ORDER BY 
        CASE risk_level 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END,
        detected_time DESC
    `, [escalator_code]);

    const detailData = {
      exportTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      escalator: {
        ...escalator,
        riskTypeName: RISK_TYPE_NAMES,
        riskLevelName: RISK_LEVEL_NAMES,
        statusName: STATUS_NAMES
      },
      inspections: inspections.map(i => ({
        ...i
      })),
      currentLogs: currentLogs.map(c => ({
        ...c,
        statusName: c.status === 'normal' ? '正常' : '超载'
      })),
      repairRecords: repairRecords.map(r => ({
        ...r,
        handleStatusName: STATUS_NAMES[r.handle_status] || r.handle_status,
        isFalseAlarmName: r.is_false_alarm ? '是' : '否'
      })),
      maintenanceRecords: maintenanceRecords.map(m => ({
        ...m,
        isResolvedName: m.is_resolved ? '已解决' : '未解决'
      })),
      risks: risks.map(r => ({
        ...r,
        riskTypeName: RISK_TYPE_NAMES[r.risk_type] || r.risk_type,
        riskLevelName: RISK_LEVEL_NAMES[r.risk_level] || r.risk_level,
        statusName: STATUS_NAMES[r.status] || r.status
      })),
      statistics: {
        inspectionCount: inspections.length,
        currentLogCount: currentLogs.length,
        repairCount: repairRecords.length,
        maintenanceCount: maintenanceRecords.length,
        riskCount: risks.length,
        pendingRiskCount: risks.filter(r => r.status === 'pending').length,
        overloadCount: currentLogs.filter(c => c.is_overload === 1).length
      }
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=escalator-${escalator_code}-detail-${moment().format('YYYYMMDDHHmmss')}.json`);
    res.json({
      success: true,
      data: detailData
    });
  } catch (error) {
    console.error('生成扶梯明细 JSON 失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
