import { Router, Request, Response } from 'express';
import { prescriptionService } from './service';
import { StatusValidationError, ConflictError } from './validator';
import { Parser } from 'json2csv';

const router = Router();

const handleError = (res: Response, error: any) => {
  if (error instanceof StatusValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof ConflictError) {
    return res.status(409).json({ error: error.message });
  }
  return res.status(500).json({ error: '服务器内部错误' });
};

router.get('/prescriptions', async (req: Request, res: Response) => {
  try {
    const { status, patientName } = req.query;
    const prescriptions = await prescriptionService.listPrescriptions({
      status: status as any,
      patientName: patientName as string
    });
    res.json(prescriptions);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/prescriptions/:id', async (req: Request, res: Response) => {
  try {
    const prescription = await prescriptionService.getPrescription(req.params.id);
    if (!prescription) {
      return res.status(404).json({ error: '处方不存在' });
    }
    res.json(prescription);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/prescriptions/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await prescriptionService.getWithdrawalHistory(req.params.id);
    res.json(history);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/prescriptions', async (req: Request, res: Response) => {
  try {
    const prescription = await prescriptionService.createPrescription(req.body);
    res.status(201).json(prescription);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/prescriptions/import', async (req: Request, res: Response) => {
  try {
    const result = await prescriptionService.importPrescriptions(req.body);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/prescriptions/export/csv', async (req: Request, res: Response) => {
  try {
    const data = await prescriptionService.exportPrescriptions();
    const parser = new Parser();
    const csv = parser.parse(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=prescriptions.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/prescriptions/export/json', async (req: Request, res: Response) => {
  try {
    const data = await prescriptionService.exportPrescriptions();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=prescriptions.json');
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/prescriptions/:id/withdraw', async (req: Request, res: Response) => {
  try {
    const prescription = await prescriptionService.requestWithdrawal({
      prescriptionId: req.params.id,
      reason: req.body.reason,
      operatorId: req.body.operatorId,
      operatorName: req.body.operatorName
    });
    res.json(prescription);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/prescriptions/:id/audit', async (req: Request, res: Response) => {
  try {
    const prescription = await prescriptionService.auditWithdrawal({
      prescriptionId: req.params.id,
      approved: req.body.approved,
      remark: req.body.remark,
      operatorId: req.body.operatorId,
      operatorName: req.body.operatorName
    });
    res.json(prescription);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/prescriptions/:id/close', async (req: Request, res: Response) => {
  try {
    const prescription = await prescriptionService.closePrescription(req.params.id);
    res.json(prescription);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/prescriptions/:id/dispensed', async (req: Request, res: Response) => {
  try {
    const prescription = await prescriptionService.markAsDispensed(req.params.id);
    res.json(prescription);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
