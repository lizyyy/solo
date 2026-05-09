const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const { idempotentMiddleware, wrapResponse } = require('../middleware/idempotent');
const { auditMiddleware } = require('../middleware/audit');
const { AUDIT_ACTIONS, MODULES } = require('../middleware/audit');

function getOperator(req) {
  const op = req.headers['x-operator'];
  if (op) {
    try {
      return decodeURIComponent(op);
    } catch (e) {
      return op;
    }
  }
  return 'system';
}

router.get('/stats', wrapResponse(async (req, res) => {
  return taskService.getTaskStatistics();
}));

router.get('/', wrapResponse(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignee) filter.assignee = req.query.assignee;
  if (req.query.created_by) filter.created_by = req.query.created_by;
  if (req.query.keyword) filter.keyword = req.query.keyword;
  if (req.query.problem_type) filter.problem_type = req.query.problem_type;
  if (req.query.startTime) filter.startTime = parseInt(req.query.startTime);
  if (req.query.endTime) filter.endTime = parseInt(req.query.endTime);
  
  return taskService.getTaskList(filter, page, pageSize);
}));

router.get('/:id', wrapResponse(async (req, res) => {
  const task = await taskService.getTaskById(req.params.id);
  const transitions = await taskService.getTaskTransitions(req.params.id);
  return { ...task, transitions };
}));

router.post(
  '/',
  idempotentMiddleware(),
  auditMiddleware(AUDIT_ACTIONS.TASK_CREATE, MODULES.TASK),
  wrapResponse(async (req, res) => {
    const operator = getOperator(req);
    return taskService.createTask(req.body, operator);
  })
);

router.put(
  '/:id',
  idempotentMiddleware(),
  auditMiddleware(AUDIT_ACTIONS.TASK_UPDATE, MODULES.TASK),
  wrapResponse(async (req, res) => {
    const operator = getOperator(req);
    const expectedVersion = req.body.version;
    return taskService.updateTask(req.params.id, req.body, operator, expectedVersion);
  })
);

router.post(
  '/:id/start',
  idempotentMiddleware(),
  auditMiddleware(AUDIT_ACTIONS.TASK_STATUS_CHANGE, MODULES.TASK),
  wrapResponse(async (req, res) => {
    const operator = getOperator(req);
    return taskService.startTask(req.params.id, operator, req.body.version);
  })
);

router.post(
  '/:id/complete',
  idempotentMiddleware(),
  auditMiddleware(AUDIT_ACTIONS.TASK_COMPLETE, MODULES.TASK),
  wrapResponse(async (req, res) => {
    const operator = getOperator(req);
    return taskService.completeTask(req.params.id, operator, req.body.remark, req.body.version);
  })
);

router.post(
  '/:id/fail',
  idempotentMiddleware(),
  auditMiddleware(AUDIT_ACTIONS.TASK_STATUS_CHANGE, MODULES.TASK),
  wrapResponse(async (req, res) => {
    const operator = getOperator(req);
    return taskService.failTask(req.params.id, operator, req.body.errorMessage, req.body.version);
  })
);

router.post(
  '/:id/retry',
  idempotentMiddleware(),
  auditMiddleware(AUDIT_ACTIONS.TASK_RETRY, MODULES.TASK),
  wrapResponse(async (req, res) => {
    const operator = getOperator(req);
    return taskService.retryTask(req.params.id, operator, req.body.version);
  })
);

router.post(
  '/:id/cancel',
  idempotentMiddleware(),
  auditMiddleware(AUDIT_ACTIONS.TASK_STATUS_CHANGE, MODULES.TASK),
  wrapResponse(async (req, res) => {
    const operator = getOperator(req);
    return taskService.cancelTask(req.params.id, operator, req.body.reason, req.body.version);
  })
);

router.post(
  '/:id/assign',
  idempotentMiddleware(),
  auditMiddleware(AUDIT_ACTIONS.TASK_ASSIGN, MODULES.TASK),
  wrapResponse(async (req, res) => {
    const operator = getOperator(req);
    return taskService.assignTask(req.params.id, req.body.assignee, operator, req.body.version);
  })
);

router.delete('/:id', wrapResponse(async (req, res) => {
  const operator = getOperator(req);
  return taskService.deleteTask(req.params.id, operator);
}));

router.get('/:id/transitions', wrapResponse(async (req, res) => {
  return taskService.getTaskTransitions(req.params.id);
}));

module.exports = router;
