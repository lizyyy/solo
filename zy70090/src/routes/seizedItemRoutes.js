const express = require('express');
const { ApiResponse } = require('../utils/response');
const SeizedItemService = require('../services/seizedItemService');
const { authenticate, requireRoles } = require('../middleware/auth');
const { idempotent } = require('../middleware/idempotent');

const router = express.Router();

router.post('/', authenticate, idempotent(), async (req, res, next) => {
  try {
    const item = await SeizedItemService.create(req, req.body);
    res.status(201).json(ApiResponse.success(item, '扣押清单创建成功'));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const item = await SeizedItemService.update(req, req.params.id, req.body);
    res.json(ApiResponse.success(item, '扣押清单更新成功'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticate, requireRoles('admin', 'supervisor'), async (req, res, next) => {
  try {
    await SeizedItemService.delete(req, req.params.id);
    res.json(ApiResponse.success({ deleted: true }, '扣押清单删除成功'));
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { 
      case_number, case_name, item_name, current_status, 
      seized_by, item_owner_name, start_date, end_date,
      page = 1, page_size = 20 
    } = req.query;

    const result = await SeizedItemService.list(
      {
        case_number,
        case_name,
        item_name,
        current_status,
        seized_by,
        item_owner_name,
        start_date,
        end_date
      },
      parseInt(page),
      parseInt(page_size)
    );

    res.json(ApiResponse.pagination(result.items, result.total, page, page_size));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const item = await SeizedItemService.getById(req.params.id);
    res.json(ApiResponse.success(item));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/details', authenticate, async (req, res, next) => {
  try {
    const details = await SeizedItemService.getFullDetails(req.params.id);
    res.json(ApiResponse.success(details));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
