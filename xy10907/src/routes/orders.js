const express = require('express');
const router = express.Router();
const Joi = require('joi');
const moment = require('moment');
const DBUtils = require('../utils/dbUtils');
const ResponseUtil = require('../utils/response');

const orderSchema = Joi.object({
  pet_id: Joi.string().required(),
  check_in_date: Joi.date().required(),
  check_out_date: Joi.date().required(),
  room_number: Joi.string().allow(''),
  status: Joi.string().valid('active', 'completed', 'cancelled').default('active'),
  notes: Joi.string().allow('')
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = orderSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const pet = await DBUtils.getOne('SELECT * FROM pets WHERE id = ?', [value.pet_id]);
    if (!pet) {
      return ResponseUtil.notFound(res, '宠物档案不存在');
    }

    if (moment(value.check_out_date).isBefore(value.check_in_date)) {
      return ResponseUtil.invalidInput(res, '退房日期不能早于入住日期');
    }

    const id = await DBUtils.insert('orders', value);
    const order = await DBUtils.getOne(`
      SELECT o.*, p.name as pet_name, p.species, p.owner_name, p.owner_phone
      FROM orders o
      JOIN pets p ON o.pet_id = p.id
      WHERE o.id = ?
    `, [id]);
    ResponseUtil.success(res, order, '寄养订单创建成功', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { pet_id, status, page = 1, limit = 20 } = req.query;
    let sql = `
      SELECT o.*, p.name as pet_name, p.species, p.owner_name
      FROM orders o
      JOIN pets p ON o.pet_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (pet_id) {
      sql += ' AND o.pet_id = ?';
      params.push(pet_id);
    }
    if (status) {
      sql += ' AND o.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const orders = await DBUtils.getAll(sql, params);
    const countResult = await DBUtils.getOne('SELECT COUNT(*) as total FROM orders');
    
    ResponseUtil.success(res, {
      items: orders,
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
    const order = await DBUtils.getOne(`
      SELECT o.*, p.name as pet_name, p.species, p.owner_name, p.owner_phone
      FROM orders o
      JOIN pets p ON o.pet_id = p.id
      WHERE o.id = ?
    `, [req.params.id]);
    if (!order) {
      return ResponseUtil.notFound(res, '寄养订单不存在');
    }
    ResponseUtil.success(res, order);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = orderSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const existing = await DBUtils.getOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing) {
      return ResponseUtil.notFound(res, '寄养订单不存在');
    }

    await DBUtils.update('orders', value, req.params.id);
    const updated = await DBUtils.getOne(`
      SELECT o.*, p.name as pet_name, p.species, p.owner_name
      FROM orders o
      JOIN pets p ON o.pet_id = p.id
      WHERE o.id = ?
    `, [req.params.id]);
    ResponseUtil.success(res, updated, '寄养订单更新成功');
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'completed', 'cancelled'].includes(status)) {
      return ResponseUtil.invalidInput(res, '无效的订单状态');
    }

    const existing = await DBUtils.getOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!existing) {
      return ResponseUtil.notFound(res, '寄养订单不存在');
    }

    await DBUtils.update('orders', { status }, req.params.id);
    const updated = await DBUtils.getOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    ResponseUtil.success(res, updated, `订单状态已更新为${status}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
