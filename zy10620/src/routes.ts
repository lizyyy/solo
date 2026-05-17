import { Router, Request, Response } from 'express';
import * as service from './service';
import { store } from './store';
import { getHttpStatus } from './errors';

const router = Router();

router.post('/leases', (req: Request, res: Response) => {
  try {
    const { createdBy, ...leaseData } = req.body;
    const lease = service.createLeaseService({
      ...leaseData,
      createdBy
    });
    res.status(201).json(lease);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leases', (req: Request, res: Response) => {
  const leases = store.listLeases();
  res.json(leases);
});

router.get('/leases/:id', (req: Request, res: Response) => {
  const lease = store.getLease(req.params.id);
  if (!lease) {
    const error = service.errors.leaseNotFound(req.params.id);
    return res.status(getHttpStatus(error.category)).json(error);
  }
  res.json(lease);
});

router.get('/leases/:id/history', (req: Request, res: Response) => {
  const lease = store.getLease(req.params.id);
  if (!lease) {
    const error = service.errors.leaseNotFound(req.params.id);
    return res.status(getHttpStatus(error.category)).json(error);
  }
  const history = store.getHistory(req.params.id);
  res.json(history);
});

router.patch('/leases/:id/status', (req: Request, res: Response) => {
  const { status, actor } = req.body;
  const result = service.transitionStatusService(req.params.id, status, actor || 'api');
  
  if (!result.success) {
    if (result.error) {
      return res.status(getHttpStatus(result.error.category)).json(result.error);
    }
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.json(result.lease);
});

router.post('/leases/:id/auto-renewal', (req: Request, res: Response) => {
  const { actor } = req.body;
  const result = service.submitAutoRenewalService(req.params.id, actor || 'api');
  
  if (!result.success) {
    if (result.error) {
      return res.status(getHttpStatus(result.error.category)).json(result.error);
    }
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.json(result.lease);
});

router.post('/leases/:id/manual-renewal', (req: Request, res: Response) => {
  const { renewalData, actor } = req.body;
  const result = service.submitManualRenewalService(req.params.id, renewalData, actor || 'api');
  
  if (!result.success) {
    if (result.error) {
      return res.status(getHttpStatus(result.error.category)).json(result.error);
    }
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.json(result.lease);
});

router.post('/leases/:id/remarks', (req: Request, res: Response) => {
  const { content, conflictId, actor } = req.body;
  if (!content) {
    const error = service.errors.missingRequiredField('content');
    return res.status(getHttpStatus(error.category)).json(error);
  }

  const result = service.addRemarkService(req.params.id, content, actor || 'api', conflictId);

  if (!result.success) {
    if (result.error) {
      return res.status(getHttpStatus(result.error.category)).json(result.error);
    }
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(result.lease);
});

router.patch('/leases/:id/conflicts/:conflictId/resolve', (req: Request, res: Response) => {
  const { resolution, actor } = req.body;
  if (!resolution) {
    const error = service.errors.missingRequiredField('resolution');
    return res.status(getHttpStatus(error.category)).json(error);
  }

  const result = service.resolveConflictService(
    req.params.id,
    req.params.conflictId,
    resolution,
    actor || 'api'
  );

  if (!result.success) {
    if (result.error) {
      return res.status(getHttpStatus(result.error.category)).json(result.error);
    }
    return res.status(404).json({ error: 'Not found' });
  }

  res.json(result.lease);
});

router.post('/leases/import', (req: Request, res: Response) => {
  const { rows, actor } = req.body;
  if (!Array.isArray(rows)) {
    const error = service.errors.missingRequiredField('rows');
    return res.status(getHttpStatus(error.category)).json(error);
  }

  const result = service.importLeasesService(rows, actor || 'api');
  
  res.json({
    leases: result.leases,
    badRows: result.badRows
  });
});

router.post('/leases/:id/confirm-renewal', (req: Request, res: Response) => {
  const { actor } = req.body;
  const result = service.confirmRenewalService(req.params.id, actor || 'api');
  
  if (!result.success) {
    if (result.error) {
      return res.status(getHttpStatus(result.error.category)).json(result.error);
    }
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.json(result.lease);
});

router.get('/leases/:id/export', (req: Request, res: Response) => {
  const lease = store.getLease(req.params.id);
  if (!lease) {
    const error = service.errors.leaseNotFound(req.params.id);
    return res.status(getHttpStatus(error.category)).json(error);
  }

  const history = store.getHistory(req.params.id);
  
  store.addHistory(req.params.id, {
    actionType: 'exported',
    actor: 'api',
    description: '导出租赁记录',
    details: { format: 'json' }
  });

  const exportData = {
    lease: {
      id: lease.id,
      leaseNo: lease.leaseNo,
      status: lease.status,
      createdAt: lease.createdAt,
      updatedAt: lease.updatedAt
    },
    customer: lease.customer,
    asset: lease.asset,
    renewalRule: lease.renewalRule,
    summary: {
      totalConflicts: lease.conflicts.length,
      unresolvedConflicts: lease.conflicts.filter(c => c.status !== 'resolved').length,
      totalRemarks: lease.remarks.length,
      totalRenewalRecords: lease.renewalRecords.length
    },
    conflicts: lease.conflicts,
    renewalRecords: lease.renewalRecords,
    remarks: lease.remarks,
    history: history,
    importBadRows: lease.importBadRows || []
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="lease-${lease.id}.json"`);
  res.json(exportData);
});

export default router;
