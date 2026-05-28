import { StateTransitionDAO } from '../dao/index.js';
import { auditService } from './auditService.js';
import type { CaseStatus, TransitionType, User, StateTransition } from '../../shared/types.js';

const STATE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  pending_confirmation: ['confirmed', 'confirmation_failed'],
  confirmed: ['normal_repayment', 'overdue', 'confirmation_withdrawn'],
  confirmation_failed: ['pending_confirmation'],
  normal_repayment: ['overdue', 'settled'],
  overdue: ['in_collection', 'in_negotiation', 'in_repayment', 're_overdue'],
  in_collection: ['in_negotiation', 'legal_action', 'in_repayment', 'settled', 'overdue'],
  in_negotiation: ['in_repayment', 'in_collection', 'legal_action', 'settled'],
  legal_action: ['in_repayment', 'settled', 'in_collection'],
  in_repayment: ['settled', 'overdue', 're_overdue'],
  settled: ['re_overdue'],
  confirmation_withdrawn: ['pending_confirmation', 'legal_action'],
  re_overdue: ['in_collection', 'legal_action', 'in_negotiation'],
};

const REVERSE_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  confirmed: ['pending_confirmation', 'confirmation_withdrawn'],
  normal_repayment: ['confirmed'],
  overdue: ['normal_repayment', 'in_collection', 'in_repayment'],
  in_collection: ['overdue', 'in_negotiation'],
  in_negotiation: ['overdue', 'in_collection'],
  in_repayment: ['overdue', 'in_collection', 'in_negotiation'],
  settled: ['in_repayment', 're_overdue'],
  confirmation_withdrawn: ['confirmed'],
  re_overdue: ['settled', 'in_repayment'],
  pending_confirmation: ['confirmation_failed', 'confirmation_withdrawn'],
  confirmation_failed: ['pending_confirmation'],
  legal_action: ['in_collection', 'in_negotiation'],
};

const NEXT_STEPS_MAP: Record<string, string[]> = {
  'pending_confirmation-confirmed': ['核实买方身份', '确认应收账款真实性', '完成确权手续'],
  'pending_confirmation-confirmation_failed': ['通知卖方确权失败', '补充材料重新申请', '评估是否继续合作'],
  'confirmed-normal_repayment': ['建立还款计划', '定期跟进还款情况', '发送还款提醒'],
  'confirmed-overdue': ['发送逾期通知', '联系买方了解情况', '启动催收流程'],
  'confirmed-confirmation_withdrawn': ['核实撤销原因', '评估影响范围', '准备法律材料'],
  'normal_repayment-overdue': ['发送逾期通知', '联系买方了解原因', '升级催收级别'],
  'normal_repayment-settled': ['核实全额到账', '办理核销手续', '更新案件状态为结清'],
  'overdue-in_collection': ['制定催收方案', '安排专人催收', '记录催收情况'],
  'overdue-in_negotiation': ['了解买方困难', '协商还款方案', '评估方案可行性'],
  'overdue-in_repayment': ['确认回款金额', '办理核销手续', '跟进剩余款项'],
  'overdue-re_overdue': ['分析再次逾期原因', '调整催收策略', '加强监控力度'],
  'in_collection-in_negotiation': ['了解买方还款意向', '协商分期方案', '提交方案审批'],
  'in_collection-legal_action': ['整理证据材料', '委托律师事务所', '提起诉讼/仲裁'],
  'in_collection-in_repayment': ['确认部分回款', '更新还款计划', '继续催收剩余'],
  'in_collection-settled': ['核实全额回款', '办理结案手续', '归档相关材料'],
  'in_collection-overdue': ['评估催收效果', '调整催收策略', '升级处理级别'],
  'in_negotiation-in_repayment': ['确认协议执行', '跟进首次回款', '监控后续还款'],
  'in_negotiation-legal_action': ['协商破裂', '启动法律程序', '申请财产保全'],
  'in_negotiation-settled': ['确认协议履行完毕', '办理核销结案', '归档相关材料'],
  'legal_action-in_repayment': ['跟进调解结果', '确认还款安排', '监控执行情况'],
  'legal_action-settled': ['确认法院判决执行', '核实款项到账', '办理结案手续'],
  'legal_action-in_collection': ['诉讼期间继续催收', '争取庭外和解', '降低处置成本'],
  'in_repayment-settled': ['核实全额到账', '办理核销手续', '更新案件状态'],
  'in_repayment-overdue': ['发送逾期提醒', '了解逾期原因', '调整还款计划'],
  'in_repayment-re_overdue': ['分析违约原因', '评估买方还款能力', '考虑法律途径'],
  'settled-re_overdue': ['核实回款撤回原因', '启动追偿程序', '评估坏账风险'],
  'confirmation_withdrawn-pending_confirmation': ['解决争议问题', '重新提交确权', '跟进确认进度'],
  'confirmation_withdrawn-legal_action': ['整理争议证据', '启动法律程序', '申请资产保全'],
  're_overdue-in_collection': ['调整催收策略', '加大催收力度', '增加催收频率'],
  're_overdue-legal_action': ['评估诉讼必要性', '准备诉讼材料', '启动法律程序'],
  're_overdue-in_negotiation': ['了解买方最新情况', '重新协商还款方案', '寻求担保人介入'],
  'default': ['持续监控', '定期更新状态', '保持沟通'],
};

function generateId(): string {
  return `st_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const stateMachineService = {
  validateTransition(fromStatus: CaseStatus, toStatus: CaseStatus): boolean {
    if (!fromStatus || !toStatus) {
      return false;
    }
    
    const allowedTransitions = STATE_TRANSITIONS[fromStatus];
    return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
  },

  getTransitionType(fromStatus: CaseStatus, toStatus: CaseStatus): TransitionType {
    if (!stateMachineService.validateTransition(fromStatus, toStatus)) {
      throw new Error(`不允许的状态流转: ${fromStatus} -> ${toStatus}`);
    }

    if (REVERSE_TRANSITIONS[toStatus]?.includes(fromStatus)) {
      return 'reverse';
    }

    if (['confirmation_withdrawn', 're_overdue'].includes(toStatus)) {
      return 'exception';
    }

    return 'normal';
  },

  getNextSteps(fromStatus: CaseStatus, toStatus: CaseStatus): string[] {
    if (!stateMachineService.validateTransition(fromStatus, toStatus)) {
      throw new Error(`不允许的状态流转: ${fromStatus} -> ${toStatus}`);
    }

    const key = `${fromStatus}-${toStatus}`;
    return NEXT_STEPS_MAP[key] || NEXT_STEPS_MAP['default'];
  },

  getAllowedTransitions(status: CaseStatus): CaseStatus[] {
    return STATE_TRANSITIONS[status] || [];
  },

  async validateAndLogTransition(
    fromStatus: CaseStatus,
    toStatus: CaseStatus,
    businessNo: string,
    reason: string,
    impactScope: string,
    operator: User
  ): Promise<StateTransition> {
    if (!stateMachineService.validateTransition(fromStatus, toStatus)) {
      throw new Error(`不允许的状态流转: ${fromStatus} -> ${toStatus}`);
    }

    const transitionType = stateMachineService.getTransitionType(fromStatus, toStatus);
    const nextSteps = stateMachineService.getNextSteps(fromStatus, toStatus);

    const id = generateId();
    
    const transition = await StateTransitionDAO.create({
      id,
      businessNo,
      fromStatus,
      toStatus,
      transitionType,
      reason,
      impactScope,
      operatorId: operator.id,
      operatorName: operator.name,
      nextStep: nextSteps.join('; '),
    });

    await auditService.logAction(
      operator.id,
      operator.name,
      'state_transition',
      'case',
      businessNo,
      `状态变更: ${fromStatus} -> ${toStatus}，类型: ${transitionType}，原因: ${reason}`,
    );

    return transition;
  },
};

export default stateMachineService;
