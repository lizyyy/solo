import type {
  InvoiceDiscount,
  Payment,
  BankReceipt,
  ProfitReport,
  Currency,
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { convertBetweenCurrencies } from './currency';

class Storage {
  private invoices: Map<string, InvoiceDiscount> = new Map();
  private payments: Map<string, Payment> = new Map();
  private bankReceipts: Map<string, BankReceipt> = new Map();
  private profitReports: Map<string, ProfitReport> = new Map();

  constructor() {
    this.seedSampleData();
  }

  createInvoice(invoice: Omit<InvoiceDiscount, 'id' | 'createdAt' | 'updatedAt'>): InvoiceDiscount {
    const now = new Date().toISOString();
    const id = uuidv4();
    const newInvoice: InvoiceDiscount = {
      ...invoice,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.invoices.set(id, newInvoice);
    return newInvoice;
  }

  getInvoice(id: string): InvoiceDiscount | undefined {
    return this.invoices.get(id);
  }

  getInvoices(filters?: {
    status?: string;
    invoiceNumber?: string;
    currency?: Currency;
    dateFrom?: string;
    dateTo?: string;
  }): InvoiceDiscount[] {
    let result = Array.from(this.invoices.values());

    if (filters) {
      if (filters.status) {
        result = result.filter(inv => inv.discountStatus === filters.status);
      }
      if (filters.invoiceNumber) {
        result = result.filter(inv =>
          inv.invoiceNumber.toLowerCase().includes(filters.invoiceNumber!.toLowerCase())
        );
      }
      if (filters.currency) {
        result = result.filter(inv => inv.invoiceCurrency === filters.currency);
      }
      if (filters.dateFrom) {
        result = result.filter(inv => inv.invoiceDate >= filters.dateFrom!);
      }
      if (filters.dateTo) {
        result = result.filter(inv => inv.invoiceDate <= filters.dateTo!);
      }
    }

    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  updateInvoice(id: string, updates: Partial<InvoiceDiscount>): InvoiceDiscount | undefined {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;

    const updated: InvoiceDiscount = {
      ...invoice,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.invoices.set(id, updated);
    return updated;
  }

  deleteInvoice(id: string): boolean {
    return this.invoices.delete(id);
  }

  createPayment(payment: Omit<Payment, 'id' | 'matched' | 'matchedAmount'>): Payment {
    const id = uuidv4();
    const newPayment: Payment = {
      ...payment,
      id,
      matched: false,
      matchedAmount: 0,
    };
    this.payments.set(id, newPayment);
    return newPayment;
  }

  getPayment(id: string): Payment | undefined {
    return this.payments.get(id);
  }

  getPaymentsByInvoice(invoiceId: string): Payment[] {
    return Array.from(this.payments.values()).filter(p => p.invoiceDiscountId === invoiceId);
  }

  getAllPayments(): Payment[] {
    return Array.from(this.payments.values());
  }

  matchPaymentToInvoice(paymentId: string, invoiceId: string, amount: number): Payment | undefined {
    const payment = this.payments.get(paymentId);
    const invoice = this.invoices.get(invoiceId);

    if (!payment || !invoice) return undefined;

    const unmatched = payment.paymentAmount - payment.matchedAmount;
    const matchAmount = Math.min(amount, unmatched, invoice.remainingUndiscountedAmount);

    if (matchAmount <= 0) return undefined;

    const updatedPayment: Payment = {
      ...payment,
      matched: true,
      matchedAmount: payment.matchedAmount + matchAmount,
    };

    this.payments.set(paymentId, updatedPayment);
    return updatedPayment;
  }

  autoMatchPayments(invoiceId: string): {
    matchedPayments: Payment[];
    warnings: string[];
  } {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      return { matchedPayments: [], warnings: ['发票不存在'] };
    }

    const warnings: string[] = [];
    const matchedPayments: Payment[] = [];
    const invoicePayments = this.getPaymentsByInvoice(invoiceId).filter(p => !p.matched);

    let remainingToMatch = invoice.remainingUndiscountedAmount;

    for (const payment of invoicePayments) {
      if (remainingToMatch <= 0) break;

      const unmatched = payment.paymentAmount - payment.matchedAmount;

      if (payment.paymentCurrency !== invoice.invoiceCurrency) {
        if (!invoice.exchangeRatePaymentToCNY || !invoice.exchangeRateToCNY) {
          warnings.push(
            `回款${payment.id}币种(${payment.paymentCurrency})与发票币种(${invoice.invoiceCurrency})不一致，且缺少汇率配置，已跳过自动匹配`
          );
          continue;
        }

        const conversion = convertBetweenCurrencies(
          1,
          payment.paymentCurrency,
          invoice.invoiceCurrency,
          invoice.exchangeRatePaymentToCNY,
          invoice.exchangeRateToCNY,
          invoice.discountDate
        );

        if (conversion.crossRate === 0) {
          warnings.push(
            `回款${payment.id}跨币种换算失败(${payment.paymentCurrency}→${invoice.invoiceCurrency})，已跳过自动匹配`
          );
          continue;
        }

        const paymentInInvoiceCurrency = roundTo2Decimals(unmatched * conversion.crossRate);
        const matchAmountInInvoiceCurrency = Math.min(paymentInInvoiceCurrency, remainingToMatch);
        const matchAmountInPaymentCurrency = roundTo2Decimals(matchAmountInInvoiceCurrency / conversion.crossRate);

        const updatedPayment: Payment = {
          ...payment,
          matched: true,
          matchedAmount: payment.matchedAmount + matchAmountInPaymentCurrency,
        };
        this.payments.set(payment.id, updatedPayment);

        remainingToMatch -= matchAmountInInvoiceCurrency;
        matchedPayments.push(updatedPayment);

        warnings.push(
          `回款${payment.id}跨币种自动匹配: ${matchAmountInPaymentCurrency} ${payment.paymentCurrency} → ${roundTo2Decimals(matchAmountInInvoiceCurrency)} ${invoice.invoiceCurrency} (交叉汇率: ${roundTo6Decimals(conversion.crossRate)})`
        );
        warnings.push(...conversion.warnings);
        continue;
      }

      const matchAmount = Math.min(unmatched, remainingToMatch);

      const result = this.matchPaymentToInvoice(payment.id, invoiceId, matchAmount);
      if (result) {
        matchedPayments.push(result);
        remainingToMatch -= matchAmount;
      }
    }

    if (remainingToMatch > 0 && invoicePayments.length > 0) {
      warnings.push(`仍有${roundTo2Decimals(remainingToMatch)} ${invoice.invoiceCurrency}未匹配`);
    }

    return { matchedPayments, warnings };
  }

  createBankReceipt(
    receipt: Omit<BankReceipt, 'id' | 'importedAt' | 'isDuplicate' | 'duplicateOf'>
  ): { receipt: BankReceipt; isDuplicate: boolean; duplicateOf: string | null } {
    const id = uuidv4();
    const now = new Date().toISOString();

    const duplicateCheck = this.checkForDuplicateReceipt(
      receipt.receiptNumber,
      receipt.amount,
      receipt.currency,
      receipt.receiptDate
    );

    const newReceipt: BankReceipt = {
      ...receipt,
      id,
      importedAt: now,
      isDuplicate: duplicateCheck.isDuplicate,
      duplicateOf: duplicateCheck.duplicateOf,
    };

    this.bankReceipts.set(id, newReceipt);

    return {
      receipt: newReceipt,
      isDuplicate: duplicateCheck.isDuplicate,
      duplicateOf: duplicateCheck.duplicateOf,
    };
  }

  getBankReceipt(id: string): BankReceipt | undefined {
    return this.bankReceipts.get(id);
  }

  getBankReceiptsByInvoice(invoiceId: string): BankReceipt[] {
    return Array.from(this.bankReceipts.values()).filter(r => r.invoiceDiscountId === invoiceId);
  }

  getAllBankReceipts(): BankReceipt[] {
    return Array.from(this.bankReceipts.values());
  }

  checkForDuplicateReceipt(
    receiptNumber: string,
    amount: number,
    currency: Currency,
    receiptDate: string
  ): { isDuplicate: boolean; duplicateOf: string | null } {
    const receipts = Array.from(this.bankReceipts.values());

    for (const existing of receipts) {
      if (existing.isDuplicate) continue;

      const numberMatch =
        receiptNumber.trim().toLowerCase() === existing.receiptNumber.trim().toLowerCase();

      const amountMatch =
        Math.abs(amount - existing.amount) < 0.01 && currency === existing.currency;

      const dateMatch = receiptDate === existing.receiptDate;

      if (numberMatch || (amountMatch && dateMatch)) {
        return { isDuplicate: true, duplicateOf: existing.id };
      }
    }

    return { isDuplicate: false, duplicateOf: null };
  }

  createProfitReport(report: Omit<ProfitReport, 'id'>): ProfitReport {
    const id = uuidv4();
    const newReport: ProfitReport = {
      ...report,
      id,
    };
    this.profitReports.set(id, newReport);
    return newReport;
  }

  getProfitReport(id: string): ProfitReport | undefined {
    return this.profitReports.get(id);
  }

  getProfitReportsByInvoice(invoiceId: string): ProfitReport[] {
    return Array.from(this.profitReports.values()).filter(r => r.invoiceDiscountId === invoiceId);
  }

  private seedSampleData(): void {
    const sampleInvoice: Omit<InvoiceDiscount, 'id' | 'createdAt' | 'updatedAt'> = {
      invoiceNumber: 'INV-2026-001',
      invoiceDate: '2026-05-01',
      invoiceAmount: 100000,
      invoiceCurrency: 'USD',
      discountRate: 3.5,
      discountDate: '2026-05-20',
      discountStatus: 'DRAFT',
      discountDays: 90,
      exchangeRateToCNY: {
        fromCurrency: 'USD',
        toCurrency: 'CNY',
        rate: 7.25,
        rateDate: '2026-05-19',
        source: '中国银行',
      },
      exchangeRatePaymentToCNY: {
        fromCurrency: 'EUR',
        toCurrency: 'CNY',
        rate: 7.85,
        rateDate: '2026-05-19',
        source: '中国银行',
      },
      missingFields: [],
      revisionHistory: [],
      partialDiscountDetails: [],
      totalDiscountedAmount: 0,
      remainingUndiscountedAmount: 100000,
    };

    this.createInvoice(sampleInvoice);

    const samplePayment: Omit<Payment, 'id' | 'matched' | 'matchedAmount'> = {
      invoiceDiscountId: Array.from(this.invoices.keys())[0],
      paymentAmount: 50000,
      paymentCurrency: 'EUR',
      paymentDate: '2026-05-25',
      bankReceiptId: null,
    };

    this.createPayment(samplePayment);
  }
}

function roundTo2Decimals(num: number): number {
  return Math.round(num * 100) / 100;
}

function roundTo6Decimals(num: number): number {
  return Math.round(num * 1000000) / 1000000;
}

export const storage = new Storage();
