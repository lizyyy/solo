import type {
  EvidencePackDetail,
  JudgmentResult,
  JudgmentReason,
  AllEvidence,
} from '../types';

interface JudgmentRule {
  code: string;
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  check: (pack: EvidencePackDetail) => { triggered: boolean; evidenceIds: string[]; message: string };
}

const RULES: JudgmentRule[] = [
  {
    code: 'R001',
    name: '重复交易检测',
    description: '检测是否存在重复的交易记录',
    severity: 'warning',
    check: (pack) => {
      const duplicates = pack.transactions.filter(t => t.isDuplicate);
      return {
        triggered: duplicates.length > 0,
        evidenceIds: duplicates.map(t => t.id),
        message: `检测到 ${duplicates.length} 条重复交易记录，请核实是否为系统重复导入`
      };
    }
  },
  {
    code: 'R002',
    name: '晚到附件识别',
    description: '识别超出正常时间窗口提交的审批附件',
    severity: 'warning',
    check: (pack) => {
      const lateScreenshots = pack.screenshots.filter(s => s.isLate);
      return {
        triggered: lateScreenshots.length > 0,
        evidenceIds: lateScreenshots.map(s => s.id),
        message: `检测到 ${lateScreenshots.length} 个晚到附件，请核实是否为正常业务场景`
      };
    }
  },
  {
    code: 'R003',
    name: '重复邮件检测',
    description: '检测是否存在内容重复的补充邮件',
    severity: 'warning',
    check: (pack) => {
      const duplicateEmails = pack.emails.filter(e => e.isDuplicate);
      return {
        triggered: duplicateEmails.length > 0,
        evidenceIds: duplicateEmails.map(e => e.id),
        message: `检测到 ${duplicateEmails.length} 封重复邮件，请核实是否为误发`
      };
    }
  },
  {
    code: 'R004',
    name: '人工更正痕迹检测',
    description: '检测是否存在人工更正记录',
    severity: 'info',
    check: (pack) => {
      return {
        triggered: pack.corrections.length > 0,
        evidenceIds: pack.corrections.map(c => c.id),
        message: `存在 ${pack.corrections.length} 条人工更正记录，请确认调整是否合规`
      };
    }
  },
  {
    code: 'R005',
    name: '证据完整性检查',
    description: '检查每笔交易是否有对应审批截图',
    severity: 'error',
    check: (pack) => {
      const uniqueTransactions = pack.transactions.filter(t => !t.isDuplicate);
      const approvedTransactions = pack.screenshots.filter(s => !s.isLate).length;
      const missing = uniqueTransactions.length - approvedTransactions;
      
      if (missing > 0) {
        return {
          triggered: true,
          evidenceIds: [],
          message: `缺少 ${missing} 笔交易的审批截图，请补充材料`
        };
      }
      return {
        triggered: false,
        evidenceIds: [],
        message: '交易流水与审批截图数量匹配'
      };
    }
  },
  {
    code: 'R006',
    name: '时间线合理性校验',
    description: '校验审批时间是否早于交易时间',
    severity: 'error',
    check: (pack) => {
      const issues: string[] = [];
      
      pack.transactions.filter(t => !t.isDuplicate).forEach(tx => {
        const relatedScreenshot = pack.screenshots.find(s => {
          return s.timestamp.getTime() <= tx.timestamp.getTime();
        });
        if (!relatedScreenshot) {
          issues.push(tx.id);
        }
      });

      if (issues.length > 0) {
        return {
          triggered: false,
          evidenceIds: [],
          message: '部分审批截图时间晚于交易时间，请注意核对'
        };
      }
      
      return {
        triggered: false,
        evidenceIds: [],
        message: '审批时间线整体逻辑合理'
      };
    }
  }
];

export function runJudgment(pack: EvidencePackDetail): JudgmentResult {
  const reasons: JudgmentReason[] = [];
  
  RULES.forEach(rule => {
    const result = rule.check(pack);
    if (result.triggered || rule.severity === 'info') {
      reasons.push({
        ruleCode: rule.code,
        ruleName: rule.name,
        description: result.message,
        severity: result.triggered ? rule.severity : 'info',
        evidenceIds: result.evidenceIds
      });
    }
  });

  const hasErrors = reasons.some(r => r.severity === 'error');
  const hasWarnings = reasons.some(r => r.severity === 'warning');
  const hasInfo = reasons.some(r => r.severity === 'info');

  let conclusion: JudgmentResult['conclusion'];
  let nextStep: string;
  let nextStepDetails: string[];
  let confidence: number;

  if (hasErrors) {
    conclusion = 'need_supplement';
    nextStep = '需补充关键材料';
    nextStepDetails = reasons
      .filter(r => r.severity === 'error')
      .map(r => r.description);
    confidence = 0.5;
  } else if (hasWarnings || hasInfo) {
    conclusion = 'need_review';
    nextStep = '需人工复核确认';
    nextStepDetails = reasons
      .filter(r => r.severity === 'warning' || r.severity === 'info')
      .map(r => r.description);
    confidence = 0.75;
  } else {
    conclusion = 'normal';
    nextStep = '证据链完整，可直接通过';
    nextStepDetails = ['所有检查项已通过', '建议标记为已完成'];
    confidence = 0.95;
  }

  return {
    id: `judge-${Date.now()}`,
    packId: pack.id,
    conclusion,
    reasons,
    nextStep,
    nextStepDetails,
    judgedAt: new Date(),
    confidence
  };
}

export function getConclusionText(conclusion: string): string {
  const map: Record<string, string> = {
    normal: '正常',
    need_supplement: '需补充材料',
    need_review: '需人工复核',
    pending: '待判断',
    abnormal: '异常'
  };
  return map[conclusion] || conclusion;
}

export function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '待处理',
    parsing: '解析中',
    parsed: '已解析',
    judging: '判断中',
    judged: '已判断',
    reviewing: '复核中',
    completed: '已完成',
    archived: '已归档'
  };
  return map[status] || status;
}

export function getSeverityColor(severity: string): string {
  const map: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800',
    warning: 'bg-warning-50 text-warning-600',
    error: 'bg-danger-50 text-danger-500'
  };
  return map[severity] || 'bg-gray-100 text-gray-800';
}

export function sortEvidenceByTime(pack: EvidencePackDetail): AllEvidence[] {
  const all: AllEvidence[] = [
    ...pack.transactions,
    ...pack.screenshots,
    ...pack.emails,
    ...pack.corrections
  ];
  
  return all.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
