const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

function checkRisks(taskData, callback) {
  const risks = [];
  const riskDetails = [];
  
  const { book_id, reviewer_id1, reviewer_id2, cabinet_id, chemical_batch_ids } = taskData;
  
  db.get('SELECT * FROM books WHERE id = ?', [book_id], (err, book) => {
    if (err) return callback(err, null);
    
    const isPrecious = book && (book.rarity_level === '珍贵' || book.rarity_level === '国宝级');
    
    if (isPrecious) {
      if (!reviewer_id1 || !reviewer_id2) {
        risks.push('珍贵书册未双人复核');
        riskDetails.push('珍贵/国宝级书册需要两位复核人签字确认');
      } else if (reviewer_id1 === reviewer_id2) {
        risks.push('珍贵书册未双人复核');
        riskDetails.push('两位复核人必须是不同的人员');
      }
    }
    
    if (cabinet_id) {
      db.get('SELECT * FROM humidity_cabinets WHERE id = ?', [cabinet_id], (err, cabinet) => {
        if (err) return callback(err, null);
        
        if (cabinet) {
          const availableSpace = cabinet.max_capacity - cabinet.current_usage;
          if (availableSpace <= 0) {
            risks.push('恒湿柜容量不足');
            riskDetails.push(`恒湿柜 ${cabinet.cabinet_number} 已无可用空间`);
          }
        }
        
        checkChemicalRisks(chemical_batch_ids, risks, riskDetails, callback);
      });
    } else {
      checkChemicalRisks(chemical_batch_ids, risks, riskDetails, callback);
    }
  });
}

function checkChemicalRisks(chemicalBatchIds, risks, riskDetails, callback) {
  if (!chemicalBatchIds || chemicalBatchIds.length === 0) {
    return finalizeRiskCheck(risks, riskDetails, callback);
  }
  
  const batchIds = Array.isArray(chemicalBatchIds) ? chemicalBatchIds : [chemicalBatchIds];
  let completedChecks = 0;
  
  batchIds.forEach((batchId) => {
    db.get('SELECT * FROM chemical_batches WHERE id = ?', [batchId], (err, batch) => {
      if (err) return callback(err, null);
      
      if (batch) {
        const isExpired = moment(batch.expiry_date).isBefore(moment());
        const isAboutToExpire = moment(batch.expiry_date).isBetween(moment(), moment().add(30, 'days'));
        
        if (isExpired) {
          risks.push('药剂批次过期');
          riskDetails.push(`药剂批次 ${batch.batch_number} (${batch.chemical_name}) 已过期`);
        } else if (isAboutToExpire) {
          risks.push('药剂批次即将过期');
          riskDetails.push(`药剂批次 ${batch.batch_number} (${batch.chemical_name}) 将在30天内过期`);
        }
        
        if (batch.quantity <= 0) {
          risks.push('药剂批次数量不足');
          riskDetails.push(`药剂批次 ${batch.batch_number} (${batch.chemical_name}) 已用完`);
        }
      }
      
      completedChecks++;
      if (completedChecks === batchIds.length) {
        finalizeRiskCheck(risks, riskDetails, callback);
      }
    });
  });
}

function finalizeRiskCheck(risks, riskDetails, callback) {
  let riskAssessment = '正常';
  if (risks.length > 0) {
    const hasCriticalRisk = risks.some(r => 
      r.includes('过期') || r.includes('未双人复核') || r.includes('容量不足')
    );
    riskAssessment = hasCriticalRisk ? '高风险' : '中风险';
  }
  
  callback(null, {
    risks: risks,
    riskDetails: riskDetails,
    riskAssessment: riskAssessment
  });
}

router.get('/', (req, res) => {
  db.all(`
    SELECT rt.*, 
           b.title as book_title,
           b.rarity_level,
           r1.name as reviewer1_name,
           r2.name as reviewer2_name,
           hc.cabinet_number
    FROM repair_tasks rt
    LEFT JOIN books b ON rt.book_id = b.id
    LEFT JOIN reviewers r1 ON rt.reviewer_id1 = r1.id
    LEFT JOIN reviewers r2 ON rt.reviewer_id2 = r2.id
    LEFT JOIN humidity_cabinets hc ON rt.cabinet_id = hc.id
    ORDER BY rt.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT rt.*, 
           b.title as book_title,
           b.author,
           b.era,
           b.rarity_level,
           r1.name as reviewer1_name,
           r2.name as reviewer2_name,
           hc.cabinet_number,
           hc.location as cabinet_location
    FROM repair_tasks rt
    LEFT JOIN books b ON rt.book_id = b.id
    LEFT JOIN reviewers r1 ON rt.reviewer_id1 = r1.id
    LEFT JOIN reviewers r2 ON rt.reviewer_id2 = r2.id
    LEFT JOIN humidity_cabinets hc ON rt.cabinet_id = hc.id
    WHERE rt.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '修复任务不存在' });
    }
    
    db.all(`
      SELECT * FROM repair_steps 
      WHERE task_id = ? 
      ORDER BY step_order
    `, [req.params.id], (err, steps) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      checkStepOrder(steps, (err, stepRisks) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.json({
          ...row,
          steps: steps,
          step_risks: stepRisks
        });
      });
    });
  });
});

function checkStepOrder(steps, callback) {
  const risks = [];
  
  if (steps.length === 0) {
    risks.push('修复任务无步骤定义');
    return callback(null, risks);
  }
  
  const stepOrders = steps.map(s => s.step_order).sort((a, b) => a - b);
  
  for (let i = 0; i < stepOrders.length; i++) {
    if (stepOrders[i] !== i + 1) {
      risks.push(`步骤顺序缺失或不连续，缺少步骤 ${i + 1}`);
      break;
    }
  }
  
  callback(null, risks);
}

router.post('/', (req, res) => {
  const { 
    book_id, assigned_to, reviewer_id1, reviewer_id2, 
    cabinet_id, chemical_batch_ids, 
    start_date, estimated_end_date, status,
    actor
  } = req.body;
  
  const taskData = {
    book_id,
    reviewer_id1,
    reviewer_id2,
    cabinet_id,
    chemical_batch_ids: chemical_batch_ids ? (Array.isArray(chemical_batch_ids) ? chemical_batch_ids : JSON.parse(chemical_batch_ids)) : []
  };
  
  checkRisks(taskData, (err, riskResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const stmt = db.prepare(`
      INSERT INTO repair_tasks (
        book_id, assigned_to, reviewer_id1, reviewer_id2, 
        cabinet_id, chemical_batch_ids,
        start_date, estimated_end_date, status,
        risk_assessment, risk_details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      book_id,
      assigned_to || null,
      reviewer_id1 || null,
      reviewer_id2 || null,
      cabinet_id || null,
      chemical_batch_ids ? JSON.stringify(chemical_batch_ids) : null,
      start_date || null,
      estimated_end_date || null,
      status || '待开始',
      riskResult.riskAssessment,
      JSON.stringify(riskResult.riskDetails),
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const taskId = this.lastID;
        
        const auditStmt = db.prepare(`
          INSERT INTO audit_logs (task_id, action, actor, details)
          VALUES (?, ?, ?, ?)
        `);
        
        auditStmt.run(
          taskId,
          '创建修复任务',
          actor || '系统',
          JSON.stringify({
            book_id,
            risks: riskResult.risks,
            risk_assessment: riskResult.riskAssessment
          }),
          function(err) {
            if (err) {
              console.error('审计日志记录失败:', err);
            }
          }
        );
        auditStmt.finalize();
        
        if (cabinet_id) {
          db.run(`
            UPDATE humidity_cabinets 
            SET current_usage = current_usage + 1 
            WHERE id = ?
          `, [cabinet_id]);
        }
        
        res.status(201).json({
          id: taskId,
          message: '修复任务创建成功',
          risk_assessment: riskResult.riskAssessment,
          risks: riskResult.risks,
          risk_details: riskResult.riskDetails
        });
      }
    );
    stmt.finalize();
  });
});

router.put('/:id', (req, res) => {
  const { 
    book_id, assigned_to, reviewer_id1, reviewer_id2, 
    cabinet_id, chemical_batch_ids, 
    start_date, estimated_end_date, actual_end_date, status,
    actor
  } = req.body;
  
  const taskData = {
    book_id,
    reviewer_id1,
    reviewer_id2,
    cabinet_id,
    chemical_batch_ids: chemical_batch_ids ? (Array.isArray(chemical_batch_ids) ? chemical_batch_ids : JSON.parse(chemical_batch_ids)) : []
  };
  
  checkRisks(taskData, (err, riskResult) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const stmt = db.prepare(`
      UPDATE repair_tasks 
      SET book_id = ?, assigned_to = ?, reviewer_id1 = ?, reviewer_id2 = ?, 
          cabinet_id = ?, chemical_batch_ids = ?,
          start_date = ?, estimated_end_date = ?, actual_end_date = ?, status = ?,
          risk_assessment = ?, risk_details = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      book_id,
      assigned_to || null,
      reviewer_id1 || null,
      reviewer_id2 || null,
      cabinet_id || null,
      chemical_batch_ids ? JSON.stringify(chemical_batch_ids) : null,
      start_date || null,
      estimated_end_date || null,
      actual_end_date || null,
      status || '待开始',
      riskResult.riskAssessment,
      JSON.stringify(riskResult.riskDetails),
      req.params.id,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '修复任务不存在' });
        }
        
        const auditStmt = db.prepare(`
          INSERT INTO audit_logs (task_id, action, actor, details)
          VALUES (?, ?, ?, ?)
        `);
        
        auditStmt.run(
          req.params.id,
          '更新修复任务',
          actor || '系统',
          JSON.stringify({
            book_id,
            status,
            risks: riskResult.risks,
            risk_assessment: riskResult.riskAssessment
          }),
          function(err) {
            if (err) {
              console.error('审计日志记录失败:', err);
            }
          }
        );
        auditStmt.finalize();
        
        res.json({ 
          message: '修复任务更新成功',
          risk_assessment: riskResult.riskAssessment,
          risks: riskResult.risks
        });
      }
    );
    stmt.finalize();
  });
});

router.put('/:id/override', (req, res) => {
  const { override_reason, actor, new_risk_assessment } = req.body;
  
  db.get('SELECT * FROM repair_tasks WHERE id = ?', [req.params.id], (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!task) {
      return res.status(404).json({ error: '修复任务不存在' });
    }
    
    const stmt = db.prepare(`
      UPDATE repair_tasks 
      SET manual_override = 1, 
          override_reason = ?,
          risk_assessment = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      override_reason,
      new_risk_assessment || '正常',
      req.params.id,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const auditStmt = db.prepare(`
          INSERT INTO audit_logs (task_id, action, actor, details)
          VALUES (?, ?, ?, ?)
        `);
        
        auditStmt.run(
          req.params.id,
          '人工改判',
          actor || '系统',
          JSON.stringify({
            original_risk: task.risk_assessment,
            new_risk: new_risk_assessment || '正常',
            reason: override_reason
          }),
          function(err) {
            if (err) {
              console.error('审计日志记录失败:', err);
            }
          }
        );
        auditStmt.finalize();
        
        res.json({ 
          message: '人工改判成功',
          new_risk_assessment: new_risk_assessment || '正常'
        });
      }
    );
    stmt.finalize();
  });
});

router.put('/:id/recheck', (req, res) => {
  const { actor } = req.body;
  
  db.get('SELECT * FROM repair_tasks WHERE id = ?', [req.params.id], (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!task) {
      return res.status(404).json({ error: '修复任务不存在' });
    }
    
    let chemicalBatchIds = [];
    try {
      chemicalBatchIds = task.chemical_batch_ids ? JSON.parse(task.chemical_batch_ids) : [];
    } catch (e) {
      chemicalBatchIds = [];
    }
    
    const taskData = {
      book_id: task.book_id,
      reviewer_id1: task.reviewer_id1,
      reviewer_id2: task.reviewer_id2,
      cabinet_id: task.cabinet_id,
      chemical_batch_ids: chemicalBatchIds
    };
    
    checkRisks(taskData, (err, riskResult) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.all(`
        SELECT * FROM repair_steps 
        WHERE task_id = ? 
        ORDER BY step_order
      `, [req.params.id], (err, steps) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        checkStepOrder(steps, (err, stepRisks) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          const allRisks = [...riskResult.risks, ...stepRisks];
          let finalRiskAssessment = '正常';
          
          if (allRisks.length > 0) {
            const hasCriticalRisk = allRisks.some(r => 
              r.includes('过期') || r.includes('未双人复核') || r.includes('容量不足') || r.includes('缺失')
            );
            finalRiskAssessment = hasCriticalRisk ? '高风险' : '中风险';
          }
          
          const stmt = db.prepare(`
            UPDATE repair_tasks 
            SET risk_assessment = ?, 
                risk_details = ?,
                manual_override = 0,
                override_reason = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `);
          
          const allRiskDetails = [...riskResult.riskDetails];
          stepRisks.forEach(r => allRiskDetails.push(r));
          
          stmt.run(
            finalRiskAssessment,
            JSON.stringify(allRiskDetails),
            req.params.id,
            function(err) {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              const auditStmt = db.prepare(`
                INSERT INTO audit_logs (task_id, action, actor, details)
                VALUES (?, ?, ?, ?)
              `);
              
              auditStmt.run(
                req.params.id,
                '重新计算风险',
                actor || '系统',
                JSON.stringify({
                  original_risk: task.risk_assessment,
                  new_risk: finalRiskAssessment,
                  risks: allRisks
                }),
                function(err) {
                  if (err) {
                    console.error('审计日志记录失败:', err);
                  }
                }
              );
              auditStmt.finalize();
              
              res.json({ 
                message: '风险重新计算成功',
                risk_assessment: finalRiskAssessment,
                risks: allRisks,
                risk_details: allRiskDetails
              });
            }
          );
          stmt.finalize();
        });
      });
    });
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT cabinet_id FROM repair_tasks WHERE id = ?', [req.params.id], (err, task) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    db.run('DELETE FROM repair_tasks WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '修复任务不存在' });
      }
      
      if (task && task.cabinet_id) {
        db.run(`
          UPDATE humidity_cabinets 
          SET current_usage = MAX(0, current_usage - 1) 
          WHERE id = ?
        `, [task.cabinet_id]);
      }
      
      res.json({ message: '修复任务删除成功' });
    });
  });
});

module.exports = router;
