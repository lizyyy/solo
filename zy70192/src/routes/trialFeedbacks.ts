import { Router, Request, Response } from 'express';
import { successResponse, errorResponse, AppError } from '../utils/response';
import * as trialFeedbackService from '../services/trialFeedbackService';

const router = Router();
const DEFAULT_OPERATOR = 'system';

const getOperator = (req: Request): string => {
  return req.header('x-operator') || DEFAULT_OPERATOR;
};

router.post('/', (req: Request, res: Response) => {
  try {
    const { 
      sampleId, 
      trialUser, 
      trialDate, 
      trialPeriod, 
      trialLocation, 
      testItems, 
      overallRating, 
      conclusion, 
      suggestions, 
      attachments 
    } = req.body;
    
    if (!sampleId || !trialUser || !trialDate || !trialPeriod || !trialLocation || !testItems || !overallRating || !conclusion) {
      return res.status(400).json(errorResponse('缺少必要参数'));
    }

    const feedback = trialFeedbackService.createTrialFeedback(
      { 
        sampleId, 
        trialUser, 
        trialDate, 
        trialPeriod, 
        trialLocation, 
        testItems, 
        overallRating, 
        conclusion, 
        suggestions, 
        attachments 
      },
      getOperator(req)
    );

    res.status(201).json(successResponse(feedback, '试用反馈提交成功'));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Create trial feedback error:', error);
    res.status(500).json(errorResponse('提交试用反馈失败'));
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const { sampleId, trialUser, minRating, maxRating, page, pageSize } = req.query;
    
    const result = trialFeedbackService.listTrialFeedbacks(
      {
        sampleId: sampleId as string,
        trialUser: trialUser as string,
        minRating: minRating ? parseInt(minRating as string) : undefined,
        maxRating: maxRating ? parseInt(maxRating as string) : undefined
      },
      parseInt(page as string) || 1,
      parseInt(pageSize as string) || 20
    );

    res.json(successResponse(result));
  } catch (error) {
    console.error('List trial feedbacks error:', error);
    res.status(500).json(errorResponse('获取试用反馈列表失败'));
  }
});

router.get('/summary', (req: Request, res: Response) => {
  try {
    const { sampleId } = req.query;
    const summary = trialFeedbackService.getTrialFeedbackSummary(sampleId as string);
    res.json(successResponse(summary));
  } catch (error) {
    console.error('Get trial feedback summary error:', error);
    res.status(500).json(errorResponse('获取汇总信息失败'));
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const feedback = trialFeedbackService.getTrialFeedbackById(req.params.id);
    res.json(successResponse(feedback));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get trial feedback error:', error);
    res.status(500).json(errorResponse('获取试用反馈失败'));
  }
});

router.get('/sample/:sampleId', (req: Request, res: Response) => {
  try {
    const feedbacks = trialFeedbackService.getTrialFeedbacksBySample(req.params.sampleId);
    res.json(successResponse(feedbacks));
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json(errorResponse(error.message, error.errorCode));
    }
    console.error('Get trial feedbacks by sample error:', error);
    res.status(500).json(errorResponse('获取样品试用反馈失败'));
  }
});

export default router;
