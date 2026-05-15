import express from 'express';
import ValidationService from '../services/validationService';
import QueryService from '../services/queryService';
import BatchService from '../services/batchService';
import SummaryService from '../services/summaryService';

const router = express.Router();

router.post('/validate', async (req, res) => {
  try {
    const { businessNo, operator, simulateConcurrency } = req.body;
    
    if (!businessNo || !operator) {
      return res.status(400).json({
        success: false,
        message: '业务单号和操作人不能为空'
      });
    }

    const result = await ValidationService.validateSample(
      businessNo, 
      operator, 
      simulateConcurrency || false
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '校验失败',
      error: (error as Error).message
    });
  }
});

router.get('/query/:businessNo', async (req, res) => {
  try {
    const { businessNo } = req.params;
    const result = await QueryService.queryByBusinessNo(businessNo);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: (error as Error).message
    });
  }
});

router.get('/query', async (req, res) => {
  try {
    const { status, startDate, endDate, page, pageSize } = req.query;
    const result = await QueryService.queryAll({
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: (error as Error).message
    });
  }
});

router.get('/failures', async (req, res) => {
  try {
    const { failureType, page, pageSize } = req.query;
    const result = await QueryService.getFailureRecords({
      failureType: failureType as string,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询失败记录失败',
      error: (error as Error).message
    });
  }
});

router.get('/anomalies', async (req, res) => {
  try {
    const { anomalyType, page, pageSize } = req.query;
    const result = await QueryService.getAnomalySamples({
      anomalyType: anomalyType as string,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询异常样本失败',
      error: (error as Error).message
    });
  }
});

router.post('/batch/preview', async (req, res) => {
  try {
    const { businessNos, operator } = req.body;
    
    if (!businessNos || !Array.isArray(businessNos) || businessNos.length === 0) {
      return res.status(400).json({
        success: false,
        message: '业务单号列表不能为空'
      });
    }

    if (!operator) {
      return res.status(400).json({
        success: false,
        message: '操作人不能为空'
      });
    }

    const result = await BatchService.previewBatchValidation(businessNos, operator);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '批量预览失败',
      error: (error as Error).message
    });
  }
});

router.post('/batch/execute/:operationId', async (req, res) => {
  try {
    const { operationId } = req.params;
    const { operator } = req.body;

    if (!operator) {
      return res.status(400).json({
        success: false,
        message: '操作人不能为空'
      });
    }

    const result = await BatchService.executeBatchValidation(operationId, operator);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '批量执行失败',
      error: (error as Error).message
    });
  }
});

router.get('/batch', async (req, res) => {
  try {
    const { page, pageSize } = req.query;
    const result = await BatchService.listBatchOperations({
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询批量操作失败',
      error: (error as Error).message
    });
  }
});

router.get('/batch/:operationId', async (req, res) => {
  try {
    const { operationId } = req.params;
    const result = await BatchService.getBatchOperation(operationId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: '批量操作不存在'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询批量操作失败',
      error: (error as Error).message
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { businessNos } = req.query;
    const businessNoArray = businessNos 
      ? (businessNos as string).split(',').filter(Boolean) 
      : undefined;

    const result = await SummaryService.generateSummary(businessNoArray);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '生成摘要失败',
      error: (error as Error).message
    });
  }
});

router.get('/summary/report', async (req, res) => {
  try {
    const { businessNos } = req.query;
    const businessNoArray = businessNos 
      ? (businessNos as string).split(',').filter(Boolean) 
      : undefined;

    const report = await SummaryService.generateSummaryReport(businessNoArray);

    res.set('Content-Type', 'text/markdown');
    res.send(report);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '生成摘要报告失败',
      error: (error as Error).message
    });
  }
});

router.get('/statistics/errors', async (req, res) => {
  try {
    const result = await SummaryService.getErrorStatistics();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取错误统计失败',
      error: (error as Error).message
    });
  }
});

router.get('/window/check', (req, res) => {
  try {
    const now = new Date();
    const result = ValidationService.isInFreezeWindow(now);

    res.json({
      success: true,
      data: {
        currentTime: now.toISOString(),
        ...result
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '检查冻结窗口失败',
      error: (error as Error).message
    });
  }
});

export default router;
