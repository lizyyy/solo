import { Router, Request, Response } from 'express';
import detailRepository from '../repositories/DetailRepository.js';
import snapshotRepository from '../repositories/SnapshotRepository.js';
import auditTrailService from '../services/AuditTrailService.js';
import singleSourceService from '../services/SingleSourceService.js';
import type { DetailStatus } from '../../shared/types.js';

const router = Router();

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const detail = detailRepository.findById(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: '明细不存在' });
    }

    const snapshot = snapshotRepository.findById(detail.originalSnapshotId);
    const auditLogs = auditTrailService.getDetailAuditTrail(detail.id);

    res.json({
      ...detail,
      snapshot,
      auditLogs
    });
  } catch (error) {
    console.error('获取明细详情失败:', error);
    res.status(500).json({ error: '获取明细详情失败' });
  }
});

router.patch('/:id', (req: Request, res: Response) => {
  try {
    const { fieldName, value, remark, operator } = req.body as {
      fieldName: string;
      value: any;
      remark?: string;
      operator: string;
    };

    const detail = detailRepository.findById(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: '明细不存在' });
    }

    const oldValue = (detail as any)[fieldName]?.toString() || '';
    detailRepository.updateField(req.params.id, fieldName, value, operator);

    if (fieldName === 'taxRate') {
      auditTrailService.logTaxRateUpdate(
        req.params.id, detail.batchId, operator, oldValue, value.toString(), remark
      );
      detailRepository.recalculateNetAmount(req.params.id, operator);
    } else {
      auditTrailService.logUpdate(
        req.params.id, detail.batchId, operator, fieldName, oldValue, value.toString(), remark
      );
    }

    const updated = detailRepository.findById(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('更新明细失败:', error);
    res.status(500).json({ error: '更新明细失败' });
  }
});

router.post('/:id/currency-review', (req: Request, res: Response) => {
  try {
    const { decision, remark, operator } = req.body as {
      decision: 'MARK_EXCEPTION' | 'SUBMIT_REVIEW' | 'REJECT';
      remark?: string;
      operator: string;
    };

    const detail = detailRepository.findById(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: '明细不存在' });
    }

    const oldStatus = detail.status;
    let newStatus: DetailStatus = oldStatus;

    switch (decision) {
      case 'MARK_EXCEPTION':
        newStatus = 'EXCEPTION';
        break;
      case 'SUBMIT_REVIEW':
        newStatus = 'PENDING_REVIEW';
        break;
      case 'REJECT':
        newStatus = 'REVIEWED';
        break;
    }

    if (oldStatus !== newStatus) {
      detailRepository.updateStatus(req.params.id, newStatus, operator);
      auditTrailService.logStatusChange(
        req.params.id, detail.batchId, operator, oldStatus, newStatus, remark
      );
    }

    auditTrailService.logCurrencyReview(
      req.params.id, detail.batchId, operator, decision, remark
    );

    const updated = detailRepository.findById(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('币种复核失败:', error);
    res.status(500).json({ error: '币种复核失败' });
  }
});

router.get('/:id/audit-trail', (req: Request, res: Response) => {
  try {
    const logs = auditTrailService.getDetailAuditTrail(req.params.id);
    res.json(logs);
  } catch (error) {
    console.error('获取审计追踪失败:', error);
    res.status(500).json({ error: '获取审计追踪失败' });
  }
});

export default router;
