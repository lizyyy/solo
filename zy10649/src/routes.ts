import { Router, Request, Response } from 'express';
import { store } from './store';
import {
  publishSegment,
  requestRevokePublish,
  completeRevokePublish,
  handleChannelException,
  StateValidationError,
  IdempotentOperationError
} from './stateMachine';
import { generateExportData, getSegmentWithRecords, importSegments } from './exporter';
import { ChannelType, RevokeReason } from './types';

const router = Router();

function handleError(res: Response, error: unknown) {
  if (error instanceof StateValidationError) {
    return res.status(400).json({
      code: 400,
      message: error.message
    });
  }
  if (error instanceof IdempotentOperationError) {
    return res.status(409).json({
      code: 409,
      message: error.message
    });
  }
  return res.status(500).json({
    code: 500,
    message: error instanceof Error ? error.message : '未知错误'
  });
}

router.post('/segments', (req: Request, res: Response) => {
  try {
    const { name, description, ruleVersion, audienceCount, operator = 'system' } = req.body;
    
    const segment = store.createSegment(
      name,
      description,
      ruleVersion,
      audienceCount,
      operator
    );

    res.json({
      code: 200,
      message: '创建成功',
      data: segment
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/segments', (req: Request, res: Response) => {
  try {
    const segments = store.listSegments();
    res.json({
      code: 200,
      message: '查询成功',
      data: segments
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/segments/:id', (req: Request, res: Response) => {
  try {
    const detail = getSegmentWithRecords(req.params.id);
    if (!detail) {
      return res.status(404).json({
        code: 404,
        message: '人群包不存在'
      });
    }
    res.json({
      code: 200,
      message: '查询成功',
      data: detail
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/segments/:id/publish', (req: Request, res: Response) => {
  try {
    const { operator = 'system' } = req.body;
    let { channels } = req.body;
    
    if (!channels || !Array.isArray(channels)) {
      channels = [
        { channel: ChannelType.SMS, channelAccount: '默认短信通道' },
        { channel: ChannelType.PUSH, channelAccount: '默认推送通道' }
      ];
    }

    const result = publishSegment(req.params.id, channels, operator);

    res.json({
      code: 200,
      message: '发布成功',
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/segments/:id/revoke', (req: Request, res: Response) => {
  try {
    const { 
      reason = RevokeReason.OTHER,
      remark = '',
      operator = 'system',
      recordIds
    } = req.body;

    const result = requestRevokePublish(
      req.params.id,
      reason,
      remark,
      operator,
      recordIds
    );

    res.json({
      code: 200,
      message: '撤销申请已提交',
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/segments/:id/revoke/complete', (req: Request, res: Response) => {
  try {
    const { 
      operator = 'system',
      handlerInfo,
      exceptions
    } = req.body;

    const result = completeRevokePublish(
      req.params.id,
      operator,
      handlerInfo,
      exceptions
    );

    res.json({
      code: 200,
      message: '撤销完成',
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/segments/:id/history', (req: Request, res: Response) => {
  try {
    const histories = store.listHistories(req.params.id);
    res.json({
      code: 200,
      message: '查询成功',
      data: histories
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/publish-records/:id/exception', (req: Request, res: Response) => {
  try {
    const { errorMessage, discoveredBy = 'system', handlerInfo } = req.body;
    
    const record = handleChannelException(
      req.params.id,
      errorMessage,
      discoveredBy,
      handlerInfo
    );

    res.json({
      code: 200,
      message: '异常已记录',
      data: record
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/export', (req: Request, res: Response) => {
  try {
    const { segmentId } = req.query;
    const data = generateExportData(
      typeof segmentId === 'string' ? segmentId : undefined
    );
    res.json({
      code: 200,
      message: '导出成功',
      data: {
        total: data.length,
        rows: data
      }
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/import', (req: Request, res: Response) => {
  try {
    const { data, operator = 'system' } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        code: 400,
        message: '导入数据格式错误'
      });
    }

    const result = importSegments(data, operator);

    res.json({
      code: 200,
      message: `导入完成: 成功 ${result.success.length} 条, 失败 ${result.failed.length} 条`,
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/publish-records', (req: Request, res: Response) => {
  try {
    const { segmentId } = req.query;
    const records = store.listPublishRecords(
      typeof segmentId === 'string' ? segmentId : undefined
    );
    res.json({
      code: 200,
      message: '查询成功',
      data: records
    });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
