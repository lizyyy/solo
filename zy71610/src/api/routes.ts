import { Router, Request, Response } from 'express';
import { settlementFacade } from '../services/SettlementFacade';
import { SettlementFilter, ExportOptions } from '../types/models';

const router = Router();

router.get('/applications', (req: Request, res: Response) => {
  try {
    const filter: SettlementFilter = req.query;
    const applications = settlementFacade.listApplications(filter);
    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/applications/:id', (req: Request, res: Response) => {
  try {
    const application = settlementFacade.getApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.get('/applications/:id/history', (req: Request, res: Response) => {
  try {
    const history = settlementFacade.getHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/applications', (req: Request, res: Response) => {
  try {
    const { contractNo, applicant, settlementReason, operator, expectedSettlementDate } = req.body;
    const application = settlementFacade.createSettlementApplication(
      contractNo,
      applicant,
      settlementReason,
      operator,
      expectedSettlementDate,
    );
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

router.post('/applications/:id/recalculate', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const application = settlementFacade.recalculateSettlement(req.params.id, operator);
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

router.post('/applications/:id/correct', (req: Request, res: Response) => {
  try {
    const { fieldName, correctedValue, correctedBy, correctionReason } = req.body;
    const application = settlementFacade.correctValue(
      req.params.id,
      fieldName,
      correctedValue,
      correctedBy,
      correctionReason,
    );
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

router.post('/applications/:id/transition', (req: Request, res: Response) => {
  try {
    const { targetStatus, userRole, operator, remark } = req.body;
    const application = settlementFacade.transitionStatus(
      req.params.id,
      targetStatus,
      userRole,
      operator,
      remark,
    );
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

router.post('/applications/:id/remark', (req: Request, res: Response) => {
  try {
    const { remark, operator } = req.body;
    const application = settlementFacade.updateRemark(req.params.id, remark, operator);
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

router.post('/applications/:id/resolve-anomaly', (req: Request, res: Response) => {
  try {
    const { anomalyType, resolvedBy, resolveReason } = req.body;
    const application = settlementFacade.resolveAnomaly(
      req.params.id,
      anomalyType,
      resolvedBy,
      resolveReason,
    );
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

router.get('/applications/:id/report', (req: Request, res: Response) => {
  try {
    const report = settlementFacade.exportDetailedReport(req.params.id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.txt"`);
    res.send(report);
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/applications/export', (req: Request, res: Response) => {
  try {
    const { filter, options }: { filter: SettlementFilter; options: ExportOptions } = req.body;
    const result = settlementFacade.exportApplications(filter, options);

    if (options.format === 'CSV') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="applications.csv"');
      res.send('\uFEFF' + result);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="applications.xlsx"');
      res.send(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

router.post('/statements', (req: Request, res: Response) => {
  try {
    const { applicationId, createdBy } = req.body;
    const statement = settlementFacade.createStatement(applicationId, createdBy);
    res.json({ success: true, data: statement });
  } catch (error) {
    res.status(400).json({ success: false, message: (error as Error).message });
  }
});

router.get('/transitions', (req: Request, res: Response) => {
  try {
    const { status, userRole } = req.query;
    const transitions = settlementFacade.getAvailableTransitions(
      status as string,
      userRole as string,
    );
    res.json({ success: true, data: transitions });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message });
  }
});

export default router;
