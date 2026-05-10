import { Repository } from 'typeorm';
import { DelayRequest, DelayRequestStatus } from '../entities/DelayRequest';
import { RiskItem, RiskStatus } from '../entities/RiskItem';
import { Vulnerability } from '../entities/Vulnerability';
import { VulnerabilityStatus, RiskLevel, Severity } from '../types';
import { BusinessRuleValidator } from './BusinessRuleValidator';
import { createAuditLogger } from '../logger';

const logger = createAuditLogger('DelayService');

export class DelayService {
  constructor(
    private delayRepo: Repository<DelayRequest>,
    private riskItemRepo: Repository<RiskItem>,
    private vulnerabilityRepo: Repository<Vulnerability>
  ) {}

  async createDelayRequest(
    vulnerabilityId: string,
    requesterId: string,
    requesterName: string,
    newDueDate: Date,
    reason: string,
    riskMitigation: string,
    isManualOverride: boolean = false
  ): Promise<{ request: DelayRequest; warnings: string[]; additionalRisk?: RiskLevel }> {
    logger.info('创建延期申请', { vulnerabilityId, requesterId });

    const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: vulnerabilityId } });
    if (!vulnerability) {
      throw new Error(`漏洞 ${vulnerabilityId} 不存在`);
    }

    if (!vulnerability.dueDate) {
      throw new Error('漏洞没有设置修复截止日期，无法申请延期');
    }

    const pendingRequests = await this.delayRepo.find({
      where: { vulnerabilityId, status: DelayRequestStatus.PENDING }
    });

    if (pendingRequests.length > 0) {
      throw new Error('该漏洞已有待审批的延期申请，请先处理已有申请');
    }

    const validation = BusinessRuleValidator.validateDelayRequest(
      vulnerability.status,
      vulnerability.delayCount,
      vulnerability.severity as Severity,
      vulnerability.dueDate,
      newDueDate,
      reason,
      riskMitigation,
      isManualOverride
    );

    if (!validation.valid) {
      logger.warn('延期申请验证失败', { vulnerabilityId, errors: validation.errors });
      throw new Error(`延期申请失败: ${validation.errors.join('; ')}`);
    }

    const request = this.delayRepo.create({
      vulnerabilityId,
      requesterId,
      requesterName,
      originalDueDate: vulnerability.dueDate,
      newDueDate,
      reason,
      riskMitigation,
      status: DelayRequestStatus.PENDING
    });

    const savedRequest = await this.delayRepo.save(request);

    if (validation.additionalRisk) {
      await this.createAssociatedRisk(vulnerability, savedRequest, validation.additionalRisk);
    }

    logger.info('延期申请创建成功', {
      requestId: savedRequest.id,
      vulnerabilityId,
      originalDueDate: vulnerability.dueDate,
      newDueDate
    });

    return {
      request: savedRequest,
      warnings: validation.warnings,
      additionalRisk: validation.additionalRisk
    };
  }

  private async createAssociatedRisk(
    vulnerability: Vulnerability,
    delayRequest: DelayRequest,
    riskLevel: RiskLevel
  ): Promise<void> {
    const riskItem = this.riskItemRepo.create({
      vulnerabilityId: vulnerability.id,
      title: `延期风险: ${vulnerability.cveId}`,
      description: `漏洞 ${vulnerability.packageName} (${vulnerability.cveId}) 申请延期，原截止日期: ${delayRequest.originalDueDate.toISOString()}，新截止日期: ${delayRequest.newDueDate.toISOString()}。延期理由: ${delayRequest.reason}`,
      level: riskLevel,
      status: RiskStatus.OPEN,
      mitigationPlan: delayRequest.riskMitigation,
      ownerId: delayRequest.requesterId,
      ownerName: delayRequest.requesterName,
      dueDate: delayRequest.newDueDate
    });

    await this.riskItemRepo.save(riskItem);
    logger.info('创建关联风险项', { vulnerabilityId: vulnerability.id, riskLevel });
  }

  async approveDelayRequest(
    requestId: string,
    approverId: string,
    approverName: string,
    comment: string
  ): Promise<DelayRequest> {
    logger.info('审批延期申请', { requestId, approverId });

    const request = await this.delayRepo.findOne({ where: { id: requestId } });
    if (!request) {
      throw new Error(`延期申请 ${requestId} 不存在`);
    }

    if (request.status !== DelayRequestStatus.PENDING) {
      throw new Error('该延期申请已经被处理过了');
    }

    request.status = DelayRequestStatus.APPROVED;
    request.approverId = approverId;
    request.approverName = approverName;
    request.approvalComment = comment;
    request.approvedAt = new Date();

    await this.delayRepo.save(request);

    const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: request.vulnerabilityId } });
    if (vulnerability) {
      vulnerability.dueDate = request.newDueDate;
      vulnerability.delayCount = (vulnerability.delayCount || 0) + 1;
      vulnerability.status = VulnerabilityStatus.DELAYED;
      await this.vulnerabilityRepo.save(vulnerability);

      logger.info('漏洞延期生效', {
        vulnerabilityId: request.vulnerabilityId,
        newDueDate: request.newDueDate,
        delayCount: vulnerability.delayCount
      });
    }

    return request;
  }

  async rejectDelayRequest(
    requestId: string,
    approverId: string,
    approverName: string,
    comment: string
  ): Promise<DelayRequest> {
    logger.info('拒绝延期申请', { requestId, approverId });

    const request = await this.delayRepo.findOne({ where: { id: requestId } });
    if (!request) {
      throw new Error(`延期申请 ${requestId} 不存在`);
    }

    if (request.status !== DelayRequestStatus.PENDING) {
      throw new Error('该延期申请已经被处理过了');
    }

    request.status = DelayRequestStatus.REJECTED;
    request.approverId = approverId;
    request.approverName = approverName;
    request.approvalComment = comment;

    await this.delayRepo.save(request);

    return request;
  }

  async getDelayRequests(vulnerabilityId?: string, status?: DelayRequestStatus): Promise<DelayRequest[]> {
    const where: any = {};
    if (vulnerabilityId) where.vulnerabilityId = vulnerabilityId;
    if (status) where.status = status;

    return this.delayRepo.find({
      where,
      order: { createdAt: 'DESC' }
    });
  }
}
