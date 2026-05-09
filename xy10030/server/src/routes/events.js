import express from 'express';
import { validateRequestId } from '../utils/idempotency.js';
import { successResponse, errorResponse, AppError } from '../utils/response.js';
import { createEvent, updateEvent, cancelEvent, getEventById, getEvents, getEventRegistrations } from '../services/eventService.js';
import { getEntityHistory } from '../services/operationLogService.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { status, search, limit, offset } = req.query;
    const result = getEvents({
      status,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id', (req, res) => {
  try {
    const event = getEventById(req.params.id);
    if (!event) {
      return res.status(404).json(errorResponse('活动不存在', 'NOT_FOUND'));
    }
    res.json(successResponse(event));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id/registrations', (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const result = getEventRegistrations(req.params.id, {
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const result = getEntityHistory('event', req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/', validateRequestId, (req, res) => {
  try {
    const event = createEvent(req.body, req.requestId);
    res.status(201).json(successResponse(event, '活动创建成功'));
  } catch (error) {
    handleError(res, error);
  }
});

router.put('/:id', validateRequestId, (req, res) => {
  try {
    const { version, ...data } = req.body;
    if (!version) {
      return res.status(400).json(errorResponse('缺少版本号', 'VALIDATION_ERROR'));
    }
    
    const event = updateEvent(req.params.id, data, version, req.requestId);
    res.json(successResponse(event, '活动更新成功'));
  } catch (error) {
    handleError(res, error);
  }
});

router.delete('/:id', validateRequestId, (req, res) => {
  try {
    const { version, reason } = req.body;
    if (!version) {
      return res.status(400).json(errorResponse('缺少版本号', 'VALIDATION_ERROR'));
    }
    
    const event = cancelEvent(req.params.id, version, reason, req.requestId);
    res.json(successResponse(event, '活动取消成功'));
  } catch (error) {
    handleError(res, error);
  }
});

function handleError(res, error) {
  if (error instanceof AppError) {
    res.status(error.statusCode).json(errorResponse(error.message, error.code, error.details));
  } else {
    console.error('Unexpected error:', error);
    res.status(500).json(errorResponse('服务器内部错误', 'INTERNAL_ERROR'));
  }
}

export default router;
