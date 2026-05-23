const express = require('express');
const Joi = require('joi');
const { TaskService, TASK_STATUSES } = require('../models/TaskService');
const db = require('../utils/database');
const { validateRequest } = require('../middleware/validate');

const router = express.Router();

const createTaskSchema = Joi.object({
  propertyId: Joi.number().required(),
  taskDate: Joi.string().required(),
  cleanerName: Joi.string().required(),
  notes: Joi.string().allow('')
});

const transitionSchema = Joi.object({
  newStatus: Joi.string().valid(...Object.values(TASK_STATUSES)).required(),
  triggeredBy: Joi.string().required(),
  reason: Joi.string().allow('')
});

const checkItemSchema = Joi.object({
  isPassed: Joi.boolean().required(),
  checkedBy: Joi.string().required(),
  notes: Joi.string().allow('')
});

const acceptanceReportSchema = Joi.object({
  inspectorName: Joi.string().required()
});

const manualCorrectSchema = Joi.object({
  newStatus: Joi.string().valid(...Object.values(TASK_STATUSES)).required(),
  correctedBy: Joi.string().required(),
  reason: Joi.string().allow('')
});

router.get('/', (req, res) => {
  const filters = {
    propertyId: req.query.propertyId,
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };
  
  const tasks = TaskService.listTasks(filters);
  res.json({ success: true, data: tasks });
});

router.get('/:id', (req, res) => {
  const task = TaskService.getTaskWithDetails(parseInt(req.params.id));
  if (!task) {
    return res.status(404).json({ success: false, error: '任务不存在' });
  }
  res.json({ success: true, data: task });
});

router.post('/', (req, res) => {
  const validationResult = validateRequest(createTaskSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  const task = TaskService.createTask(
    value.propertyId,
    value.taskDate,
    value.cleanerName,
    value.notes || ''
  );

  res.status(201).json({ success: true, data: task });
});

router.post('/:id/transition', (req, res) => {
  const validationResult = validateRequest(transitionSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  try {
    const result = TaskService.transitionTask(
      parseInt(req.params.id),
      value.newStatus,
      value.triggeredBy,
      value.reason || ''
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/check-items/:taskCheckItemId', (req, res) => {
  const validationResult = validateRequest(checkItemSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  try {
    const result = TaskService.updateCheckItem(
      parseInt(req.params.taskCheckItemId),
      value.isPassed,
      value.checkedBy,
      value.notes || ''
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/photos', (req, res) => {
  const { taskCheckItemId, photoPath, photoType, uploadedBy, notes } = req.body;
  
  if (!photoPath || !photoType) {
    return res.status(400).json({ success: false, error: '照片路径和类型必填' });
  }

  const result = TaskService.addPhotoEvidence(
    parseInt(req.params.id),
    taskCheckItemId,
    photoPath,
    photoType,
    uploadedBy || 'system',
    notes || ''
  );

  res.status(201).json({ success: true, data: result });
});

router.post('/:id/acceptance-report', (req, res) => {
  const validationResult = validateRequest(acceptanceReportSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  try {
    const result = TaskService.createAcceptanceReport(
      parseInt(req.params.id),
      value.inspectorName
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/manual-correct', (req, res) => {
  const validationResult = validateRequest(manualCorrectSchema, req, res);
  if (validationResult !== null) return;
  
  const value = req.validatedBody;
  try {
    const result = TaskService.manualCorrectTask(
      parseInt(req.params.id),
      value.newStatus,
      value.correctedBy,
      value.reason || ''
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:id/rework-history', (req, res) => {
  const history = db.prepare(
    'SELECT * FROM rework_history WHERE task_id = ? ORDER BY created_at DESC'
  ).all(parseInt(req.params.id));
  
  res.json({ success: true, data: history });
});

router.get('/:id/acceptance-report', (req, res) => {
  const report = db.prepare(
    'SELECT * FROM acceptance_reports WHERE task_id = ?'
  ).get(parseInt(req.params.id));
  
  if (!report) {
    return res.status(404).json({ success: false, error: '该任务暂无验收报告' });
  }
  
  res.json({ success: true, data: report });
});

module.exports = router;
