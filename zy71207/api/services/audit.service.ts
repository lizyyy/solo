import { AuditRepository } from '../repositories/audit.repository';
import { ContractRepository } from '../repositories/contract.repository';
import { ShareRepository } from '../repositories/share.repository';
import { RateService } from './rate.service';
import { PromotionService } from './promotion.service';
import { ChargeService } from './charge.service';
import {
  AuditRecord,
  AuditLinkNode,
  NodeType,
  NodeStatus,
  AuditStatus,
  AuditStats,
} from '../../shared/types';

export class AuditService {
  private auditRepository: AuditRepository;
  private contractRepository: ContractRepository;
  private shareRepository: ShareRepository;
  private rateService: RateService;
  private promotionService: PromotionService;
  private chargeService: ChargeService;

  constructor() {
    this.auditRepository = new AuditRepository();
    this.contractRepository = new ContractRepository();
    this.shareRepository = new ShareRepository();
    this.rateService = new RateService();
    this.promotionService = new PromotionService();
    this.chargeService = new ChargeService();
  }

  getAllAudits(filters?: {
    status?: AuditStatus;
    customerId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  }): AuditRecord[] {
    if (filters) {
      return this.auditRepository.findWithFilters(filters);
    }
    return this.auditRepository.findAll();
  }

  getAuditById(id: string): AuditRecord | null {
    return this.auditRepository.findById(id);
  }

  getStats(): AuditStats {
    return this.auditRepository.getStats();
  }

  createAudit(customerId: string, productId: string, chargeId: string): AuditRecord {
    const share = this.shareRepository.findByCustomerAndProduct(customerId, productId);
    if (!share) {
      throw new Error(`Share not found for customer ${customerId} and product ${productId}`);
    }

    const charge = this.chargeService.getChargeById(chargeId);
    if (!charge) {
      throw new Error(`Charge record ${chargeId} not found`);
    }

    const contract = this.contractRepository.findById(share.contractId);
    const { rate, contract: matchedContract, reasons: rateReasons } = this.rateService.matchRateVersion(
      productId,
      charge.chargeDate,
      contract
    );

    if (!rate || !matchedContract) {
      throw new Error('Failed to match rate version or contract');
    }

    const { promotion, reasons: promotionReasons } = this.promotionService.checkPromotionEligibility(
      productId,
      customerId,
      charge.chargeDate
    );

    const { expectedAmount, diffAmount, reasons: chargeReasons } = this.chargeService.recalculateCharge(
      charge,
      share,
      rate,
      promotion
    );

    const { matched, reasons: verifyReasons } = this.chargeService.verifyChargeMatch(
      charge,
      rate.id,
      promotion?.id || null
    );

    const allReasons = [
      ...rateReasons,
      ...promotionReasons,
      ...chargeReasons,
      ...verifyReasons,
    ];

    const status: AuditStatus = matched && Math.abs(diffAmount) <= 0.01 ? 'normal' : 'abnormal';

    return this.auditRepository.create({
      customerId,
      customerName: share.customerName,
      productId,
      productName: matchedContract.productName,
      shareId: share.id,
      contractId: matchedContract.id,
      rateVersionId: rate.id,
      promotionId: promotion?.id || null,
      chargeId,
      status,
      expectedAmount,
      actualAmount: charge.chargedAmount,
      diffAmount,
      reasons: allReasons,
      resolvedTime: null,
      rollbackId: null,
    });
  }

  recalculateAudit(auditId: string): AuditRecord {
    const audit = this.auditRepository.findById(auditId);
    if (!audit) {
      throw new Error(`Audit record ${auditId} not found`);
    }

    const share = this.shareRepository.findById(audit.shareId);
    const contract = this.contractRepository.findById(audit.contractId);
    const charge = this.chargeService.getChargeById(audit.chargeId);
    const rate = this.rateService.getRateById(audit.rateVersionId);
    const promotion = audit.promotionId
      ? this.promotionService.getPromotionById(audit.promotionId)
      : null;

    if (!share || !contract || !charge || !rate) {
      throw new Error('Missing required data for recalculation');
    }

    const { expectedAmount, diffAmount, reasons } = this.chargeService.recalculateCharge(
      charge,
      share,
      rate,
      promotion
    );

    const status: AuditStatus = Math.abs(diffAmount) <= 0.01 ? 'normal' : 'abnormal';

    this.auditRepository.updateStatus(auditId, status);

    return {
      ...audit,
      expectedAmount,
      diffAmount,
      status,
      reasons: [...audit.reasons, ...reasons, '重算完成'],
    };
  }

  resolveAudit(auditId: string): AuditRecord {
    this.auditRepository.updateStatus(auditId, 'resolved');
    const audit = this.auditRepository.findById(auditId);
    if (!audit) {
      throw new Error(`Audit record ${auditId} not found`);
    }
    return audit;
  }

  getAuditChain(auditId: string): AuditLinkNode[] {
    const audit = this.auditRepository.findById(auditId);
    if (!audit) {
      throw new Error(`Audit record ${auditId} not found`);
    }

    const chain: AuditLinkNode[] = [];

    const contract = this.contractRepository.findById(audit.contractId);
    chain.push({
      type: 'contract',
      data: contract ? { ...contract } : {},
      status: contract ? 'ok' : 'error',
      message: contract
        ? `产品合同：${contract.productName} ${contract.version}（${contract.effectiveDate}起生效）`
        : '合同信息缺失',
    });

    const share = this.shareRepository.findById(audit.shareId);
    chain.push({
      type: 'share',
      data: share ? { ...share } : {},
      status: share ? 'ok' : 'error',
      message: share
        ? `客户份额：${share.customerName} 持有 ¥${share.shareAmount.toLocaleString()}（${share.purchaseDate}购入）`
        : '份额信息缺失',
    });

    const rate = this.rateService.getRateById(audit.rateVersionId);
    const rateStatus: NodeStatus =
      audit.status === 'abnormal' && audit.reasons.some(r => r.includes('费率')) ? 'error' : 'ok';
    chain.push({
      type: 'rate',
      data: rate ? { ...rate } : {},
      status: rateStatus,
      message: rate
        ? `费率版本：${rate.version} 管理费${(rate.managementFeeRate * 100).toFixed(2)}% + 服务费${(rate.serviceFeeRate * 100).toFixed(2)}% = 总${((rate.managementFeeRate + rate.serviceFeeRate) * 100).toFixed(2)}%`
        : '费率信息缺失',
    });

    const promotion = audit.promotionId
      ? this.promotionService.getPromotionById(audit.promotionId)
      : null;
    const promotionStatus: NodeStatus = promotion
      ? this.promotionService.isCrossMonthPromotion(promotion)
        ? 'warning'
        : 'ok'
      : audit.reasons.some(r => r.includes('优惠'))
        ? 'error'
        : 'ok';
    chain.push({
      type: 'promotion',
      data: promotion ? { ...promotion } : {},
      status: promotionStatus,
      message: promotion
        ? `优惠期：${promotion.name}（${promotion.startDate}至${promotion.endDate}）${(promotion.discountRate * 10).toFixed(1)}折${this.promotionService.isCrossMonthPromotion(promotion) ? ' 【跨月，需重点核查】' : ''}`
        : '无适用优惠期',
    });

    const charge = this.chargeService.getChargeById(audit.chargeId);
    const chargeStatus: NodeStatus = Math.abs(audit.diffAmount) > 0.01 ? 'error' : 'ok';
    chain.push({
      type: 'charge',
      data: charge ? { ...charge } : {},
      status: chargeStatus,
      message: charge
        ? `扣费流水：${charge.chargeDate} 扣费¥${charge.chargedAmount.toFixed(2)}（费率${(charge.appliedRate * 100).toFixed(2)}%）`
        : '扣费流水缺失',
    });

    const auditStatus: NodeStatus =
      audit.status === 'normal' ? 'ok' : audit.status === 'abnormal' ? 'error' : 'warning';
    chain.push({
      type: 'audit',
      data: { ...audit },
      status: auditStatus,
      message: `审计结论：${this.getStatusText(audit.status)}  ${audit.diffAmount !== 0 ? `差异¥${audit.diffAmount.toFixed(2)}` : '无差异'}`,
    });

    return chain;
  }

  private getStatusText(status: AuditStatus): string {
    const map: Record<AuditStatus, string> = {
      pending: '待审计',
      normal: '审计通过',
      abnormal: '存在异常',
      resolved: '已处理',
    };
    return map[status];
  }
}
