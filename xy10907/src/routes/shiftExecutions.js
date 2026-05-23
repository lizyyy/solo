const express = require('express');
const router = express.Router();
const Joi = require('joi');
const moment = require('moment');
const DBUtils = require('../utils/dbUtils');
const ResponseUtil = require('../utils/response');

const executeSchema = Joi.object({
  administered_by: Joi.string().required(),
  actual_dosage: Joi.string().required(),
  notes: Joi.string().allow('')
});

const alarmSchema = Joi.object({
  acknowledged_by: Joi.string().required(),
  notes: Joi.string().allow('')
});

router.get('/', async (req, res, next) => {
  try {
    const { medication_plan_id, status, shift_type, has_alarm, date, page = 1, limit = 50 } = req.query;
    let sql = `
      SELECT se.*, mp.medication_name, mp.dosage as planned_dosage, p.name as pet_name, o.room_number
      FROM shift_executions se
      JOIN medication_plans mp ON se.medication_plan_id = mp.id
      JOIN pets p ON mp.pet_id = p.id
      JOIN orders o ON mp.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (medication_plan_id) {
      sql += ' AND se.medication_plan_id = ?';
      params.push(medication_plan_id);
    }
    if (status) {
      sql += ' AND se.status = ?';
      params.push(status);
    }
    if (shift_type) {
      sql += ' AND se.shift_type = ?';
      params.push(shift_type);
    }
    if (has_alarm !== undefined) {
      sql += ' AND se.has_alarm = ?';
      params.push(has_alarm);
    }
    if (date) {
      sql += ' AND DATE(se.scheduled_time) = ?';
      params.push(date);
    }

    sql += ' ORDER BY se.scheduled_time ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const executions = await DBUtils.getAll(sql, params);
    const countResult = await DBUtils.getOne('SELECT COUNT(*) as total FROM shift_executions');

    ResponseUtil.success(res, {
      items: executions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/pending', async (req, res, next) => {
  try {
    const now = moment().toISOString();
    const pending = await DBUtils.getAll(`
      SELECT se.*, mp.medication_name, p.name as pet_name, o.room_number
      FROM shift_executions se
      JOIN medication_plans mp ON se.medication_plan_id = mp.id
      JOIN pets p ON mp.pet_id = p.id
      JOIN orders o ON mp.order_id = o.id
      WHERE se.status = 'pending' AND se.scheduled_time <= ?
      ORDER BY se.scheduled_time ASC
    `, [now]);

    ResponseUtil.success(res, pending);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const execution = await DBUtils.getOne(`
      SELECT se.*, mp.medication_name, mp.dosage as planned_dosage, p.name as pet_name, o.room_number
      FROM shift_executions se
      JOIN medication_plans mp ON se.medication_plan_id = mp.id
      JOIN pets p ON mp.pet_id = p.id
      JOIN orders o ON mp.order_id = o.id
      WHERE se.id = ?
    `, [req.params.id]);

    if (!execution) {
      return ResponseUtil.notFound(res, '班次执行记录不存在');
    }

    ResponseUtil.success(res, execution);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/execute', async (req, res, next) => {
  try {
    const { error, value } = executeSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const existing = await DBUtils.getOne(
      'SELECT * FROM shift_executions WHERE id = ?',
      [req.params.id]
    );
    if (!existing) {
      return ResponseUtil.notFound(res, '班次执行记录不存在');
    }

    if (existing.status === 'completed') {
      return ResponseUtil.conflict(res, '该班次已执行，无需重复操作');
    }

    await DBUtils.update('shift_executions', {
      status: 'completed',
      actual_time: moment().toISOString(),
      administered_by: value.administered_by,
      actual_dosage: value.actual_dosage,
      notes: value.notes
    }, req.params.id);

    const updated = await DBUtils.getOne(
      'SELECT * FROM shift_executions WHERE id = ?',
      [req.params.id]
    );

    ResponseUtil.success(res, updated, '喂药执行确认成功');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/missed', async (req, res, next) => {
  try {
    const { administered_by, notes } = req.body;
    if (!administered_by) {
      return ResponseUtil.invalidInput(res, '操作人不能为空');
    }

    const existing = await DBUtils.getOne(
      'SELECT * FROM shift_executions WHERE id = ?',
      [req.params.id]
    );
    if (!existing) {
      return ResponseUtil.notFound(res, '班次执行记录不存在');
    }

    await DBUtils.update('shift_executions', {
      status: 'missed',
      actual_time: moment().toISOString(),
      administered_by,
      has_alarm: 1,
      notes: notes || '漏喂'
    }, req.params.id);

    const updated = await DBUtils.getOne(
      'SELECT * FROM shift_executions WHERE id = ?',
      [req.params.id]
    );

    ResponseUtil.success(res, updated, '已标记为漏喂，已触发告警');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/alarm/acknowledge', async (req, res, next) => {
  try {
    const { error, value } = alarmSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const existing = await DBUtils.getOne(
      'SELECT * FROM shift_executions WHERE id = ?',
      [req.params.id]
    );
    if (!existing) {
      return ResponseUtil.notFound(res, '班次执行记录不存在');
    }

    if (!existing.has_alarm) {
      return ResponseUtil.conflict(res, '该班次无待确认的告警');
    }

    await DBUtils.update('shift_executions', {
      alarm_acknowledged: 1,
      notes: (existing.notes || '') + ' [告警已确认]'
    }, req.params.id);

    const updated = await DBUtils.getOne(
      'SELECT * FROM shift_executions WHERE id = ?',
      [req.params.id]
    );

    ResponseUtil.success(res, updated, '告警已确认');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/correct', async (req, res, next) => {
  try {
    const { administered_by, actual_dosage, notes, compensation_notes } = req.body;
    if (!administered_by || !actual_dosage) {
      return ResponseUtil.invalidInput(res, '操作人和实际剂量不能为空');
    }

    const existing = await DBUtils.getOne(
      'SELECT * FROM shift_executions WHERE id = ?',
      [req.params.id]
    );
    if (!existing) {
      return ResponseUtil.notFound(res, '班次执行记录不存在');
    }

    await DBUtils.update('shift_executions', {
      status: 'compensated',
      actual_time: moment().toISOString(),
      actual_dosage,
      administered_by,
      notes: notes || existing.notes
    }, req.params.id);

    const updated = await DBUtils.getOne(
      'SELECT * FROM shift_executions WHERE id = ?',
      [req.params.id]
    );

    ResponseUtil.compensated(res, {
      execution: updated,
      compensation_notes: compensation_notes || '人工修正完成'
    }, '喂药记录已人工修正');
  } catch (err) {
    next(err);
  }
});

router.get('/alarms/active', async (req, res, next) => {
  try {
    const alarms = await DBUtils.getAll(`
      SELECT se.*, mp.medication_name, p.name as pet_name, o.room_number
      FROM shift_executions se
      JOIN medication_plans mp ON se.medication_plan_id = mp.id
      JOIN pets p ON mp.pet_id = p.id
      JOIN orders o ON mp.order_id = o.id
      WHERE se.has_alarm = 1 AND se.alarm_acknowledged = 0
      ORDER BY se.scheduled_time DESC
    `);

    ResponseUtil.success(res, alarms);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
