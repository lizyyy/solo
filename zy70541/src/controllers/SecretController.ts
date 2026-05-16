import { Request, Response, NextFunction } from 'express';
import secretService from '../services/SecretService';
import referenceService from '../services/ReferenceService';
import replacementService from '../services/ReplacementService';
import correctionService from '../services/CorrectionService';
import reportService from '../services/ReportService';
import { successResponse } from '../utils/response';
import type {
  CreateSecretInput,
  UpdateSecretStatusInput,
  CreateReferenceInput,
  RecordAccessInput,
  CreateReplacementInput,
  ApproveReplacementInput,
  CreateCorrectionInput,
  QuerySecretsInput,
} from '../utils/validation';

export class SecretController {
  async createSecret(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await secretService.createSecret(req.body as CreateSecretInput);
      res.status(201).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async getSecret(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await secretService.getSecretByName(req.params.name);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async querySecrets(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await secretService.querySecrets(req.query as unknown as QuerySecretsInput);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async updateSecretStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await secretService.updateSecretStatus(
        req.params.name,
        req.body as UpdateSecretStatusInput
      );
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async deleteSecret(req: Request, res: Response, next: NextFunction) {
    try {
      const force = req.query.force === 'true';
      const result = await secretService.deleteSecret(req.params.name, force);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async createReference(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await referenceService.createReference(
        req.params.name,
        req.body as CreateReferenceInput
      );
      res.status(201).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async getReferences(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.include_inactive === 'true';
      const result = await referenceService.getReferencesBySecret(req.params.name, includeInactive);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async recordAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await referenceService.recordAccess(
        req.params.name,
        req.body as RecordAccessInput
      );
      res.status(201).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async createReplacement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await replacementService.createReplacement(
        req.params.name,
        req.body as CreateReplacementInput
      );
      res.status(201).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async approveReplacement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await replacementService.approveReplacement(
        req.params.id,
        req.body as ApproveReplacementInput
      );
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async rejectReplacement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await replacementService.rejectReplacement(
        req.params.id,
        req.body as ApproveReplacementInput
      );
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async executeReplacement(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await replacementService.executeReplacement(req.params.id);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async createCorrection(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await correctionService.createCorrection(
        req.params.name,
        req.body as CreateCorrectionInput
      );
      res.status(201).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async getLineageReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reportService.generateLineageReport(req.params.name);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async exportReportCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await reportService.exportReportCSV(req.params.name);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${req.params.name}-lineage-report.csv"`
      );
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }

  async getErrors(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.page_size as string) || 20;
      const result = await secretService.getErrors(page, pageSize);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async getAllReports(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await reportService.getAllReports();
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }
}

export default new SecretController();
