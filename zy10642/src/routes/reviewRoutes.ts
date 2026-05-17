import express, { Request, Response } from 'express';
import { reviewService, StateValidationError } from '../services/ReviewService';
import { CreateAppealRequest, ReviewAppealRequest, ReviewStatus } from '../models/types';

const router = express.Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, customerServiceId } = req.query;
    const filters: { status?: ReviewStatus; customerServiceId?: string } = {};
    
    if (status) {
      filters.status = status as ReviewStatus;
    }
    if (customerServiceId) {
      filters.customerServiceId = customerServiceId as string;
    }

    const reviews = reviewService.listReviews(filters);
    res.json({
      success: true,
      data: reviews,
      total: reviews.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取列表失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const review = reviewService.getReview(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: '质检记录不存在'
      });
    }
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取详情失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.get('/:id/history', (req: Request, res: Response) => {
  try {
    const review = reviewService.getReview(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: '质检记录不存在'
      });
    }
    res.json({
      success: true,
      data: review.history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取历史记录失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const review = reviewService.createReview(req.body);
    res.status(201).json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '创建质检记录失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/:id/appeal', (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName, ...appealRequest } = req.body;
    
    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        message: '缺少操作人信息'
      });
    }

    const review = reviewService.submitAppeal(
      req.params.id,
      appealRequest as CreateAppealRequest,
      operatorId,
      operatorName
    );
    
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    if (error instanceof StateValidationError) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: '提交复议失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post('/:id/review', (req: Request, res: Response) => {
  try {
    const review = reviewService.reviewAppeal(
      req.params.id,
      req.body as ReviewAppealRequest
    );
    
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    if (error instanceof StateValidationError) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: '复核失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.get('/export/csv', (req: Request, res: Response) => {
  try {
    const { status, customerServiceId } = req.query;
    const filters: { status?: ReviewStatus; customerServiceId?: string } = {};
    
    if (status) {
      filters.status = status as ReviewStatus;
    }
    if (customerServiceId) {
      filters.customerServiceId = customerServiceId as string;
    }

    const reviews = reviewService.listReviews(filters);
    const csvData = reviewService.exportToCSV(reviews);
    
    res.json({
      success: true,
      data: csvData,
      total: csvData.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
