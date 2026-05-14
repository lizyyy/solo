import { Router, Request, Response } from 'express';
import { tenantInitService } from '../services/tenantInitService';
import { rollbackService } from '../services/rollbackService';
import { exportService } from '../services/exportService';
import { allQuery } from '../database';

const router = Router();

router.post('/initialize', async (req: Request, res: Response) => {
  try {
    const { tenantId, tenantName, packagePath } = req.body;

    if (!tenantId || !tenantName || !packagePath) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: tenantId, tenantName, packagePath'
      });
    }

    const result = await tenantInitService.initializeTenant(tenantId, tenantName, packagePath);

    res.json({
      success: result.success,
      recordId: result.recordId,
      currentStep: result.currentStep,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/records', async (req: Request, res: Response) => {
  try {
    const { status, tenantId } = req.query;
    const records = await tenantInitService.getInitRecords({
      status: status as string,
      tenantId: tenantId as string
    });

    res.json({
      success: true,
      data: records
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/records/:recordId', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const record = await tenantInitService.getInitRecord(recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/records/:recordId/details', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const { status, step } = req.query;
    const details = await tenantInitService.getDetailItems(recordId, {
      status: status as string,
      step: step as string
    });

    res.json({
      success: true,
      data: details
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/records/:recordId/failed', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const failedItems = await tenantInitService.getDetailItems(recordId, { status: 'FAILED' });

    res.json({
      success: true,
      data: failedItems
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/rollback/:recordId/candidates', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const candidates = await rollbackService.generateRollbackCandidates(recordId);

    res.json({
      success: true,
      data: candidates
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/rollback/:recordId/candidates', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const candidates = await rollbackService.getRollbackCandidates(recordId);

    res.json({
      success: true,
      data: candidates
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/rollback/:recordId/execute', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const { candidateIds } = req.body;

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供要回滚的候选ID列表'
      });
    }

    const result = await rollbackService.executeRollback(recordId, candidateIds);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/cleanup/candidates', async (req: Request, res: Response) => {
  try {
    const candidates = await rollbackService.generateCleanupCandidates();

    res.json({
      success: true,
      data: candidates
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/export/:recordId', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const filePath = await exportService.exportInitRecord(recordId);

    res.json({
      success: true,
      filePath
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/export/devices/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const filePath = await exportService.exportDeviceLedger(tenantId);

    res.json({
      success: true,
      filePath
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/revisions', async (req: Request, res: Response) => {
  try {
    const { recordId, detailItemId, attachmentName, beforeValue, afterValue, modifiedBy, approvalNodeId } = req.body;

    const revisionId = await exportService.createAttachmentRevision(
      recordId, detailItemId, attachmentName, beforeValue, afterValue, modifiedBy, approvalNodeId
    );

    res.json({
      success: true,
      revisionId
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/revisions/:recordId', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const revisions = await exportService.getAttachmentRevisions(recordId);

    res.json({
      success: true,
      data: revisions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/approvals', async (req: Request, res: Response) => {
  try {
    const { recordId, nodeName, nodeOrder, approver } = req.body;

    const nodeId = await exportService.createApprovalNode(recordId, nodeName, nodeOrder, approver);

    res.json({
      success: true,
      nodeId
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/approvals/:nodeId/approve', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const { approver, comment } = req.body;

    await exportService.approveNode(nodeId, approver, comment);

    res.json({
      success: true
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/approvals/:recordId', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const nodes = await exportService.getApprovalNodes(recordId);

    res.json({
      success: true,
      data: nodes
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/devices/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const devices = await allQuery<any>(
      `SELECT * FROM device_ledgers WHERE tenant_id = ? ORDER BY created_at DESC`,
      [tenantId]
    );

    const result = devices.map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      deviceCode: d.device_code,
      deviceName: d.device_name,
      deviceType: d.device_type,
      storeName: d.store_name,
      installLocation: d.install_location,
      status: d.status,
      purchaseDate: d.purchase_date,
      warrantyPeriod: d.warranty_period,
      manufacturer: d.manufacturer,
      model: d.model
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
