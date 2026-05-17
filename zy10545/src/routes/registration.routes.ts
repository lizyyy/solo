import { Router, Request, Response } from 'express';
import { store } from '../models/store';
import { qualificationService } from '../services/qualification.service';
import { reportService } from '../services/report.service';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { trainingId, applicantId, applicantName, applicantEmail, applicantData, operator } = req.body;

    if (!trainingId || !applicantId || !applicantName || !applicantEmail || !operator) {
      return res.status(400).json({ error: '培训ID、报名人信息和操作人为必填项' });
    }

    const registration = qualificationService.processRegistration(
      trainingId,
      applicantId,
      applicantName,
      applicantEmail,
      applicantData || {},
      operator
    );

    res.status(201).json(registration);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const registration = store.getRegistration(req.params.id);
    if (!registration) {
      return res.status(404).json({ error: '报名记录不存在' });
    }
    res.json(registration);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/training/:trainingId', (req: Request, res: Response) => {
  try {
    const registrations = store.getRegistrationsByTraining(req.params.trainingId);
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/applicant/:applicantId', (req: Request, res: Response) => {
  try {
    const registrations = store.getRegistrationsByApplicant(req.params.applicantId);
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/:id/approve', (req: Request, res: Response) => {
  try {
    const { operator, comment } = req.body;
    if (!operator) {
      return res.status(400).json({ error: '操作人为必填项' });
    }

    const updated = qualificationService.approveRegistration(req.params.id, operator, comment);
    if (!updated) {
      return res.status(404).json({ error: '报名记录不存在' });
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const { operator, comment } = req.body;
    if (!operator || !comment) {
      return res.status(400).json({ error: '操作人和拒绝理由为必填项' });
    }

    const updated = qualificationService.rejectRegistration(req.params.id, operator, comment);
    if (!updated) {
      return res.status(404).json({ error: '报名记录不存在' });
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:id/cancel', (req: Request, res: Response) => {
  try {
    const { operator, comment } = req.body;
    if (!operator) {
      return res.status(400).json({ error: '操作人为必填项' });
    }

    const updated = qualificationService.cancelRegistration(req.params.id, operator, comment);
    if (!updated) {
      return res.status(404).json({ error: '报名记录不存在' });
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:id/correct', (req: Request, res: Response) => {
  try {
    const { updates, operator, reason } = req.body;
    if (!operator || !reason) {
      return res.status(400).json({ error: '操作人和修正理由为必填项' });
    }

    const updated = qualificationService.manualCorrect(req.params.id, updates, operator, reason);
    if (!updated) {
      return res.status(404).json({ error: '报名记录不存在' });
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/:id/audit-trail', (req: Request, res: Response) => {
  try {
    const auditTrails = store.getAuditTrailsByRegistration(req.params.id);
    res.json(auditTrails);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/report/:trainingId', (req: Request, res: Response) => {
  try {
    const report = reportService.generateReport(req.params.trainingId);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/export/:trainingId', async (req: Request, res: Response) => {
  try {
    const csv = await reportService.exportReportToCsv(req.params.trainingId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="training-report-${req.params.trainingId}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.get('/export-audit/:trainingId', async (req: Request, res: Response) => {
  try {
    const csv = await reportService.exportAuditTrailToCsv(req.params.trainingId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${req.params.trainingId}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
