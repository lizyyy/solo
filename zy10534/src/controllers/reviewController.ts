import { Request, Response } from 'express';
import { ReviewService } from '../services/reviewService';
import { ExportService } from '../services/exportService';
import { store } from '../store/memoryStore';
import {
  createBatchSchema,
  createSampleSchema,
  createReviewSchema,
  updateReviewStatusSchema,
  manualCorrectionSchema,
  exportReportSchema
} from '../validation/schemas';
import { ReviewStatus } from '../types';

const successResponse = (res: Response, data: any, message?: string) => {
  res.json({
    success: true,
    data,
    message,
    timestamp: new Date()
  });
};

const errorResponse = (res: Response, error: string, statusCode: number = 400) => {
  res.status(statusCode).json({
    success: false,
    error,
    timestamp: new Date()
  });
};

export const createBatch = async (req: Request, res: Response) => {
  try {
    const { error, value } = createBatchSchema.validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message);
    }

    const batch = store.createBatch({
      ...value,
      totalSamples: 0,
      reviewedCount: 0,
      revisedCount: 0,
      averageOriginalScore: 0,
      averageRevisedScore: 0,
      status: ReviewStatus.PENDING
    });

    successResponse(res, batch, '评测批次创建成功');
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const createSample = async (req: Request, res: Response) => {
  try {
    const { error, value } = createSampleSchema.validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message);
    }

    const batch = store.getBatch(value.batchId);
    if (!batch) {
      return errorResponse(res, '评测批次不存在');
    }

    const sample = store.createSample({
      ...value,
      currentScore: value.originalScore
    });

    ReviewService['updateBatchStats'](value.batchId);

    successResponse(res, sample, '评测样本创建成功');
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const createReview = async (req: Request, res: Response) => {
  try {
    const { error, value } = createReviewSchema.validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message);
    }

    const review = await ReviewService.createReview(value);
    successResponse(res, review, '复核记录创建成功');
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const updateReviewStatus = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { error, value } = updateReviewStatusSchema.validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message);
    }

    const review = await ReviewService.updateReviewStatus(reviewId, value.status, value.updatedBy);
    successResponse(res, review, '复核状态更新成功');
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const manualCorrection = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { error, value } = manualCorrectionSchema.validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message);
    }

    const review = await ReviewService.manualCorrection(reviewId, value);
    successResponse(res, review, '人工改判成功');
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const handleException = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { exceptionMessage, rawInput, processingBasis } = req.body;

    if (!exceptionMessage || !processingBasis) {
      return errorResponse(res, '异常信息和处理依据是必填项');
    }

    const review = await ReviewService.handleException(reviewId, exceptionMessage, rawInput, processingBasis);
    successResponse(res, review, '异常处理完成');
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const getReview = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const review = ReviewService.getReview(reviewId);

    if (!review) {
      return errorResponse(res, '复核记录不存在', 404);
    }

    successResponse(res, review);
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const getSampleWithReviews = async (req: Request, res: Response) => {
  try {
    const { sampleId } = req.params;
    const data = ReviewService.getSampleWithReviews(sampleId);

    if (!data) {
      return errorResponse(res, '样本不存在', 404);
    }

    successResponse(res, data);
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const getBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const batch = ReviewService.getBatch(batchId);

    if (!batch) {
      return errorResponse(res, '评测批次不存在', 404);
    }

    successResponse(res, batch);
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const getAllBatches = async (req: Request, res: Response) => {
  try {
    const batches = ReviewService.getAllBatches();
    successResponse(res, batches);
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const getReviewsByBatch = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const reviews = ReviewService.getReviewsByBatch(batchId);
    successResponse(res, reviews);
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const exportBatchReport = async (req: Request, res: Response) => {
  try {
    const { error, value } = exportReportSchema.validate(req.body);
    if (error) {
      return errorResponse(res, error.details[0].message);
    }

    const result = await ExportService.exportBatchReport(value.batchId, value.format, value.generatedBy);

    if (value.format === 'csv') {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
      res.send(result.content);
    } else {
      successResponse(res, result.content, '报告导出成功');
    }
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const exportSampleReport = async (req: Request, res: Response) => {
  try {
    const { sampleId } = req.params;
    const { format = 'json', generatedBy } = req.body;

    if (!generatedBy) {
      return errorResponse(res, '导出人是必填项');
    }

    const result = await ExportService.exportSampleWithReviews(sampleId, format as 'json' | 'csv', generatedBy);

    if (format === 'csv') {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
      res.send(result.content);
    } else {
      successResponse(res, result.content, '样本详情导出成功');
    }
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};

export const generateReport = async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { generatedBy } = req.body;

    if (!generatedBy) {
      return errorResponse(res, '生成人是必填项');
    }

    const report = await ReviewService.generateReport(batchId, generatedBy);
    successResponse(res, report, '报告生成成功');
  } catch (err: any) {
    errorResponse(res, err.message, 500);
  }
};
