const express = require('express');
const router = express.Router();
const db = require('../database');
const { format } = require('date-fns');

router.get('/markdown', (req, res) => {
  const { deck, priority } = req.query;
  
  const query = `
    SELECT ca.*, c.deck, c.type as cabin_type
    FROM cabin_analysis ca
    LEFT JOIN cabins c ON ca.cabin_number = c.cabin_number
    WHERE ca.maintenance_status != '无需维修'
    AND ca.maintenance_status != '误报排除'
    ${deck ? ' AND c.deck = ?' : ''}
    ${priority ? ' AND ca.maintenance_priority = ?' : ''}
    ORDER BY 
      CASE ca.maintenance_priority
        WHEN '高' THEN 1
        WHEN '中' THEN 2
        WHEN '低' THEN 3
        ELSE 4
      END,
      c.deck, ca.cabin_number
  `;
  
  const params = [];
  if (deck) params.push(deck);
  if (priority) params.push(priority);
  
  db.all(query, params, async (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    try {
      const markdown = generateMaintenanceReport(rows, deck, priority);
      
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=maintenance-report-${format(new Date(), 'yyyyMMdd')}.md`);
      res.send(markdown);
    } catch (error) {
      console.error('生成Markdown报告失败:', error);
      res.status(500).json({ error: '生成报告失败: ' + error.message });
    }
  });
});

function generateMaintenanceReport(maintenanceItems, deck, priority) {
  const today = format(new Date(), 'yyyy年MM月dd日');
  const currentTime = format(new Date(), 'HH:mm');
  
  let markdown = `# 邮轮客舱维修交班单\n\n`;
  markdown += `**生成日期**: ${today} ${currentTime}\n\n`;
  
  if (deck) {
    markdown += `**筛选甲板**: ${deck}层\n\n`;
  }
  
  if (priority) {
    markdown += `**筛选优先级**: ${priority}\n\n`;
  }
  
  markdown += `---\n\n`;
  
  const highPriority = maintenanceItems.filter(item => item.maintenance_priority === '高');
  const mediumPriority = maintenanceItems.filter(item => item.maintenance_priority === '中');
  const lowPriority = maintenanceItems.filter(item => item.maintenance_priority === '低');
  
  markdown += `## 统计概览\n\n`;
  markdown += `| 优先级 | 数量 |\n`;
  markdown += `|--------|------|\n`;
  markdown += `| 高优先级 | ${highPriority.length} |\n`;
  markdown += `| 中优先级 | ${mediumPriority.length} |\n`;
  markdown += `| 低优先级 | ${lowPriority.length} |\n`;
  markdown += `| **总计** | **${maintenanceItems.length}** |\n\n`;
  
  if (highPriority.length > 0) {
    markdown += `---\n\n`;
    markdown += `## 高优先级维修任务 (${highPriority.length})\n\n`;
    markdown += `> ⚠️ **紧急处理**: 这些舱房需要立即检修，可能影响乘客体验或存在安全隐患\n\n`;
    
    highPriority.forEach((item, index) => {
      markdown += `### ${index + 1}. 舱房 ${item.cabin_number} (${item.deck}层)\n\n`;
      markdown += `- **维修状态**: ${item.maintenance_status}\n`;
      markdown += `- **风险等级**: ${item.risk_level}\n`;
      markdown += `- **风险分数**: ${item.risk_score}\n`;
      
      if (item.analysis_reason) {
        markdown += `- **分析原因**: ${item.analysis_reason}\n`;
      }
      
      if (item.evidence) {
        try {
          const evidence = typeof item.evidence === 'string' ? JSON.parse(item.evidence) : item.evidence;
          if (evidence.length > 0) {
            markdown += `\n**风险证据**:\n`;
            evidence.forEach(e => {
              markdown += `- ${e.description || e.type}\n`;
            });
          }
        } catch (e) {}
      }
      
      if (item.notes) {
        markdown += `\n**备注**: ${item.notes}\n`;
      }
      
      if (item.manual_override) {
        markdown += `\n> ⚠️ **人工改判**: 此状态已由工程人员手动确认\n`;
        if (item.override_reason) {
          markdown += `> 改判原因: ${item.override_reason}\n`;
        }
      }
      
      markdown += `\n---\n\n`;
    });
  }
  
  if (mediumPriority.length > 0) {
    markdown += `## 中优先级维修任务 (${mediumPriority.length})\n\n`;
    markdown += `> 📋 **计划处理**: 这些舱房需要在当天内安排检修\n\n`;
    
    mediumPriority.forEach((item, index) => {
      markdown += `### ${index + 1}. 舱房 ${item.cabin_number} (${item.deck}层)\n\n`;
      markdown += `- **维修状态**: ${item.maintenance_status}\n`;
      markdown += `- **风险等级**: ${item.risk_level}\n`;
      markdown += `- **风险分数**: ${item.risk_score}\n`;
      
      if (item.analysis_reason) {
        markdown += `- **分析原因**: ${item.analysis_reason}\n`;
      }
      
      if (item.notes) {
        markdown += `\n**备注**: ${item.notes}\n`;
      }
      
      markdown += `\n---\n\n`;
    });
  }
  
  if (lowPriority.length > 0) {
    markdown += `## 低优先级维修任务 (${lowPriority.length})\n\n`;
    markdown += `> 📝 **建议检查**: 这些舱房建议在方便时检查，或纳入定期维护计划\n\n`;
    
    lowPriority.forEach((item, index) => {
      markdown += `### ${index + 1}. 舱房 ${item.cabin_number} (${item.deck}层)\n\n`;
      markdown += `- **维修状态**: ${item.maintenance_status}\n`;
      markdown += `- **风险等级**: ${item.risk_level}\n`;
      markdown += `- **风险分数**: ${item.risk_score}\n`;
      
      if (item.analysis_reason) {
        markdown += `- **分析原因**: ${item.analysis_reason}\n`;
      }
      
      if (item.notes) {
        markdown += `\n**备注**: ${item.notes}\n`;
      }
      
      markdown += `\n---\n\n`;
    });
  }
  
  markdown += `\n## 交班记录\n\n`;
  markdown += `| 项目 | 内容 |\n`;
  markdown += `|------|------|\n`;
  markdown += `| 交班人 | ________________ |\n`;
  markdown += `| 接班人 | ________________ |\n`;
  markdown += `| 交班时间 | ________________ |\n`;
  markdown += `| 特殊说明 | ________________ |\n\n`;
  
  markdown += `---\n\n`;
  markdown += `*此报告由邮轮客舱维护工具自动生成*\n`;
  markdown += `*生成时间: ${today} ${currentTime}*\n`;
  
  return markdown;
}

router.get('/json', (req, res) => {
  const { deck, risk_level, maintenance_status, cabin_number } = req.query;
  
  let query = `
    SELECT ca.*, c.deck, c.type as cabin_type,
           (SELECT json_group_array(json_object(
             'id', s.id,
             'timestamp', s.timestamp,
             'temperature', s.temperature,
             'humidity', s.humidity
           )) FROM sensor_data s WHERE s.cabin_number = ca.cabin_number ORDER BY s.timestamp DESC LIMIT 10) as recent_sensor_data,
           (SELECT json_group_array(json_object(
             'id', a.id,
             'alarm_type', a.alarm_type,
             'alarm_time', a.alarm_time,
             'alarm_level', a.alarm_level,
             'status', a.status
           )) FROM alarm_data a WHERE a.cabin_number = ca.cabin_number ORDER BY a.alarm_time DESC LIMIT 5) as recent_alarms,
           (SELECT json_group_array(json_object(
             'id', i.id,
             'inspection_date', i.inspection_date,
             'inspector', i.inspector,
             'fan_coil_status', i.fan_coil_status,
             'filter_status', i.filter_status
           )) FROM inspection_data i WHERE i.cabin_number = ca.cabin_number ORDER BY i.inspection_date DESC LIMIT 3) as recent_inspections,
           (SELECT json_group_array(json_object(
             'id', cm.id,
             'complaint_time', cm.complaint_time,
             'type', cm.type,
             'status', cm.status,
             'description', cm.description
           )) FROM complaints cm WHERE cm.cabin_number = ca.cabin_number ORDER BY cm.complaint_time DESC LIMIT 5) as recent_complaints
    FROM cabin_analysis ca
    LEFT JOIN cabins c ON ca.cabin_number = c.cabin_number
    WHERE 1=1
  `;
  
  const params = [];
  
  if (deck) {
    query += ' AND c.deck = ?';
    params.push(deck);
  }
  
  if (risk_level) {
    query += ' AND ca.risk_level = ?';
    params.push(risk_level);
  }
  
  if (maintenance_status) {
    query += ' AND ca.maintenance_status = ?';
    params.push(maintenance_status);
  }
  
  if (cabin_number) {
    query += ' AND ca.cabin_number LIKE ?';
    params.push(`%${cabin_number}%`);
  }
  
  query += ' ORDER BY ca.risk_score DESC, c.deck, ca.cabin_number';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const processedRows = rows.map(row => {
      const processed = { ...row };
      
      if (processed.evidence) {
        try {
          processed.evidence = typeof processed.evidence === 'string' 
            ? JSON.parse(processed.evidence) 
            : processed.evidence;
        } catch (e) {
          processed.evidence = [];
        }
      }
      
      if (processed.recent_sensor_data) {
        try {
          processed.recent_sensor_data = typeof processed.recent_sensor_data === 'string'
            ? JSON.parse(processed.recent_sensor_data)
            : processed.recent_sensor_data;
        } catch (e) {
          processed.recent_sensor_data = [];
        }
      }
      
      if (processed.recent_alarms) {
        try {
          processed.recent_alarms = typeof processed.recent_alarms === 'string'
            ? JSON.parse(processed.recent_alarms)
            : processed.recent_alarms;
        } catch (e) {
          processed.recent_alarms = [];
        }
      }
      
      if (processed.recent_inspections) {
        try {
          processed.recent_inspections = typeof processed.recent_inspections === 'string'
            ? JSON.parse(processed.recent_inspections)
            : processed.recent_inspections;
        } catch (e) {
          processed.recent_inspections = [];
        }
      }
      
      if (processed.recent_complaints) {
        try {
          processed.recent_complaints = typeof processed.recent_complaints === 'string'
            ? JSON.parse(processed.recent_complaints)
            : processed.recent_complaints;
        } catch (e) {
          processed.recent_complaints = [];
        }
      }
      
      return processed;
    });
    
    const exportData = {
      metadata: {
        export_time: new Date().toISOString(),
        export_date: format(new Date(), 'yyyy-MM-dd'),
        filter: {
          deck: deck || null,
          risk_level: risk_level || null,
          maintenance_status: maintenance_status || null,
          cabin_number: cabin_number || null
        },
        total_count: processedRows.length
      },
      data: processedRows
    };
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=cabin-analysis-${format(new Date(), 'yyyyMMdd')}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  });
});

router.get('/:cabinNumber/json', (req, res) => {
  const { cabinNumber } = req.params;
  
  const query = `
    SELECT ca.*, c.deck, c.type as cabin_type,
           (SELECT json_group_array(json_object(
             'id', s.id,
             'timestamp', s.timestamp,
             'temperature', s.temperature,
             'humidity', s.humidity
           )) FROM sensor_data s WHERE s.cabin_number = ca.cabin_number ORDER BY s.timestamp DESC) as all_sensor_data,
           (SELECT json_group_array(json_object(
             'id', a.id,
             'alarm_type', a.alarm_type,
             'alarm_time', a.alarm_time,
             'alarm_level', a.alarm_level,
             'description', a.description,
             'status', a.status
           )) FROM alarm_data a WHERE a.cabin_number = ca.cabin_number ORDER BY a.alarm_time DESC) as all_alarms,
           (SELECT json_group_array(json_object(
             'id', i.id,
             'inspection_date', i.inspection_date,
             'inspector', i.inspector,
             'fan_coil_status', i.fan_coil_status,
             'filter_status', i.filter_status,
             'condensate_pipe_status', i.condensate_pipe_status,
             'temperature_setpoint', i.temperature_setpoint,
             'actual_temperature', i.actual_temperature,
             'actual_humidity', i.actual_humidity,
             'notes', i.notes
           )) FROM inspection_data i WHERE i.cabin_number = ca.cabin_number ORDER BY i.inspection_date DESC) as all_inspections,
           (SELECT json_group_array(json_object(
             'id', cm.id,
             'complaint_time', cm.complaint_time,
             'complainant', cm.complainant,
             'type', cm.type,
             'description', cm.description,
             'status', cm.status,
             'priority', cm.priority,
             'assigned_to', cm.assigned_to,
             'resolution', cm.resolution,
             'resolved_at', cm.resolved_at
           )) FROM complaints cm WHERE cm.cabin_number = ca.cabin_number ORDER BY cm.complaint_time DESC) as all_complaints
    FROM cabin_analysis ca
    LEFT JOIN cabins c ON ca.cabin_number = c.cabin_number
    WHERE ca.cabin_number = ?
  `;
  
  db.get(query, [cabinNumber], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: '舱房数据不存在' });
      return;
    }
    
    const processed = { ...row };
    
    if (processed.evidence) {
      try {
        processed.evidence = typeof processed.evidence === 'string' 
          ? JSON.parse(processed.evidence) 
          : processed.evidence;
      } catch (e) {
        processed.evidence = [];
      }
    }
    
    const jsonFields = ['all_sensor_data', 'all_alarms', 'all_inspections', 'all_complaints'];
    jsonFields.forEach(field => {
      if (processed[field]) {
        try {
          processed[field] = typeof processed[field] === 'string'
            ? JSON.parse(processed[field])
            : processed[field];
        } catch (e) {
          processed[field] = [];
        }
      }
    });
    
    const exportData = {
      metadata: {
        export_time: new Date().toISOString(),
        cabin_number: cabinNumber
      },
      data: processed
    };
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=cabin-${cabinNumber}-details.json`);
    res.send(JSON.stringify(exportData, null, 2));
  });
});

module.exports = router;
