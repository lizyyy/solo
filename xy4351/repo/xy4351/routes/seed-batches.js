const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

function validateSeedBatchData(data, callback) {
  const risks = [];
  const riskDetails = [];
  let assessment = '正常';

  db.serialize(() => {
    db.get('SELECT * FROM native_species WHERE id = ?', [data.species_id], (err, species) => {
      if (err) return callback(err, null);
      if (!species) {
        risks.push('物种信息缺失');
        riskDetails.push(`物种 ID ${data.species_id} 不存在`);
        assessment = '高风险';
        return callback(null, { assessment, risks, riskDetails, species: null });
      }

      if (species.native_status !== '乡土种') {
        risks.push('外来种误放');
        riskDetails.push(`物种 ${species.common_name} (${species.scientific_name}) 为 ${species.native_status}，非乡土种，禁止入库`);
        assessment = '高风险';
      }

      db.get('SELECT * FROM seed_batches WHERE batch_number = ?', [data.batch_number], (err, existingBatch) => {
        if (err) return callback(err, null);
        
        if (existingBatch) {
          risks.push('同批次重复登记');
          riskDetails.push(`批次号 ${data.batch_number} 已存在，请勿重复登记`);
          assessment = '高风险';
        }

        db.get('SELECT * FROM collection_sites WHERE id = ?', [data.collection_site_id], (err, collectionSite) => {
          if (err) return callback(err, null);
          
          if (!collectionSite) {
            risks.push('来源缺失');
            riskDetails.push(`采集地点 ID ${data.collection_site_id} 不存在`);
            assessment = '高风险';
          } else if (collectionSite.status !== '活跃') {
            risks.push('来源缺失');
            riskDetails.push(`采集地点 ${collectionSite.site_name} 状态为 ${collectionSite.status}，非活跃状态`);
            if (assessment !== '高风险') assessment = '中风险';
          }

          if (data.volunteer_id) {
            db.get('SELECT * FROM volunteers WHERE id = ?', [data.volunteer_id], (err, volunteer) => {
              if (err) return callback(err, null);
              
              if (!volunteer) {
                risks.push('来源缺失');
                riskDetails.push(`志愿者 ID ${data.volunteer_id} 不存在`);
                assessment = '高风险';
              } else if (volunteer.status !== '活跃') {
                risks.push('来源缺失');
                riskDetails.push(`志愿者 ${volunteer.name} 状态为 ${volunteer.status}，非活跃状态`);
                if (assessment !== '高风险') assessment = '中风险';
              }

              checkMoistureAndGermination(data, species, risks, riskDetails, assessment, callback);
            });
          } else {
            checkMoistureAndGermination(data, species, risks, riskDetails, assessment, callback);
          }
        });
      });
    });
  });
}

function checkMoistureAndGermination(data, species, risks, riskDetails, assessment, callback) {
  const moistureThreshold = species.moisture_threshold || 8.0;
  const germinationThreshold = species.germination_threshold || 50.0;

  if (data.moisture_content !== null && data.moisture_content !== undefined) {
    if (data.moisture_content > moistureThreshold) {
      risks.push('含水率超标');
      riskDetails.push(`含水率 ${data.moisture_content}% 超过该物种阈值 ${moistureThreshold}%`);
      assessment = '高风险';
    }
  }

  if (data.initial_germination_rate !== null && data.initial_germination_rate !== undefined) {
    if (data.initial_germination_rate < germinationThreshold) {
      risks.push('萌发率过低');
      riskDetails.push(`萌发率 ${data.initial_germination_rate}% 低于该物种阈值 ${germinationThreshold}%`);
      if (assessment !== '高风险') assessment = '中风险';
    }
  }

  if (data.storage_slot_id) {
    db.get(`
      SELECT ss.*, cs.cabinet_code, cs.cabinet_name 
      FROM storage_slots ss 
      LEFT JOIN cold_storages cs ON ss.cold_storage_id = cs.id 
      WHERE ss.id = ?
    `, [data.storage_slot_id], (err, slot) => {
      if (err) return callback(err, null);
      
      if (!slot) {
        risks.push('格位容量不足');
        riskDetails.push(`存储格位 ID ${data.storage_slot_id} 不存在`);
        assessment = '高风险';
      } else {
        const availableSlots = slot.max_capacity - slot.current_usage;
        if (availableSlots <= 0) {
          risks.push('格位容量不足');
          riskDetails.push(`格位 ${slot.slot_code} (${slot.cabinet_name}) 已满，无可用空间`);
          assessment = '高风险';
        }
      }

      callback(null, { assessment, risks, riskDetails, species });
    });
  } else {
    callback(null, { assessment, risks, riskDetails, species });
  }
}

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

router.get('/', (req, res) => {
  const status = req.query.status;
  let query = `
    SELECT sb.*, 
           ns.scientific_name, ns.common_name, ns.native_status,
           cs.site_name, cs.location as site_location,
           v.name as volunteer_name,
           ss.slot_code, ss.row_number, ss.column_number,
           cst.cabinet_code, cst.cabinet_name
    FROM seed_batches sb
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    LEFT JOIN collection_sites cs ON sb.collection_site_id = cs.id
    LEFT JOIN volunteers v ON sb.volunteer_id = v.id
    LEFT JOIN storage_slots ss ON sb.storage_slot_id = ss.id
    LEFT JOIN cold_storages cst ON ss.cold_storage_id = cst.id
  `;
  
  const params = [];
  if (status) {
    query += ' WHERE sb.status = ?';
    params.push(status);
  }
  query += ' ORDER BY sb.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT sb.*, 
           ns.scientific_name, ns.common_name, ns.native_status,
           ns.moisture_threshold, ns.germination_threshold,
           cs.site_code, cs.site_name, cs.location as site_location,
           v.name as volunteer_name, v.role as volunteer_role,
           ss.slot_code, ss.row_number, ss.column_number, ss.max_capacity, ss.current_usage,
           cst.cabinet_code, cst.cabinet_name, cst.location as cabinet_location
    FROM seed_batches sb
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    LEFT JOIN collection_sites cs ON sb.collection_site_id = cs.id
    LEFT JOIN volunteers v ON sb.volunteer_id = v.id
    LEFT JOIN storage_slots ss ON sb.storage_slot_id = ss.id
    LEFT JOIN cold_storages cst ON ss.cold_storage_id = cst.id
    WHERE sb.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '种子批次不存在' });
    }
    
    db.all(`
      SELECT * FROM germination_tests 
      WHERE seed_batch_id = ? 
      ORDER BY test_date DESC
    `, [req.params.id], (err, tests) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      row.germination_tests = tests;
      res.json(row);
    });
  });
});

router.get('/batch/:batchNumber', (req, res) => {
  db.get(`
    SELECT sb.*, 
           ns.scientific_name, ns.common_name, ns.native_status,
           cs.site_name, v.name as volunteer_name,
           ss.slot_code, cst.cabinet_name
    FROM seed_batches sb
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    LEFT JOIN collection_sites cs ON sb.collection_site_id = cs.id
    LEFT JOIN volunteers v ON sb.volunteer_id = v.id
    LEFT JOIN storage_slots ss ON sb.storage_slot_id = ss.id
    LEFT JOIN cold_storages cst ON ss.cold_storage_id = cst.id
    WHERE sb.batch_number = ?
  `, [req.params.batchNumber], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '种子批次不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const {
    batch_number,
    species_id,
    collection_site_id,
    volunteer_id,
    collection_date,
    quantity_grams,
    moisture_content,
    initial_germination_rate,
    storage_slot_id,
    notes,
    actor
  } = req.body;

  if (!species_id || !collection_site_id || !collection_date) {
    return res.status(400).json({ error: '物种ID、采集地点ID和采集日期为必填项' });
  }

  const finalBatchNumber = batch_number || `BATCH-${moment().format('YYYYMMDD')}-${uuidv4().substring(0, 8).toUpperCase()}`;

  validateSeedBatchData({
    batch_number: finalBatchNumber,
    species_id,
    collection_site_id,
    volunteer_id,
    moisture_content,
    initial_germination_rate,
    storage_slot_id
  }, (err, validationResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const { assessment, risks, riskDetails } = validationResult;
    
    const finalStatus = assessment === '高风险' ? '待复核' : 
                        assessment === '中风险' ? '待确认' : '待入库';

    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT INTO seed_batches (
          batch_number, species_id, collection_site_id, volunteer_id,
          collection_date, quantity_grams, moisture_content,
          initial_germination_rate, storage_slot_id, status,
          batch_assessment, assessment_details, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        finalBatchNumber,
        species_id,
        collection_site_id,
        volunteer_id || null,
        collection_date,
        quantity_grams || 0,
        moisture_content !== undefined ? moisture_content : null,
        initial_germination_rate !== undefined ? initial_germination_rate : null,
        storage_slot_id || null,
        finalStatus,
        assessment,
        JSON.stringify(riskDetails),
        notes || null,
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const batchId = this.lastID;

          if (storage_slot_id && assessment !== '高风险') {
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
            batchId,
            null,
            '创建种子批次',
            actor || '系统',
            { batch_number: finalBatchNumber, species_id, collection_site_id },
            assessment,
            riskDetails
          );

          res.status(201).json({
            id: batchId,
            batch_number: finalBatchNumber,
            message: '种子批次创建成功',
            batch_assessment: assessment,
            status: finalStatus,
            risks: risks,
            risk_details: riskDetails
          });
        }
      );
      stmt.finalize();
    });
  });
});

router.post('/:id/register', (req, res) => {
  const batchId = req.params.id;
  const { storage_slot_id, actor } = req.body;

  db.get('SELECT * FROM seed_batches WHERE id = ?', [batchId], (err, batch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: '种子批次不存在' });
    }

    const finalSlotId = storage_slot_id || batch.storage_slot_id;
    
    if (!finalSlotId) {
      return res.status(400).json({ error: '请指定存储格位' });
    }

    db.get(`
      SELECT ss.*, cs.cabinet_code, cs.cabinet_name 
      FROM storage_slots ss 
      LEFT JOIN cold_storages cs ON ss.cold_storage_id = cs.id 
      WHERE ss.id = ?
    `, [finalSlotId], (err, slot) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!slot) {
        return res.status(400).json({ error: '存储格位不存在' });
      }

      const availableSlots = slot.max_capacity - slot.current_usage;
      if (availableSlots <= 0) {
        return res.status(400).json({
          error: '格位容量不足',
          details: `格位 ${slot.slot_code} (${slot.cabinet_name}) 已满，无可用空间`
        });
      }

      db.serialize(() => {
        db.run(`
          UPDATE seed_batches 
          SET storage_slot_id = ?, 
              status = '已入库',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [finalSlotId, batchId], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          db.run(`
            UPDATE storage_slots 
            SET current_usage = current_usage + 1,
                status = CASE 
                  WHEN current_usage + 1 >= max_capacity THEN '已满'
                  ELSE '使用中'
                END
            WHERE id = ?
          `, [finalSlotId]);

          logAudit(
            batchId,
            null,
            '种子入库登记',
            actor || '系统',
            { storage_slot_id: finalSlotId, slot_code: slot.slot_code },
            '正常',
            []
          );

          res.json({
            message: '种子入库登记成功',
            batch_id: batchId,
            storage_slot: {
              id: finalSlotId,
              slot_code: slot.slot_code,
              cabinet_name: slot.cabinet_name
            }
          });
        });
      });
    });
  });
});

router.put('/:id/override', (req, res) => {
  const batchId = req.params.id;
  const { override_reason, new_assessment, actor } = req.body;

  if (!override_reason || !new_assessment) {
    return res.status(400).json({ error: '改判原因和新评估状态为必填项' });
  }

  db.get('SELECT * FROM seed_batches WHERE id = ?', [batchId], (err, batch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: '种子批次不存在' });
    }

    const newStatus = new_assessment === '正常' ? '待入库' : 
                      new_assessment === '中风险' ? '待确认' : '待复核';

    db.run(`
      UPDATE seed_batches 
      SET batch_assessment = ?,
          assessment_details = ?,
          manual_override = 1,
          override_reason = ?,
          override_by = ?,
          status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      new_assessment,
      JSON.stringify([`人工改判: ${override_reason}`]),
      override_reason,
      actor || '管理员',
      newStatus,
      batchId
    ], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      logAudit(
        batchId,
        null,
        '人工改判',
        actor || '管理员',
        { 
          original_assessment: batch.batch_assessment,
          new_assessment: new_assessment,
          override_reason: override_reason
        },
        new_assessment,
        [`人工改判: ${override_reason}`]
      );

      res.json({
        message: '人工改判成功',
        batch_id: batchId,
        original_assessment: batch.batch_assessment,
        new_assessment: new_assessment,
        new_status: newStatus,
        override_reason: override_reason
      });
    });
  });
});

router.put('/:id/recheck', (req, res) => {
  const batchId = req.params.id;
  const { actor } = req.body;

  db.get(`
    SELECT sb.*, ns.moisture_threshold, ns.germination_threshold
    FROM seed_batches sb
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    WHERE sb.id = ?
  `, [batchId], (err, batch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: '种子批次不存在' });
    }

    validateSeedBatchData({
      batch_number: batch.batch_number + '-recheck',
      species_id: batch.species_id,
      collection_site_id: batch.collection_site_id,
      volunteer_id: batch.volunteer_id,
      moisture_content: batch.moisture_content,
      initial_germination_rate: batch.initial_germination_rate,
      storage_slot_id: batch.storage_slot_id
    }, (err, validationResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const { assessment, risks, riskDetails } = validationResult;
      const newStatus = assessment === '高风险' ? '待复核' : 
                        assessment === '中风险' ? '待确认' : 
                        batch.status === '已入库' ? '已入库' : '待入库';

      db.run(`
        UPDATE seed_batches 
        SET batch_assessment = ?,
            assessment_details = ?,
            manual_override = 0,
            override_reason = NULL,
            override_by = NULL,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        assessment,
        JSON.stringify(riskDetails),
        newStatus,
        batchId
      ], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        logAudit(
          batchId,
          null,
          '重新评估',
          actor || '系统',
          { 
            previous_assessment: batch.batch_assessment,
            previous_manual_override: batch.manual_override ? '是' : '否'
          },
          assessment,
          riskDetails
        );

        res.json({
          message: '重新评估完成',
          batch_id: batchId,
          previous_assessment: batch.batch_assessment,
          new_assessment: assessment,
          new_status: newStatus,
          risks: risks,
          risk_details: riskDetails,
          manual_override_cleared: batch.manual_override ? true : false
        });
      });
    });
  });
});

router.put('/:id', (req, res) => {
  const batchId = req.params.id;
  const {
    collection_date,
    quantity_grams,
    moisture_content,
    initial_germination_rate,
    storage_slot_id,
    notes,
    actor
  } = req.body;

  db.get('SELECT * FROM seed_batches WHERE id = ?', [batchId], (err, existingBatch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!existingBatch) {
      return res.status(404).json({ error: '种子批次不存在' });
    }

    const finalStorageSlotId = storage_slot_id !== undefined ? storage_slot_id : existingBatch.storage_slot_id;
    const finalMoisture = moisture_content !== undefined ? moisture_content : existingBatch.moisture_content;
    const finalGermination = initial_germination_rate !== undefined ? initial_germination_rate : existingBatch.initial_germination_rate;

    validateSeedBatchData({
      batch_number: existingBatch.batch_number + '-update',
      species_id: existingBatch.species_id,
      collection_site_id: existingBatch.collection_site_id,
      volunteer_id: existingBatch.volunteer_id,
      moisture_content: finalMoisture,
      initial_germination_rate: finalGermination,
      storage_slot_id: finalStorageSlotId
    }, (err, validationResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      const { assessment, risks, riskDetails } = validationResult;
      
      let finalStatus = existingBatch.status;
      if (existingBatch.status !== '已入库') {
        finalStatus = assessment === '高风险' ? '待复核' : 
                      assessment === '中风险' ? '待确认' : '待入库';
      }

      const stmt = db.prepare(`
        UPDATE seed_batches 
        SET collection_date = ?,
            quantity_grams = ?,
            moisture_content = ?,
            initial_germination_rate = ?,
            storage_slot_id = ?,
            status = ?,
            batch_assessment = ?,
            assessment_details = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(
        collection_date || existingBatch.collection_date,
        quantity_grams !== undefined ? quantity_grams : existingBatch.quantity_grams,
        finalMoisture !== undefined ? finalMoisture : null,
        finalGermination !== undefined ? finalGermination : null,
        finalStorageSlotId !== undefined ? finalStorageSlotId : null,
        finalStatus,
        assessment,
        JSON.stringify(riskDetails),
        notes !== undefined ? notes : existingBatch.notes,
        batchId,
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          logAudit(
            batchId,
            null,
            '更新种子批次',
            actor || '系统',
            { updated_fields: Object.keys(req.body) },
            assessment,
            riskDetails
          );

          res.json({
            message: '种子批次更新成功',
            batch_assessment: assessment,
            status: finalStatus,
            risks: risks,
            risk_details: riskDetails
          });
        }
      );
      stmt.finalize();
    });
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT * FROM seed_batches WHERE id = ?', [req.params.id], (err, batch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: '种子批次不存在' });
    }

    if (batch.storage_slot_id) {
      db.run(`
        UPDATE storage_slots 
        SET current_usage = current_usage - 1,
            status = CASE 
              WHEN current_usage - 1 <= 0 THEN '空闲'
              ELSE '使用中'
            END
        WHERE id = ?
      `, [batch.storage_slot_id]);
    }

    db.run('DELETE FROM seed_batches WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      logAudit(
        null,
        null,
        '删除种子批次',
        '系统',
        { batch_number: batch.batch_number, deleted_at: new Date().toISOString() },
        null,
        null
      );

      res.json({ message: '种子批次删除成功' });
    });
  });
});

module.exports = router;
