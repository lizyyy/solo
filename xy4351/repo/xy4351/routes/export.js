const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

function getBatchDetails(batchId, callback) {
  db.get(`
    SELECT sb.*,
           ns.scientific_name, ns.common_name, ns.native_status,
           ns.moisture_threshold, ns.germination_threshold,
           cs.site_code, cs.site_name, cs.location as site_location,
           cs.latitude, cs.longitude, cs.habitat,
           v.name as volunteer_name, v.role as volunteer_role,
           ss.slot_code, ss.row_number, ss.column_number,
           ss.max_capacity, ss.current_usage,
           cst.cabinet_code, cst.cabinet_name, cst.location as cabinet_location,
           cst.temperature as cabinet_temperature, cst.humidity as cabinet_humidity
    FROM seed_batches sb
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    LEFT JOIN collection_sites cs ON sb.collection_site_id = cs.id
    LEFT JOIN volunteers v ON sb.volunteer_id = v.id
    LEFT JOIN storage_slots ss ON sb.storage_slot_id = ss.id
    LEFT JOIN cold_storages cst ON ss.cold_storage_id = cst.id
    WHERE sb.id = ?
  `, [batchId], (err, batch) => {
    if (err) return callback(err, null);
    if (!batch) return callback(null, null);
    
    db.all(`
      SELECT * FROM germination_tests
      WHERE seed_batch_id = ?
      ORDER BY test_date DESC
    `, [batchId], (err, tests) => {
      if (err) return callback(err, null);
      
      db.all(`
        SELECT se.*
        FROM seed_exchanges se
        WHERE se.seed_batch_id = ?
        ORDER BY se.request_date DESC
      `, [batchId], (err, exchanges) => {
        if (err) return callback(err, null);
        
        db.all(`
          SELECT al.*
          FROM audit_logs al
          WHERE al.batch_id = ?
          ORDER BY al.timestamp DESC
        `, [batchId], (err, auditLogs) => {
          if (err) return callback(err, null);
          
          let assessmentDetails = [];
          try {
            assessmentDetails = batch.assessment_details ? JSON.parse(batch.assessment_details) : [];
          } catch (e) {
            assessmentDetails = [];
          }
          
          callback(null, {
            batch,
            germinationTests: tests,
            exchanges,
            auditLogs,
            assessmentDetails
          });
        });
      });
    });
  });
}

router.get('/markdown/:batchId', (req, res) => {
  const batchId = req.params.batchId;
  
  getBatchDetails(batchId, (err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!data) {
      return res.status(404).json({ error: '种子批次不存在' });
    }
    
    const { batch, germinationTests, exchanges, auditLogs, assessmentDetails } = data;
    
    let markdown = `# 乡土植物种子保育交接单\n\n`;
    
    markdown += `## 基本信息\n\n`;
    markdown += `| 项目 | 内容 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 批次编号 | ${batch.batch_number} |\n`;
    markdown += `| 物种名称 | ${batch.common_name} (${batch.scientific_name}) |\n`;
    markdown += `| 乡土种状态 | ${batch.native_status} |\n`;
    markdown += `| 采集日期 | ${batch.collection_date || '-'} |\n`;
    markdown += `| 采集地点 | ${batch.site_name || '-'} (${batch.site_code || '-'}) |\n`;
    markdown += `| 采集地点坐标 | ${batch.latitude ? `${batch.latitude}°N, ${batch.longitude}°E` : '-'} |\n`;
    markdown += `| 生境类型 | ${batch.habitat || '-'} |\n`;
    markdown += `| 采集志愿者 | ${batch.volunteer_name || '-'} |\n`;
    markdown += `| 入库状态 | ${batch.status} |\n`;
    markdown += `| 批次评估 | ${batch.batch_assessment || '-'} |\n`;
    
    if (batch.manual_override) {
      markdown += `| 人工改判 | 是 |\n`;
      markdown += `| 改判原因 | ${batch.override_reason || '-'} |\n`;
      markdown += `| 改判人 | ${batch.override_by || '-'} |\n`;
    }
    
    markdown += `\n`;
    
    markdown += `## 种子质量指标\n\n`;
    markdown += `| 指标 | 实测值 | 阈值 | 状态 |\n`;
    markdown += `|------|--------|------|------|\n`;
    
    const moistureStatus = batch.moisture_content !== null 
      ? (batch.moisture_content > (batch.moisture_threshold || 8.0) ? '❌ 超标' : '✅ 合格') 
      : '-';
    const germinationStatus = batch.initial_germination_rate !== null
      ? (batch.initial_germination_rate < (batch.germination_threshold || 50.0) ? '⚠️ 偏低' : '✅ 合格')
      : '-';
    
    markdown += `| 含水率 | ${batch.moisture_content !== null ? `${batch.moisture_content}%` : '-'} | ${batch.moisture_threshold || 8.0}% | ${moistureStatus} |\n`;
    markdown += `| 萌发率 | ${batch.initial_germination_rate !== null ? `${batch.initial_germination_rate}%` : '-'} | ${batch.germination_threshold || 50.0}% | ${germinationStatus} |\n`;
    markdown += `| 种子数量 | ${batch.quantity_grams || 0}g | - | - |\n`;
    markdown += `\n`;
    
    if (batch.cabinet_code) {
      markdown += `## 冷藏存储信息\n\n`;
      markdown += `| 项目 | 内容 |\n`;
      markdown += `|------|------|\n`;
      markdown += `| 冷藏柜编号 | ${batch.cabinet_code} |\n`;
      markdown += `| 冷藏柜名称 | ${batch.cabinet_name || '-'} |\n`;
      markdown += `| 冷藏柜位置 | ${batch.cabinet_location || '-'} |\n`;
      markdown += `| 冷藏温度 | ${batch.cabinet_temperature !== null ? `${batch.cabinet_temperature}°C` : '-'} |\n`;
      markdown += `| 冷藏湿度 | ${batch.cabinet_humidity !== null ? `${batch.cabinet_humidity}%` : '-'} |\n`;
      markdown += `| 格位编号 | ${batch.slot_code || '-'} |\n`;
      markdown += `| 格位位置 | 第${batch.row_number || '-'}行 第${batch.column_number || '-'}列 |\n`;
      markdown += `| 格位使用情况 | ${batch.current_usage || 0}/${batch.max_capacity || '-'} |\n`;
      markdown += `\n`;
    }
    
    if (germinationTests && germinationTests.length > 0) {
      markdown += `## 萌发测试记录\n\n`;
      germinationTests.forEach((test, index) => {
        const testRate = test.seeds_planted > 0 ? (test.seeds_germinated / test.seeds_planted * 100).toFixed(1) : 0;
        markdown += `### 测试 ${index + 1}\n\n`;
        markdown += `- **测试日期**: ${test.test_date}\n`;
        markdown += `- **测试人**: ${test.tested_by || '-'}\n`;
        markdown += `- **播种数量**: ${test.seeds_planted} 粒\n`;
        markdown += `- **萌发数量**: ${test.seeds_germinated} 粒\n`;
        markdown += `- **萌发率**: ${testRate}%\n`;
        if (test.duration_days) {
          markdown += `- **测试时长**: ${test.duration_days} 天\n`;
        }
        if (test.test_conditions) {
          markdown += `- **测试条件**: ${test.test_conditions}\n`;
        }
        if (test.notes) {
          markdown += `- **备注**: ${test.notes}\n`;
        }
        markdown += `\n`;
      });
    }
    
    if (exchanges && exchanges.length > 0) {
      markdown += `## 换种记录\n\n`;
      markdown += `| 申请编号 | 类型 | 数量(g) | 申请人 | 申请日期 | 状态 |\n`;
      markdown += `|----------|------|---------|--------|----------|------|\n`;
      exchanges.forEach(exchange => {
        markdown += `| ${exchange.exchange_number} | ${exchange.exchange_type} | ${exchange.quantity_grams} | ${exchange.requestor} | ${exchange.request_date} | ${exchange.status} |\n`;
      });
      markdown += `\n`;
    }
    
    if (assessmentDetails && assessmentDetails.length > 0) {
      markdown += `## 风险评估详情\n\n`;
      assessmentDetails.forEach((detail, index) => {
        markdown += `${index + 1}. ${detail}\n`;
      });
      markdown += `\n`;
    }
    
    if (batch.notes) {
      markdown += `## 备注\n\n`;
      markdown += `${batch.notes}\n\n`;
    }
    
    if (auditLogs && auditLogs.length > 0) {
      markdown += `## 操作日志\n\n`;
      auditLogs.slice(0, 10).forEach(log => {
        const time = moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss');
        markdown += `- **${time}** - ${log.actor}: ${log.action}\n`;
        if (log.assessment) {
          markdown += `  - 评估: ${log.assessment}\n`;
        }
      });
      if (auditLogs.length > 10) {
        markdown += `- ... 还有 ${auditLogs.length - 10} 条记录\n`;
      }
      markdown += `\n`;
    }
    
    markdown += `---\n\n`;
    markdown += `**生成时间**: ${moment().format('YYYY-MM-DD HH:mm:ss')}\n`;
    markdown += `**交接单版本**: 1.0\n`;
    markdown += `**批次创建时间**: ${batch.created_at || '-'}\n`;
    markdown += `**最后更新**: ${batch.updated_at || '-'}\n`;
    
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const filename = `seed-conservation-${batch.batch_number}-${moment().format('YYYYMMDDHHmmss')}.md`;
    const filepath = path.join(exportDir, filename);
    
    fs.writeFile(filepath, markdown, 'utf8', (err) => {
      if (err) {
        return res.status(500).json({ error: '文件写入失败' });
      }
      
      res.json({
        message: 'Markdown 保育交接单生成成功',
        filename: filename,
        filepath: filepath,
        content: markdown
      });
    });
  });
});

router.get('/audit/:batchId', (req, res) => {
  const batchId = req.params.batchId;
  
  getBatchDetails(batchId, (err, data) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!data) {
      return res.status(404).json({ error: '种子批次不存在' });
    }
    
    const { batch, germinationTests, exchanges, auditLogs, assessmentDetails } = data;
    
    const parseJson = (str) => {
      try {
        return str ? JSON.parse(str) : null;
      } catch (e) {
        return str;
      }
    };
    
    const auditPackage = {
      version: '1.0',
      generated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
      batch_summary: {
        id: batch.id,
        batch_number: batch.batch_number,
        status: batch.status,
        batch_assessment: batch.batch_assessment,
        created_at: batch.created_at,
        updated_at: batch.updated_at
      },
      species_info: {
        id: batch.species_id,
        scientific_name: batch.scientific_name,
        common_name: batch.common_name,
        native_status: batch.native_status,
        moisture_threshold: batch.moisture_threshold || 8.0,
        germination_threshold: batch.germination_threshold || 50.0
      },
      collection_info: {
        site_code: batch.site_code,
        site_name: batch.site_name,
        location: batch.site_location,
        latitude: batch.latitude,
        longitude: batch.longitude,
        habitat: batch.habitat,
        collection_date: batch.collection_date,
        volunteer: batch.volunteer_name ? {
          name: batch.volunteer_name,
          role: batch.volunteer_role
        } : null
      },
      seed_quality: {
        quantity_grams: batch.quantity_grams,
        moisture_content: batch.moisture_content,
        initial_germination_rate: batch.initial_germination_rate,
        moisture_status: batch.moisture_content !== null 
          ? (batch.moisture_content > (batch.moisture_threshold || 8.0) ? '超标' : '合格') 
          : null,
        germination_status: batch.initial_germination_rate !== null
          ? (batch.initial_germination_rate < (batch.germination_threshold || 50.0) ? '偏低' : '合格')
          : null
      },
      storage_info: batch.cabinet_code ? {
        cabinet_code: batch.cabinet_code,
        cabinet_name: batch.cabinet_name,
        cabinet_location: batch.cabinet_location,
        temperature: batch.cabinet_temperature,
        humidity: batch.cabinet_humidity,
        slot_code: batch.slot_code,
        slot_position: batch.row_number && batch.column_number 
          ? `第${batch.row_number}行第${batch.column_number}列` 
          : null,
        slot_usage: {
          current: batch.current_usage,
          max: batch.max_capacity
        }
      } : null,
      germination_tests: germinationTests.map(t => ({
        id: t.id,
        test_date: t.test_date,
        tested_by: t.tested_by,
        seeds_planted: t.seeds_planted,
        seeds_germinated: t.seeds_germinated,
        germination_rate: t.germination_rate,
        duration_days: t.duration_days,
        test_conditions: t.test_conditions,
        notes: t.notes
      })),
      exchanges: exchanges.map(e => ({
        id: e.id,
        exchange_number: e.exchange_number,
        exchange_type: e.exchange_type,
        quantity_grams: e.quantity_grams,
        requestor: e.requestor,
        request_date: e.request_date,
        purpose: e.purpose,
        status: e.status,
        approved_by: e.approved_by,
        approval_date: e.approval_date,
        exchange_date: e.exchange_date,
        assessment_before: e.assessment_before
      })),
      risk_analysis: {
        current_assessment: batch.batch_assessment,
        manual_override: batch.manual_override ? true : false,
        override_reason: batch.override_reason,
        override_by: batch.override_by,
        risk_details: assessmentDetails
      },
      audit_trail: auditLogs.map(log => ({
        id: log.id,
        action: log.action,
        actor: log.actor,
        details: parseJson(log.details),
        assessment: log.assessment,
        assessment_details: parseJson(log.assessment_details),
        timestamp: log.timestamp
      }))
    };
    
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const filename = `audit-package-${batch.batch_number}-${moment().format('YYYYMMDDHHmmss')}.json`;
    const filepath = path.join(exportDir, filename);
    
    fs.writeFile(filepath, JSON.stringify(auditPackage, null, 2), 'utf8', (err) => {
      if (err) {
        return res.status(500).json({ error: '文件写入失败' });
      }
      
      res.json({
        message: 'JSON 审计包生成成功',
        filename: filename,
        filepath: filepath,
        content: auditPackage
      });
    });
  });
});

router.get('/all-batches', (req, res) => {
  db.all(`
    SELECT sb.*,
           ns.common_name, ns.scientific_name, ns.native_status,
           cs.site_name,
           v.name as volunteer_name,
           ss.slot_code,
           cst.cabinet_code
    FROM seed_batches sb
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    LEFT JOIN collection_sites cs ON sb.collection_site_id = cs.id
    LEFT JOIN volunteers v ON sb.volunteer_id = v.id
    LEFT JOIN storage_slots ss ON sb.storage_slot_id = ss.id
    LEFT JOIN cold_storages cst ON ss.cold_storage_id = cst.id
    ORDER BY sb.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const summary = {
      generated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
      total_batches: rows.length,
      status_summary: {
        pending: rows.filter(r => r.status === '待入库').length,
        to_confirm: rows.filter(r => r.status === '待确认').length,
        to_review: rows.filter(r => r.status === '待复核').length,
        in_storage: rows.filter(r => r.status === '已入库').length,
        out_storage: rows.filter(r => r.status === '已出库').length
      },
      assessment_summary: {
        normal: rows.filter(r => r.batch_assessment === '正常').length,
        medium: rows.filter(r => r.batch_assessment === '中风险').length,
        high: rows.filter(r => r.batch_assessment === '高风险').length
      },
      native_status_summary: {
        native: rows.filter(r => r.native_status === '乡土种').length,
        alien: rows.filter(r => r.native_status !== '乡土种').length
      },
      batches: rows.map(r => ({
        id: r.id,
        batch_number: r.batch_number,
        common_name: r.common_name,
        scientific_name: r.scientific_name,
        native_status: r.native_status,
        status: r.status,
        batch_assessment: r.batch_assessment,
        quantity_grams: r.quantity_grams,
        moisture_content: r.moisture_content,
        initial_germination_rate: r.initial_germination_rate,
        site_name: r.site_name,
        volunteer_name: r.volunteer_name,
        cabinet_code: r.cabinet_code,
        slot_code: r.slot_code,
        collection_date: r.collection_date,
        created_at: r.created_at
      }))
    };
    
    res.json(summary);
  });
});

router.get('/statistics', (req, res) => {
  db.serialize(() => {
    const stats = {
      generated_at: moment().format('YYYY-MM-DD HH:mm:ss')
    };
    
    db.get('SELECT COUNT(*) as count FROM native_species', (err, row) => {
      stats.species_count = row.count;
      
      db.get('SELECT COUNT(*) as count FROM seed_batches', (err, row) => {
        stats.batch_count = row.count;
        
        db.get('SELECT SUM(quantity_grams) as total FROM seed_batches WHERE status = "已入库"', (err, row) => {
          stats.total_storage_grams = row.total || 0;
          
          db.get('SELECT COUNT(*) as count FROM volunteers WHERE status = "活跃"', (err, row) => {
            stats.active_volunteers = row.count;
            
            db.get('SELECT COUNT(*) as count FROM cold_storages', (err, row) => {
              stats.cabinet_count = row.count;
              
              db.get(`
                SELECT AVG(germination_rate) as avg_rate
                FROM germination_tests
              `, (err, row) => {
                stats.avg_germination_rate = row.avg_rate ? parseFloat(row.avg_rate.toFixed(2)) : null;
                
                db.all(`
                  SELECT ns.native_status, COUNT(*) as count
                  FROM seed_batches sb
                  LEFT JOIN native_species ns ON sb.species_id = ns.id
                  GROUP BY ns.native_status
                `, (err, rows) => {
                  stats.native_distribution = rows;
                  
                  db.all(`
                    SELECT cs.site_name, COUNT(*) as count
                    FROM seed_batches sb
                    LEFT JOIN collection_sites cs ON sb.collection_site_id = cs.id
                    GROUP BY cs.id
                    ORDER BY count DESC
                    LIMIT 5
                  `, (err, rows) => {
                    stats.top_sites = rows;
                    
                    db.all(`
                      SELECT ns.common_name, COUNT(*) as count
                      FROM seed_batches sb
                      LEFT JOIN native_species ns ON sb.species_id = ns.id
                      GROUP BY ns.id
                      ORDER BY count DESC
                      LIMIT 5
                    `, (err, rows) => {
                      stats.top_species = rows;
                      
                      res.json(stats);
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;
