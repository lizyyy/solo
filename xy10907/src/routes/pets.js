const express = require('express');
const router = express.Router();
const Joi = require('joi');
const DBUtils = require('../utils/dbUtils');
const ResponseUtil = require('../utils/response');

const petSchema = Joi.object({
  name: Joi.string().required(),
  species: Joi.string().required(),
  breed: Joi.string().allow(''),
  age: Joi.number().integer().min(0).allow(null),
  weight: Joi.number().min(0).allow(null),
  owner_name: Joi.string().required(),
  owner_phone: Joi.string().required(),
  notes: Joi.string().allow('')
});

router.post('/', async (req, res, next) => {
  try {
    const { error, value } = petSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const id = await DBUtils.insert('pets', value);
    const pet = await DBUtils.getOne('SELECT * FROM pets WHERE id = ?', [id]);
    ResponseUtil.success(res, pet, '宠物档案创建成功', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { species, owner_name, page = 1, limit = 20 } = req.query;
    let sql = 'SELECT * FROM pets WHERE 1=1';
    const params = [];

    if (species) {
      sql += ' AND species LIKE ?';
      params.push(`%${species}%`);
    }
    if (owner_name) {
      sql += ' AND owner_name LIKE ?';
      params.push(`%${owner_name}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const pets = await DBUtils.getAll(sql, params);
    const countResult = await DBUtils.getOne('SELECT COUNT(*) as total FROM pets');
    
    ResponseUtil.success(res, {
      items: pets,
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
    const pet = await DBUtils.getOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!pet) {
      return ResponseUtil.notFound(res, '宠物档案不存在');
    }
    ResponseUtil.success(res, pet);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = petSchema.validate(req.body);
    if (error) {
      return ResponseUtil.invalidInput(res, '参数验证失败', error.details);
    }

    const existing = await DBUtils.getOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!existing) {
      return ResponseUtil.notFound(res, '宠物档案不存在');
    }

    await DBUtils.update('pets', value, req.params.id);
    const updated = await DBUtils.getOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    ResponseUtil.success(res, updated, '宠物档案更新成功');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await DBUtils.getOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!existing) {
      return ResponseUtil.notFound(res, '宠物档案不存在');
    }

    const activeOrders = await DBUtils.getOne(
      'SELECT COUNT(*) as count FROM orders WHERE pet_id = ? AND status = "active"',
      [req.params.id]
    );
    if (activeOrders.count > 0) {
      return ResponseUtil.conflict(res, '该宠物有活跃寄养订单，无法删除');
    }

    await DBUtils.delete('pets', req.params.id);
    ResponseUtil.success(res, null, '宠物档案删除成功');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
