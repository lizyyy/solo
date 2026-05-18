"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteService = exports.QuoteService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const types_1 = require("../types");
const PART_PRICE_RANGES = {
    'BENZ-AC-001': { min: 3500, max: 5000 },
    'VW-OIL-001': { min: 80, max: 150 },
    'TOY-BRAKE-001': { min: 120, max: 250 },
};
class QuoteService {
    async getQuoteById(id) {
        return database_1.db.getQuoteById(id);
    }
    async getQuoteByNumber(quoteNumber) {
        return database_1.db.getQuoteByNumber(quoteNumber);
    }
    async getAllQuotes() {
        return database_1.db.getAllQuotes();
    }
    async createQuote(quoteData) {
        const now = new Date();
        const quote = {
            ...quoteData,
            id: (0, uuid_1.v4)(),
            status: types_1.QuoteStatus.DRAFT,
            statusHistory: [
                {
                    status: types_1.QuoteStatus.DRAFT,
                    changedAt: now,
                    changedBy: quoteData.createdBy
                }
            ],
            createdAt: now,
            updatedAt: now
        };
        database_1.db.addQuote(quote);
        return quote;
    }
    async submitForApproval(quoteId, operator) {
        const quote = database_1.db.getQuoteById(quoteId);
        if (!quote) {
            throw new Error('QUOTE_NOT_FOUND');
        }
        if (quote.status !== types_1.QuoteStatus.DRAFT) {
            throw new Error('INVALID_STATUS');
        }
        const validationResult = this.validateQuoteConsistency(quote);
        if (!validationResult.valid) {
            quote.status = types_1.QuoteStatus.REJECTED;
            quote.rejectionReason = validationResult.reason;
            quote.statusHistory.push({
                status: types_1.QuoteStatus.REJECTED,
                changedAt: new Date(),
                changedBy: '系统',
                notes: '报价一致性校验失败'
            });
            quote.updatedAt = new Date();
            database_1.db.updateQuote(quoteId, quote);
            throw new Error(`QUOTE_REJECTED:${validationResult.reason}`);
        }
        quote.status = types_1.QuoteStatus.PENDING_APPROVAL;
        quote.statusHistory.push({
            status: types_1.QuoteStatus.PENDING_APPROVAL,
            changedAt: new Date(),
            changedBy: operator
        });
        quote.updatedAt = new Date();
        database_1.db.updateQuote(quoteId, quote);
        return quote;
    }
    async customerAcceptQuote(quoteId, customerName) {
        const quote = database_1.db.getQuoteById(quoteId);
        if (!quote) {
            throw new Error('QUOTE_NOT_FOUND');
        }
        if (quote.status !== types_1.QuoteStatus.PENDING_APPROVAL) {
            throw new Error('INVALID_STATUS');
        }
        const now = new Date();
        quote.status = types_1.QuoteStatus.CUSTOMER_ACCEPTED;
        quote.customerAcceptedAt = now;
        quote.statusHistory.push({
            status: types_1.QuoteStatus.CUSTOMER_ACCEPTED,
            changedAt: now,
            changedBy: customerName,
            notes: '客户确认接受报价'
        });
        quote.updatedAt = now;
        database_1.db.updateQuote(quoteId, quote);
        return quote;
    }
    async addHiddenFault(quoteId, faultItem, partItems, reason, operator) {
        const quote = database_1.db.getQuoteById(quoteId);
        if (!quote) {
            throw new Error('QUOTE_NOT_FOUND');
        }
        if (quote.status !== types_1.QuoteStatus.CUSTOMER_ACCEPTED) {
            throw new Error('INVALID_STATUS');
        }
        const previousTotal = quote.totalAmount;
        faultItem.id = (0, uuid_1.v4)();
        faultItem.isHidden = true;
        quote.faultItems.push(faultItem);
        partItems.forEach(p => p.id = (0, uuid_1.v4)());
        quote.partItems.push(...partItems);
        const newLaborTotal = quote.laborTotal + faultItem.laborCost;
        const newPartsTotal = quote.partsTotal + partItems.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
        const newTotal = newLaborTotal + newPartsTotal - quote.discount;
        quote.laborTotal = newLaborTotal;
        quote.partsTotal = newPartsTotal;
        quote.totalAmount = newTotal;
        quote.status = types_1.QuoteStatus.PENDING_SUPPLEMENT;
        quote.supplementNotes = reason;
        const now = new Date();
        quote.statusHistory.push({
            status: types_1.QuoteStatus.PENDING_SUPPLEMENT,
            changedAt: now,
            changedBy: operator,
            notes: reason
        });
        quote.updatedAt = now;
        const changeRecord = {
            id: (0, uuid_1.v4)(),
            quoteId: quoteId,
            changeType: types_1.ChangeType.HIDDEN_FAULT_ADD,
            changeReason: reason,
            previousAmount: previousTotal,
            newAmount: newTotal,
            changedBy: operator,
            changedAt: now,
            reviewResult: types_1.ReviewResult.PENDING
        };
        database_1.db.updateQuote(quoteId, quote);
        database_1.db.addChangeRecord(changeRecord);
        return { quote, changeRecord };
    }
    async reviewSupplement(quoteId, recordId, approved, reviewer, notes) {
        const quote = database_1.db.getQuoteById(quoteId);
        if (!quote) {
            throw new Error('QUOTE_NOT_FOUND');
        }
        const records = database_1.db.getChangeRecordsByQuoteId(quoteId);
        const changeRecord = records.find(r => r.id === recordId);
        if (!changeRecord) {
            throw new Error('CHANGE_RECORD_NOT_FOUND');
        }
        if (quote.status !== types_1.QuoteStatus.PENDING_SUPPLEMENT) {
            throw new Error('INVALID_STATUS');
        }
        const now = new Date();
        changeRecord.reviewResult = approved ? types_1.ReviewResult.APPROVED : types_1.ReviewResult.REJECTED;
        changeRecord.reviewedBy = reviewer;
        changeRecord.reviewedAt = now;
        changeRecord.reviewNotes = notes;
        if (approved) {
            quote.status = types_1.QuoteStatus.CUSTOMER_ACCEPTED;
            quote.statusHistory.push({
                status: types_1.QuoteStatus.CUSTOMER_ACCEPTED,
                changedAt: now,
                changedBy: reviewer,
                notes: '客户确认接受追加报价'
            });
        }
        else {
            quote.status = types_1.QuoteStatus.REJECTED;
            quote.rejectionReason = notes || '客户拒绝追加报价';
            quote.statusHistory.push({
                status: types_1.QuoteStatus.REJECTED,
                changedAt: now,
                changedBy: reviewer,
                notes: '客户拒绝追加报价'
            });
        }
        quote.updatedAt = now;
        database_1.db.updateQuote(quoteId, quote);
        database_1.db.updateChangeRecord(recordId, changeRecord);
        return { quote, changeRecord };
    }
    async completeQuote(quoteId, operator) {
        const quote = database_1.db.getQuoteById(quoteId);
        if (!quote) {
            throw new Error('QUOTE_NOT_FOUND');
        }
        if (quote.status !== types_1.QuoteStatus.CUSTOMER_ACCEPTED) {
            throw new Error('INVALID_STATUS');
        }
        const now = new Date();
        quote.status = types_1.QuoteStatus.COMPLETED;
        quote.statusHistory.push({
            status: types_1.QuoteStatus.COMPLETED,
            changedAt: now,
            changedBy: operator,
            notes: '维修完成'
        });
        quote.updatedAt = now;
        database_1.db.updateQuote(quoteId, quote);
        return quote;
    }
    async getChangeRecords(quoteId) {
        return database_1.db.getChangeRecordsByQuoteId(quoteId);
    }
    validateQuoteConsistency(quote) {
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
exports.QuoteService = QuoteService;
exports.quoteService = new QuoteService();
