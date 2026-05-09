import {
  ChargingSession,
  BillingSegment,
  RefundRequest,
  RefundRecord,
  RefundStatus,
  RejectStage,
  InterruptionReason,
  RefundResult,
  RefundCalculation,
} from '../types';
import { ChargingSessionRepository } from '../repositories/ChargingSessionRepository';
import { BillingSegmentRepository } from '../repositories/BillingSegmentRepository';
import { RefundRepository } from '../repositories/RefundRepository';
import { RefundCalculationService } from './RefundCalculationService';
import { StateTransitionService } from './StateTransitionService';

export interface CreateRefundRequest {
  requestId: string;
  sessionId: string;
  interruptionReason: InterruptionReason;
  interruptionTime: Date;
  description?: string;
}

export interface RefundQueryResult {
  record: RefundRecord;
  request: RefundRequest;
  session: ChargingSession;
  segments: BillingSegment[];
  history: any[];
  latestHistory: any | null;
  previousHistory: any | null;
}

export class RefundService {
  constructor(
    private sessionRepository: ChargingSessionRepository = new ChargingSessionRepository(),
    private segmentRepository: BillingSegmentRepository = new BillingSegmentRepository(),
    private refundRepository: RefundRepository = new RefundRepository(),
    private calculationService: RefundCalculationService = new RefundCalculationService(),
    private stateTransitionService: StateTransitionService = new StateTransitionService()
  ) {}

  createRefundRequest(request: CreateRefundRequest, operator: string = 'SYSTEM'): RefundResult {
    const existingRecord = this.refundRepository.findRecordByRequestId(request.requestId);
    if (existingRecord) {
      return {
        success: true,
        refundRecord: existingRecord,
        message: '请求已存在，返回幂等结果',
      };
    }

    const validation = this.validateRefundRequest(request);
    if (!validation.valid) {
      return {
        success: false,
        currentStage: RejectStage.VALIDATION,
        message: validation.reason || '验证失败',
      };
    }

    const session = validation.session!;
    const segments = this.segmentRepository.findBySessionId(session.id);

    const calculation = this.calculationService.calculateRefund(
      request.interruptionReason,
      segments
    );

    if (!this.calculationService.isTotalAmountValid(calculation)) {
      return {
        success: false,
        currentStage: RejectStage.CALCULATION,
        message: '退款金额计算无效',
      };
    }

    const refundRequest: Omit<RefundRequest, 'id'> = {
      sessionId: session.id,
      requestId: request.requestId,
      interruptionReason: request.interruptionReason,
      interruptionTime: request.interruptionTime,
      description: request.description || '',
      createdAt: new Date(),
    };
    const savedRequest = this.refundRepository.createRequest(refundRequest);

    const initialStatus = this.calculationService.hasRefundAmount(calculation)
      ? RefundStatus.CALCULATED
      : RefundStatus.REJECTED;

    const initialStage = initialStatus === RefundStatus.REJECTED
      ? RejectStage.CALCULATION
      : null;

    const record: Omit<RefundRecord, 'id'> = {
      requestId: savedRequest.requestId,
      sessionId: session.id,
      status: initialStatus,
      currentStage: initialStage,
      energyRefundAmount: calculation.energyAmount,
      serviceRefundAmount: calculation.serviceAmount,
      totalRefundAmount: calculation.totalAmount,
      callbackCount: 0,
      lastCallbackAt: null,
      lastCallbackResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const savedRecord = this.refundRepository.createRecord(record);

    this.addHistory(
      savedRecord.id,
      initialStatus,
      initialStage,
      initialStatus === RefundStatus.REJECTED
        ? '无退款金额，自动拒绝'
        : '退款金额计算完成，等待审批',
      operator
    );

    return {
      success: initialStatus !== RefundStatus.REJECTED,
      refundRecord: savedRecord,
      currentStage: initialStage || undefined,
      message: initialStatus === RefundStatus.REJECTED
        ? '无退款金额，自动拒绝'
        : '退款请求创建成功',
    };
  }

  approveRefund(requestId: string, operator: string = 'SYSTEM'): RefundResult {
    const record = this.refundRepository.findRecordByRequestId(requestId);
    if (!record) {
      return { success: false, message: '退款记录不存在' };
    }

    if (this.stateTransitionService.isTerminalStatus(record.status)) {
      return {
        success: true,
        refundRecord: record,
        message: '请求已处理完成',
      };
    }

    if (record.status !== RefundStatus.CALCULATED) {
      return {
        success: false,
        currentStage: RejectStage.APPROVAL,
        message: `当前状态 ${record.status} 不允许审批`,
      };
    }

    const transition = this.stateTransitionService.canTransition(
      record.status,
      RefundStatus.APPROVED
    );
    if (!transition.allowed) {
      return {
        success: false,
        currentStage: RejectStage.APPROVAL,
        message: transition.reason || '状态转换不允许',
      };
    }

    record.status = RefundStatus.APPROVED;
    record.currentStage = null;
    this.refundRepository.updateRecord(record);

    this.addHistory(record.id, RefundStatus.APPROVED, null, '审批通过', operator);

    return {
      success: true,
      refundRecord: record,
      message: '审批通过',
    };
  }

  sendCallback(
    requestId: string,
    callbackResponse?: string,
    operator: string = 'SYSTEM'
  ): RefundResult {
    const record = this.refundRepository.findRecordByRequestId(requestId);
    if (!record) {
      return { success: false, message: '退款记录不存在' };
    }

    if (record.status === RefundStatus.CALLBACK_SENT ||
        record.status === RefundStatus.RECONCILED ||
        record.status === RefundStatus.COMPLETED) {
      return {
        success: true,
        refundRecord: record,
        message: '回调已发送，幂等返回',
      };
    }

    if (record.status !== RefundStatus.APPROVED) {
      return {
        success: false,
        currentStage: RejectStage.CALLBACK,
        message: `当前状态 ${record.status} 不允许发送回调`,
      };
    }

    if (record.callbackCount >= 3) {
      record.status = RefundStatus.REJECTED;
      record.currentStage = RejectStage.CALLBACK;
      this.refundRepository.updateRecord(record);
      this.addHistory(
        record.id,
        RefundStatus.REJECTED,
        RejectStage.CALLBACK,
        '回调次数超过3次，自动拒绝',
        operator
      );
      return {
        success: false,
        refundRecord: record,
        currentStage: RejectStage.CALLBACK,
        message: '回调次数超过3次，自动拒绝',
      };
    }

    record.status = RefundStatus.CALLBACK_SENT;
    record.currentStage = null;
    record.callbackCount += 1;
    record.lastCallbackAt = new Date();
    record.lastCallbackResponse = callbackResponse || null;
    this.refundRepository.updateRecord(record);

    this.addHistory(
      record.id,
      RefundStatus.CALLBACK_SENT,
      null,
      `回调发送成功（第 ${record.callbackCount} 次）`,
      operator
    );

    return {
      success: true,
      refundRecord: record,
      message: '回调发送成功',
    };
  }

  reconcile(
    requestId: string,
    success: boolean,
    operator: string = 'SYSTEM'
  ): RefundResult {
    const record = this.refundRepository.findRecordByRequestId(requestId);
    if (!record) {
      return { success: false, message: '退款记录不存在' };
    }

    if (record.status === RefundStatus.RECONCILED ||
        record.status === RefundStatus.COMPLETED) {
      return {
        success: true,
        refundRecord: record,
        message: '已完成对账，幂等返回',
      };
    }

    if (record.status !== RefundStatus.CALLBACK_SENT) {
      return {
        success: false,
        currentStage: RejectStage.RECONCILIATION,
        message: `当前状态 ${record.status} 不允许对账`,
      };
    }

    if (!success) {
      record.status = RefundStatus.REJECTED;
      record.currentStage = RejectStage.RECONCILIATION;
      this.refundRepository.updateRecord(record);
      this.addHistory(
        record.id,
        RefundStatus.REJECTED,
        RejectStage.RECONCILIATION,
        '财务对账失败',
        operator
      );
      return {
        success: false,
        refundRecord: record,
        currentStage: RejectStage.RECONCILIATION,
        message: '财务对账失败',
      };
    }

    record.status = RefundStatus.RECONCILED;
    record.currentStage = null;
    this.refundRepository.updateRecord(record);

    this.addHistory(
      record.id,
      RefundStatus.RECONCILED,
      null,
      '财务对账成功',
      operator
    );

    return {
      success: true,
      refundRecord: record,
      message: '财务对账成功',
    };
  }

  complete(
    requestId: string,
    operator: string = 'SYSTEM'
  ): RefundResult {
    const record = this.refundRepository.findRecordByRequestId(requestId);
    if (!record) {
      return { success: false, message: '退款记录不存在' };
    }

    if (record.status === RefundStatus.COMPLETED) {
      return {
        success: true,
        refundRecord: record,
        message: '已完成，幂等返回',
      };
    }

    if (record.status !== RefundStatus.RECONCILED) {
      return {
        success: false,
        message: `当前状态 ${record.status} 不允许完成`,
      };
    }

    record.status = RefundStatus.COMPLETED;
    record.currentStage = null;
    this.refundRepository.updateRecord(record);

    this.addHistory(
      record.id,
      RefundStatus.COMPLETED,
      null,
      '退款流程完成',
      operator
    );

    return {
      success: true,
      refundRecord: record,
      message: '退款流程完成',
    };
  }

  getRefundDetail(requestId: string): RefundQueryResult | null {
    const record = this.refundRepository.findRecordByRequestId(requestId);
    if (!record) return null;

    const request = this.refundRepository.findRequestByRequestId(requestId);
    if (!request) return null;

    const session = this.sessionRepository.findById(record.sessionId);
    if (!session) return null;

    const segments = this.segmentRepository.findBySessionId(session.id);
    const history = this.refundRepository.findHistoryByRecordId(record.id);
    const latestHistory = history[0] || null;
    const previousHistory = history[1] || null;

    return {
      record,
      request,
      session,
      segments,
      history,
      latestHistory,
      previousHistory,
    };
  }

  calculateRefundPreview(
    interruptionReason: InterruptionReason,
    segments: BillingSegment[]
  ): RefundCalculation {
    return this.calculationService.calculateRefund(interruptionReason, segments);
  }

  private validateRefundRequest(request: CreateRefundRequest): {
    valid: boolean;
    reason?: string;
    session?: ChargingSession;
  } {
    const session = this.sessionRepository.findById(request.sessionId);
    if (!session) {
      return { valid: false, reason: '充电会话不存在' };
    }

    if (session.status === 'ACTIVE') {
      return { valid: false, reason: '充电会话仍在进行中' };
    }

    if (session.status === 'COMPLETED') {
      return { valid: false, reason: '充电会话已正常完成' };
    }

    if (request.interruptionTime < session.startTime) {
      return { valid: false, reason: '中断时间早于会话开始时间' };
    }

    const segments = this.segmentRepository.findBySessionId(session.id);
    if (segments.length === 0) {
      return { valid: false, reason: '无计费片段数据' };
    }

    return { valid: true, session };
  }

  private addHistory(
    recordId: string,
    status: RefundStatus,
    stage: RejectStage | null,
    message: string,
    operator: string
  ): void {
    this.refundRepository.createHistory({
      refundRecordId: recordId,
      status,
      stage,
      message,
      operator,
      createdAt: new Date(),
    });
  }
}
