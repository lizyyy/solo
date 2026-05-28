import express, { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { ApiResponse, Currency, InvoiceDiscount, RevisionEntry } from './types';
import {
  CreateInvoiceDiscountSchema,
  UpdateInvoiceDiscountSchema,
  AdvanceStatusSchema,
  CreatePaymentSchema,
  CreateBankReceiptSchema,
  DiscountCalculateSchema,
  validateRequiredFields,
  validatePaymentRequiredFields,
  validateBankReceiptRequiredFields,
  validateExchangeRateDate,
  validateDateOrder,
  type CreateInvoiceDiscountInput,
  type UpdateInvoiceDiscountInput,
  type AdvanceStatusInput,
  type CreatePaymentInput,
  type CreateBankReceiptInput,
  type DiscountCalculateInput,
} from './validation';
import { storage } from './storage';
import { calculateDiscount, calculatePartialDiscount, generateProfitReport, validateStatusTransition } from './discount';
import { generateCSVExport, generateJSONExport, generateExportFilename, type ExportData } from './export';

const router = express.Router();

function successResponse<T>(data: T, warnings: string[] = [], missingFields: string[] = []): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    warnings,
    missingFields,
  };
}

function errorResponse<T>(error: string, warnings: string[] = [], missingFields: string[] = []): ApiResponse<T> {
  return {
    success: false,
    data: null,
    error,
    warnings,
    missingFields,
  };
}

router.post('/calculate', (req: Request, res: Response) => {
  try {
    const validated = DiscountCalculateSchema.parse(req.body) as DiscountCalculateInput;

    const result = calculateDiscount({
      invoiceAmount: validated.invoiceAmount,
      invoiceCurrency: validated.invoiceCurrency,
      discountRate: validated.discountRate,
      discountDays: validated.discountDays,
      exchangeRateToCNY: validated.exchangeRateToCNY,
      interestCurrency: validated.interestCurrency,
      referenceDate: new Date().toISOString().split('T')[0],
    });

    res.json(successResponse(result, result.warnings));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json(errorResponse(`参数验证失败: ${err.issues.map((e: z.ZodIssue) => e.message).join(', ')}`));
    } else {
      res.status(500).json(errorResponse('计算失败'));
    }
  }
});

router.post('/invoices', (req: Request, res: Response) => {
  try {
    const missingFields = validateRequiredFields(req.body);

    if (missingFields.length > 0) {
      res.status(400).json(
        errorResponse(
          `缺少必填字段: ${missingFields.join(', ')}`,
          [],
          missingFields
        )
      );
      return;
    }

    const validated = CreateInvoiceDiscountSchema.parse(req.body) as CreateInvoiceDiscountInput;

    const warnings: string[] = [];

    const dateOrderResult = validateDateOrder(
      validated.invoiceDate,
      validated.discountDate,
      '发票日期',
      '贴现日期'
    );
    if (!dateOrderResult.valid) {
      warnings.push(dateOrderResult.message);
    }

    if (validated.exchangeRateToCNY) {
      const rateDateResult = validateExchangeRateDate(
        validated.exchangeRateToCNY.rateDate,
        validated.discountDate
      );
      if (!rateDateResult.valid) {
        warnings.push(rateDateResult.message);
      }
    }

    if (validated.exchangeRatePaymentToCNY) {
      const rateDateResult = validateExchangeRateDate(
        validated.exchangeRatePaymentToCNY.rateDate,
        validated.discountDate
      );
      if (!rateDateResult.valid) {
        warnings.push(rateDateResult.message);
      }
    }

    const existingInvoices = storage.getInvoices({ invoiceNumber: validated.invoiceNumber });
    if (existingInvoices.length > 0) {
      warnings.push(`发票号码${validated.invoiceNumber}已存在，请注意是否重复录入`);
    }

    const invoice = storage.createInvoice({
      ...validated,
      discountStatus: 'DRAFT',
      exchangeRateToCNY: validated.exchangeRateToCNY ?? null,
      exchangeRatePaymentToCNY: validated.exchangeRatePaymentToCNY ?? null,
      missingFields,
      revisionHistory: [],
      partialDiscountDetails: [],
      totalDiscountedAmount: 0,
      remainingUndiscountedAmount: validated.invoiceAmount,
    });

    res.status(201).json(successResponse(invoice, warnings, missingFields));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json(errorResponse(`参数验证失败: ${err.issues.map((e: z.ZodIssue) => e.message).join(', ')}`));
    } else {
      res.status(500).json(errorResponse('创建发票贴现记录失败'));
    }
  }
});

router.get('/invoices', (req: Request, res: Response) => {
  try {
    const { status, invoiceNumber, currency, dateFrom, dateTo } = req.query;

    const filters = {
      status: status as string | undefined,
      invoiceNumber: invoiceNumber as string | undefined,
      currency: currency as Currency | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    };

    const invoices = storage.getInvoices(filters);
    res.json(successResponse(invoices));
  } catch (err) {
    res.status(500).json(errorResponse('查询发票贴现记录失败'));
  }
});

router.get('/invoices/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const invoice = storage.getInvoice(id);

    if (!invoice) {
      res.status(404).json(errorResponse('发票贴现记录不存在'));
      return;
    }

    const payments = storage.getPaymentsByInvoice(id);
    const receipts = storage.getBankReceiptsByInvoice(id);
    const reports = storage.getProfitReportsByInvoice(id);

    res.json(
      successResponse({
        invoice,
        payments,
        receipts,
        profitReports: reports,
      })
    );
  } catch (err) {
    res.status(500).json(errorResponse('查询发票贴现详情失败'));
  }
});

router.put('/invoices/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const invoice = storage.getInvoice(id);

    if (!invoice) {
      res.status(404).json(errorResponse('发票贴现记录不存在'));
      return;
    }

    const validated = UpdateInvoiceDiscountSchema.parse(req.body) as UpdateInvoiceDiscountInput;

    const { revisionReason, operator, ...updates } = validated;

    const warnings: string[] = [];
    const revisionEntries: RevisionEntry[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && value !== null) {
        const oldValue = (invoice as unknown as Record<string, unknown>)[key];
        if (oldValue !== value) {
          revisionEntries.push({
            id: uuidv4(),
            revisionDate: new Date().toISOString(),
            fieldName: key,
            oldValue,
            newValue: value,
            reason: revisionReason,
            operator,
          });
        }
      }
    }

    if (updates.invoiceDate && updates.discountDate) {
      const dateOrderResult = validateDateOrder(
        updates.invoiceDate,
        updates.discountDate,
        '发票日期',
        '贴现日期'
      );
      if (!dateOrderResult.valid) {
        warnings.push(dateOrderResult.message);
      }
    }

    if (updates.exchangeRateToCNY) {
      const rateDateResult = validateExchangeRateDate(
        updates.exchangeRateToCNY.rateDate,
        invoice.discountDate
      );
      if (!rateDateResult.valid) {
        warnings.push(rateDateResult.message);
      }
    }

    const newMissingFields = invoice.missingFields.filter(
      f => !Object.keys(updates).includes(f)
    );

    const updated = storage.updateInvoice(id, {
      ...updates,
      revisionHistory: [...invoice.revisionHistory, ...revisionEntries],
      missingFields: newMissingFields,
    });

    res.json(successResponse(updated, warnings, newMissingFields));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json(errorResponse(`参数验证失败: ${err.issues.map((e: z.ZodIssue) => e.message).join(', ')}`));
    } else {
      res.status(500).json(errorResponse('修正发票贴现记录失败'));
    }
  }
});

router.post('/invoices/:id/advance', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const invoice = storage.getInvoice(id);

    if (!invoice) {
      res.status(404).json(errorResponse('发票贴现记录不存在'));
      return;
    }

    const validated = AdvanceStatusSchema.parse(req.body) as AdvanceStatusInput;

    const statusValidation = validateStatusTransition(invoice.discountStatus, validated.targetStatus);
    if (!statusValidation.valid) {
      res.status(400).json(errorResponse(statusValidation.message));
      return;
    }

    const warnings: string[] = [];
    let updatedInvoice: InvoiceDiscount = invoice;

    if (validated.targetStatus === 'PARTIALLY_SETTLED') {
      if (!validated.partialDiscountAmount || !validated.partialDiscountRate) {
        res.status(400).json(errorResponse('部分贴现需要提供partialDiscountAmount和partialDiscountRate'));
        return;
      }

      const partialResult = calculatePartialDiscount(
        invoice,
        validated.partialDiscountAmount,
        validated.partialDiscountRate,
        invoice.discountDate
      );

      updatedInvoice = partialResult.updatedInvoice;
      warnings.push(...partialResult.warnings);
    }

    if (validated.targetStatus === 'DISCOUNTED' || validated.targetStatus === 'FULLY_SETTLED') {
      if (invoice.remainingUndiscountedAmount > 0 && validated.targetStatus === 'DISCOUNTED') {
        const fullDiscount = calculatePartialDiscount(
          updatedInvoice,
          updatedInvoice.remainingUndiscountedAmount,
          updatedInvoice.discountRate,
          updatedInvoice.discountDate
        );
        updatedInvoice = fullDiscount.updatedInvoice;
        warnings.push(...fullDiscount.warnings);
      }

      const matchResult = storage.autoMatchPayments(id);
      warnings.push(...matchResult.warnings);

      if (matchResult.matchedPayments.length === 0) {
        warnings.push('未找到可自动匹配的回款，请手动匹配');
      }
    }

    if (validated.targetStatus === 'COMPLETED') {
      if (updatedInvoice.remainingUndiscountedAmount > 0) {
        res.status(400).json(errorResponse(`还有${updatedInvoice.remainingUndiscountedAmount} ${updatedInvoice.invoiceCurrency}未贴现，无法标记为完成`));
        return;
      }

      const payments = storage.getPaymentsByInvoice(id);
      const totalMatched = payments.reduce((sum, p) => sum + p.matchedAmount, 0);
      const totalPayment = payments.reduce((sum, p) => sum + p.paymentAmount, 0);

      if (Math.abs(totalMatched - totalPayment) > 0.01) {
        warnings.push(`仍有${totalPayment - totalMatched}未匹配的回款`);
      }
    }

    updatedInvoice = storage.updateInvoice(id, {
      ...updatedInvoice,
      discountStatus: validated.targetStatus,
    })!;

    res.json(successResponse(updatedInvoice, warnings));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json(errorResponse(`参数验证失败: ${err.issues.map((e: z.ZodIssue) => e.message).join(', ')}`));
    } else {
      res.status(500).json(errorResponse('推进状态失败'));
    }
  }
});

router.post('/invoices/:id/export', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { format = 'csv', includeProfitReport = true } = req.body;

    const invoice = storage.getInvoice(id);
    if (!invoice) {
      res.status(404).json(errorResponse('发票贴现记录不存在'));
      return;
    }

    const payments = storage.getPaymentsByInvoice(id);
    const receipts = storage.getBankReceiptsByInvoice(id);
    const reports = storage.getProfitReportsByInvoice(id);

    const exportData: ExportData = {
      invoice,
      payments,
      receipts,
      profitReport: includeProfitReport && reports.length > 0 ? reports[reports.length - 1] : undefined,
    };

    const filename = generateExportFilename(invoice.invoiceNumber, format as 'csv' | 'json');

    if (format === 'csv') {
      const csv = generateCSVExport(exportData);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } else {
      const json = generateJSONExport(exportData);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(json);
    }
  } catch (err) {
    res.status(500).json(errorResponse('导出失败'));
  }
});

router.post('/payments', (req: Request, res: Response) => {
  try {
    const missingFields = validatePaymentRequiredFields(req.body);

    if (missingFields.length > 0) {
      res.status(400).json(
        errorResponse(
          `缺少必填字段: ${missingFields.join(', ')}`,
          [],
          missingFields
        )
      );
      return;
    }

    const validated = CreatePaymentSchema.parse(req.body) as CreatePaymentInput;

    const invoice = storage.getInvoice(validated.invoiceDiscountId);
    if (!invoice) {
      res.status(404).json(errorResponse('关联的发票贴现记录不存在'));
      return;
    }

    const warnings: string[] = [];

    const dateOrderResult = validateDateOrder(
      invoice.invoiceDate,
      validated.paymentDate,
      '发票日期',
      '回款日期'
    );
    if (!dateOrderResult.valid) {
      warnings.push(dateOrderResult.message);
    }

    if (validated.bankReceiptId) {
      const receipt = storage.getBankReceipt(validated.bankReceiptId);
      if (!receipt) {
        warnings.push(`银行回执${validated.bankReceiptId}不存在`);
      } else if (receipt.isDuplicate) {
        warnings.push(`银行回执${validated.bankReceiptId}已被标记为重复，建议谨慎使用`);
      }
    }

    const paymentData = {
      ...validated,
      bankReceiptId: validated.bankReceiptId ?? null,
    };
    const payment = storage.createPayment(paymentData);

    res.status(201).json(successResponse(payment, warnings));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json(errorResponse(`参数验证失败: ${err.issues.map((e: z.ZodIssue) => e.message).join(', ')}`));
    } else {
      res.status(500).json(errorResponse('创建回款记录失败'));
    }
  }
});

router.get('/payments', (_req: Request, res: Response) => {
  try {
    const payments = storage.getAllPayments();
    res.json(successResponse(payments));
  } catch (err) {
    res.status(500).json(errorResponse('查询回款记录失败'));
  }
});

router.post('/payments/:id/match', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { invoiceId, amount } = req.body;

    if (!invoiceId || !amount || amount <= 0) {
      res.status(400).json(errorResponse('需要提供invoiceId和有效的匹配金额amount'));
      return;
    }

    const result = storage.matchPaymentToInvoice(id, invoiceId, amount);

    if (!result) {
      res.status(400).json(errorResponse('匹配失败，请检查支付、发票和金额是否有效'));
      return;
    }

    res.json(successResponse(result));
  } catch (err) {
    res.status(500).json(errorResponse('匹配回款失败'));
  }
});

router.post('/bank-receipts', (req: Request, res: Response) => {
  try {
    const missingFields = validateBankReceiptRequiredFields(req.body);

    if (missingFields.length > 0) {
      res.status(400).json(
        errorResponse(
          `缺少必填字段: ${missingFields.join(', ')}`,
          [],
          missingFields
        )
      );
      return;
    }

    const validated = CreateBankReceiptSchema.parse(req.body) as CreateBankReceiptInput;

    const warnings: string[] = [];

    if (validated.invoiceDiscountId) {
      const invoice = storage.getInvoice(validated.invoiceDiscountId);
      if (!invoice) {
        warnings.push(`关联的发票贴现记录${validated.invoiceDiscountId}不存在`);
      }
    }

    const receiptData = {
      ...validated,
      invoiceDiscountId: validated.invoiceDiscountId ?? null,
    };
    const result = storage.createBankReceipt(receiptData);

    if (result.isDuplicate) {
      warnings.push(`检测到重复回执，原始回执ID: ${result.duplicateOf}`);
    }

    res.status(201).json(
      successResponse(
        {
          receipt: result.receipt,
          isDuplicate: result.isDuplicate,
          duplicateOf: result.duplicateOf,
        },
        warnings
      )
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json(errorResponse(`参数验证失败: ${err.issues.map((e: z.ZodIssue) => e.message).join(', ')}`));
    } else {
      res.status(500).json(errorResponse('导入银行回执失败'));
    }
  }
});

router.get('/bank-receipts', (_req: Request, res: Response) => {
  try {
    const receipts = storage.getAllBankReceipts();
    res.json(successResponse(receipts));
  } catch (err) {
    res.status(500).json(errorResponse('查询银行回执失败'));
  }
});

router.post('/invoices/:id/profit-report', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { bankFeesCNY = 0 } = req.body;

    const invoice = storage.getInvoice(id);
    if (!invoice) {
      res.status(404).json(errorResponse('发票贴现记录不存在'));
      return;
    }

    const payments = storage.getPaymentsByInvoice(id);
    const paymentData = payments.map(p => ({
      amount: p.paymentAmount,
      currency: p.paymentCurrency,
      date: p.paymentDate,
    }));

    const result = generateProfitReport(invoice, paymentData, bankFeesCNY);

    const savedReport = storage.createProfitReport(result.report);

    res.json(successResponse(savedReport, result.warnings));
  } catch (err) {
    res.status(500).json(errorResponse('生成收益报告失败'));
  }
});

router.get('/invoices/:id/profit-report', (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const reports = storage.getProfitReportsByInvoice(id);
    res.json(successResponse(reports));
  } catch (err) {
    res.status(500).json(errorResponse('查询收益报告失败'));
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: '跨币种发票贴现 API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;
