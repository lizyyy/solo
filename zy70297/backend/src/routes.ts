import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { store } from './store';
import { 
  createTasksFromInspection, 
  scheduleReview, 
  completeReview,
  manuallyCutOffGas,
  restoreGas,
  getMerchantCurrentStatus,
  getTaskSuggestion,
  RECTIFICATION_DAYS,
  GAS_CUTOFF_AFTER_FAILED_REVIEWS,
} from './services/rectificationService';
import { Inspection, InspectionProblem } from './types';

const router = Router();

router.get('/merchants', (_req: Request, res: Response) => {
  res.json(store.merchants);
});

router.get('/merchants/:id', (req: Request, res: Response) => {
  const merchant = store.merchants.find(m => m.id === req.params.id);
  if (!merchant) {
    res.status(404).json({ error: '商户不存在' });
    return;
  }
  
  const inspections = store.inspections.filter(i => i.merchantId === merchant.id);
  const tasks = store.rectificationTasks.filter(t => t.merchantId === merchant.id);
  const tasksWithSuggestions = tasks.map(t => ({
    ...t,
    suggestion: getTaskSuggestion(t),
  }));
  
  merchant.currentStatus = getMerchantCurrentStatus(merchant.id);
  
  res.json({
    merchant,
    inspections,
    tasks: tasksWithSuggestions,
  });
});

router.get('/inspections', (_req: Request, res: Response) => {
  res.json(store.inspections);
});

router.post('/inspections', (req: Request, res: Response) => {
  const { merchantId, inspector, inspectionDate, problems, remarks } = req.body;
  
  const merchant = store.merchants.find(m => m.id === merchantId);
  if (!merchant) {
    res.status(404).json({ error: '商户不存在' });
    return;
  }
  
  const inspectionProblems: InspectionProblem[] = problems.map((p: any) => ({
    id: uuidv4(),
    inspectionId: '',
    problemType: p.problemType,
    description: p.description,
    severity: p.severity,
    rectificationDays: RECTIFICATION_DAYS[p.problemType],
    createdAt: new Date().toISOString(),
  }));
  
  const inspection: Inspection = {
    id: uuidv4(),
    merchantId,
    inspector,
    inspectionDate,
    status: inspectionProblems.length > 0 ? 'has_problem' : 'completed',
    problems: inspectionProblems,
    remarks,
    createdAt: new Date().toISOString(),
  };
  
  inspectionProblems.forEach(p => p.inspectionId = inspection.id);
  store.inspections.push(inspection);
  
  const tasks = createTasksFromInspection(inspection);
  
  merchant.currentStatus = getMerchantCurrentStatus(merchantId);
  merchant.updatedAt = new Date().toISOString();
  
  res.json({
    inspection,
    tasks: tasks.map(t => ({ ...t, suggestion: getTaskSuggestion(t) })),
  });
});

router.get('/rectification-tasks', (_req: Request, res: Response) => {
  const tasks = store.rectificationTasks.map(t => {
    const merchant = store.merchants.find(m => m.id === t.merchantId);
    return {
      ...t,
      merchantName: merchant?.name || '',
      suggestion: getTaskSuggestion(t),
    };
  });
  res.json(tasks);
});

router.get('/rectification-tasks/:id', (req: Request, res: Response) => {
  const task = store.rectificationTasks.find(t => t.id === req.params.id);
  if (!task) {
    res.status(404).json({ error: '整改任务不存在' });
    return;
  }
  
  const history = store.statusChanges
    .filter(sc => sc.taskId === task.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  const merchant = store.merchants.find(m => m.id === task.merchantId);
  
  res.json({
    task: {
      ...task,
      merchantName: merchant?.name || '',
      suggestion: getTaskSuggestion(task),
    },
    history,
  });
});

router.post('/rectification-tasks/:id/schedule-review', (req: Request, res: Response) => {
  const { reviewDate, handler } = req.body;
  
  if (!reviewDate || !handler) {
    res.status(400).json({ error: '复查日期和处理人不能为空' });
    return;
  }
  
  const task = scheduleReview(req.params.id, reviewDate, handler);
  if (!task) {
    res.status(404).json({ error: '整改任务不存在' });
    return;
  }
  
  const merchant = store.merchants.find(m => m.id === task.merchantId);
  res.json({
    task: {
      ...task,
      merchantName: merchant?.name || '',
      suggestion: getTaskSuggestion(task),
    },
  });
});

router.post('/rectification-tasks/:id/complete-review', (req: Request, res: Response) => {
  const { result, handler } = req.body;
  
  if (!result || !handler) {
    res.status(400).json({ error: '复查结果和处理人不能为空' });
    return;
  }
  
  const task = completeReview(req.params.id, result, handler);
  if (!task) {
    res.status(404).json({ error: '整改任务不存在或状态不允许完成复查' });
    return;
  }
  
  const merchant = store.merchants.find(m => m.id === task.merchantId);
  if (merchant) {
    merchant.currentStatus = getMerchantCurrentStatus(merchant.id);
    merchant.updatedAt = new Date().toISOString();
  }
  
  res.json({
    task: {
      ...task,
      merchantName: merchant?.name || '',
      suggestion: getTaskSuggestion(task),
    },
    gasCutOffTriggered: task.status === 'gas_cut_off',
    note: `连续${GAS_CUTOFF_AFTER_FAILED_REVIEWS}次复查不通过将自动停气`,
  });
});

router.post('/rectification-tasks/:id/cut-off-gas', (req: Request, res: Response) => {
  const { handler, reason } = req.body;
  
  if (!handler || !reason) {
    res.status(400).json({ error: '处理人和停气原因不能为空' });
    return;
  }
  
  const task = manuallyCutOffGas(req.params.id, handler, reason);
  if (!task) {
    res.status(404).json({ error: '整改任务不存在' });
    return;
  }
  
  const merchant = store.merchants.find(m => m.id === task.merchantId);
  if (merchant) {
    merchant.currentStatus = 'gas_cut_off';
    merchant.updatedAt = new Date().toISOString();
  }
  
  res.json({
    task: {
      ...task,
      merchantName: merchant?.name || '',
      suggestion: getTaskSuggestion(task),
    },
    gasCutOff: true,
  });
});

router.post('/rectification-tasks/:id/restore-gas', (req: Request, res: Response) => {
  const { handler } = req.body;
  
  if (!handler) {
    res.status(400).json({ error: '处理人不能为空' });
    return;
  }
  
  const task = restoreGas(req.params.id, handler);
  if (!task) {
    res.status(404).json({ error: '整改任务不存在或当前状态不允许恢复供气' });
    return;
  }
  
  const merchant = store.merchants.find(m => m.id === task.merchantId);
  if (merchant) {
    merchant.currentStatus = getMerchantCurrentStatus(merchant.id);
    merchant.updatedAt = new Date().toISOString();
  }
  
  res.json({
    task: {
      ...task,
      merchantName: merchant?.name || '',
      suggestion: getTaskSuggestion(task),
    },
    gasRestored: true,
  });
});

router.get('/reports', (_req: Request, res: Response) => {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const reportPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const stats = {
    period: reportPeriod,
    totalMerchants: store.merchants.length,
    normalMerchants: store.merchants.filter(m => m.currentStatus === 'normal').length,
    warningMerchants: store.merchants.filter(m => m.currentStatus === 'warning').length,
    gasCutOffMerchants: store.merchants.filter(m => m.currentStatus === 'gas_cut_off').length,
    totalTasks: store.rectificationTasks.length,
    tasksByStatus: {
      created: 0,
      scheduled_review: 0,
      review_failed: 0,
      gas_cut_off: 0,
      completed: 0,
    } as Record<string, number>,
    tasksByType: {
      hose: 0,
      alarm: 0,
      valve: 0,
    } as Record<string, number>,
    overdueTasks: 0,
  };
  
  store.rectificationTasks.forEach(t => {
    stats.tasksByStatus[t.status]++;
    stats.tasksByType[t.problemType]++;
    
    const deadline = new Date(t.deadline);
    if (t.status !== 'completed' && deadline < now) {
      stats.overdueTasks++;
    }
  });
  
  const riskList = store.rectificationTasks
    .filter(t => t.status !== 'completed')
    .map(t => {
      const merchant = store.merchants.find(m => m.id === t.merchantId);
      const deadline = new Date(t.deadline);
      const overdueDays = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        taskId: t.id,
        merchantName: merchant?.name || '',
        problemType: t.problemType,
        problemDescription: t.problemDescription,
        status: t.status,
        severity: t.severity,
        deadline: t.deadline,
        overdueDays: overdueDays > 0 ? overdueDays : 0,
        gasCutOff: t.status === 'gas_cut_off',
        suggestion: getTaskSuggestion(t),
      };
    })
    .sort((a, b) => {
      const priorityMap = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityMap[a.suggestion.priority] - priorityMap[b.suggestion.priority];
    });
  
  res.json({
    stats,
    riskList,
    rules: {
      rectificationDays: RECTIFICATION_DAYS,
      gasCutOffAfterFailedReviews: GAS_CUTOFF_AFTER_FAILED_REVIEWS,
    },
  });
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    data: {
      merchants: store.merchants.length,
      inspections: store.inspections.length,
      tasks: store.rectificationTasks.length,
      statusChanges: store.statusChanges.length,
    },
  });
});

export default router;
