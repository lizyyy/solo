import express from 'express';
import { validateRequestId } from '../utils/idempotency.js';
import { successResponse, errorResponse, AppError, DuplicateRequestError } from '../utils/response.js';
import { createRegistration, updateRegistration, cancelRegistration, getRegistrationById, getRegistrations } from '../services/registrationService.js';
import { getEntityHistory } from '../services/operationLogService.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { eventId, phone, status, limit, offset } = req.query;
    const result = getRegistrations({
      eventId,
      phone,
      status,
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
    const registration = getRegistrationById(req.params.id);
    if (!registration) {
      return res.status(404).json(errorResponse('报名记录不存在', 'NOT_FOUND'));
    }
    res.json(successResponse(registration));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const result = getEntityHistory('registration', req.params.id);
    res.json(successResponse(result));
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/event/:eventId', validateRequestId, (req, res) => {
  try {
    const registration = createRegistration(req.params.eventId, req.body, req.requestId);
    res.status(201).json(successResponse(registration, '报名成功'));
  } catch (error) {
    if (error instanceof DuplicateRequestError) {
      return res.status(200).json(successResponse(error.existingData, error.message));
    }
    handleError(res, error);
  }
});

router.put('/:id', validateRequestId, (req, res) => {
  try {
    const { version, ...data } = req.body;
    if (!version) {
      return res.status(400).json(errorResponse('缺少版本号', 'VALIDATION_ERROR'));
    }
    
    const registration = updateRegistration(req.params.id, data, version, req.requestId);
    res.json(successResponse(registration, '报名信息更新成功'));
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
    
    const registration = cancelRegistration(req.params.id, version, reason, req.requestId);
    res.json(successResponse(registration, '报名取消成功'));
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
