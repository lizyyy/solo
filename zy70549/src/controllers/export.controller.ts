import { Request, Response } from "express";
import Joi from "joi";
import { ExportService } from "../services/export.service";

const createRequestSchema = Joi.object({
  topicId: Joi.string().required(),
  startTime: Joi.string().isoDate().required(),
  endTime: Joi.string().isoDate().required(),
  requester: Joi.string().required(),
  reason: Joi.string().required(),
  idempotencyKey: Joi.string().optional()
});

const approveSchema = Joi.object({
  approver: Joi.string().required(),
  comment: Joi.string().optional()
});

const rejectSchema = Joi.object({
  approver: Joi.string().required(),
  reason: Joi.string().required()
});

const verifySchema = Joi.object({
  verifier: Joi.string().required()
});

const reportSchema = Joi.object({
  generator: Joi.string().required(),
  format: Joi.string().valid("json", "csv").default("json")
});

export class ExportController {
  static async createRequest(req: Request, res: Response) {
    try {
      const { error, value } = createRequestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      const result = await ExportService.createExportRequest(
        value.topicId,
        value.startTime,
        value.endTime,
        value.requester,
        value.reason,
        value.idempotencyKey
      );
      res.status(result.isNew ? 201 : 200).json({
        success: true,
        isNew: result.isNew,
        data: result.request
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getRequests(req: Request, res: Response) {
    try {
      const { status, topicId, requester } = req.query;
      const filters: any = {};
      if (status) filters.status = status as string;
      if (topicId) filters.topicId = topicId as string;
      if (requester) filters.requester = requester as string;
      const requests = await ExportService.getRequests(filters);
      res.json({ success: true, data: requests });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getRequestById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const request = await ExportService.getRequestById(id);
      if (!request) {
        return res.status(404).json({ error: "Export request not found" });
      }
      res.json({ success: true, data: request });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async approveRequest(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { error, value } = approveSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      const result = await ExportService.approveRequest(id, value.approver, value.comment);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async rejectRequest(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { error, value } = rejectSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      const result = await ExportService.rejectRequest(id, value.approver, value.reason);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async verifyHashChain(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { error, value } = verifySchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      const result = await ExportService.verifyHashChain(id, value.verifier);
      res.json({
        success: true,
        data: {
          verificationId: result.verificationId,
          isValid: result.isValid,
          mismatchCount: result.mismatches.length,
          mismatches: result.mismatches
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async generateReport(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { error, value } = reportSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      const result = await ExportService.generateProofReport(id, value.generator, value.format);
      res.json({
        success: true,
        data: {
          reportId: result.reportId,
          format: result.format,
          content: result.reportContent
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async exportEvents(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const events = await ExportService.exportEvents(id);
      res.json({
        success: true,
        data: {
          eventCount: events.length,
          events
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getProcessingHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const history = await ExportService.getProcessingHistory(id);
      res.json({ success: true, data: history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
