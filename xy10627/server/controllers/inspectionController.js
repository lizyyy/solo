const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const RuleEngine = require('../services/ruleEngine');

class InspectionController {
  static async create(req, res) {
    try {
      const {
        plant_area,
        pest_level,
        missed_inspection_points = 0,
        responsible_person,
        operation_id,
        changed_by
      } = req.body;

      if (operation_id) {
        const exists = await RuleEngine.checkIdempotent(operation_id);
        if (exists) {
          return res.status(409).json({
            success: false,
            message: '该操作已执行过，幂等性保护'
          });
        }
      }

      const id = uuidv4();
      const inspection_no = `INSP-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

      db.run(
        `INSERT INTO inspections 
         (id, inspection_no, plant_area, pest_level, missed_inspection_points, 
          responsible_person, status, operation_id)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [id, inspection_no, plant_area, pest_level, missed_inspection_points, 
         responsible_person, operation_id || uuidv4()],
        async (err) => {
          if (err) {
            return res.status(500).json({ success: false, message: err.message });
          }

          await RuleEngine.addTimelineEntry(
            id, null, 'pending', changed_by || responsible_person, 
            '创建巡检记录', '新的园林养护补苗巡检已创建'
          );

          res.status(201).json({
            success: true,
            data: { id, inspection_no }
          });
        }
      );
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async advance(req, res) {
    try {
      const { id } = req.params;
      const {
        status,
        plant_area,
        pest_level,
        missed_inspection_points,
        outsourced_score,
        seedling_acceptance_status,
        changed_by,
        change_reason,
        change_details
      } = req.body;

      db.get('SELECT * FROM inspections WHERE id = ?', [id], async (err, oldInspection) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        if (!oldInspection) {
          return res.status(404).json({ success: false, message: '巡检记录不存在' });
        }

        const updates = [];
        const params = [];

        if (status && status !== oldInspection.status) {
          updates.push('status = ?');
          params.push(status);
        }

        if (plant_area && plant_area !== oldInspection.plant_area) {
          updates.push('plant_area = ?');
          updates.push('plant_area_before = ?');
          params.push(plant_area, oldInspection.plant_area);
          await RuleEngine.addFieldHistory(id, 'plant_area', oldInspection.plant_area, plant_area, changed_by);
        }

        if (pest_level && pest_level !== oldInspection.pest_level) {
          updates.push('pest_level = ?');
          updates.push('pest_level_before = ?');
          params.push(pest_level, oldInspection.pest_level);
          await RuleEngine.addFieldHistory(id, 'pest_level', oldInspection.pest_level, pest_level, changed_by);
        }

        if (missed_inspection_points !== undefined && missed_inspection_points !== oldInspection.missed_inspection_points) {
          updates.push('missed_inspection_points = ?');
          updates.push('missed_inspection_points_before = ?');
          params.push(missed_inspection_points, oldInspection.missed_inspection_points);
          await RuleEngine.addFieldHistory(id, 'missed_inspection_points', oldInspection.missed_inspection_points, missed_inspection_points, changed_by);
        }

        if (outsourced_score !== undefined) {
          updates.push('outsourced_score = ?');
          params.push(outsourced_score);
        }

        if (seedling_acceptance_status !== undefined) {
          updates.push('seedling_acceptance_status = ?');
          params.push(seedling_acceptance_status);
        }

        if (updates.length === 0) {
          return res.status(400).json({ success: false, message: '没有需要更新的字段' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        db.run(
          `UPDATE inspections SET ${updates.join(', ')} WHERE id = ?`,
          params,
          async (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: err.message });
            }

            if (status && status !== oldInspection.status) {
              await RuleEngine.addTimelineEntry(
                id, oldInspection.status, status, changed_by,
                change_reason || '状态变更', change_details || ''
              );
            }

            db.get('SELECT * FROM inspections WHERE id = ?', [id], async (err, updatedInspection) => {
              const ruleResults = await RuleEngine.applyRules(updatedInspection);
              
              if (ruleResults.length > 0) {
                for (const result of ruleResults) {
                  if (result.suggestedStatus && result.suggestedStatus !== updatedInspection.status) {
                    db.run('UPDATE inspections SET status = ? WHERE id = ?', [result.suggestedStatus, id]);
                    await RuleEngine.addTimelineEntry(
                      id, status, result.suggestedStatus, '系统',
                      '规则触发', result.reason
                    );
                  }
                }
              }

              res.json({
                success: true,
                data: updatedInspection,
                rulesTriggered: ruleResults
              });
            });
          }
        );
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async correct(req, res) {
    try {
      const { id } = req.params;
      const { corrections, changed_by, reason } = req.body;

      db.get('SELECT * FROM inspections WHERE id = ?', [id], async (err, oldInspection) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        if (!oldInspection) {
          return res.status(404).json({ success: false, message: '巡检记录不存在' });
        }

        const updates = [];
        const params = [];

        for (const [field, value] of Object.entries(corrections)) {
          if (oldInspection[field] !== undefined && oldInspection[field] !== value) {
            updates.push(`${field} = ?`);
            updates.push(`${field}_before = ?`);
            params.push(value, oldInspection[field]);
            await RuleEngine.addFieldHistory(id, field, oldInspection[field], value, changed_by);
          }
        }

        if (updates.length === 0) {
          return res.status(400).json({ success: false, message: '没有需要修正的字段' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        db.run(
          `UPDATE inspections SET ${updates.join(', ')} WHERE id = ?`,
          params,
          async (err) => {
            if (err) {
              return res.status(500).json({ success: false, message: err.message });
            }

            await RuleEngine.addTimelineEntry(
              id, oldInspection.status, oldInspection.status, changed_by,
              '数据修正', reason || '人工修正数据'
            );

            db.get('SELECT * FROM inspections WHERE id = ?', [id], (err, updated) => {
              res.json({ success: true, data: updated });
            });
          }
        );
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static getAll(req, res) {
    const { responsible_person, start_date, end_date, status } = req.query;
    let query = 'SELECT * FROM inspections WHERE 1=1';
    const params = [];

    if (responsible_person) {
      query += ' AND responsible_person = ?';
      params.push(responsible_person);
    }

    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      res.json({ success: true, data: rows });
    });
  }

  static getById(req, res) {
    const { id } = req.params;
    db.get('SELECT * FROM inspections WHERE id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
      if (!row) {
        return res.status(404).json({ success: false, message: '巡检记录不存在' });
      }
      res.json({ success: true, data: row });
    });
  }

  static getTimeline(req, res) {
    const { id } = req.params;
    db.all(
      `SELECT * FROM status_timeline WHERE inspection_id = ? ORDER BY created_at ASC`,
      [id],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: rows });
      }
    );
  }

  static getFieldHistory(req, res) {
    const { id } = req.params;
    db.all(
      `SELECT * FROM field_history WHERE inspection_id = ? ORDER BY created_at ASC`,
      [id],
      (err, rows) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true, data: rows });
      }
    );
  }
}

module.exports = InspectionController;
