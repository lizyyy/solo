"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscountCalculateSchema = exports.CreateBankReceiptSchema = exports.CreatePaymentSchema = exports.AdvanceStatusSchema = exports.UpdateInvoiceDiscountSchema = exports.CreateInvoiceDiscountSchema = exports.ExchangeRateSchema = exports.DiscountStatusSchema = exports.CurrencySchema = void 0;
exports.validateRequiredFields = validateRequiredFields;
exports.validateExchangeRateDate = validateExchangeRateDate;
exports.validateDateOrder = validateDateOrder;
const zod_1 = require("zod");
exports.CurrencySchema = zod_1.z.enum(['USD', 'EUR', 'CNY']);
exports.DiscountStatusSchema = zod_1.z.enum([
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'DISCOUNTED',
    'PARTIALLY_SETTLED',
    'FULLY_SETTLED',
    'COMPLETED',
]);
exports.ExchangeRateSchema = zod_1.z.object({
    fromCurrency: exports.CurrencySchema,
    toCurrency: exports.CurrencySchema,
    rate: zod_1.z.number().positive(),
    rateDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'rateDate must be in YYYY-MM-DD format'),
    source: zod_1.z.string().min(1),
});
exports.CreateInvoiceDiscountSchema = zod_1.z.object({
    invoiceNumber: zod_1.z.string().min(1, '发票号码不能为空'),
    invoiceDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invoiceDate must be in YYYY-MM-DD format'),
    invoiceAmount: zod_1.z.number().positive('发票金额必须大于0'),
    invoiceCurrency: exports.CurrencySchema,
    discountRate: zod_1.z.number().positive('贴现利率必须大于0'),
    discountDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'discountDate must be in YYYY-MM-DD format'),
    discountDays: zod_1.z.number().int().positive('贴现天数必须大于0'),
    exchangeRateToCNY: exports.ExchangeRateSchema.optional(),
    exchangeRatePaymentToCNY: exports.ExchangeRateSchema.optional(),
});
exports.UpdateInvoiceDiscountSchema = zod_1.z.object({
    invoiceDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invoiceDate must be in YYYY-MM-DD format').optional(),
    invoiceAmount: zod_1.z.number().positive('发票金额必须大于0').optional(),
    invoiceCurrency: exports.CurrencySchema.optional(),
    discountRate: zod_1.z.number().positive('贴现利率必须大于0').optional(),
    discountDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'discountDate must be in YYYY-MM-DD format').optional(),
    discountDays: zod_1.z.number().int().positive('贴现天数必须大于0').optional(),
    exchangeRateToCNY: exports.ExchangeRateSchema.optional(),
    exchangeRatePaymentToCNY: exports.ExchangeRateSchema.optional(),
    revisionReason: zod_1.z.string().min(1, '修正原因不能为空'),
    operator: zod_1.z.string().min(1, '操作人不能为空'),
});
exports.AdvanceStatusSchema = zod_1.z.object({
    targetStatus: exports.DiscountStatusSchema,
    operator: zod_1.z.string().min(1, '操作人不能为空'),
    remark: zod_1.z.string().optional(),
    partialDiscountAmount: zod_1.z.number().positive().optional(),
    partialDiscountRate: zod_1.z.number().positive().optional(),
});
exports.CreatePaymentSchema = zod_1.z.object({
    invoiceDiscountId: zod_1.z.string().min(1),
    paymentAmount: zod_1.z.number().positive('回款金额必须大于0'),
    paymentCurrency: exports.CurrencySchema,
    paymentDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'paymentDate must be in YYYY-MM-DD format'),
    bankReceiptId: zod_1.z.string().min(1).optional(),
});
exports.CreateBankReceiptSchema = zod_1.z.object({
    receiptNumber: zod_1.z.string().min(1, '回执号码不能为空'),
    receiptDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'receiptDate must be in YYYY-MM-DD format'),
    amount: zod_1.z.number().positive('回执金额必须大于0'),
    currency: exports.CurrencySchema,
    invoiceDiscountId: zod_1.z.string().min(1).optional(),
});
exports.DiscountCalculateSchema = zod_1.z.object({
    invoiceAmount: zod_1.z.number().positive('发票金额必须大于0'),
    invoiceCurrency: exports.CurrencySchema,
    discountRate: zod_1.z.number().positive('贴现利率必须大于0'),
    discountDays: zod_1.z.number().int().positive('贴现天数必须大于0'),
    exchangeRateToCNY: exports.ExchangeRateSchema,
    interestCurrency: exports.CurrencySchema.default('CNY'),
});
function validateRequiredFields(input) {
    const requiredFields = [
        'invoiceNumber',
        'invoiceDate',
        'invoiceAmount',
        'invoiceCurrency',
        'discountRate',
        'discountDate',
        'discountDays',
    ];
    const missing = [];
    for (const field of requiredFields) {
        if (input[field] === undefined || input[field] === null || input[field] === '') {
            missing.push(field);
        }
    }
    return missing;
}
function validateExchangeRateDate(rateDate, referenceDate, maxDaysDiff = 3) {
    const rate = new Date(rateDate);
    const reference = new Date(referenceDate);
    const diffTime = Math.abs(reference.getTime() - rate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > maxDaysDiff) {
        return {
            valid: false,
            message: `汇率日期(${rateDate})与贴现日期(${referenceDate})相差${diffDays}天，超过最大允许${maxDaysDiff}天`,
        };
    }
    return { valid: true, message: '' };
}
function validateDateOrder(earlierDate, laterDate, earlierLabel, laterLabel) {
    const earlier = new Date(earlierDate);
    const later = new Date(laterDate);
    if (earlier > later) {
        return {
            valid: false,
            message: `${earlierLabel}(${earlierDate})不能晚于${laterLabel}(${laterDate})`,
        };
    }
    return { valid: true, message: '' };
}
