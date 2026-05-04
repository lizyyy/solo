const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

function logAudit(batchId, exchangeId, action, actor, details, assessment, assessmentDetails, callback) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (batch_id, exchange_id, action, actor, details, assessment, assessment_details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    batchId || null,
    exchangeId || null,
    action,
    actor,
    details ? JSON.stringify(details) : null,
    assessment || null,
    assessmentDetails ? JSON.stringify(assessmentDetails) : null,
    function(err) {
      if (callback) callback(err, this.lastID);
    }
  );
  stmt.finalize();
}

function validateExchangeBeforeApproval(exchangeData, callback) {
  const risks = [];
  const riskDetails = [];
  let assessment = '正常';

  db.get(`
    SELECT sb.*, 
           ns.scientific_name, ns.common_name, ns.native_status,
           ns.moisture_threshold, ns.germination_threshold,
           cs.site_name, cs.status as site_status,
           ss.slot_code, ss.max_capacity, ss.current_usage,
           cst.cabinet_code, cst.cabinet_name
    FROM seed_batches sb
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    LEFT JOIN collection_sites cs ON sb.collection_site_id = cs.id
    LEFT JOIN storage_slots ss ON sb.storage_slot_id = ss.id
    LEFT JOIN cold_storages cst ON ss.cold_storage_id = cst.id
    WHERE sb.id = ?
  `, [exchangeData.seed_batch_id], (err, batch) => {
    if (err) return callback(err, null);
    if (!batch) {
      risks.push('种子批次不存在');
      riskDetails.push(`种子批次 ID ${exchangeData.seed_batch_id} 不存在`);
      assessment = '高风险';
      return callback(null, { assessment, risks, riskDetails, batch: null });
    }

    if (exchangeData.exchange_type === '换出') {
      if (batch.status !== '已入库') {
        risks.push('批次状态异常');
        riskDetails.push(`种子批次状态为 "${batch.status}"，换出前必须为"已入库"状态`);
        assessment = '高风险';
      }

      if (batch.quantity_grams < exchangeData.quantity_grams) {
        risks.push('库存不足');
        riskDetails.push(`库存 ${batch.quantity_grams}g 不足，申请换出 ${exchangeData.quantity_grams}g`);
        assessment = '高风险';
      }

      const moistureThreshold = batch.moisture_threshold || 8.0;
      if (batch.moisture_content !== null && batch.moisture_content > moistureThreshold) {
        risks.push('含水率超标');
        riskDetails.push(`含水率 ${batch.moisture_content}% 超过阈值 ${moistureThreshold}%，建议处理后再换出`);
        if (assessment !== '高风险') assessment = '中风险';
      }

      const germinationThreshold = batch.germination_threshold || 50.0;
      if (batch.initial_germination_rate !== null && batch.initial_germination_rate < germinationThreshold) {
        risks.push('萌发率过低');
        riskDetails.push(`萌发率 ${batch.initial_germination_rate}% 低于阈值 ${germinationThreshold}%，不建议换出`);
        if (assessment !== '高风险') assessment = '中风险';
      }
    }

    if (exchangeData.exchange_type === '入库') {
      if (batch.native_status !== '乡土种') {
        risks.push('外来种误放');
        riskDetails.push(`物种 ${batch.common_name} (${batch.scientific_name}) 为 ${batch.native_status}，非乡土种，禁止入库`);
        assessment = '高风险';
      }

      if (batch.site_status !== '活跃') {
        risks.push('来源缺失');
        riskDetails.push(`采集地点 ${batch.site_name} 状态为 "${batch.site_status}"，非活跃状态`);
        if (assessment !== '高风险') assessment = '中风险';
      }

      if (exchangeData.storage_slot_id) {
        db.get('SELECT * FROM storage_slots WHERE id = ?', [exchangeData.storage_slot_id], (err, slot) => {
          if (err) return callback(err, null);
          
          if (!slot) {
            risks.push('格位容量不足');
            riskDetails.push(`存储格位 ID ${exchangeData.storage_slot_id} 不存在`);
            assessment = '高风险';
          } else {
            const availableSlots = slot.max_capacity - slot.current_usage;
            if (availableSlots <= 0) {
              risks.push('格位容量不足');
              riskDetails.push(`格位已使用 ${slot.current_usage}/${slot.max_capacity}，无可用空间`);
              assessment = '高风险';
            }
          }
          callback(null, { assessment, risks, riskDetails, batch });
        });
        return;
      }
    }

    callback(null, { assessment, risks, riskDetails, batch });
  });
}

router.get('/', (req, res) => {
  const status = req.query.status;
  const type = req.query.type;
  
  let query = `
    SELECT se.*,
           sb.batch_number,
           ns.common_name, ns.scientific_name,
           ss.slot_code, cst.cabinet_code
    FROM seed_exchanges se
    LEFT JOIN seed_batches sb ON se.seed_batch_id = sb.id
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    LEFT JOIN storage_slots ss ON sb.storage_slot_id = ss.id
    LEFT JOIN cold_storages cst ON ss.cold_storage_id = cst.id
  `;
  const params = [];
  const conditions = [];
  
  if (status) {
    conditions.push('se.status = ?');
    params.push(status);
  }
  if (type) {
    conditions.push('se.exchange_type = ?');
    params.push(type);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY se.request_date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT se.*,
           sb.batch_number, sb.quantity_grams as batch_quantity, sb.status as batch_status,
           sb.moisture_content, sb.initial_germination_rate,
           ns.common_name, ns.scientific_name, ns.moisture_threshold, ns.germination_threshold,
           cs.site_name,
           ss.slot_code, cst.cabinet_code, cst.cabinet_name
    FROM seed_exchanges se
    LEFT JOIN seed_batches sb ON se.seed_batch_id = sb.id
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    LEFT JOIN collection_sites cs ON sb.collection_site_id = cs.id
    LEFT JOIN storage_slots ss ON sb.storage_slot_id = ss.id
    LEFT JOIN cold_storages cst ON ss.cold_storage_id = cst.id
    WHERE se.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '换种申请不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const {
    exchange_type,
    seed_batch_id,
    quantity_grams,
    requestor,
    request_date,
    purpose,
    actor
  } = req.body;

  if (!exchange_type || !seed_batch_id || !quantity_grams || !requestor) {
    return res.status(400).json({ error: '换种类型、种子批次ID、数量和申请人为必填项' });
  }

  if (!['入库', '换出'].includes(exchange_type)) {
    return res.status(400).json({ error: '换种类型必须为"入库"或"换出"' });
  }

  db.get('SELECT * FROM seed_batches WHERE id = ?', [seed_batch_id], (err, batch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: '种子批次不存在' });
    }

    const exchangeNumber = `EX-${moment().format('YYYYMMDD')}-${uuidv4().substring(0, 6).toUpperCase()}`;

    const stmt = db.prepare(`
      INSERT INTO seed_exchanges (
        exchange_number, exchange_type, seed_batch_id,
        quantity_grams, requestor, request_date, purpose, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      exchangeNumber,
      exchange_type,
      seed_batch_id,
      quantity_grams,
      requestor,
      request_date || moment().format('YYYY-MM-DD'),
      purpose || null,
      '待审核',
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const exchangeId = this.lastID;

        logAudit(
          seed_batch_id,
          exchangeId,
          '创建换种申请',
          actor || requestor,
          {
            exchange_number: exchangeNumber,
            exchange_type: exchange_type,
            quantity_grams: quantity_grams,
            purpose: purpose
          },
          null,
          null
        );

        res.status(201).json({
          id: exchangeId,
          exchange_number: exchangeNumber,
          message: '换种申请创建成功',
          status: '待审核'
        });
      }
    );
    stmt.finalize();
  });
});

router.put('/:id/approve', (req, res) => {
  const exchangeId = req.params.id;
  const {
    approved_by,
    storage_slot_id,
    actor
  } = req.body;

  db.get(`
    SELECT se.*,
           sb.batch_number, sb.quantity_grams as batch_quantity, sb.status as batch_status,
           sb.storage_slot_id as current_slot_id
    FROM seed_exchanges se
    LEFT JOIN seed_batches sb ON se.seed_batch_id = sb.id
    WHERE se.id = ?
  `, [exchangeId], (err, exchange) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!exchange) {
      return res.status(404).json({ error: '换种申请不存在' });
    }

    if (exchange.status !== '待审核') {
      return res.status(400).json({ 
        error: '只能审核待审核状态的申请',
        current_status: exchange.status
      });
    }

    validateExchangeBeforeApproval({
      seed_batch_id: exchange.seed_batch_id,
      exchange_type: exchange.exchange_type,
      quantity_grams: exchange.quantity_grams,
      storage_slot_id: storage_slot_id || null
    }, (err, validationResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const { assessment, risks, riskDetails, batch } = validationResult;

      if (assessment === '高风险') {
        return res.status(400).json({
          error: '审核未通过，存在高风险项',
          assessment: assessment,
          risks: risks,
          risk_details: riskDetails
        });
      }

      db.serialize(() => {
        const approvalDate = moment().format('YYYY-MM-DD');
        let finalStatus = '已通过';
        
        if (assessment === '中风险') {
          finalStatus = '待复核';
        }

        db.run(`
          UPDATE seed_exchanges 
          SET status = ?,
              approved_by = ?,
              approval_date = ?,
              assessment_before = ?,
              assessment_details = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          finalStatus,
          approved_by || actor || '管理员',
          approvalDate,
          assessment,
          JSON.stringify(riskDetails),
          exchangeId
        ]);

        if (exchange.exchange_type === '换出') {
          const newQuantity = batch.quantity_grams - exchange.quantity_grams;
          
          db.run(`
            UPDATE seed_batches 
            SET quantity_grams = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [newQuantity, exchange.seed_batch_id]);

          if (newQuantity <= 0) {
            db.run(`
              UPDATE seed_batches 
              SET status = '已出库',
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [exchange.seed_batch_id]);

            if (exchange.current_slot_id) {
              db.run(`
                UPDATE storage_slots 
                SET current_usage = current_usage - 1,
                    status = CASE 
                      WHEN current_usage - 1 <= 0 THEN '空闲'
                      ELSE '使用中'
                    END
                WHERE id = ?
              `, [exchange.current_slot_id]);
            }
          }
        }

        if (exchange.exchange_type === '入库' && storage_slot_id) {
          db.run(`
            UPDATE seed_batches 
            SET storage_slot_id = ?,
                status = '已入库',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [storage_slot_id, exchange.seed_batch_id]);

          db.run(`
            UPDATE storage_slots 
            SET current_usage = current_usage + 1,
                status = CASE 
                  WHEN current_usage + 1 >= max_capacity THEN '已满'
                  ELSE '使用中'
                END
            WHERE id = ?
          `, [storage_slot_id]);
        }

        logAudit(
          exchange.seed_batch_id,
          exchangeId,
          '审核换种申请',
          actor || approved_by || '管理员',
          {
            action: '批准',
            exchange_type: exchange.exchange_type,
            quantity_grams: exchange.quantity_grams
          },
          assessment,
          riskDetails
        );

        res.json({
          message: '换种申请审核通过',
          exchange_id: exchangeId,
          exchange_number: exchange.exchange_number,
          status: finalStatus,
          assessment: assessment,
          risks: risks,
          risk_details: riskDetails
        });
      });
    });
  });
});

router.put('/:id/reject', (req, res) => {
  const exchangeId = req.params.id;
  const { reject_reason, actor } = req.body;

  db.get('SELECT * FROM seed_exchanges WHERE id = ?', [exchangeId], (err, exchange) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!exchange) {
      return res.status(404).json({ error: '换种申请不存在' });
    }

    if (exchange.status !== '待审核') {
      return res.status(400).json({ 
        error: '只能驳回待审核状态的申请',
        current_status: exchange.status
      });
    }

    db.run(`
      UPDATE seed_exchanges 
      SET status = '已驳回',
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [reject_reason || null, exchangeId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      logAudit(
        exchange.seed_batch_id,
        exchangeId,
        '驳回换种申请',
        actor || '管理员',
        {
          reject_reason: reject_reason,
          exchange_type: exchange.exchange_type
        },
        null,
        null
      );

      res.json({
        message: '换种申请已驳回',
        exchange_id: exchangeId,
        status: '已驳回',
        reject_reason: reject_reason
      });
    });
  });
});

router.put('/:id/execute', (req, res) => {
  const exchangeId = req.params.id;
  const { actor } = req.body;

  db.get(`
    SELECT se.*,
           sb.batch_number, sb.quantity_grams as batch_quantity
    FROM seed_exchanges se
    LEFT JOIN seed_batches sb ON se.seed_batch_id = sb.id
    WHERE se.id = ?
  `, [exchangeId], (err, exchange) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!exchange) {
      return res.status(404).json({ error: '换种申请不存在' });
    }

    if (exchange.status !== '已通过') {
      return res.status(400).json({ 
        error: '只能执行已通过的申请',
        current_status: exchange.status
      });
    }

    const exchangeDate = moment().format('YYYY-MM-DD');

    db.run(`
      UPDATE seed_exchanges 
      SET status = '已完成',
          exchange_date = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [exchangeDate, exchangeId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      logAudit(
        exchange.seed_batch_id,
        exchangeId,
        '执行换种',
        actor || '系统',
        {
          exchange_date: exchangeDate,
          exchange_type: exchange.exchange_type,
          quantity_grams: exchange.quantity_grams
        },
        '正常',
        []
      );

      res.json({
        message: '换种执行完成',
        exchange_id: exchangeId,
        exchange_number: exchange.exchange_number,
        status: '已完成',
        exchange_date: exchangeDate
      });
    });
  });
});

router.put('/:id', (req, res) => {
  const exchangeId = req.params.id;
  const {
    quantity_grams,
    requestor,
    request_date,
    purpose,
    notes,
    actor
  } = req.body;

  db.get('SELECT * FROM seed_exchanges WHERE id = ?', [exchangeId], (err, existingExchange) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!existingExchange) {
      return res.status(404).json({ error: '换种申请不存在' });
    }

    if (['已通过', '已驳回', '已完成'].includes(existingExchange.status)) {
      return res.status(400).json({ 
        error: '该状态下的申请不可修改',
        current_status: existingExchange.status
      });
    }

    const stmt = db.prepare(`
      UPDATE seed_exchanges 
      SET quantity_grams = ?,
          requestor = ?,
          request_date = ?,
          purpose = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      quantity_grams !== undefined ? quantity_grams : existingExchange.quantity_grams,
      requestor || existingExchange.requestor,
      request_date || existingExchange.request_date,
      purpose !== undefined ? purpose : existingExchange.purpose,
      notes !== undefined ? notes : existingExchange.notes,
      exchangeId,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        logAudit(
          existingExchange.seed_batch_id,
          exchangeId,
          '更新换种申请',
          actor || '系统',
          { updated_fields: Object.keys(req.body) },
          null,
          null
        );

        res.json({ message: '换种申请更新成功' });
      }
    );
    stmt.finalize();
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT * FROM seed_exchanges WHERE id = ?', [req.params.id], (err, exchange) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!exchange) {
      return res.status(404).json({ error: '换种申请不存在' });
    }

    if (['已通过', '已完成'].includes(exchange.status)) {
      return res.status(400).json({ 
        error: '该状态下的申请不可删除',
        current_status: exchange.status
      });
    }

    db.run('DELETE FROM seed_exchanges WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      logAudit(
        exchange.seed_batch_id,
        null,
        '删除换种申请',
        '系统',
        {
          exchange_number: exchange.exchange_number,
          exchange_type: exchange.exchange_type
        },
        null,
        null
      );

      res.json({ message: '换种申请删除成功' });
    });
  });
});

module.exports = router;
