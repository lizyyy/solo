import express from 'express';
import {
  DeductionStatus,
  DeductionAction,
  canPerformAction,
  getNextStatus,
  validateScoreConsistency,
  calculateTotalScore,
  type DeductionRecord,
  type StatusHistory,
} from '../../shared/types';
import { photoHashMap } from '../mock/data';
import { records, statusHistory } from '../data/store';

const router = express.Router();

router.get('/', (req, res) => {
  const { status, storeId, page = '1', pageSize = '10' } = req.query;
  
  let filtered = [...records];
  
  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }
  if (storeId) {
    filtered = filtered.filter(r => r.storeId === storeId);
  }
  
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const pageNum = parseInt(page as string);
  const size = parseInt(pageSize as string);
  const start = (pageNum - 1) * size;
  const paginated = filtered.slice(start, start + size);
  
  res.json({
    data: paginated,
    total: filtered.length,
    page: pageNum,
    pageSize: size,
  });
});

router.get('/:id', (req, res) => {
  const record = records.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }
  res.json(record);
});

router.get('/:id/history', (req, res) => {
  const history = statusHistory.filter(h => h.recordId === req.params.id);
  history.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  res.json(history);
});

router.post('/', (req, res) => {
  const { storeId, storeName, inspectorId, inspectorName, inspectionDate, details } = req.body;
  
  const totalScore = calculateTotalScore(details);
  if (!validateScoreConsistency(details, totalScore)) {
    return res.status(400).json({ error: '总分与扣分项之和不一致' });
  }
  
  for (const detail of details) {
    for (const photo of detail.photos) {
      const reused = photoHashMap.get(photo.hash);
      if (reused) {
        photo.reusedWarning = reused;
      }
    }
  }
  
  const newRecord: DeductionRecord = {
    id: `rec-${Date.now()}`,
    recordNo: `XD${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(records.length + 1).padStart(3, '0')}`,
    storeId,
    storeName,
    inspectorId,
    inspectorName,
    inspectionDate,
    submissionSource: 'PC',
    status: DeductionStatus.DRAFT,
    details,
    totalScore,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  records.push(newRecord);
  res.status(201).json(newRecord);
});

router.put('/:id', (req, res) => {
  const index = records.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const record = records[index];
  if (record.status !== DeductionStatus.DRAFT) {
    return res.status(400).json({ error: '只能编辑草稿状态的记录' });
  }
  
  const { details, ...rest } = req.body;
  
  if (details) {
    const totalScore = calculateTotalScore(details);
    if (!validateScoreConsistency(details, rest.totalScore ?? totalScore)) {
      return res.status(400).json({ error: '总分与扣分项之和不一致' });
    }
    
    for (const detail of details) {
      for (const photo of detail.photos) {
        const reused = photoHashMap.get(photo.hash);
        if (reused) {
          photo.reusedWarning = reused;
        }
      }
    }
    
    record.details = details;
    record.totalScore = totalScore;
  }
  
  Object.assign(record, rest);
  record.updatedAt = new Date().toISOString();
  
  res.json(record);
});

router.post('/:id/actions', (req, res) => {
  const { action, remark, operatorId, operatorName, operatorRole, adjustedScore, adjustRemark, appealContent } = req.body;
  
  const index = records.findIndex(r => r.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const record = records[index];
  
  if (!canPerformAction(record.status, action as DeductionAction)) {
    return res.status(400).json({ error: `当前状态不允许执行 ${action} 操作` });
  }
  
  const nextStatus = getNextStatus(record.status, action as DeductionAction);
  if (!nextStatus) {
    return res.status(400).json({ error: '无效的状态转换' });
  }
  
  const historyEntry: StatusHistory = {
    id: `hist-${Date.now()}`,
    recordId: record.id,
    fromStatus: record.status,
    toStatus: nextStatus,
    action: action as DeductionAction,
    operatorId,
    operatorName,
    operatorRole,
    remark: remark || '',
    createdAt: new Date().toISOString(),
    scoreSnapshot: record.totalScore,
  };
  
  statusHistory.push(historyEntry);
  
  record.status = nextStatus;
  record.updatedAt = new Date().toISOString();
  
  if (action === DeductionAction.APPEAL && appealContent) {
    record.appealContent = appealContent;
    record.appealAt = new Date().toISOString();
  }
  
  if (action === DeductionAction.APPEAL_APPROVE) {
    record.adjustedScore = adjustedScore ?? record.totalScore;
    record.adjustRemark = adjustRemark || '';
  }
  
  if (action === DeductionAction.CLOSE) {
    record.closedAt = new Date().toISOString();
  }
  
  res.json({ record, history: historyEntry });
});

export default router;
