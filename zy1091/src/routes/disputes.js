const express = require('express');
const router = express.Router();
const { DisputeController } = require('../controllers');
const { Validation } = require('../middlewares');

// 获取所有争议单
router.get('/', DisputeController.getAll);

// 获取我的争议单
router.get('/my', DisputeController.getMyDisputes);

// 获取分配给我的争议单（管理员）
router.get('/assigned', DisputeController.getAssignedDisputes);

// 获取争议统计
router.get('/stats', DisputeController.getDisputeStats);

// 根据ID获取争议单
router.get('/:id', DisputeController.getById);

// 创建争议单
router.post('/', 
  Validation.validateDisputeCreate,
  DisputeController.create
);

// 更新争议单
router.put('/:id', DisputeController.update);

// 解决争议单
router.post('/:id/resolve', 
  Validation.validateDisputeResolve,
  DisputeController.resolve
);

module.exports = router;
