const express = require('express');
const router = express.Router();
const { ChoreController } = require('../controllers');
const { Validation } = require('../middlewares');

// 获取所有任务
router.get('/', ChoreController.getAll);

// 获取即将到来的任务
router.get('/upcoming', ChoreController.getUpcoming);

// 获取我的任务
router.get('/my', ChoreController.getMyTasks);

// 检查过期任务
router.post('/check-overdue', ChoreController.checkOverdue);

// 根据ID获取任务
router.get('/:id', ChoreController.getById);

// 创建任务
router.post('/', 
  Validation.validateTaskCreate,
  ChoreController.create
);

// 更新任务
router.put('/:id', ChoreController.update);

// 完成任务
router.post('/:id/complete', 
  Validation.validateTaskComplete,
  ChoreController.complete
);

// 标记为爽约
router.post('/:id/miss', ChoreController.miss);

// 跳过任务
router.post('/:id/skip', ChoreController.skip);

module.exports = router;
