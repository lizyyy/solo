import { Request, Response } from 'express';
import { importService } from '../services/ImportService';
import { reconciliationEngine } from '../services/ReconciliationEngine';
import { reviewService } from '../services/ReviewService';
import { reportService } from '../services/ReportService';
import { dataStore } from '../models/DataStore';
import { ReviewResult, ReviewAction } from '../types';

export class ReconciliationController {
  async importBedCSV(req: Request, res: Response): Promise<void> {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ success: false, error: 'filePath is required' });
        return;
      }

      const result = await importService.importBedCSV(filePath);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async importPatientJSON(req: Request, res: Response): Promise<void> {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ success: false, error: 'filePath is required' });
        return;
      }

      const result = await importService.importPatientJSON(filePath);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async importCleaningWorkOrdersJSON(req: Request, res: Response): Promise<void> {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        res.status(400).json({ success: false, error: 'filePath is required' });
        return;
      }

      const result = await importService.importCleaningWorkOrdersJSON(filePath);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async runReconciliation(req: Request, res: Response): Promise<void> {
    try {
      const { performedBy, ward } = req.body;
      if (!performedBy) {
        res.status(400).json({ success: false, error: 'performedBy is required' });
        return;
      }

      const record = await reconciliationEngine.runReconciliation(performedBy, ward);
      res.json({ success: true, data: record });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async reviewDiscrepancy(req: Request, res: Response): Promise<void> {
    try {
      const { discrepancyId } = req.params;
      const { result, action, notes, reviewedBy, supportingEvidence } = req.body;

      if (!discrepancyId || !result || !action || !notes || !reviewedBy) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      const reviewResult = await reviewService.reviewDiscrepancy(
        discrepancyId,
        result as ReviewResult,
        action as ReviewAction,
        notes,
        reviewedBy,
        supportingEvidence
      );

      res.json({ success: true, data: reviewResult });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async batchReview(req: Request, res: Response): Promise<void> {
    try {
      const { discrepancyIds, result, action, notes, reviewedBy } = req.body;

      if (!discrepancyIds || !result || !action || !notes || !reviewedBy) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      const batchResult = await reviewService.batchReview(
        discrepancyIds,
        result as ReviewResult,
        action as ReviewAction,
        notes,
        reviewedBy
      );

      res.json({ success: true, data: batchResult });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getDiscrepancies(req: Request, res: Response): Promise<void> {
    try {
      const { status, type, severity } = req.query;
      let discrepancies = dataStore.getAllDiscrepancies();

      if (status === 'resolved') {
        discrepancies = discrepancies.filter(d => d.isResolved);
      } else if (status === 'pending') {
        discrepancies = discrepancies.filter(d => !d.isResolved);
      }

      if (type) {
        discrepancies = discrepancies.filter(d => d.type === type);
      }

      if (severity) {
        discrepancies = discrepancies.filter(d => d.severity === severity);
      }

      res.json({ success: true, data: discrepancies, count: discrepancies.length });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getDiscrepancy(req: Request, res: Response): Promise<void> {
    try {
      const { discrepancyId } = req.params;
      const discrepancy = dataStore.getDiscrepancy(discrepancyId);

      if (!discrepancy) {
        res.status(404).json({ success: false, error: 'Discrepancy not found' });
        return;
      }

      const history = reviewService.getDiscrepancyReviewHistory(discrepancyId);
      const explanation = reviewService.generateDiscrepancyExplanation(discrepancyId);

      res.json({ 
        success: true, 
        data: {
          discrepancy,
          reviewHistory: history,
          explanation
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getPatientAuditTrail(req: Request, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const auditTrail = reviewService.getPatientAuditTrail(patientId);

      if (!auditTrail.patientInfo) {
        res.status(404).json({ success: false, error: 'Patient not found' });
        return;
      }

      res.json({ success: true, data: auditTrail });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getPatientFullReport(req: Request, res: Response): Promise<void> {
    try {
      const { patientId } = req.params;
      const report = reportService.getPatientFullReport(patientId);

      if (!report.patient) {
        res.status(404).json({ success: false, error: 'Patient not found' });
        return;
      }

      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async generateReconciliationReport(req: Request, res: Response): Promise<void> {
    try {
      const { recordId } = req.params;
      const report = reportService.generateReconciliationReport(recordId);
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async exportDiscrepanciesCSV(req: Request, res: Response): Promise<void> {
    try {
      const result = reportService.exportDiscrepanciesToCSV();
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.csv);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async exportBedsCSV(req: Request, res: Response): Promise<void> {
    try {
      const result = reportService.exportBedsToCSV();
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.csv);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async exportPatientsCSV(req: Request, res: Response): Promise<void> {
    try {
      const result = reportService.exportPatientsToCSV();
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.csv);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async exportWorkOrdersCSV(req: Request, res: Response): Promise<void> {
    try {
      const result = reportService.exportWorkOrdersToCSV();
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.send(result.csv);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getSummaryStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = reportService.generateSummaryStatistics();
      res.json({ success: true, data: statistics });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const dashboardData = reportService.generateDashboardData();
      res.json({ success: true, data: dashboardData });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getBeds(req: Request, res: Response): Promise<void> {
    try {
      const { ward, status } = req.query;
      let beds = dataStore.getAllBeds();

      if (ward) {
        beds = beds.filter(b => b.ward === ward);
      }

      if (status) {
        beds = beds.filter(b => b.status === status);
      }

      res.json({ success: true, data: beds, count: beds.length });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getPatients(req: Request, res: Response): Promise<void> {
    try {
      const { status, ward } = req.query;
      let patients = dataStore.getAllPatients();

      if (status) {
        patients = patients.filter(p => p.status === status);
      }

      res.json({ success: true, data: patients, count: patients.length });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getWorkOrders(req: Request, res: Response): Promise<void> {
    try {
      const { status, ward } = req.query;
      let workOrders = dataStore.getAllWorkOrders();

      if (status) {
        workOrders = workOrders.filter(wo => wo.status === status);
      }

      if (ward) {
        workOrders = workOrders.filter(wo => wo.ward === ward);
      }

      res.json({ success: true, data: workOrders, count: workOrders.length });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getReconciliationRecords(req: Request, res: Response): Promise<void> {
    try {
      const records = dataStore.getAllReconciliationRecords();
      res.json({ success: true, data: records, count: records.length });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async validateConsistency(req: Request, res: Response): Promise<void> {
    try {
      const result = importService.validateBedPatientConsistency();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async clearAllData(req: Request, res: Response): Promise<void> {
    try {
      dataStore.clearAll();
      res.json({ success: true, message: 'All data cleared successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
}

export const reconciliationController = new ReconciliationController();
