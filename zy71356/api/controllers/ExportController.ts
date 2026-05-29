import { Request, Response } from 'express';
import { ExportService } from '../services/ExportService';
import { ArrangementService } from '../services/ArrangementService';
import { VendorService } from '../services/VendorService';
import { StallService } from '../services/StallService';

export class ExportController {
  private exportService: ExportService;
  private arrangementService: ArrangementService;
  private vendorService: VendorService;
  private stallService: StallService;

  constructor() {
    this.exportService = new ExportService();
    this.arrangementService = new ArrangementService();
    this.vendorService = new VendorService();
    this.stallService = new StallService();
  }

  exportExcel = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const arrangement = this.arrangementService.getArrangementById(id);
      if (!arrangement) {
        res.status(404).json({ error: '排布不存在' });
        return;
      }

      const assignments = this.arrangementService.getAssignmentsWithDetails(id);
      const vendors = this.vendorService.getAllVendors();
      const stalls = this.stallService.getAllStalls();

      const buf = this.exportService.exportToExcel(
        arrangement,
        assignments,
        vendors,
        stalls,
        arrangement.conflicts
      );

      const fileName = `摊位排布报告_${arrangement.version}_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileName)}"`
      );
      res.send(buf);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  exportConflictReport = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const arrangement = this.arrangementService.getArrangementById(id);
      if (!arrangement) {
        res.status(404).json({ error: '排布不存在' });
        return;
      }

      const report = this.exportService.generateConflictReport(
        arrangement,
        arrangement.conflicts
      );

      const fileName = `冲突报告_${arrangement.version}_${new Date().toISOString().split('T')[0]}.txt`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(fileName)}"`
      );
      res.send(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getConflictReportText = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const arrangement = this.arrangementService.getArrangementById(id);
      if (!arrangement) {
        res.status(404).json({ error: '排布不存在' });
        return;
      }

      const report = this.exportService.generateConflictReport(
        arrangement,
        arrangement.conflicts
      );

      res.json({ report });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
