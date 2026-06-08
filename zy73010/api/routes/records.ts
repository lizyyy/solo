import express, { type Request, type Response } from 'express';
import type { ReviewStatus, ListRecordsQuery } from '../../shared/types.js';
import { db } from '../data/db.js';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  const { status, vaccineMissing, weightAnomaly, keyword } = req.query as ListRecordsQuery;
  let result = db.boardingRecords.map(r => {
    const latestRemark = r.remarks[r.remarks.length - 1];
    return {
      id: r.id,
      petName: r.petName,
      petBreed: r.petBreed,
      ownerName: r.ownerName,
      startDate: r.startDate,
      endDate: r.endDate,
      reviewStatus: r.reviewStatus,
      conclusion: r.conclusion,
      hasWeightAnomaly: r.hasWeightAnomaly,
      hasVaccineMissing: r.hasVaccineMissing,
      abnormalPhotosCount: r.abnormalPhotos.length,
      latestRemark: latestRemark ? latestRemark.content : '',
      latestOperator: latestRemark ? latestRemark.operator : '',
    };
  });

  if (status) {
    result = result.filter(r => r.reviewStatus === status);
  }
  if (vaccineMissing !== undefined && vaccineMissing !== null) {
    result = result.filter(r => r.hasVaccineMissing === Boolean(vaccineMissing));
  }
  if (weightAnomaly !== undefined && weightAnomaly !== null) {
    result = result.filter(r => r.hasWeightAnomaly === Boolean(weightAnomaly));
  }
  if (keyword) {
    const kw = String(keyword).toLowerCase();
    result = result.filter(r =>
      r.petName.toLowerCase().includes(kw) ||
      r.petBreed.toLowerCase().includes(kw) ||
      r.ownerName.toLowerCase().includes(kw)
    );
  }

  res.json({ success: true, data: result });
});

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const record = db.boardingRecords.find(r => r.id === id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  res.json({ success: true, data: record });
});

router.patch('/:id/remarks', (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, status, operator = '寄养店长老周' } = req.body;
  const record = db.boardingRecords.find(r => r.id === id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }

  const latestRemark = record.remarks[record.remarks.length - 1];
  const now = new Date().toISOString();

  if (latestRemark && latestRemark.status === status && !latestRemark.isSupplement) {
    latestRemark.content = content;
    latestRemark.updatedAt = now;
    latestRemark.operator = operator;
  } else {
    const newRemark = {
      id: 'RMK-' + Math.random().toString(36).slice(2, 8),
      recordId: id,
      content,
      status: status as ReviewStatus,
      createdAt: now,
      updatedAt: now,
      isSupplement: false,
      operator,
    };
    record.remarks.push(newRemark);
  }

  record.reviewStatus = status;
  const remarkForConclusion = record.remarks[record.remarks.length - 1];
  const conclusionParts: string[] = [];
  if (record.hasWeightAnomaly) conclusionParts.push('体重异常记录');
  if (record.hasVaccineMissing) conclusionParts.push('疫苗缺失');
  const statusMap: Record<string, string> = {
    pending: '待复核',
    approved: '复核通过',
    exception: '存在异常',
    needsInfo: '需补充信息',
  };
  record.conclusion = `${statusMap[status] || status}${conclusionParts.length ? '，' + conclusionParts.join('/') : ''}`;

  db.syncRemarkToException(id);
  db.recheckAllConsistency();

  res.json({
    success: true,
    data: {
      synced: true,
      recordUpdated: true,
      exportUpdated: true,
      exceptionUpdated: true,
      message: '备注已同步至后端数据和导出缓存',
      record,
    },
  });
});

router.post('/:id/remarks/supplement', (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, operator = '寄养店长老周' } = req.body;
  const record = db.boardingRecords.find(r => r.id === id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }

  const now = new Date().toISOString();
  const originalLatestRemark = record.remarks[record.remarks.length - 1];
  const beforeConclusion = record.conclusion;
  const beforeRemark = originalLatestRemark ? originalLatestRemark.content : '';

  const supplementRemark = {
    id: 'RMK-SUP-' + Math.random().toString(36).slice(2, 8),
    recordId: id,
    content: `【补录】${content}`,
    status: originalLatestRemark?.status || 'approved' as ReviewStatus,
    createdAt: now,
    updatedAt: now,
    isSupplement: true,
    operator,
  };
  record.remarks.push(supplementRemark);

  record.conclusion = `${record.conclusion}；【补录】${content}`;

  db.syncRemarkToException(id);
  db.recheckAllConsistency();

  const exportId = 'EXP-NEW-' + Math.random().toString(36).slice(2, 6);
  const diff = [
    {
      field: 'conclusion',
      before: beforeConclusion,
      after: record.conclusion,
      changeReason: `补录备注：${content}（操作人：${operator}）`,
      rowIndex: db.boardingRecords.findIndex(r => r.id === id) + 1,
    },
    {
      field: 'latestRemark',
      before: beforeRemark,
      after: supplementRemark.content,
      changeReason: '补录备注内容更新',
      rowIndex: db.boardingRecords.findIndex(r => r.id === id) + 1,
    },
  ];
  db.exportDiffs.set(exportId, diff);
  db.exportHistory.unshift({
    id: exportId,
    exportType: 'report',
    operator,
    createdAt: now,
    changeSummary: `${record.petName}(${id})补录备注后重新导出，结论和最新备注字段更新`,
    relatedRemarkId: supplementRemark.id,
  });

  res.json({
    success: true,
    data: {
      exportId,
      diff,
      changeDescription: `本次补录让导出发生了${diff.length}处变更：第${diff[0].rowIndex}行（宠物：${record.petName}）的"结论"字段和"最新备注"字段已更新为包含补录内容`,
      record,
    },
  });
});

export default router;
