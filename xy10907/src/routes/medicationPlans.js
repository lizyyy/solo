const express = require('express');
const router = express.Router();
const Joi = require('joi');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const DBUtils = require('../utils/dbUtils');
const ResponseUtil = require('../utils/response');

const medicationPlanSchema = Joi.object({
  order_id: Joi.string().required(),
  pet_id: Joi.string().required(),
  medication_name: Joi.string().required(),
  dosage: Joi.string().required(),
  dosage_unit: Joi.string().required(),
  frequency: Joi.string().required(),
  start_date: Joi.date().required(),
  end_date: Joi.date().required(),
  administration_method: Joi.string().allow(''),
  created_by: Joi.string().allow(''),
  notes: Joi.string().allow('')
});

const changeRequestSchema = Joi.object({
  request_id: Joi.string().required(),
  dosage: Joi.string(),
  dosage_unit: Joi.string(),
  frequency: Joi.string(),
  end_date: Joi.date(),
  notes: Joi.string().allow(''),
  requested_by: Joi.string().allow('')
});

function generateShiftExecutions(medicationPlanId, frequency, startDate, endDate) {
  const executions = [];
  const start = moment(startDate);
  const end = moment(endDate);
  let current = start.clone().startOf('day');

  while (current.isSameOrBefore(end, 'day')) {
    if (frequency.includes('每日') || frequency.includes('每天')) {
      if (frequency.includes('2次') || frequency.includes('两次')) {
        executions.push({
          id: uuidv4(),
          medication_plan_id: medicationPlanId,
          scheduled_time: current.clone().hour(9).minute(0).toISOString(),
          shift_type: 'morning',
          status: 'pending'
        });
        executions.push({
          id: uuidv4(),
          medication_plan_id: medicationPlanId,
          scheduled_time: current.clone().hour(21).minute(0).toISOString(),
          shift_type: 'night',
          status: 'pending'
        });
      } else if (frequency.includes('3次')) {
        executions.push({
          id: uuidv4(),
          medication_plan_id: medicationPlanId,
          scheduled_time: current.clone().hour(8).minute(0).toISOString(),
          shift_type: 'morning',
          status: 'pending'
        });
        executions.push({
          id: uuidv4(),
          medication_plan_id: medicationPlanId,
          scheduled_time: current.clone().hour(14).minute(0).toISOString(),
          shift_type: 'afternoon',
          status: 'pending'
        });
        executions.push({
          id: uuidv4(),
          medication_plan_id: medicationPlanId,
          scheduled_time: current.clone().hour(21).minute(0).toISOString(),
          shift_type: 'night',
          status: 'pending'
        });
      } else {
        executions.push({
          id: uuidv4(),
          medication_plan_id: medicationPlanId,
          scheduled_time: current.clone().hour(12).minute(0).toISOString(),
          shift_type: 'noon',
          status: 'pending'
        });
      }
    } else if (frequency.includes('每12小时')) {
      let time = current.clone().hour(8).minute(0);
      while (time.isSame(current, 'day')) {
        executions.push({
          id: uuidv4(),
          medication_plan_id: medicationPlanId,
          scheduled_time: time.toISOString(),
          shift_type: time.hour() < 12 ? 'morning' : 'night',
          status: 'pending'
        });
        time.add(12, 'hours');
      }
    } else {
      executions.push({
        id: uuidv4(),
        medication_plan_id: medicationPlanId,
        scheduled_time: current.clone().hour(12).minute(0).toISOString(),
        shift_type: 'noon',
        status: 'pending'
      });
    }
    current.add(1, 'day');
  }

  return executions;
}

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = medicationPlanSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const order = await DBUtils.getOne('SELECT * FROM orders WHERE id = ?', [value.order_id]);
    if (!order) {
      return ResponseUtil.notFound(res, '寄养订单不存在');
    }

    if (moment(value.end_date).isBefore(value.start_date)) {
      return ResponseUtil.invalidInput(res, '结束日期不能早于开始日期');
    }

    const planId = await DBUtils.insert('medication_plans', { ...value, version: 1, is_active: 1 });
    
    const executions = generateShiftExecutions(planId, value.frequency, value.start_date, value.end_date);
    for (const exec of executions) {
      await DBUtils.runQuery(
        'INSERT INTO shift_executions (id, medication_plan_id, scheduled_time, shift_type, status) VALUES (?, ?, ?, ?, ?)',
        [exec.id, exec.medication_plan_id, exec.scheduled_time, exec.shift_type, exec.status]
      );
    }

    const plan = await DBUtils.getOne(`
      SELECT mp.*, p.name as pet_name, o.room_number
      FROM medication_plans mp
      JOIN pets p ON mp.pet_id = p.id
      JOIN orders o ON mp.order_id = o.id
      WHERE mp.id = ?
    `, [planId]);

    const createdExecutions = await DBUtils.getAll(
      'SELECT * FROM shift_executions WHERE medication_plan_id = ? ORDER BY scheduled_time',
      [planId]
    );

    ResponseUtil.success(res, {
      plan,
      executions: createdExecutions
    }, '喂药计划创建成功', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { order_id, pet_id, is_active, page = 1, limit = 20 } = req.query;
    let sql = `
      SELECT mp.*, p.name as pet_name, o.room_number
      FROM medication_plans mp
      JOIN pets p ON mp.pet_id = p.id
      JOIN orders o ON mp.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (order_id) {
      sql += ' AND mp.order_id = ?';
      params.push(order_id);
    }
    if (pet_id) {
      sql += ' AND mp.pet_id = ?';
      params.push(pet_id);
    }
    if (is_active !== undefined) {
      sql += ' AND mp.is_active = ?';
      params.push(is_active);
    }

    sql += ' ORDER BY mp.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const plans = await DBUtils.getAll(sql, params);
    const countResult = await DBUtils.getOne('SELECT COUNT(*) as total FROM medication_plans');
    
    ResponseUtil.success(res, {
      items: plans,
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

router.get('/:id', async (req, res, next) => {
  try {
    const plan = await DBUtils.getOne(`
      SELECT mp.*, p.name as pet_name, o.room_number
      FROM medication_plans mp
      JOIN pets p ON mp.pet_id = p.id
      JOIN orders o ON mp.order_id = o.id
      WHERE mp.id = ?
    `, [req.params.id]);
    if (!plan) {
      return ResponseUtil.notFound(res, '喂药计划不存在');
    }

    const executions = await DBUtils.getAll(
      'SELECT * FROM shift_executions WHERE medication_plan_id = ? ORDER BY scheduled_time',
      [req.params.id]
    );

    ResponseUtil.success(res, { ...plan, executions });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/change-request', async (req, res, next) => {
  try {
    const { error, value } = changeRequestSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const existingPlan = await DBUtils.getOne(
      'SELECT * FROM medication_plans WHERE id = ?',
      [req.params.id]
    );
    if (!existingPlan) {
      return ResponseUtil.notFound(res, '喂药计划不存在');
    }

    const existingRequest = await DBUtils.getOne(
      'SELECT * FROM change_confirmations WHERE request_id = ?',
      [value.request_id]
    );
    if (existingRequest) {
      return ResponseUtil.success(
        res,
        existingRequest,
        '请求已处理（幂等返回）'
      );
    }

    const changeData = {};
    if (value.dosage) changeData.dosage = value.dosage;
    if (value.dosage_unit) changeData.dosage_unit = value.dosage_unit;
    if (value.frequency) changeData.frequency = value.frequency;
    if (value.end_date) changeData.end_date = value.end_date;
    if (value.notes) changeData.notes = value.notes;

    const confirmationId = await DBUtils.insert('change_confirmations', {
      request_id: value.request_id,
      resource_type: 'medication_plan',
      resource_id: req.params.id,
      change_type: 'dosage_change',
      original_data: JSON.stringify({
        dosage: existingPlan.dosage,
        dosage_unit: existingPlan.dosage_unit,
        frequency: existingPlan.frequency,
        end_date: existingPlan.end_date
      }),
      new_data: JSON.stringify(changeData),
      requested_by: value.requested_by || '',
      status: 'pending_review'
    });

    const confirmation = await DBUtils.getOne(
      'SELECT * FROM change_confirmations WHERE id = ?',
      [confirmationId]
    );

    ResponseUtil.pendingReview(res, confirmation, '剂量变更请求已提交，待复核');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/versions', async (req, res, next) => {
  try {
    const existingPlan = await DBUtils.getOne(
      'SELECT * FROM medication_plans WHERE id = ?',
      [req.params.id]
    );
    if (!existingPlan) {
      return ResponseUtil.notFound(res, '喂药计划不存在');
    }

    const { error, value } = medicationPlanSchema.validate({
      ...existingPlan,
      ...req.body,
      order_id: existingPlan.order_id,
      pet_id: existingPlan.pet_id,
      medication_name: existingPlan.medication_name
    });
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const newVersion = existingPlan.version + 1;
    
    await DBUtils.update('medication_plans', { is_active: 0 }, req.params.id);

    const newPlanId = await DBUtils.insert('medication_plans', {
      ...value,
      version: newVersion,
      is_active: 1
    });

    const executions = generateShiftExecutions(newPlanId, value.frequency, value.start_date, value.end_date);
    for (const exec of executions) {
      await DBUtils.runQuery(
        'INSERT INTO shift_executions (id, medication_plan_id, scheduled_time, shift_type, status) VALUES (?, ?, ?, ?, ?)',
        [exec.id, exec.medication_plan_id, exec.scheduled_time, exec.shift_type, exec.status]
      );
    }

    const newPlan = await DBUtils.getOne(
      'SELECT * FROM medication_plans WHERE id = ?',
      [newPlanId]
    );

    ResponseUtil.success(res, newPlan, `喂药计划已更新至版本${newVersion}`);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const currentPlan = await DBUtils.getOne(
      'SELECT * FROM medication_plans WHERE id = ?',
      [req.params.id]
    );
    if (!currentPlan) {
      return ResponseUtil.notFound(res, '喂药计划不存在');
    }

    const history = await DBUtils.getAll(`
      SELECT * FROM medication_plans
      WHERE order_id = ? AND pet_id = ? AND medication_name = ?
      ORDER BY version DESC
    `, [currentPlan.order_id, currentPlan.pet_id, currentPlan.medication_name]);

    ResponseUtil.success(res, history);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
