import { Request, Response, NextFunction } from 'express';
import { Parser } from 'json2csv';
import { arbitrationStore } from '../store/arbitrationStore';
import { CreateArbitrationRequest, UpdateStatusRequest, CorrectionRequest, QueryParams, ArbitrationRecord } from '../types';
import { AppError } from '../middleware/errorHandler';

export const createArbitration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const request: CreateArbitrationRequest = req.body;
    const record = arbitrationStore.create(request);

    res.status(201).json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

export const getArbitrationById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const record = arbitrationStore.findById(String(id));

    if (!record) {
      throw new AppError(404, 'NOT_FOUND', '仲裁记录不存在');
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

export const getArbitrations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const params: QueryParams = req.query as any;
    const result = arbitrationStore.findAll(params);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateArbitrationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const stringId = String(id);
    const request: UpdateStatusRequest = req.body;

    const existingRecord = arbitrationStore.findById(stringId);
    if (!existingRecord) {
      throw new AppError(404, 'NOT_FOUND', '仲裁记录不存在');
    }

    const record = arbitrationStore.updateStatus(stringId, request);

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

export const addCorrection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const stringId = String(id);
    const request: CorrectionRequest = req.body;

    const existingRecord = arbitrationStore.findById(stringId);
    if (!existingRecord) {
      throw new AppError(404, 'NOT_FOUND', '仲裁记录不存在');
    }

    const editableFields = ['fieldName', 'disputeDescription', 'arbitrationOpinion', 'effectiveVersion'];
    if (!editableFields.includes(request.field)) {
      throw new AppError(400, 'INVALID_FIELD', '不支持修改该字段', {
        allowedFields: editableFields
      });
    }

    const record = arbitrationStore.addCorrection(stringId, request);

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

export const exportArbitrations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const records = arbitrationStore.getAllRecords();

    const flattenedRecords = records.map(record => ({
      id: record.id,
      fieldName: record.fieldName,
      sourceReports: record.sourceReports.map(r => `${r.reportName}: ${r.calculation}`).join('; '),
      disputeDescription: record.disputeDescription,
      arbitrationOpinion: record.arbitrationOpinion || '',
      effectiveVersion: record.effectiveVersion || '',
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      createdBy: record.createdBy,
      arbitratedBy: record.arbitratedBy || '',
      handlingBasis: record.handlingBasis || '',
      correctionsCount: record.corrections.length
    }));

    const fields = [
      'id',
      'fieldName',
      'sourceReports',
      'disputeDescription',
      'arbitrationOpinion',
      'effectiveVersion',
      'status',
      'createdAt',
      'updatedAt',
      'createdBy',
      'arbitratedBy',
      'handlingBasis',
      'correctionsCount'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(flattenedRecords);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="field-caliber-arbitration-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
};

export const getStatusStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const records = arbitrationStore.getAllRecords();
    const stats: Record<string, number> = {};

    records.forEach(record => {
      stats[record.status] = (stats[record.status] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        total: records.length,
        byStatus: stats
      }
    });
  } catch (error) {
    next(error);
  }
};
