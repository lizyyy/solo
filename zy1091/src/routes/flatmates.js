const express = require('express');
const router = express.Router();
const { FlatmateController } = require('../controllers');
const { Validation } = require('../middlewares');

// 获取所有室友
router.get('/', FlatmateController.getAll);

// 获取室友余额
router.get('/balance', FlatmateController.getBalance);

// 根据ID获取室友
router.get('/:id', FlatmateController.getById);

// 创建室友
router.post('/', 
  Validation.validateFlatmateCreate,
  FlatmateController.create
);

// 更新室友
router.put('/:id', 
  Validation.validateFlatmateUpdate,
  FlatmateController.update
);

// 删除室友
router.delete('/:id', FlatmateController.delete);

module.exports = router;
