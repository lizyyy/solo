import express from 'express';
import config from '../config.js';
import { idempotencyService, RECORD_STATUS } from '../services/IdempotencyService.js';
import { mockBusinessService } from '../services/MockBusinessService.js';

const router = express.Router();

router.post('/business/:businessType', async (req, res) => {
  const { businessType } = req.params;
  const idempotencyKey = req.headers[config.idempotency.keyHeader.toLowerCase()];
  const request = { ...req.body, businessType };

  if (!idempotencyKey) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_IDEMPOTENCY_KEY',
      message: '缺少幂等键，请在 X-Idempotency-Key 头中提供',
    });
  }

  const { record, isNew, fingerprintMatch, expired, forbidden, reusedAfterExpiry } = 
    idempotencyService.getOrCreateRecord(idempotencyKey, request);

  if (forbidden) {
    return res.status(409).json({
      success: false,
      error: 'KEY_EXPIRED',
      message: '幂等键已过期且不允许复用',
      recordSummary: idempotencyService.getAuditSummary(idempotencyKey),
      suggestion: '请使用新的幂等键重新发起请求',
    });
  }

  if (!fingerprintMatch && !expired) {
    const diff = idempotencyService.compareRequests(record, 0, record.requests.length - 1);
    idempotencyService.markAsConflict(idempotencyKey, {
      type: 'PARAMETER_MISMATCH',
      message: '同一幂等键被用于不同参数的请求',
      conflictingRequest: {
        index: record.requests.length - 1,
        requestId: record.requests[record.requests.length - 1].requestId,
        timestamp: record.requests[record.requests.length - 1].timestamp,
      },
      differences: diff?.differences || [],
    });

    return res.status(409).json({
      success: false,
      error: 'REQUEST_CONFLICT',
      message: '请求冲突：同一幂等键被不同参数复用',
      conflictDetails: {
        firstRequest: {
          index: 0,
          requestId: record.firstRequest.requestId,
          timestamp: record.firstRequest.timestamp,
          keyFields: record.firstRequest.keyFields,
        },
        currentRequest: {
          index: record.requests.length - 1,
          requestId: record.requests[record.requests.length - 1].requestId,
          timestamp: record.requests[record.requests.length - 1].timestamp,
          keyFields: record.requests[record.requests.length - 1].keyFields,
        },
        totalDifferences: diff?.totalDifferences || 0,
        differences: diff?.differences || [],
        suggestion: getConflictSuggestion(diff?.differences || []),
      },
      finalResult: record.businessResult,
      callersAdvice: '首次请求的业务结果已经生效，后续冲突请求不会改变结果。如需使用不同参数，请更换幂等键。',
    });
  }

  if (!isNew) {
    if (record.status === RECORD_STATUS.PENDING) {
      return res.status(202).json({
        success: true,
        status: 'PROCESSING',
        message: '业务处理中，请稍后重试',
        idempotencyKey,
        firstRequestTime: record.firstRequest.timestamp,
        processingSince: record.processingSince,
        suggestion: '建议使用指数退避策略重试，或使用查询接口获取最新状态',
      });
    }

    return res.status(200).json({
      success: true,
      status: 'IDEMPOTENT_RESPONSE',
      message: reusedAfterExpiry ? '幂等键过期后复用成功' : '幂等请求复用原始结果',
      requestCount: record.requests.length,
      reusedAfterExpiry: reusedAfterExpiry || false,
      originalRequest: {
        index: 0,
        requestId: record.firstRequest.requestId,
        timestamp: record.firstRequest.timestamp,
      },
      currentRequest: {
        index: record.requests.length - 1,
        requestId: record.requests[record.requests.length - 1].requestId,
        timestamp: record.requests[record.requests.length - 1].timestamp,
      },
      businessResult: record.businessResult,
      suggestion: '相同参数的幂等请求已正确复用首次结果',
    });
  }

  try {
    const result = await mockBusinessService.execute(businessType, request);
    
    idempotencyService.updateRecordStatus(
      idempotencyKey,
      result.success ? RECORD_STATUS.SUCCESS : RECORD_STATUS.FAILED,
      result
    );

    const status = result.success ? 200 : 500;
    return res.status(status).json({
      success: result.success,
      status: result.success ? 'SUCCESS' : 'FAILED',
      message: result.message,
      requestCount: 1,
      firstRequest: {
        index: 0,
        requestId: record.firstRequest.requestId,
        timestamp: record.firstRequest.timestamp,
      },
      businessResult: result,
      suggestion: result.success ? '业务执行成功，后续相同参数的幂等请求将复用此结果' : '业务执行失败，请检查参数后使用新的幂等键重试',
    });
  } catch (error) {
    idempotencyService.updateRecordStatus(
      idempotencyKey,
      RECORD_STATUS.FAILED,
      {
        success: false,
        code: 'SYSTEM_ERROR',
        message: error.message,
        data: null,
      }
    );

    return res.status(500).json({
      success: false,
      error: 'SYSTEM_ERROR',
      message: '系统错误：' + error.message,
    });
  }
});

router.get('/:idempotencyKey', (req, res) => {
  const { idempotencyKey } = req.params;
  const record = idempotencyService.getRecord(idempotencyKey);
  const auditSummary = idempotencyService.getAuditSummary(idempotencyKey);

  if (!record && !auditSummary) {
    return res.status(404).json({
      success: false,
      error: 'KEY_NOT_FOUND',
      message: '幂等键不存在',
    });
  }

  if (auditSummary && !record) {
    return res.status(200).json({
      success: true,
      status: 'EXPIRED',
      message: '幂等键已过期，仅保留审计摘要',
      type: 'audit_summary',
      record: auditSummary,
      suggestion: auditSummary.conflictReason 
        ? '此幂等键曾发生冲突，请查看差异详情' 
        : '如需重新发起业务，请使用新的幂等键',
    });
  }

  const summary = generateCallersAdvice(record);
  
  res.json({
    success: true,
    status: record.status,
    type: 'full_record',
    idempotencyKey,
    createdAt: new Date(record.createdAt).toISOString(),
    expiresAt: new Date(record.expiresAt).toISOString(),
    isExpired: Date.now() > record.expiresAt,
    requestSummary: {
      totalRequests: record.requests.length,
      firstRequest: {
        index: 0,
        requestId: record.firstRequest.requestId,
        timestamp: record.firstRequest.timestamp,
        keyFields: record.firstRequest.keyFields,
        fingerprint: record.firstRequest.fingerprint,
      },
      subsequentRequests: record.requests.slice(1).map((r, i) => ({
        index: i + 1,
        requestId: r.requestId,
        timestamp: r.timestamp,
        keyFields: r.keyFields,
        differsFromFirst: r.fingerprint !== record.firstRequest.fingerprint,
      })),
    },
    conflictDetails: record.conflictReason,
    businessResult: record.businessResult,
    finalStatus: {
      status: record.status,
      effectiveRequest: 0,
      businessResult: record.businessResult,
    },
    callersAdvice: summary,
  });
});

router.get('/:idempotencyKey/diff/:index1/:index2', (req, res) => {
  const { idempotencyKey, index1, index2 } = req.params;
  const record = idempotencyService.getRecord(idempotencyKey);

  if (!record) {
    return res.status(404).json({
      success: false,
      error: 'KEY_NOT_FOUND',
      message: '幂等键不存在',
    });
  }

  const i1 = parseInt(index1);
  const i2 = parseInt(index2);

  if (isNaN(i1) || isNaN(i2)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_INDEX',
      message: '索引必须是整数',
    });
  }

  const diff = idempotencyService.compareRequests(record, i1, i2);

  if (!diff) {
    return res.status(400).json({
      success: false,
      error: 'INDEX_OUT_OF_RANGE',
      message: `索引超出范围，当前记录有 ${record.requests.length} 个请求`,
    });
  }

  res.json({
    success: true,
    comparison: {
      idempotencyKey,
      request1: {
        index: diff.index1,
        requestId: diff.request1Id,
        timestamp: record.requests[i1].timestamp,
        keyFields: record.requests[i1].keyFields,
      },
      request2: {
        index: diff.index2,
        requestId: diff.request2Id,
        timestamp: record.requests[i2].timestamp,
        keyFields: record.requests[i2].keyFields,
      },
      sameFingerprint: diff.sameFingerprint,
      totalDifferences: diff.totalDifferences,
      differences: diff.differences,
      callersAdvice: getDiffAdvice(diff),
    },
  });
});

router.post('/cleanup', (req, res) => {
  const result = idempotencyService.cleanupExpired();
  res.json({
    success: true,
    message: '过期清理完成',
    cleanedCount: result.count,
    cleanedKeys: result.keys,
    timestamp: result.timestamp,
    callersAdvice: '已清理的幂等键仍保留审计摘要，可通过查询接口查看',
  });
});

router.get('/:idempotencyKey/advice', (req, res) => {
  const { idempotencyKey } = req.params;
  const record = idempotencyService.getRecord(idempotencyKey);
  const auditSummary = idempotencyService.getAuditSummary(idempotencyKey);

  if (!record && !auditSummary) {
    return res.status(404).json({
      success: false,
      error: 'KEY_NOT_FOUND',
      message: '幂等键不存在',
    });
  }

  const advice = record ? generateCallersAdvice(record) : {
    keyStatus: 'expired',
    hasConflict: !!auditSummary?.conflictReason,
    suggestions: [
      auditSummary?.conflictReason 
        ? '此幂等键曾发生参数冲突，请使用查询接口查看详情' 
        : '幂等键已过期，如需重新执行业务请使用新的幂等键',
    ],
    nextSteps: ['使用新的幂等键重新发起请求', '如有疑问可联系技术支持'],
  };

  res.json({
    success: true,
    idempotencyKey,
    ...advice,
  });
});

function getConflictSuggestion(differences) {
  const suggestions = [];
  for (const diff of differences) {
    switch (diff.field) {
      case 'amount':
        suggestions.push(`金额不一致：首次请求金额 ${diff.request1.value}，当前请求金额 ${diff.request2.value}`);
        break;
      case 'userId':
        suggestions.push(`用户不一致：首次请求用户 ${diff.request1.value}，当前请求用户 ${diff.request2.value}`);
        break;
      case 'orderId':
      case 'refundId':
      case 'couponBatchId':
        suggestions.push(`业务单号不一致：首次请求单号 ${diff.request1.value}，当前请求单号 ${diff.request2.value}`);
        break;
      case 'currency':
        suggestions.push(`币种不一致：首次请求币种 ${diff.request1.value}，当前请求币种 ${diff.request2.value}`);
        break;
      default:
        suggestions.push(`字段 ${diff.field} 不一致：${JSON.stringify(diff.request1.value)} vs ${JSON.stringify(diff.request2.value)}`);
    }
  }
  return suggestions;
}

function getDiffAdvice(diff) {
  if (diff.totalDifferences === 0) {
    return '两次请求参数完全一致，属于正常的幂等重试';
  }

  const advice = [`发现 ${diff.totalDifferences} 个字段差异：`];
  for (const d of diff.differences) {
    advice.push(`- ${d.field}: ${JSON.stringify(d.request1.value)} → ${JSON.stringify(d.request2.value)}`);
  }
  advice.push('建议：');
  advice.push('1. 确认业务需求是否应该使用不同的幂等键');
  advice.push('2. 检查调用方代码是否在参数变化时更新了幂等键');
  advice.push('3. 如需排查历史问题，可查看首次请求的业务结果是否正确生效');

  return advice.join('\n');
}

function generateCallersAdvice(record) {
  const advice = {
    keyStatus: record.status,
    hasConflict: !!record.conflictReason,
    requestCount: record.requests.length,
    firstRequestEffective: true,
    businessResult: record.businessResult,
    suggestions: [],
    nextSteps: [],
  };

  switch (record.status) {
    case RECORD_STATUS.PENDING:
      advice.suggestions = ['业务正在处理中，建议稍后重试'];
      advice.nextSteps = ['使用指数退避策略重试', '可使用查询接口轮询状态'];
      break;

    case RECORD_STATUS.SUCCESS:
      advice.suggestions = ['首次请求已成功执行业务，后续相同参数请求会复用此结果'];
      if (record.requests.length > 1) {
        advice.suggestions.push(`此幂等键已被复用 ${record.requests.length - 1} 次`);
      }
      advice.nextSteps = ['无需额外操作，业务结果已生效'];
      break;

    case RECORD_STATUS.FAILED:
      advice.suggestions = ['首次请求业务执行失败'];
      advice.nextSteps = ['检查业务失败原因', '如需重试请使用新的幂等键'];
      break;

    case RECORD_STATUS.CONFLICT:
      advice.suggestions = [
        '检测到参数冲突：同一幂等键被不同参数复用',
        `共有 ${record.requests.length} 个请求，其中 ${record.requests.length - 1} 个与首次请求参数不同`,
        '首次请求的业务结果已生效，后续冲突请求不会改变结果',
      ];
      advice.nextSteps = [
        '使用 /diff 接口比较具体差异',
        '检查调用方是否正确生成和使用幂等键',
        '如需使用不同参数，必须使用新的幂等键',
      ];
      break;
  }

  return advice;
}

export default router;
