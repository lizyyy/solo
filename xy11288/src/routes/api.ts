import express from 'express';
import { materialService } from '../services/MaterialService';
import { auditService } from '../services/AuditService';
import { idempotentService } from '../services/IdempotentService';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.use(express.json());

router.post('/materials/import', async (req, res) => {
  const { csvContent, operator } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  const result = await materialService.importMaterials(csvContent, operator, requestId);
  res.json(result);
});

router.post('/materials/occupy', async (req, res) => {
  const { materialCode, boothId, quantity, operator, reason } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  const result = await materialService.occupy(
    materialCode, boothId, quantity, operator, requestId, reason
  );
  res.json(result);
});

router.post('/materials/transfer', async (req, res) => {
  const { materialCode, fromBoothId, toBoothId, quantity, operator, reason } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  const result = await materialService.transfer(
    materialCode, fromBoothId, toBoothId, quantity, operator, requestId, reason
  );
  res.json(result);
});

router.post('/materials/return', async (req, res) => {
  const { recordId, quantity, operator, reason } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  const result = await materialService.return(
    recordId, quantity, operator, requestId, reason
  );
  res.json(result);
});

router.post('/materials/damage', async (req, res) => {
  const { recordId, quantity, damageType, description, deductionAmount, operator } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  const result = await materialService.reportDamage(
    recordId, quantity, damageType, description, deductionAmount, operator, requestId
  );
  res.json(result);
});

router.post('/materials/rollback', async (req, res) => {
  const { recordId, operator, reason } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  const result = await materialService.rollback(
    recordId, operator, requestId, reason
  );
  res.json(result);
});

router.get('/materials', async (req, res) => {
  const { type, status } = req.query;
  const materials = await materialService.getMaterials({
    type: type as any,
    status: status as string
  });
  res.json({ success: true, data: materials });
});

router.post('/booths', async (req, res) => {
  const { code, name, exhibitor, contact } = req.body;
  const result = await materialService.createBooth(code, name, exhibitor, contact);
  res.json(result);
});

router.get('/booths', async (req, res) => {
  const booths = await materialService.getBooths();
  res.json({ success: true, data: booths });
});

router.get('/records', async (req, res) => {
  const { boothId, materialCode, status, operationType } = req.query;
  const records = await materialService.getBorrowRecords({
    boothId: boothId as string,
    materialCode: materialCode as string,
    status: status as string,
    operationType: operationType as any
  });
  res.json({ success: true, data: records });
});

router.get('/audit-logs', async (req, res) => {
  const { requestId, operatorId, operationType, result, startTime, endTime } = req.query;
  const logs = await auditService.getLogs({
    requestId: requestId as string,
    operatorId: operatorId as string,
    operationType: operationType as any,
    result: result as any,
    startTime: startTime ? parseInt(startTime as string) : undefined,
    endTime: endTime ? parseInt(endTime as string) : undefined
  });
  res.json({ success: true, data: logs });
});

router.get('/export', async (req, res) => {
  const { format = 'json', boothId, materialCode, status, operationType } = req.query;
  const content = await materialService.exportReport(format as 'csv' | 'json', {
    boothId: boothId as string,
    materialCode: materialCode as string,
    status: status as string,
    operationType: operationType as any
  });
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
  } else {
    res.setHeader('Content-Type', 'application/json');
  }
  
  res.send(content);
});

router.get('/request/:requestId', async (req, res) => {
  const request = await idempotentService.getRequest(req.params.requestId);
  res.json({ success: true, data: request });
});

export default router;
