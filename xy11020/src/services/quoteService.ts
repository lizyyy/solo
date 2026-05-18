import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { RepairQuote, QuoteStatus, QuoteChangeRecord, ChangeType, ReviewResult, FaultItem, PartItem } from '../types';

const PART_PRICE_RANGES: Record<string, { min: number; max: number }> = {
  'BENZ-AC-001': { min: 3500, max: 5000 },
  'VW-OIL-001': { min: 80, max: 150 },
  'TOY-BRAKE-001': { min: 120, max: 250 },
};

export class QuoteService {
  async getQuoteById(id: string): Promise<RepairQuote | undefined> {
    return db.getQuoteById(id);
  }

  async getQuoteByNumber(quoteNumber: string): Promise<RepairQuote | undefined> {
    return db.getQuoteByNumber(quoteNumber);
  }

  async getAllQuotes(): Promise<RepairQuote[]> {
    return db.getAllQuotes();
  }

  async createQuote(quoteData: Omit<RepairQuote, 'id' | 'createdAt' | 'updatedAt' | 'statusHistory'>): Promise<RepairQuote> {
    const now = new Date();
    const quote: RepairQuote = {
      ...quoteData,
      id: uuidv4(),
      status: QuoteStatus.DRAFT,
      statusHistory: [
        {
          status: QuoteStatus.DRAFT,
          changedAt: now,
          changedBy: quoteData.createdBy
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    db.addQuote(quote);
    return quote;
  }

  async submitForApproval(quoteId: string, operator: string): Promise<RepairQuote> {
    const quote = db.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    if (quote.status !== QuoteStatus.DRAFT) {
      throw new Error('INVALID_STATUS');
    }

    const validationResult = this.validateQuoteConsistency(quote);
    if (!validationResult.valid) {
      quote.status = QuoteStatus.REJECTED;
      quote.rejectionReason = validationResult.reason;
      quote.statusHistory.push({
        status: QuoteStatus.REJECTED,
        changedAt: new Date(),
        changedBy: '系统',
        notes: '报价一致性校验失败'
      });
      quote.updatedAt = new Date();
      db.updateQuote(quoteId, quote);
      throw new Error(`QUOTE_REJECTED:${validationResult.reason}`);
    }

    quote.status = QuoteStatus.PENDING_APPROVAL;
    quote.statusHistory.push({
      status: QuoteStatus.PENDING_APPROVAL,
      changedAt: new Date(),
      changedBy: operator
    });
    quote.updatedAt = new Date();
    db.updateQuote(quoteId, quote);

    return quote;
  }

  async customerAcceptQuote(quoteId: string, customerName: string): Promise<RepairQuote> {
    const quote = db.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    if (quote.status !== QuoteStatus.PENDING_APPROVAL) {
      throw new Error('INVALID_STATUS');
    }

    const now = new Date();
    quote.status = QuoteStatus.CUSTOMER_ACCEPTED;
    quote.customerAcceptedAt = now;
    quote.statusHistory.push({
      status: QuoteStatus.CUSTOMER_ACCEPTED,
      changedAt: now,
      changedBy: customerName,
      notes: '客户确认接受报价'
    });
    quote.updatedAt = now;
    db.updateQuote(quoteId, quote);

    return quote;
  }

  async addHiddenFault(
    quoteId: string,
    faultItem: FaultItem,
    partItems: PartItem[],
    reason: string,
    operator: string
  ): Promise<{ quote: RepairQuote; changeRecord: QuoteChangeRecord }> {
    const quote = db.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    if (quote.status !== QuoteStatus.CUSTOMER_ACCEPTED) {
      throw new Error('INVALID_STATUS');
    }

    const previousTotal = quote.totalAmount;
    
    faultItem.id = uuidv4();
    faultItem.isHidden = true;
    quote.faultItems.push(faultItem);
    
    partItems.forEach(p => p.id = uuidv4());
    quote.partItems.push(...partItems);

    const newLaborTotal = quote.laborTotal + faultItem.laborCost;
    const newPartsTotal = quote.partsTotal + partItems.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
    const newTotal = newLaborTotal + newPartsTotal - quote.discount;

    quote.laborTotal = newLaborTotal;
    quote.partsTotal = newPartsTotal;
    quote.totalAmount = newTotal;
    quote.status = QuoteStatus.PENDING_SUPPLEMENT;
    quote.supplementNotes = reason;

    const now = new Date();
    quote.statusHistory.push({
      status: QuoteStatus.PENDING_SUPPLEMENT,
      changedAt: now,
      changedBy: operator,
      notes: reason
    });
    quote.updatedAt = now;

    const changeRecord: QuoteChangeRecord = {
      id: uuidv4(),
      quoteId: quoteId,
      changeType: ChangeType.HIDDEN_FAULT_ADD,
      changeReason: reason,
      previousAmount: previousTotal,
      newAmount: newTotal,
      changedBy: operator,
      changedAt: now,
      reviewResult: ReviewResult.PENDING
    };

    db.updateQuote(quoteId, quote);
    db.addChangeRecord(changeRecord);

    return { quote, changeRecord };
  }

  async reviewSupplement(
    quoteId: string,
    recordId: string,
    approved: boolean,
    reviewer: string,
    notes?: string
  ): Promise<{ quote: RepairQuote; changeRecord: QuoteChangeRecord }> {
    const quote = db.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    const records = db.getChangeRecordsByQuoteId(quoteId);
    const changeRecord = records.find(r => r.id === recordId);
    if (!changeRecord) {
      throw new Error('CHANGE_RECORD_NOT_FOUND');
    }

    if (quote.status !== QuoteStatus.PENDING_SUPPLEMENT) {
      throw new Error('INVALID_STATUS');
    }

    const now = new Date();
    changeRecord.reviewResult = approved ? ReviewResult.APPROVED : ReviewResult.REJECTED;
    changeRecord.reviewedBy = reviewer;
    changeRecord.reviewedAt = now;
    changeRecord.reviewNotes = notes;

    if (approved) {
      quote.status = QuoteStatus.CUSTOMER_ACCEPTED;
      quote.statusHistory.push({
        status: QuoteStatus.CUSTOMER_ACCEPTED,
        changedAt: now,
        changedBy: reviewer,
        notes: '客户确认接受追加报价'
      });
    } else {
      quote.status = QuoteStatus.REJECTED;
      quote.rejectionReason = notes || '客户拒绝追加报价';
      quote.statusHistory.push({
        status: QuoteStatus.REJECTED,
        changedAt: now,
        changedBy: reviewer,
        notes: '客户拒绝追加报价'
      });
    }

    quote.updatedAt = now;
    db.updateQuote(quoteId, quote);
    db.updateChangeRecord(recordId, changeRecord);

    return { quote, changeRecord };
  }

  async completeQuote(quoteId: string, operator: string): Promise<RepairQuote> {
    const quote = db.getQuoteById(quoteId);
    if (!quote) {
      throw new Error('QUOTE_NOT_FOUND');
    }

    if (quote.status !== QuoteStatus.CUSTOMER_ACCEPTED) {
      throw new Error('INVALID_STATUS');
    }

    const now = new Date();
    quote.status = QuoteStatus.COMPLETED;
    quote.statusHistory.push({
      status: QuoteStatus.COMPLETED,
      changedAt: now,
      changedBy: operator,
      notes: '维修完成'
    });
    quote.updatedAt = now;
    db.updateQuote(quoteId, quote);

    return quote;
  }

  async getChangeRecords(quoteId: string): Promise<QuoteChangeRecord[]> {
    return db.getChangeRecordsByQuoteId(quoteId);
  }

  private validateQuoteConsistency(quote: RepairQuote): { valid: boolean; reason?: string } {
    for (const part of quote.partItems) {
      const priceRange = PART_PRICE_RANGES[part.partNumber];
      if (priceRange) {
        if (part.unitPrice < priceRange.min || part.unitPrice > priceRange.max) {
          return {
            valid: false,
            reason: `【报价异常拦截】${part.name}报价${part.unitPrice}元超出同款配件市场价范围（${priceRange.min}-${priceRange.max}元），配件价格一致性校验失败。请核实配件渠道和价格后重新提交，或转人工审核。`
          };
        }
      }
    }

    const calculatedLaborTotal = quote.faultItems.reduce((sum, f) => sum + f.laborCost, 0);
    if (Math.abs(calculatedLaborTotal - quote.laborTotal) > 0.01) {
      return {
        valid: false,
        reason: `【报价异常拦截】工时费计算不一致。故障项目工时费总和(${calculatedLaborTotal}元)与报价单工时费总额(${quote.laborTotal}元)不匹配。请核对工时项目后重新提交。`
      };
    }

    const calculatedPartsTotal = quote.partItems.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
    if (Math.abs(calculatedPartsTotal - quote.partsTotal) > 0.01) {
      return {
        valid: false,
        reason: `【报价异常拦截】配件费计算不一致。配件项目费用总和(${calculatedPartsTotal}元)与报价单配件费总额(${quote.partsTotal}元)不匹配。请核对配件项目后重新提交。`
      };
    }

    const calculatedTotal = calculatedLaborTotal + calculatedPartsTotal - quote.discount;
    if (Math.abs(calculatedTotal - quote.totalAmount) > 0.01) {
      return {
        valid: false,
        reason: `【报价异常拦截】总金额计算不一致。(工时费+配件费-折扣)应为${calculatedTotal}元，当前报价${quote.totalAmount}元。请重新核算报价金额。`
      };
    }

    return { valid: true };
  }
}

export const quoteService = new QuoteService();
