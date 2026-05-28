import { z } from 'zod';
import type { Currency, DiscountStatus } from './types';

export const CurrencySchema = z.enum(['USD', 'EUR', 'CNY']) as z.ZodType<Currency>;

export const DiscountStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'DISCOUNTED',
  'PARTIALLY_SETTLED',
  'FULLY_SETTLED',
  'COMPLETED',
]) as z.ZodType<DiscountStatus>;

export const ExchangeRateSchema = z.object({
  fromCurrency: CurrencySchema,
  toCurrency: CurrencySchema,
  rate: z.number().positive(),
  rateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'rateDate must be in YYYY-MM-DD format'),
  source: z.string().min(1),
});

export const CreateInvoiceDiscountSchema = z.object({
  invoiceNumber: z.string().min(1, '发票号码不能为空'),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invoiceDate must be in YYYY-MM-DD format'),
  invoiceAmount: z.number().positive('发票金额必须大于0'),
  invoiceCurrency: CurrencySchema,
  discountRate: z.number().positive('贴现利率必须大于0'),
  discountDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'discountDate must be in YYYY-MM-DD format'),
  discountDays: z.number().int().positive('贴现天数必须大于0'),
  exchangeRateToCNY: ExchangeRateSchema.optional(),
  exchangeRatePaymentToCNY: ExchangeRateSchema.optional(),
});

export const UpdateInvoiceDiscountSchema = z.object({
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invoiceDate must be in YYYY-MM-DD format').optional(),
  invoiceAmount: z.number().positive('发票金额必须大于0').optional(),
  invoiceCurrency: CurrencySchema.optional(),
  discountRate: z.number().positive('贴现利率必须大于0').optional(),
  discountDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'discountDate must be in YYYY-MM-DD format').optional(),
  discountDays: z.number().int().positive('贴现天数必须大于0').optional(),
  exchangeRateToCNY: ExchangeRateSchema.optional(),
  exchangeRatePaymentToCNY: ExchangeRateSchema.optional(),
  revisionReason: z.string().min(1, '修正原因不能为空'),
  operator: z.string().min(1, '操作人不能为空'),
});

export const AdvanceStatusSchema = z.object({
  targetStatus: DiscountStatusSchema,
  operator: z.string().min(1, '操作人不能为空'),
  remark: z.string().optional(),
  partialDiscountAmount: z.number().positive().optional(),
  partialDiscountRate: z.number().positive().optional(),
});

export const CreatePaymentSchema = z.object({
  invoiceDiscountId: z.string().min(1),
  paymentAmount: z.number().positive('回款金额必须大于0'),
  paymentCurrency: CurrencySchema,
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'paymentDate must be in YYYY-MM-DD format'),
  bankReceiptId: z.string().min(1).optional(),
});

export const CreateBankReceiptSchema = z.object({
  receiptNumber: z.string().min(1, '回执号码不能为空'),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'receiptDate must be in YYYY-MM-DD format'),
  amount: z.number().positive('回执金额必须大于0'),
  currency: CurrencySchema,
  invoiceDiscountId: z.string().min(1).optional(),
});

export const DiscountCalculateSchema = z.object({
  invoiceAmount: z.number().positive('发票金额必须大于0'),
  invoiceCurrency: CurrencySchema,
  discountRate: z.number().positive('贴现利率必须大于0'),
  discountDays: z.number().int().positive('贴现天数必须大于0'),
  exchangeRateToCNY: ExchangeRateSchema,
  interestCurrency: CurrencySchema.default('CNY'),
});

export type CreateInvoiceDiscountInput = z.infer<typeof CreateInvoiceDiscountSchema>;
export type UpdateInvoiceDiscountInput = z.infer<typeof UpdateInvoiceDiscountSchema>;
export type AdvanceStatusInput = z.infer<typeof AdvanceStatusSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type CreateBankReceiptInput = z.infer<typeof CreateBankReceiptSchema>;
export type DiscountCalculateInput = z.infer<typeof DiscountCalculateSchema>;

export function validateRequiredFields(input: Record<string, unknown>): string[] {
  const requiredFields = [
    'invoiceNumber',
    'invoiceDate',
    'invoiceAmount',
    'invoiceCurrency',
    'discountRate',
    'discountDate',
    'discountDays',
  ];

  const missing: string[] = [];
  for (const field of requiredFields) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      missing.push(field);
    }
  }

  return missing;
}

export function validatePaymentRequiredFields(input: Record<string, unknown>): string[] {
  const requiredFields = [
    'invoiceDiscountId',
    'paymentAmount',
    'paymentCurrency',
    'paymentDate',
  ];

  const missing: string[] = [];
  for (const field of requiredFields) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      missing.push(field);
    }
  }

  return missing;
}

export function validateBankReceiptRequiredFields(input: Record<string, unknown>): string[] {
  const requiredFields = [
    'receiptNumber',
    'receiptDate',
    'amount',
    'currency',
  ];

  const missing: string[] = [];
  for (const field of requiredFields) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      missing.push(field);
    }
  }

  return missing;
}

export function validateExchangeRateDate(
  rateDate: string,
  referenceDate: string,
  maxDaysDiff: number = 3
): { valid: boolean; message: string } {
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

export function validateDateOrder(
  earlierDate: string,
  laterDate: string,
  earlierLabel: string,
  laterLabel: string
): { valid: boolean; message: string } {
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
