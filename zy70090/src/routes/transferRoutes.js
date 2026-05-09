const express = require('express');
const { ApiResponse } = require('../utils/response');
const TransferService = require('../services/transferService');
const { authenticate } = require('../middleware/auth');
const { idempotent } = require('../middleware/idempotent');

const router = express.Router();

router.post('/create/:seizedItemId', authenticate, idempotent(), async (req, res, next) => {
  try {
    const transfer = await TransferService.createTransfer(req, req.params.seizedItemId, req.body);
    res.status(201).json(ApiResponse.success(transfer, '移交记录创建成功'));
  } catch (error) {
    next(error);
  }
});

router.post('/confirm/:transferId', authenticate, async (req, res, next) => {
  try {
    const result = await TransferService.confirmTransfer(req, req.params.transferId, req.body);
    res.json(ApiResponse.success(result, '移交确认成功'));
  } catch (error) {
    next(error);
  }
});

router.post('/cancel/:transferId', authenticate, async (req, res, next) => {
  try {
    const result = await TransferService.cancelTransfer(req, req.params.transferId, req.body);
    res.json(ApiResponse.success(result, '移交取消成功'));
  } catch (error) {
    next(error);
  }
});

router.post('/retry/:transferId', authenticate, async (req, res, next) => {
  try {
    const result = await TransferService.retryFailedTransfer(req, req.params.transferId);
    res.json(ApiResponse.success(result));
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { 
      transfer_number, transfer_status, seized_item_id,
      from_department, to_department,
      start_date, end_date,
      page = 1, page_size = 20 
    } = req.query;

    const result = await TransferService.list(
      {
        transfer_number,
        transfer_status,
        seized_item_id,
        from_department,
        to_department,
        start_date,
        end_date
      },
      parseInt(page),
      parseInt(page_size)
    );

    res.json(ApiResponse.pagination(result.transfers, result.total, page, page_size));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const transfer = await TransferService.getById(req.params.id);
    res.json(ApiResponse.success(transfer));
  } catch (error) {
    next(error);
  }
});

router.get('/item/:seizedItemId', authenticate, async (req, res, next) => {
  try {
    const transfers = await TransferService.getByItemId(req.params.seizedItemId);
    res.json(ApiResponse.success(transfers));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
