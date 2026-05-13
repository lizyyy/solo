import express, { Request, Response } from 'express';
import { TreatmentService } from '../services/treatment';
import { Parser } from 'json2csv';

export const createReportRouter = (treatmentService: TreatmentService) => {
  const router = express.Router();

  router.get('/export', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, assigneeId, assigneeName } = req.query;
      const records = await treatmentService.exportReport({
        startDate: startDate as string,
        endDate: endDate as string,
        assigneeId: assigneeId as string,
        assigneeName: assigneeName as string
      });
      res.json({ success: true, data: records });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.get('/export/csv', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, assigneeId, assigneeName } = req.query;
      const records = await treatmentService.exportReport({
        startDate: startDate as string,
        endDate: endDate as string,
        assigneeId: assigneeId as string,
        assigneeName: assigneeName as string
      });

      const flattened = records.map((r: any) => ({
        操作时间: r.actionTime,
        操作人ID: r.operatorId,
        操作人姓名: r.operatorName,
        患者姓名: r.patientName,
        实体类型: r.entityType,
        字段名: r.fieldName,
        修改前值: typeof r.oldValue === 'object' ? JSON.stringify(r.oldValue) : r.oldValue,
        修改后值: typeof r.newValue === 'object' ? JSON.stringify(r.newValue) : r.newValue,
        修改原因: r.reason
      }));

      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(flattened);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="treatment_report_${Date.now()}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
};

export default createReportRouter;
