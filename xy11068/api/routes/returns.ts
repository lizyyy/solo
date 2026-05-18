import express, { Request, Response } from 'express';
import { ReturnApplication, ReturnStatus, OperationLog, DeviceItem, SubmitSource } from '../../shared/types';
import { mockReturns } from '../data/mockData';
import { getAllowedTransitions, isTransitionAllowed, getTransitionAction } from '../services/statusTransition';
import { validateReturnApplication } from '../services/validation';

const router = express.Router();

let returnsStore: ReturnApplication[] = JSON.parse(JSON.stringify(mockReturns));

const generateId = (): string => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const num = String(returnsStore.length + 1).padStart(3, '0');
  return `GH${dateStr}${num}`;
};

const addOperationLog = (application: ReturnApplication, action: string, operator: string, remarks: string = ''): void => {
  const log: OperationLog = {
    id: Math.random().toString(36).substring(2, 9).toUpperCase(),
    action,
    operator,
    time: new Date().toISOString(),
    remarks
  };
  application.operationLogs.push(log);
};

router.get('/', (req: Request, res: Response) => {
  const { status, page = '1', pageSize = '10' } = req.query;
  let filtered = [...returnsStore];
  
  if (status && typeof status === 'string') {
    filtered = filtered.filter(r => r.status === status);
  }
  
  const pageNum = parseInt(page as string);
  const sizeNum = parseInt(pageSize as string);
  const start = (pageNum - 1) * sizeNum;
  const end = start + sizeNum;
  const paginated = filtered.slice(start, end);
  
  res.json({
    success: true,
    data: {
      data: paginated,
      total: filtered.length,
      page: pageNum,
      pageSize: sizeNum
    }
  });
});

router.get('/stats', (req: Request, res: Response) => {
  const stats = {
    draft: returnsStore.filter(r => r.status === ReturnStatus.DRAFT).length,
    pending: returnsStore.filter(r => r.status === ReturnStatus.PENDING).length,
    approved: returnsStore.filter(r => r.status === ReturnStatus.APPROVED).length,
    rejected: returnsStore.filter(r => r.status === ReturnStatus.REJECTED).length,
    ownershipIssue: returnsStore.filter(r => r.status === ReturnStatus.OWNERSHIP_ISSUE).length,
    processing: returnsStore.filter(r => r.status === ReturnStatus.PROCESSING).length,
    stored: returnsStore.filter(r => r.status === ReturnStatus.STORED).length,
    completed: returnsStore.filter(r => r.status === ReturnStatus.COMPLETED).length,
    issueRecorded: returnsStore.filter(r => r.status === ReturnStatus.ISSUE_RECORDED).length,
    total: returnsStore.length,
    totalDevices: returnsStore.reduce((sum, r) => sum + r.deviceCount, 0)
  };
  
  res.json({
    success: true,
    data: stats
  });
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const application = returnsStore.find(r => r.id === id);
  
  if (!application) {
    return res.status(404).json({
      success: false,
      message: '归还申请不存在'
    });
  }
  
  res.json({
    success: true,
    data: application
  });
});

router.get('/:id/transitions', (req: Request, res: Response) => {
  const { id } = req.params;
  const application = returnsStore.find(r => r.id === id);
  
  if (!application) {
    return res.status(404).json({
      success: false,
      message: '归还申请不存在'
    });
  }
  
  const transitions = getAllowedTransitions(application.status);
  
  res.json({
    success: true,
    data: transitions
  });
});

router.post('/', (req: Request, res: Response) => {
  const {
    teamName,
    responsiblePerson,
    phone,
    returnDate,
    submitSource,
    operator,
    deviceCount,
    devices
  } = req.body;
  
  const newApplication: ReturnApplication = {
    id: generateId(),
    teamName,
    responsiblePerson,
    phone,
    returnDate,
    submitSource: submitSource || 'web',
    submitTime: new Date().toISOString(),
    operator: operator || responsiblePerson,
    status: ReturnStatus.DRAFT,
    deviceCount,
    devices: devices || [],
    operationLogs: [],
    validationIssues: []
  };
  
  addOperationLog(newApplication, '创建归还申请', newApplication.operator, `创建${deviceCount}台讲解器归还申请`);
  
  const validation = validateReturnApplication(newApplication, returnsStore);
  newApplication.validationIssues = validation.issues;
  
  returnsStore.push(newApplication);
  
  res.status(201).json({
    success: true,
    data: newApplication,
    message: '创建成功'
  });
});

router.post('/:id/submit', (req: Request, res: Response) => {
  const { id } = req.params;
  const application = returnsStore.find(r => r.id === id);
  
  if (!application) {
    return res.status(404).json({
      success: false,
      message: '归还申请不存在'
    });
  }
  
  if (!isTransitionAllowed(application.status, ReturnStatus.PENDING)) {
    return res.status(400).json({
      success: false,
      message: '当前状态不允许提交审核'
    });
  }
  
  const validation = validateReturnApplication(application, returnsStore);
  application.validationIssues = validation.issues;
  application.status = ReturnStatus.PENDING;
  application.submitTime = new Date().toISOString();
  
  addOperationLog(application, '提交审核', application.operator);
  
  res.json({
    success: true,
    data: application,
    message: '提交成功'
  });
});

router.put('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, reason, operator = '管理员' } = req.body;
  
  const application = returnsStore.find(r => r.id === id);
  
  if (!application) {
    return res.status(404).json({
      success: false,
      message: '归还申请不存在'
    });
  }
  
  if (!isTransitionAllowed(application.status, status as ReturnStatus)) {
    return res.status(400).json({
      success: false,
      message: `不允许从${application.status}状态变更为${status}状态`
    });
  }
  
  const action = getTransitionAction(application.status, status as ReturnStatus);
  application.status = status as ReturnStatus;
  
  addOperationLog(application, action || '状态变更', operator, reason || '');
  
  const validation = validateReturnApplication(application, returnsStore);
  application.validationIssues = validation.issues;
  
  res.json({
    success: true,
    data: application,
    message: '状态更新成功'
  });
});

router.post('/:id/validate', (req: Request, res: Response) => {
  const { id } = req.params;
  const application = returnsStore.find(r => r.id === id);
  
  if (!application) {
    return res.status(404).json({
      success: false,
      message: '归还申请不存在'
    });
  }
  
  const validation = validateReturnApplication(application, returnsStore);
  application.validationIssues = validation.issues;
  
  res.json({
    success: true,
    data: validation
  });
});

router.put('/:id/devices', (req: Request, res: Response) => {
  const { id } = req.params;
  const { devices, operator = '管理员' } = req.body;
  
  const application = returnsStore.find(r => r.id === id);
  
  if (!application) {
    return res.status(404).json({
      success: false,
      message: '归还申请不存在'
    });
  }
  
  application.devices = devices;
  application.deviceCount = devices.length;
  
  addOperationLog(application, '更新设备清单', operator, `更新设备清单，共${devices.length}台设备`);
  
  const validation = validateReturnApplication(application, returnsStore);
  application.validationIssues = validation.issues;
  
  res.json({
    success: true,
    data: application,
    message: '设备清单更新成功'
  });
});

export default router;
