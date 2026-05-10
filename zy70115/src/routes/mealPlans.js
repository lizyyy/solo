const express = require('express');
const router = express.Router();
const db = require('../config/database');
const mealRoutingService = require('../services/mealRoutingService');
const processLogService = require('../services/processLogService');
const { buildSuccessResponse, buildErrorResponse } = require('../utils/common');

router.get('/', (req, res) => {
  db.all('SELECT * FROM meal_plans ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
    res.json(buildSuccessResponse(rows));
  });
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM meal_plans WHERE id = ?', [id], (err, plan) => {
    if (err) return res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
    if (!plan) return res.status(404).json(buildErrorResponse('配餐计划不存在', 404));
    res.json(buildSuccessResponse(plan));
  });
});

router.post('/', async (req, res) => {
  const { planDate, notes, operator } = req.body;
  if (!planDate) {
    return res.status(400).json(buildErrorResponse('请提供配餐日期 (planDate)', 400);
  }

  try {
    const result = await mealRoutingService.createMealPlan(planDate, notes || '', operator || 'system');
    res.json(buildSuccessResponse(result, '配餐计划创建成功'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('创建失败', 500, err.message));
  }
});

router.post('/matchRoute', async (req, res) => {
  const { classId, mealCount, menuAllergens, operator } = req.body;
  if (!classId || mealCount === undefined) {
    return res.status(400).json(buildErrorResponse('请提供班级ID和配餐人数', 400));
  }

  try {
    const result = await mealRoutingService.matchMealToRoute(
      parseInt(classId), 
      parseInt(mealCount),
      menuAllergens || [],
      operator || 'system'
    );
    res.json(buildSuccessResponse(result, result.success ? '路由匹配成功' : '存在校验问题，请查看详情'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('匹配失败', 500, err.message));
  }
});

router.post('/:planId/items', async (req, res) => {
  const { planId } = req.params;
  const { classId, mealCount, menuAllergens, operator } = req.body;
  
  if (!classId || mealCount === undefined) {
    return res.status(400).json(buildErrorResponse('请提供班级ID和配餐人数', 400));
  }

  try {
    const result = await mealRoutingService.addMealPlanItem(
      parseInt(planId),
      parseInt(classId),
      parseInt(mealCount),
      menuAllergens || [],
      operator || 'system'
    );
    res.json(buildSuccessResponse(result, result.success ? '项目添加成功' : '项目已添加但存在待审核项'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('添加失败', 500, err.message));
  }
});

router.get('/:planId/items', (req, res) => {
  const { planId } = req.params;
  db.all(`
    SELECT mpi.*, s.name as school_name, c.name as class_name, dr.name as route_name
    FROM meal_plan_items mpi
    JOIN schools s ON mpi.school_id = s.id
    JOIN classes c ON mpi.class_id = c.id
    LEFT JOIN delivery_routes dr ON mpi.route_id = dr.id
    WHERE mpi.meal_plan_id = ?
    ORDER BY s.name, c.name
  `, [planId], (err, rows) => {
    if (err) return res.status(500).json(buildErrorResponse('查询失败', 500, err.message));
    res.json(buildSuccessResponse(rows));
  });
});

router.post('/:planId/validateAllergens', async (req, res) => {
  const { planId } = req.params;
  const { operator } = req.body;
  
  try {
    const result = await mealRoutingService.validateAllergenRules(parseInt(planId), operator || 'system');
    res.json(buildSuccessResponse(result, result.success ? '过敏源校验全部通过' : '存在过敏源冲突'));
  } catch (err) {
    res.status(500).json(buildErrorResponse('校验失败', 500, err.message));
  }
});

module.exports = router;
