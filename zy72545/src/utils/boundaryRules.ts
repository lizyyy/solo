import { ConfidenceLevel, ReviewStatus, ProcessParamSample } from '../types';

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0,
};

export function determineConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

export function isMaskedByAverage(sample: {
  confidenceScore: number;
  metrics: { avgIndex?: number; rawValue?: number };
}): boolean {
  if (sample.metrics.avgIndex === undefined || sample.metrics.rawValue === undefined) {
    return false;
  }
  const deviation = Math.abs(sample.metrics.rawValue - sample.metrics.avgIndex);
  const deviationRatio = sample.metrics.avgIndex > 0 
    ? deviation / sample.metrics.avgIndex 
    : 0;
  return sample.confidenceScore < CONFIDENCE_THRESHOLDS.MEDIUM && deviationRatio < 0.1;
}

export function determineInitialStatus(sample: {
  confidenceScore: number;
  isMaskedByAvg: boolean;
}): ReviewStatus {
  if (sample.isMaskedByAvg && sample.confidenceScore < CONFIDENCE_THRESHOLDS.MEDIUM) {
    return 'needs_knowledge_review';
  }
  if (sample.confidenceScore < CONFIDENCE_THRESHOLDS.LOW) {
    return 'needs_knowledge_review';
  }
  return 'pending_review';
}

export function canTransitionStatus(current: ReviewStatus, next: ReviewStatus, role: string): boolean {
  const transitions: Record<ReviewStatus, Record<ReviewStatus, string[]>> = {
    pending_review: {
      pending_review: ['*'],
      needs_knowledge_review: ['algorithm_ops', 'knowledge_editor'],
      confirmed: ['algorithm_ops', 'knowledge_editor'],
      rolled_back: [],
    },
    needs_knowledge_review: {
      pending_review: ['knowledge_editor'],
      needs_knowledge_review: ['*'],
      confirmed: ['knowledge_editor'],
      rolled_back: ['knowledge_editor'],
    },
    confirmed: {
      pending_review: ['knowledge_editor'],
      needs_knowledge_review: ['knowledge_editor'],
      confirmed: ['*'],
      rolled_back: ['knowledge_editor'],
    },
    rolled_back: {
      pending_review: ['knowledge_editor'],
      needs_knowledge_review: ['knowledge_editor'],
      confirmed: [],
      rolled_back: ['*'],
    },
  };
  const allowedRoles = transitions[current]?.[next];
  if (!allowedRoles) return false;
  return allowedRoles.includes('*') || allowedRoles.includes(role);
}

export interface BoundaryRuleCheckResult {
  passed: boolean;
  warnings: string[];
  requiredAction?: 'knowledge_review' | 'manual_confirm' | 'none';
}

export function checkBoundaryRules(sample: ProcessParamSample): BoundaryRuleCheckResult {
  const warnings: string[] = [];
  let requiredAction: BoundaryRuleCheckResult['requiredAction'] = 'none';

  if (sample.isMaskedByAvg && sample.confidence === 'low') {
    warnings.push('低置信度样本被平均指标覆盖，需知识库编辑复核');
    requiredAction = 'knowledge_review';
  }

  if (sample.confidenceScore < CONFIDENCE_THRESHOLDS.MEDIUM && !sample.isMaskedByAvg) {
    warnings.push('置信度低于中等阈值，建议人工确认');
    requiredAction = requiredAction === 'none' ? 'manual_confirm' : requiredAction;
  }

  if (sample.metrics.rawValue === undefined && sample.metrics.avgIndex !== undefined) {
    warnings.push('缺少原始值，仅有平均指标，需注意数据完整性');
  }

  return {
    passed: warnings.length === 0,
    warnings,
    requiredAction,
  };
}

export const BOUNDARY_RULES_DOC = `
## 工艺参数推荐回看 - 边界规则

### 1. 低置信度样本判定规则
- 高置信度：置信分 >= 0.8
- 中置信度：0.5 <= 置信分 < 0.8
- 低置信度：置信分 < 0.5

### 2. 平均指标覆盖判定
当样本同时满足以下条件时，判定为"被平均指标盖住"：
- 置信分 < 0.5（低置信度）
- 原始值与平均值偏差率 < 10%

### 3. 状态流转规则
| 当前状态 | 可流转到 | 允许角色 |
|---------|---------|---------|
| 待复核(pending_review) | 需知识库复核、已确认 | 算法运营、知识库编辑 |
| 需知识库复核(needs_knowledge_review) | 待复核、已确认、已回滚 | 知识库编辑 |
| 已确认(confirmed) | 待复核、需知识库复核、已回滚 | 知识库编辑 |
| 已回滚(rolled_back) | 待复核、需知识库复核 | 知识库编辑 |

### 4. 低置信度样本处理流程
1. 系统自动标记为"需知识库复核"状态
2. 算法运营不能直接确认，必须转交知识库编辑
3. 知识库编辑可选择：
   - 确认（数据正确）
   - 回滚（数据有误，需重新生成）
   - 退回待复核（需补充信息）

### 5. 回滚机制
- 仅知识库编辑可执行回滚
- 回滚后保留完整历史记录
- 回滚样本可重新进入复核流程
`;
