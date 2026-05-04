import { Request, Response } from 'express';
import { ExportService } from '../services';
import { wrapAsync } from '../middleware/error-handler';

export class ExportController {
  private readonly service: ExportService;

  constructor() {
    this.service = new ExportService();
  }

  getStudentBalances = wrapAsync(async (req: Request, res: Response) => {
    const { format } = req.query;
    const balances = await this.service.getStudentBalanceReport();

    if (format === 'csv') {
      const csv = await this.service.exportStudentBalancesToCSV(balances);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=student_balances.csv');
      res.send('\uFEFF' + csv);
    } else if (format === 'json') {
      res.json({ success: true, data: balances });
    } else {
      res.json({ success: true, data: balances });
    }
  });

  getTeacherPayments = wrapAsync(async (req: Request, res: Response) => {
    const { format, year, month } = req.query;
    const yearNum = year ? Number(year) : undefined;
    const monthNum = month ? Number(month) : undefined;
    const payments = await this.service.getTeacherPaymentReport(yearNum, monthNum);

    if (format === 'csv') {
      const csv = await this.service.exportTeacherPaymentsToCSV(payments);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=teacher_payments.csv');
      res.send('\uFEFF' + csv);
    } else if (format === 'json') {
      res.json({ success: true, data: payments });
    } else {
      res.json({ success: true, data: payments });
    }
  });

  getMonthlyReport = wrapAsync(async (req: Request, res: Response) => {
    const { year, month } = req.params;
    const { format } = req.query;
    
    const yearNum = Number(year);
    const monthNum = Number(month);
    
    const report = await this.service.getMonthlyReport(yearNum, monthNum);

    if (format === 'md' || format === 'markdown') {
      const markdown = await this.service.exportMonthlyReportToMarkdown(report);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=monthly_report_${year}_${month}.md`);
      res.send(markdown);
    } else if (format === 'json') {
      res.json({ success: true, data: report });
    } else {
      res.json({ success: true, data: report });
    }
  });
}
