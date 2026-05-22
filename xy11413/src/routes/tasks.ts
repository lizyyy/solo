import { Router } from 'express';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware/auth';
import {
  createTask,
  getTaskById,
  getAllTasks,
  getTasksByStatus,
  updateManualOpinion,
  assignTask
} from '../services/taskService';
import { performReconciliation, getReconciliationResults, getReconciliationSummary } from '../services/reconciliationService';

const router = Router();

router.post('/', authenticate, requirePermission('reconcile'), async (req: AuthenticatedRequest, res) => {
  try {
    const { taskType, payload } = req.body;
    
    if (!taskType) {
      res.status(400).json({ error: '缺少任务类型', code: 'MISSING_TASK_TYPE' });
      return;
    }

    const taskId = await createTask(taskType, payload || {});
    
    res.json({
      success: true,
      data: { taskId, taskType }
    });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({ 
      error: '创建任务失败', 
      code: 'TASK_CREATE_FAILED',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let tasks;
    
    if (status && typeof status === 'string') {
      tasks = await getTasksByStatus(status as any);
    } else {
      tasks = await getAllTasks();
    }
    
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ 
      error: '获取任务列表失败', 
      code: 'TASK_LIST_FAILED'
    });
  }
});

router.get('/:taskId', authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await getTaskById(taskId);
    
    if (!task) {
      res.status(404).json({ error: '任务不存在', code: 'TASK_NOT_FOUND' });
      return;
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({ 
      error: '获取任务详情失败', 
      code: 'TASK_DETAIL_FAILED'
    });
  }
});

router.post('/:taskId/reconcile', authenticate, requirePermission('reconcile'), async (req: AuthenticatedRequest, res) => {
  try {
    const { taskId } = req.params;
    const { franchiseeId, startDate, endDate } = req.body;
    
    const started = await getTaskById(taskId);
    if (!started) {
      res.status(404).json({ error: '任务不存在', code: 'TASK_NOT_FOUND' });
      return;
    }

    const result = await performReconciliation(taskId, { franchiseeId, startDate, endDate });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('对账失败:', error);
    res.status(500).json({ 
      error: '对账失败', 
      code: 'RECONCILIATION_FAILED',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

router.get('/:taskId/results', authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    const results = await getReconciliationResults(taskId);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取对账结果失败:', error);
    res.status(500).json({ 
      error: '获取对账结果失败', 
      code: 'RESULTS_FAILED'
    });
  }
});

router.get('/:taskId/summary', authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    const summary = await getReconciliationSummary(taskId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('获取对账摘要失败:', error);
    res.status(500).json({ 
      error: '获取对账摘要失败', 
      code: 'SUMMARY_FAILED'
    });
  }
});

router.post('/:taskId/manual-opinion', authenticate, requirePermission('manage_tasks'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { opinion, resolved } = req.body;
    
    if (!opinion) {
      res.status(400).json({ error: '缺少处理意见', code: 'MISSING_OPINION' });
      return;
    }

    const success = await updateManualOpinion(taskId, opinion, resolved || false);
    
    if (!success) {
      res.status(400).json({ error: '更新失败，任务可能不处于待人工处理状态', code: 'UPDATE_FAILED' });
      return;
    }
    
    res.json({
      success: true,
      message: resolved ? '已重新提交处理' : '已记录人工意见'
    });
  } catch (error) {
    console.error('更新人工意见失败:', error);
    res.status(500).json({ 
      error: '更新人工意见失败', 
      code: 'OPINION_UPDATE_FAILED'
    });
  }
});

router.post('/:taskId/assign', authenticate, requirePermission('manage_tasks'), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { assignedTo } = req.body;
    
    if (!assignedTo) {
      res.status(400).json({ error: '缺少处理人', code: 'MISSING_ASSIGNEE' });
      return;
    }

    const success = await assignTask(taskId, assignedTo);
    
    res.json({ success });
  } catch (error) {
    console.error('分配任务失败:', error);
    res.status(500).json({ 
      error: '分配任务失败', 
      code: 'ASSIGN_FAILED'
    });
  }
});

export default router;
