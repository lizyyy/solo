import { Router, Request, Response, NextFunction } from 'express';
import { routingEngine } from '../services/routingEngine';
import { configService } from '../services/configService';
import { routingExplainer } from '../services/routingExplainer';
import { compensationService } from '../services/compensationService';
import { auditService } from '../utils/audit';
import { CustomApiError } from '../middleware/errorHandler';
import { OrderContext } from '../types';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'order-sharding-router',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

router.post('/route/write', (req: Request, res: Response, next: NextFunction) => {
  try {
    const context: OrderContext = req.body;

    if (!context.tenantId) {
      throw new CustomApiError('缺少必须参数：tenantId', 400, 'MISSING_PARAMETER');
    }

    const duplicateCheck = compensationService.handleDuplicateWrite(
      context.tenantId,
      context.orderId || 'unknown'
    );

    const result = routingEngine.routeWrite(context);
    const explanation = routingExplainer.explainWriteRouting(result);

    res.json({
      success: result.success,
      routingResult: result,
      explanation,
      duplicateCheck,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/route/query', (req: Request, res: Response, next: NextFunction) => {
  try {
    const context: OrderContext = req.body;
    const { fromDate, toDate } = req.body.queryPlan || {};

    if (!context.tenantId) {
      throw new CustomApiError('缺少必须参数：tenantId', 400, 'MISSING_PARAMETER');
    }

    const result = routingEngine.routeQuery(
      context,
      fromDate && toDate ? { fromDate, toDate } : undefined
    );
    const explanation = routingExplainer.explainQueryRouting(result);

    res.json({
      success: result.success,
      routingResult: result,
      explanation,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/route/explain', (req: Request, res: Response, next: NextFunction) => {
  try {
    const context: OrderContext = req.body;
    const operation = req.body.operation || 'write';

    if (!context.tenantId) {
      throw new CustomApiError('缺少必须参数：tenantId', 400, 'MISSING_PARAMETER');
    }

    let result;
    let explanation;

    if (operation === 'write') {
      result = routingEngine.routeWrite(context);
      explanation = routingExplainer.explainWriteRouting(result);
    } else {
      const { fromDate, toDate } = req.body.queryPlan || {};
      result = routingEngine.routeQuery(
        context,
        fromDate && toDate ? { fromDate, toDate } : undefined
      );
      explanation = routingExplainer.explainQueryRouting(result);
    }

    res.json({
      success: result.success,
      explanation,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/query/plan', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, fromDate, toDate } = req.body;

    if (!tenantId || !fromDate || !toDate) {
      throw new CustomApiError('缺少必须参数：tenantId, fromDate, toDate', 400, 'MISSING_PARAMETER');
    }

    const tenantConfig = configService.getTenantConfig(tenantId);
    if (!tenantConfig) {
      throw new CustomApiError(`租户配置不存在：${tenantId}`, 404, 'TENANT_NOT_FOUND');
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) {
      throw new CustomApiError('fromDate 必须早于 toDate', 400, 'INVALID_DATE_RANGE');
    }

    const monthDiff = (to.getFullYear() - from.getFullYear()) * 12 + 
      (to.getMonth() - from.getMonth());
    const maxRange = configService.getMaxCrossMonthRange();

    if (monthDiff > maxRange * 12) {
      throw new CustomApiError(
        `查询时间范围超过限制（${maxRange * 12} 个月）`,
        400,
        'TIME_RANGE_TOO_LARGE'
      );
    }

    const plan = routingEngine.buildCrossMonthQueryPlan(tenantId, fromDate, toDate);
    const explainedPlan = routingExplainer.explainQueryPlan(plan);

    res.json({
      success: true,
      queryPlan: plan,
      explanation: explainedPlan,
      warnings: plan.warnings || [],
    });
  } catch (error) {
    next(error);
  }
});

router.post('/compensation/create', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, tenantId, failedShardId, originalWriteTimestamp, operation, data } = req.body;

    if (!orderId || !tenantId || !failedShardId || !originalWriteTimestamp || !operation || !data) {
      throw new CustomApiError(
        '缺少必须参数：orderId, tenantId, failedShardId, originalWriteTimestamp, operation, data',
        400,
        'MISSING_PARAMETER'
      );
    }

    const request = compensationService.createCompensationRequest(
      orderId,
      tenantId,
      failedShardId,
      originalWriteTimestamp,
      operation,
      data
    );

    res.json({
      success: true,
      compensationRequest: request,
      message: '补偿请求已加入队列',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/compensation/process', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, tenantId, failedShardId } = req.body;

    if (!tenantId || !orderId || !failedShardId) {
      throw new CustomApiError(
        '缺少必须参数：tenantId, orderId, failedShardId',
        400,
        'MISSING_PARAMETER'
      );
    }

    const pending = compensationService.getPendingCompensations(tenantId);
    const request = pending.find(
      r => r.orderId === orderId && r.failedShardId === failedShardId
    );

    if (!request) {
      throw new CustomApiError(
        `未找到对应的补偿请求：orderId=${orderId}, shardId=${failedShardId}`,
        404,
        'COMPENSATION_NOT_FOUND'
      );
    }

    const result = compensationService.processCompensation(request);

    res.json({
      success: result.success,
      result,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/compensation/pending/:tenantId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.params;
    const pending = compensationService.getPendingCompensations(tenantId);

    res.json({
      success: true,
      tenantId,
      pendingCompensations: pending,
      count: pending.length,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/dualread/resolve', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, oldData, newData } = req.body;

    if (!tenantId || !oldData || !newData) {
      throw new CustomApiError(
        '缺少必须参数：tenantId, oldData, newData',
        400,
        'MISSING_PARAMETER'
      );
    }

    const result = routingEngine.resolveDualReadConflict(oldData, newData);
    const resolution = compensationService.resolveMigrationConflict(tenantId, oldData, newData);

    res.json({
      success: true,
      conflictCheck: result,
      resolution,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/config/tenant/:tenantId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = req.params;
    const tenantConfig = configService.getTenantConfig(tenantId);

    if (!tenantConfig) {
      throw new CustomApiError(`租户配置不存在：${tenantId}`, 404, 'TENANT_NOT_FOUND');
    }

    const { oldShard, newShard } = configService.getOldAndNewShards(tenantId);

    res.json({
      success: true,
      tenantConfig,
      shardInfo: {
        oldShard,
        newShard,
      },
      migrationStatus: {
        isMigrationInProgress: configService.isMigrationInProgress(tenantId),
        requiresDualWrite: configService.requiresDualWrite(tenantId),
        requiresDualRead: configService.requiresDualRead(tenantId),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/config/shards', (req: Request, res: Response, next: NextFunction) => {
  try {
    const shards = configService.getAllShardConfigs();

    res.json({
      success: true,
      shards,
      count: shards.length,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/audit/recent', (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const records = auditService.getRecentRecords(limit);

    res.json({
      success: true,
      records,
      count: records.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
