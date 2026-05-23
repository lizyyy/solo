const express = require('express');
const router = express.Router();
const Joi = require('joi');
const moment = require('moment');
const DBUtils = require('../utils/dbUtils');
const ResponseUtil = require('../utils/response');

const reviewSchema = Joi.object({
  reviewed_by: Joi.string().required(),
  review_notes: Joi.string().allow(''),
  compensation_notes: Joi.string().allow('')
});

router.get('/', async (req, res, next) => {
  try {
    const { status, resource_type, resource_id, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM change_confirmations WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (resource_type) {
      sql += ' AND resource_type = ?';
      params.push(resource_type);
    }
    if (resource_id) {
      sql += ' AND resource_id = ?';
      params.push(resource_id);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const confirmations = await DBUtils.getAll(sql, params);
    const countResult = await DBUtils.getOne('SELECT COUNT(*) as total FROM change_confirmations');

    ResponseUtil.success(res, {
      items: confirmations,
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
    const confirmation = await DBUtils.getOne(
      'SELECT * FROM change_confirmations WHERE id = ?',
      [req.params.id]
    );

    if (!confirmation) {
      return ResponseUtil.notFound(res, '变更确认记录不存在');
    }

    try {
      confirmation.original_data = JSON.parse(confirmation.original_data);
      confirmation.new_data = JSON.parse(confirmation.new_data);
    } catch (e) {
    }

    ResponseUtil.success(res, confirmation);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/approve', async (req, res, next) => {
  try {
    const { error, value } = reviewSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const confirmation = await DBUtils.getOne(
      'SELECT * FROM change_confirmations WHERE id = ?',
      [req.params.id]
    );

    if (!confirmation) {
      return ResponseUtil.notFound(res, '变更确认记录不存在');
    }

    if (confirmation.status !== 'pending_review') {
      return ResponseUtil.conflict(res, '该变更请求已处理，无法重复审批');
    }

    let newData;
    try {
      newData = JSON.parse(confirmation.new_data);
    } catch (e) {
      newData = {};
    }

    const plan = await DBUtils.getOne(
      'SELECT * FROM medication_plans WHERE id = ?',
      [confirmation.resource_id]
    );

    if (plan) {
      const newVersion = plan.version + 1;
      await DBUtils.update('medication_plans', { is_active: 0 }, confirmation.resource_id);

      const newPlanId = await DBUtils.insert('medication_plans', {
        order_id: plan.order_id,
        pet_id: plan.pet_id,
        medication_name: plan.medication_name,
        dosage: newData.dosage || plan.dosage,
        dosage_unit: newData.dosage_unit || plan.dosage_unit,
        frequency: newData.frequency || plan.frequency,
        start_date: plan.start_date,
        end_date: newData.end_date || plan.end_date,
        administration_method: plan.administration_method,
        notes: newData.notes || plan.notes,
        version: newVersion,
        is_active: 1,
        created_by: value.reviewed_by
      });

      await DBUtils.runQuery(
        'UPDATE shift_executions SET medication_plan_id = ? WHERE medication_plan_id = ? AND status = "pending"',
        [newPlanId, confirmation.resource_id]
      );
    }

    await DBUtils.update('change_confirmations', {
      status: 'approved',
      reviewed_by: value.reviewed_by,
      reviewed_at: moment().toISOString(),
      review_notes: value.review_notes,
      compensation_notes: value.compensation_notes
    }, req.params.id);

    const updated = await DBUtils.getOne(
      'SELECT * FROM change_confirmations WHERE id = ?',
      [req.params.id]
    );

    ResponseUtil.success(res, updated, '变更请求已批准，计划已更新');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/reject', async (req, res, next) => {
  try {
    const { error, value } = reviewSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const confirmation = await DBUtils.getOne(
      'SELECT * FROM change_confirmations WHERE id = ?',
      [req.params.id]
    );

    if (!confirmation) {
      return ResponseUtil.notFound(res, '变更确认记录不存在');
    }

    if (confirmation.status !== 'pending_review') {
      return ResponseUtil.conflict(res, '该变更请求已处理，无法重复审批');
    }

    await DBUtils.update('change_confirmations', {
      status: 'rejected',
      reviewed_by: value.reviewed_by,
      reviewed_at: moment().toISOString(),
      review_notes: value.review_notes
    }, req.params.id);

    const updated = await DBUtils.getOne(
      'SELECT * FROM change_confirmations WHERE id = ?',
      [req.params.id]
    );

    ResponseUtil.rejected(res, updated, '变更请求已驳回');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
