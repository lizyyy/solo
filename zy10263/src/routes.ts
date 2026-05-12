import { Router, Request, Response } from 'express';
import { runAsync, getAsync } from './database/connection';
import * as employeeService from './services/employeeService';
import * as lineService from './services/lineService';
import * as lineSwapService from './services/lineSwapService';
import * as workHourService from './services/workHourService';
import * as absenceService from './services/absenceService';
import * as performanceService from './services/performanceService';
import * as historyService from './services/historyService';
import { ValidationError } from './utils/validation';

const router = Router();

const handleError = (res: Response, error: any) => {
  if (error instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  } else {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
};

const getOperator = (req: Request) => ({
  id: req.headers['x-operator-id'] as string || 'system',
  name: req.headers['x-operator-name'] as string || '系统用户'
});

router.post('/employees', async (req, res) => {
  try {
    const operator = getOperator(req);
    const employee = await employeeService.createEmployee(
      req.body,
      operator.id,
      operator.name
    );
    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/employees', async (req, res) => {
  try {
    const employees = await employeeService.getEmployees();
    res.json({ success: true, data: employees });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/employees/:id', async (req, res) => {
  try {
    const employee = await employeeService.getEmployeeById(req.params.id);
    res.json({ success: true, data: employee });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/employees/:id/skills', async (req, res) => {
  try {
    const skills = await employeeService.getEmployeeSkills(req.params.id);
    res.json({ success: true, data: skills });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/employees/:id/skills', async (req, res) => {
  try {
    const operator = getOperator(req);
    const skill = await employeeService.addEmployeeSkill(
      req.params.id,
      req.body.skillId,
      req.body.level,
      operator.id,
      operator.name
    );
    res.status(201).json({ success: true, data: skill });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/lines', async (req, res) => {
  try {
    const operator = getOperator(req);
    const line = await lineService.createLine(
      req.body,
      operator.id,
      operator.name
    );
    res.status(201).json({ success: true, data: line });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/lines', async (req, res) => {
  try {
    const lines = await lineService.getLines();
    res.json({ success: true, data: lines });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/lines/:id', async (req, res) => {
  try {
    const line = await lineService.getLineById(req.params.id);
    res.json({ success: true, data: line });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/skills', async (req, res) => {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const now = new Date().toISOString();
    await runAsync(
      'INSERT INTO skills (id, name, code, description, created_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), req.body.name, req.body.code, req.body.description || '', now]
    );
    const skill = await getAsync(
      'SELECT id, name, code, description, created_at as createdAt FROM skills WHERE code = ?',
      [req.body.code]
    );
    res.status(201).json({ success: true, data: skill });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/skills', async (req, res) => {
  try {
    const skills = await lineService.getSkills();
    res.json({ success: true, data: skills });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/skills/:id', async (req, res) => {
  try {
    const skill = await lineService.getSkillById(req.params.id);
    res.json({ success: true, data: skill });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/swap-requests', async (req, res) => {
  try {
    const operator = getOperator(req);
    const request = await lineSwapService.createSwapRequest(
      req.body,
      operator.id,
      operator.name
    );
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/swap-requests', async (req, res) => {
  try {
    const requests = await lineSwapService.getSwapRequests(req.query.status as string);
    res.json({ success: true, data: requests });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/swap-requests/:id', async (req, res) => {
  try {
    const request = await lineSwapService.getSwapRequestById(req.params.id);
    res.json({ success: true, data: request });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/swap-requests/:id/approve', async (req, res) => {
  try {
    const operator = getOperator(req);
    const request = await lineSwapService.approveSwapRequest(
      req.params.id,
      operator.id,
      operator.name
    );
    res.json({ success: true, data: request });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/swap-requests/:id/reject', async (req, res) => {
  try {
    const operator = getOperator(req);
    const request = await lineSwapService.rejectSwapRequest(
      req.params.id,
      req.body.reason,
      operator.id,
      operator.name
    );
    res.json({ success: true, data: request });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/work-hours', async (req, res) => {
  try {
    const operator = getOperator(req);
    const workHour = await workHourService.createWorkHour(
      req.body,
      operator.id,
      operator.name
    );
    res.status(201).json({ success: true, data: workHour });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/work-hours', async (req, res) => {
  try {
    const workHours = await workHourService.getWorkHours(
      req.query.employeeId as string,
      req.query.date as string
    );
    res.json({ success: true, data: workHours });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/work-hours/:id/confirm', async (req, res) => {
  try {
    const operator = getOperator(req);
    const workHour = await workHourService.confirmWorkHour(
      req.params.id,
      operator.id,
      operator.name
    );
    res.json({ success: true, data: workHour });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/absences', async (req, res) => {
  try {
    const operator = getOperator(req);
    const absence = await absenceService.createAbsence(
      req.body,
      operator.id,
      operator.name
    );
    res.status(201).json({ success: true, data: absence });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/absences', async (req, res) => {
  try {
    const absences = await absenceService.getAbsences(
      req.query.employeeId as string,
      req.query.date as string
    );
    res.json({ success: true, data: absences });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/performances/calculate', async (req, res) => {
  try {
    const operator = getOperator(req);
    const performance = await performanceService.calculatePerformance(
      req.body.employeeId,
      req.body.lineId,
      req.body.month,
      operator.id,
      operator.name
    );
    res.json({ success: true, data: performance });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/performances', async (req, res) => {
  try {
    const performances = await performanceService.getPerformances(
      req.query.employeeId as string,
      req.query.month as string
    );
    res.json({ success: true, data: performances });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/history/:entityType/:entityId', async (req, res) => {
  try {
    const history = await historyService.getEntityHistory(
      req.params.entityType,
      req.params.entityId
    );
    res.json({ success: true, data: history });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/history/operation/:operationType', async (req, res) => {
  try {
    const history = await historyService.getOperationTypeHistory(
      req.params.operationType
    );
    res.json({ success: true, data: history });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
