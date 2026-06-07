import { Router, Request, Response } from 'express';
import { importService, reviewService, modelService } from '../services';
import { AppError } from '../utils/errors';
import { ReviewStatus } from '../types';

const router = Router();

function handleError(res: Response, error: unknown) {
  if (error instanceof AppError) {
    res.status(400).json({
      code: error.code,
      message: error.userMessage,
    });
  } else {
    console.error(error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: '系统内部错误，请稍后重试',
    });
  }
}

router.post('/prompt-versions/import', (req: Request, res: Response) => {
  try {
    const { version, importedBy, description, samples } = req.body;
    if (!version || !importedBy || !Array.isArray(samples)) {
      res.status(400).json({
        code: 'MISSING_REQUIRED_FIELD',
        message: '缺少必填字段：version、importedBy、samples',
      });
      return;
    }
    const result = importService.importPromptVersion({
      version,
      importedBy,
      description,
      samples,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/prompt-versions', (_req: Request, res: Response) => {
  try {
    const versions = reviewService.listPromptVersions();
    res.json(versions);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/prompt-versions/:id/trace', (req: Request, res: Response) => {
  try {
    const trace = reviewService.getTraceByPromptVersion(req.params.id);
    res.json(trace);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/prompt-versions/:id/chart-data', (req: Request, res: Response) => {
  try {
    const data = reviewService.getChartDataWithLinks(req.params.id);
    res.json(data);
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/knowledge-links', (req: Request, res: Response) => {
  try {
    const { promptVersionId, url, title, addedBy } = req.body;
    if (!promptVersionId || !url || !title || !addedBy) {
      res.status(400).json({
        code: 'MISSING_REQUIRED_FIELD',
        message: '缺少必填字段：promptVersionId、url、title、addedBy',
      });
      return;
    }
    const link = reviewService.addKnowledgeLink({
      promptVersionId,
      url,
      title,
      addedBy,
    });
    res.json(link);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/samples/:id', (req: Request, res: Response) => {
  try {
    const sample = reviewService.getSampleWithTrace(req.params.id);
    res.json(sample);
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/samples/:id/remark', (req: Request, res: Response) => {
  try {
    const { newRemark, operator, role } = req.body;
    if (!newRemark || !operator || !role) {
      res.status(400).json({
        code: 'MISSING_REQUIRED_FIELD',
        message: '缺少必填字段：newRemark、operator、role',
      });
      return;
    }
    const result = reviewService.updateRemark({
      sampleId: req.params.id,
      newRemark,
      operator,
      role,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.patch('/samples/:id/status', (req: Request, res: Response) => {
  try {
    const { newStatus, operator, role, remark } = req.body;
    if (!newStatus || !operator || !role) {
      res.status(400).json({
        code: 'MISSING_REQUIRED_FIELD',
        message: '缺少必填字段：newStatus、operator、role',
      });
      return;
    }
    const result = reviewService.updateStatus({
      sampleId: req.params.id,
      newStatus: newStatus as ReviewStatus,
      operator,
      role,
      remark,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/samples', (req: Request, res: Response) => {
  try {
    const status = req.query.status as ReviewStatus | undefined;
    if (status) {
      const samples = reviewService.getSamplesByStatus(status);
      res.json(samples);
    } else {
      res.status(400).json({
        code: 'MISSING_REQUIRED_FIELD',
        message: '请指定 status 参数',
      });
    }
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/model-versions/compare', (req: Request, res: Response) => {
  try {
    const { version, promptVersionId, comparedBy, changeSummary } = req.body;
    if (!version || !promptVersionId || !comparedBy) {
      res.status(400).json({
        code: 'MISSING_REQUIRED_FIELD',
        message: '缺少必填字段：version、promptVersionId、comparedBy',
      });
      return;
    }
    const result = modelService.compareModelVersion({
      version,
      promptVersionId,
      comparedBy,
      changeSummary,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/model-versions', (req: Request, res: Response) => {
  try {
    const promptVersionId = req.query.promptVersionId as string;
    if (!promptVersionId) {
      res.status(400).json({
        code: 'MISSING_REQUIRED_FIELD',
        message: '请指定 promptVersionId 参数',
      });
      return;
    }
    const versions = modelService.getModelVersions(promptVersionId);
    res.json(versions);
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;
