"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelayService = void 0;
const DelayRequest_1 = require("../entities/DelayRequest");
const RiskItem_1 = require("../entities/RiskItem");
const types_1 = require("../types");
const BusinessRuleValidator_1 = require("./BusinessRuleValidator");
const logger_1 = require("../logger");
const logger = (0, logger_1.createAuditLogger)('DelayService');
class DelayService {
    constructor(delayRepo, riskItemRepo, vulnerabilityRepo) {
        this.delayRepo = delayRepo;
        this.riskItemRepo = riskItemRepo;
        this.vulnerabilityRepo = vulnerabilityRepo;
    }
    async createDelayRequest(vulnerabilityId, requesterId, requesterName, newDueDate, reason, riskMitigation, isManualOverride = false) {
        logger.info('创建延期申请', { vulnerabilityId, requesterId });
        const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: vulnerabilityId } });
        if (!vulnerability) {
            throw new Error(`漏洞 ${vulnerabilityId} 不存在`);
        }
        if (!vulnerability.dueDate) {
            throw new Error('漏洞没有设置修复截止日期，无法申请延期');
        }
        const pendingRequests = await this.delayRepo.find({
            where: { vulnerabilityId, status: DelayRequest_1.DelayRequestStatus.PENDING }
        });
        if (pendingRequests.length > 0) {
            throw new Error('该漏洞已有待审批的延期申请，请先处理已有申请');
        }
        const validation = BusinessRuleValidator_1.BusinessRuleValidator.validateDelayRequest(vulnerability.status, vulnerability.delayCount, vulnerability.severity, vulnerability.dueDate, newDueDate, reason, riskMitigation, isManualOverride);
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
            status: DelayRequest_1.DelayRequestStatus.PENDING
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
    async createAssociatedRisk(vulnerability, delayRequest, riskLevel) {
        const riskItem = this.riskItemRepo.create({
            vulnerabilityId: vulnerability.id,
            title: `延期风险: ${vulnerability.cveId}`,
            description: `漏洞 ${vulnerability.packageName} (${vulnerability.cveId}) 申请延期，原截止日期: ${delayRequest.originalDueDate.toISOString()}，新截止日期: ${delayRequest.newDueDate.toISOString()}。延期理由: ${delayRequest.reason}`,
            level: riskLevel,
            status: RiskItem_1.RiskStatus.OPEN,
            mitigationPlan: delayRequest.riskMitigation,
            ownerId: delayRequest.requesterId,
            ownerName: delayRequest.requesterName,
            dueDate: delayRequest.newDueDate
        });
        await this.riskItemRepo.save(riskItem);
        logger.info('创建关联风险项', { vulnerabilityId: vulnerability.id, riskLevel });
    }
    async approveDelayRequest(requestId, approverId, approverName, comment) {
        logger.info('审批延期申请', { requestId, approverId });
        const request = await this.delayRepo.findOne({ where: { id: requestId } });
        if (!request) {
            throw new Error(`延期申请 ${requestId} 不存在`);
        }
        if (request.status !== DelayRequest_1.DelayRequestStatus.PENDING) {
            throw new Error('该延期申请已经被处理过了');
        }
        request.status = DelayRequest_1.DelayRequestStatus.APPROVED;
        request.approverId = approverId;
        request.approverName = approverName;
        request.approvalComment = comment;
        request.approvedAt = new Date();
        await this.delayRepo.save(request);
        const vulnerability = await this.vulnerabilityRepo.findOne({ where: { id: request.vulnerabilityId } });
        if (vulnerability) {
            vulnerability.dueDate = request.newDueDate;
            vulnerability.delayCount = (vulnerability.delayCount || 0) + 1;
            vulnerability.status = types_1.VulnerabilityStatus.DELAYED;
            await this.vulnerabilityRepo.save(vulnerability);
            logger.info('漏洞延期生效', {
                vulnerabilityId: request.vulnerabilityId,
                newDueDate: request.newDueDate,
                delayCount: vulnerability.delayCount
            });
        }
        return request;
    }
    async rejectDelayRequest(requestId, approverId, approverName, comment) {
        logger.info('拒绝延期申请', { requestId, approverId });
        const request = await this.delayRepo.findOne({ where: { id: requestId } });
        if (!request) {
            throw new Error(`延期申请 ${requestId} 不存在`);
        }
        if (request.status !== DelayRequest_1.DelayRequestStatus.PENDING) {
            throw new Error('该延期申请已经被处理过了');
        }
        request.status = DelayRequest_1.DelayRequestStatus.REJECTED;
        request.approverId = approverId;
        request.approverName = approverName;
        request.approvalComment = comment;
        await this.delayRepo.save(request);
        return request;
    }
    async getDelayRequests(vulnerabilityId, status) {
        const where = {};
        if (vulnerabilityId)
            where.vulnerabilityId = vulnerabilityId;
        if (status)
            where.status = status;
        return this.delayRepo.find({
            where,
            order: { createdAt: 'DESC' }
        });
    }
}
exports.DelayService = DelayService;
//# sourceMappingURL=DelayService.js.map