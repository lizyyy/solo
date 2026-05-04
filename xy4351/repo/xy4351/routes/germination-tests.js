const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

function logAudit(batchId, action, actor, details, callback) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (batch_id, action, actor, details)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(
    batchId,
    action,
    actor,
    details ? JSON.stringify(details) : null,
    function(err) {
      if (callback) callback(err, this.lastID);
    }
  );
  stmt.finalize();
}

router.get('/', (req, res) => {
  const batchId = req.query.batch_id;
  let query = `
    SELECT gt.*,
           sb.batch_number,
           ns.common_name, ns.scientific_name
    FROM germination_tests gt
    LEFT JOIN seed_batches sb ON gt.seed_batch_id = sb.id
    LEFT JOIN native_species ns ON sb.species_id = ns.id
  `;
  const params = [];
  
  if (batchId) {
    query += ' WHERE gt.seed_batch_id = ?';
    params.push(batchId);
  }
  query += ' ORDER BY gt.test_date DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get(`
    SELECT gt.*,
           sb.batch_number, sb.initial_germination_rate,
           ns.common_name, ns.scientific_name, ns.germination_threshold
    FROM germination_tests gt
    LEFT JOIN seed_batches sb ON gt.seed_batch_id = sb.id
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    WHERE gt.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '萌发测试记录不存在' });
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const {
    seed_batch_id,
    test_date,
    tested_by,
    seeds_planted,
    seeds_germinated,
    test_conditions,
    duration_days,
    notes,
    actor
  } = req.body;

  if (!seed_batch_id || !test_date || seeds_planted === undefined) {
    return res.status(400).json({ error: '种子批次ID、测试日期和播种数量为必填项' });
  }

  const finalGerminated = seeds_germinated || 0;
  const germinationRate = seeds_planted > 0 ? (finalGerminated / seeds_planted) * 100 : 0;

  db.get(`
    SELECT sb.*, ns.germination_threshold, ns.common_name
    FROM seed_batches sb
    LEFT JOIN native_species ns ON sb.species_id = ns.id
    WHERE sb.id = ?
  `, [seed_batch_id], (err, batch) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!batch) {
      return res.status(404).json({ error: '种子批次不存在' });
    }

    const threshold = batch.germination_threshold || 50.0;
    const isLow = germinationRate < threshold;

    const stmt = db.prepare(`
      INSERT INTO germination_tests (
        seed_batch_id, test_date, tested_by, seeds_planted,
        seeds_germinated, germination_rate, test_conditions,
        duration_days, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      seed_batch_id,
      test_date,
      tested_by || null,
      seeds_planted,
      finalGerminated,
      germinationRate,
      test_conditions || null,
      duration_days || null,
      notes || null,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const testId = this.lastID;

        db.all(`
          SELECT AVG(germination_rate) as avg_rate
          FROM germination_tests
          WHERE seed_batch_id = ?
        `, [seed_batch_id], (err, avgResult) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const avgRate = avgResult[0].avg_rate || germinationRate;

          db.run(`
            UPDATE seed_batches 
            SET initial_germination_rate = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [avgRate, seed_batch_id]);

          logAudit(
            seed_batch_id,
            '新增萌发测试',
            actor || tested_by || '系统',
            {
              test_id: testId,
              seeds_planted: seeds_planted,
              seeds_germinated: finalGerminated,
              germination_rate: germinationRate,
              threshold: threshold,
              status: isLow ? '低于阈值' : '正常'
            }
          );

          res.status(201).json({
            id: testId,
            message: '萌发测试记录创建成功',
            germination_rate: germinationRate,
            threshold: threshold,
            status: isLow ? '萌发率过低' : '正常',
            batch_updated: true
          });
        });
      }
    );
    stmt.finalize();
  });
});

router.put('/:id', (req, res) => {
  const {
    test_date,
    tested_by,
    seeds_planted,
    seeds_germinated,
    test_conditions,
    duration_days,
    notes,
    actor
  } = req.body;

  db.get(`
    SELECT gt.*, sb.batch_number
    FROM germination_tests gt
    LEFT JOIN seed_batches sb ON gt.seed_batch_id = sb.id
    WHERE gt.id = ?
  `, [req.params.id], (err, existingTest) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!existingTest) {
      return res.status(404).json({ error: '萌发测试记录不存在' });
    }

    const finalPlanted = seeds_planted !== undefined ? seeds_planted : existingTest.seeds_planted;
    const finalGerminated = seeds_germinated !== undefined ? seeds_germinated : existingTest.seeds_germinated;
    const germinationRate = finalPlanted > 0 ? (finalGerminated / finalPlanted) * 100 : 0;

    const stmt = db.prepare(`
      UPDATE germination_tests 
      SET test_date = ?, tested_by = ?, seeds_planted = ?,
          seeds_germinated = ?, germination_rate = ?, test_conditions = ?,
          duration_days = ?, notes = ?
      WHERE id = ?
    `);
    
    stmt.run(
      test_date || existingTest.test_date,
      tested_by !== undefined ? tested_by : existingTest.tested_by,
      finalPlanted,
      finalGerminated,
      germinationRate,
      test_conditions !== undefined ? test_conditions : existingTest.test_conditions,
      duration_days !== undefined ? duration_days : existingTest.duration_days,
      notes !== undefined ? notes : existingTest.notes,
      req.params.id,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        db.all(`
          SELECT AVG(germination_rate) as avg_rate
          FROM germination_tests
          WHERE seed_batch_id = ?
        `, [existingTest.seed_batch_id], (err, avgResult) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          const avgRate = avgResult[0].avg_rate || germinationRate;

          db.run(`
            UPDATE seed_batches 
            SET initial_germination_rate = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [avgRate, existingTest.seed_batch_id]);

          logAudit(
            existingTest.seed_batch_id,
            '更新萌发测试',
            actor || '系统',
            {
              test_id: req.params.id,
              old_rate: existingTest.germination_rate,
              new_rate: germinationRate
            }
          );

          res.json({ 
            message: '萌发测试记录更新成功',
            germination_rate: germinationRate
          });
        });
      }
    );
    stmt.finalize();
  });
});

router.delete('/:id', (req, res) => {
  db.get('SELECT * FROM germination_tests WHERE id = ?', [req.params.id], (err, test) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!test) {
      return res.status(404).json({ error: '萌发测试记录不存在' });
    }

    db.run('DELETE FROM germination_tests WHERE id = ?', [req.params.id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      db.all(`
        SELECT AVG(germination_rate) as avg_rate
        FROM germination_tests
        WHERE seed_batch_id = ?
      `, [test.seed_batch_id], (err, avgResult) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const avgRate = avgResult[0].avg_rate || null;

        db.run(`
          UPDATE seed_batches 
          SET initial_germination_rate = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [avgRate, test.seed_batch_id]);

        logAudit(
          test.seed_batch_id,
          '删除萌发测试',
          '系统',
          {
            test_id: req.params.id,
            deleted_rate: test.germination_rate
          }
        );

        res.json({ message: '萌发测试记录删除成功' });
      });
    });
  });
});

module.exports = router;
