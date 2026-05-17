import { Router, Request, Response } from 'express';
import { dataStore } from '../store/DataStore';
import { verificationService } from '../services/VerificationService';
import { VerificationStatus, DeliveryBatchStatus } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { batchNo, name, description, customer, version, createdBy } = req.body;
    
    if (!batchNo || !name || !customer || !version || !createdBy) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['batchNo', 'name', 'customer', 'version', 'createdBy']
      });
    }

    const batch = dataStore.createBatch(
      batchNo,
      name,
      description || '',
      customer,
      version,
      createdBy
    );

    res.status(201).json(batch);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  const batches = dataStore.getAllBatches();
  res.json(batches.map(batch => ({
    id: batch.id,
    batchNo: batch.batchNo,
    name: batch.name,
    customer: batch.customer,
    version: batch.version,
    status: batch.status,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    packageCount: batch.packages.length
  })));
});

router.get('/:batchId', (req: Request, res: Response) => {
  const batch = dataStore.getBatchById(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  res.json(batch);
});

router.get('/no/:batchNo', (req: Request, res: Response) => {
  const batch = dataStore.getBatchByNo(req.params.batchNo);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  res.json(batch);
});

router.post('/:batchId/packages', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { name, version, size, md5, sha256 } = req.body;

    if (!name || !version || !md5) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['name', 'version', 'md5']
      });
    }

    const pkg = dataStore.addPackage(batchId, {
      name,
      version,
      size: size || 0,
      md5,
      sha256: sha256 || '',
      verificationStatus: VerificationStatus.PENDING
    });

    const batch = dataStore.getBatchById(batchId);
    if (batch && batch.status === DeliveryBatchStatus.CREATED) {
      dataStore.updateBatchStatus(batchId, DeliveryBatchStatus.PACKAGES_UPLOADED);
    }

    res.status(201).json(pkg);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:batchId/manifest', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { fileName, content } = req.body;

    if (!fileName || !content) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['fileName', 'content']
      });
    }

    const manifest = dataStore.setManifest(batchId, {
      fileName,
      content,
      verificationStatus: VerificationStatus.PENDING,
      expectedPackages: [],
      missingPackages: [],
      extraPackages: []
    });

    res.status(201).json(manifest);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:batchId/manifest/verify', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = verificationService.verifyManifest(batchId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:batchId/signatures', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { packageId, packageName, signature, publicKey } = req.body;

    if (!packageName || !signature || !publicKey) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['packageName', 'signature', 'publicKey']
      });
    }

    const result = dataStore.addSignature(batchId, {
      packageId: packageId || '',
      packageName,
      signature,
      publicKey,
      verificationStatus: VerificationStatus.PENDING
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:batchId/signatures/verify', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = verificationService.verifySignatures(batchId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:batchId/patch-order', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { order, dependencies } = req.body;

    if (!order || !Array.isArray(order)) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['order']
      });
    }

    const result = dataStore.setPatchOrder(batchId, {
      order,
      dependencies: dependencies || {},
      verificationStatus: VerificationStatus.PENDING,
      circularDependencies: [],
      missingDependencies: []
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:batchId/patch-order/verify', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = verificationService.verifyPatchOrder(batchId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:batchId/reports', (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { generatedBy } = req.body;

    if (!generatedBy) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['generatedBy']
      });
    }

    const report = verificationService.generateReport(batchId, generatedBy);
    res.status(201).json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:batchId/reports/:reportId/export', (req: Request, res: Response) => {
  try {
    const { batchId, reportId } = req.params;
    const content = verificationService.exportReport(batchId, reportId);
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="verification-report-${reportId}.txt"`);
    res.send(content);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:batchId/errors/:errorId/resolve', (req: Request, res: Response) => {
  try {
    const { batchId, errorId } = req.params;
    const { resolvedBy, resolutionNote } = req.body;

    if (!resolvedBy) {
      return res.status(400).json({ 
        error: '缺少必要参数',
        required: ['resolvedBy']
      });
    }

    const result = dataStore.resolveError(
      batchId, 
      errorId, 
      resolvedBy, 
      resolutionNote || ''
    );

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:batchId/packages/:packageId/manual-fix', (req: Request, res: Response) => {
  try {
    const { batchId, packageId } = req.params;
    const result = dataStore.manualFixPackage(batchId, packageId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;