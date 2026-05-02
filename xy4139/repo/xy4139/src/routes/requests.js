const express = require('express');
const router = express.Router();
const RequestService = require('../services/RequestService');

const requestService = new RequestService();

router.get('/', async (req, res, next) => {
  try {
    const options = {
      requester_id: req.query.requester_id,
      chemical_id: req.query.chemical_id,
      batch_id: req.query.batch_id,
      status: req.query.status,
      request_number: req.query.request_number,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };
    
    const result = await requestService.getRequests(options, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/pending', async (req, res, next) => {
  try {
    const result = await requestService.getPendingRequests(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/status-flow', async (req, res, next) => {
  try {
    const flow = await requestService.getRequestStatusFlow();
    res.json({ data: flow });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const request = await requestService.getRequestById(req.params.id, req.user);
    res.json({ data: request });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/available-actions', async (req, res, next) => {
  try {
    const actions = await requestService.getAvailableActions(req.params.id, req.user);
    res.json(actions);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const request = await requestService.createRequest(req.body, req.user);
    res.status(201).json({
      data: request,
      message: '领用申请创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', async (req, res, next) => {
  try {
    const request = await requestService.submitRequest(req.params.id, req.user);
    res.json({
      data: request,
      message: '领用申请提交成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/approve', async (req, res, next) => {
  try {
    const request = await requestService.approveRequest(req.params.id, req.user);
    res.json({
      data: request,
      message: '领用申请批准成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    const request = await requestService.rejectRequest(req.params.id, req.body, req.user);
    res.json({
      data: request,
      message: '领用申请驳回成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/execute', async (req, res, next) => {
  try {
    const request = await requestService.executeRequest(req.params.id, req.user);
    res.json({
      data: request,
      message: '领用申请执行成功，已扣减库存'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/return', async (req, res, next) => {
  try {
    const request = await requestService.returnRequest(req.params.id, req.body, req.user);
    res.json({
      data: request,
      message: '试剂归还成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/dispose', async (req, res, next) => {
  try {
    const request = await requestService.disposeRequest(req.params.id, req.body, req.user);
    res.json({
      data: request,
      message: '试剂报废成功'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
