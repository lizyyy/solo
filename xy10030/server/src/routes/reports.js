import express from 'express';
import { successResponse, errorResponse, AppError } from '../utils/response.js';
import {
  generateEventsReport,
  generateRegistrationsReport,
  generateOperationLogsReport,
  generateStatistics
} from '../services/reportService.js';

const router = express.Router();

router.get('/statistics', (req, res) => {
  try {
    const stats = generateStatistics();
    res.json(successResponse(stats));
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/events', (req, res) => {
  try {
    const { format = 'json' } = req.query;
    
    if (format === 'csv') {
      const csv = generateEventsReport('csv');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="events_${Date.now()}.csv"`);
      res.send('\ufeff' + csv);
    } else {
      const data = generateEventsReport('json');
      res.json(successResponse(data));
    }
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/registrations', (req, res) => {
  try {
    const { eventId, format = 'json' } = req.query;
    
    if (format === 'csv') {
      const csv = generateRegistrationsReport(eventId, 'csv');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="registrations_${Date.now()}.csv"`);
      res.send('\ufeff' + csv);
    } else {
      const data = generateRegistrationsReport(eventId, 'json');
      res.json(successResponse(data));
    }
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/logs', (req, res) => {
  try {
    const { entityType, entityId, action, status, format = 'json' } = req.query;
    
    if (format === 'csv') {
      const csv = generateOperationLogsReport({ entityType, entityId, action, status }, 'csv');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="logs_${Date.now()}.csv"`);
      res.send('\ufeff' + csv);
    } else {
      const data = generateOperationLogsReport({ entityType, entityId, action, status }, 'json');
      res.json(successResponse(data));
    }
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
