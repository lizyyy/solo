import { 
  Invoice, 
  ValidationOptions, 
  ValidationResult,
  ValidationError,
  ValidationErrorType,
  DuplicateGroup,
  RedInvoiceRelation
} from '../types/invoice';
import { 
  createInvoiceKey, 
  calculateTotalAmount,
  isValidInvoiceNumber,
  isValidInvoiceCode,
  isValidDate
} from '../utils/helpers';

const DEFAULT_OPTIONS: ValidationOptions = {
  checkDuplicates: true,
  checkRedInvoices: true,
  checkAmountConsistency: true,
  strictMode: false
};

export class ValidationService {
  private options: ValidationOptions;

  constructor(options?: Partial<ValidationOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async validate(invoices: Invoice[], existingInvoices: Invoice[] = []): Promise<ValidationResult> {
    const startTime = Date.now();
    const allInvoices = [...existingInvoices, ...invoices];
    
    const errors: ValidationError[] = [];
    const duplicateGroups: DuplicateGroup[] = [];
    const redInvoiceRelations: RedInvoiceRelation[] = [];

    for (const invoice of invoices) {
      invoice.validationErrors = invoice.validationErrors || [];
      
      this.validateBasicFields(invoice, errors);
      
      if (this.options.checkAmountConsistency) {
        this.validateAmountConsistency(invoice, errors);
      }
    }

    if (this.options.checkDuplicates) {
      const foundDuplicates = this.findDuplicates(allInvoices, invoices);
      duplicateGroups.push(...foundDuplicates);
      
      for (const group of foundDuplicates) {
        for (const inv of group.invoices) {
          if (!inv.validationErrors?.some(e => e.type === 'DUPLICATE_INVOICE')) {
            inv.validationErrors?.push({
              type: 'DUPLICATE_INVOICE',
              message: `发现重复发票，组内共 ${group.invoices.length} 张`,
              relatedInvoiceId: group.invoices.find(i => i.id !== inv.id)?.id
            });
            errors.push({
              type: 'DUPLICATE_INVOICE',
              message: `发票 ${inv.invoiceCode}-${inv.invoiceNumber} 存在重复`,
              relatedInvoiceId: inv.id
            });
          }
        }
      }
    }

    if (this.options.checkRedInvoices) {
      const redInvoices = invoices.filter(inv => inv.isRedInvoice);
      for (const redInvoice of redInvoices) {
        const relation = this.validateRedInvoice(redInvoice, allInvoices);
        redInvoiceRelations.push(relation);
        
        if (!relation.isValid) {
          redInvoice.validationErrors?.push({
            type: 'RED_INVOICE_WITHOUT_ORIGINAL',
            message: relation.reason || '红冲发票校验失败'
          });
          errors.push({
            type: 'RED_INVOICE_WITHOUT_ORIGINAL',
            message: `红冲发票 ${redInvoice.invoiceCode}-${redInvoice.invoiceNumber}: ${relation.reason}`,
            relatedInvoiceId: redInvoice.id
          });
        }
      }
    }

    const invalidInvoices = invoices.filter(
      inv => inv.validationErrors && inv.validationErrors.length > 0
    ).length;

    const processingTime = Date.now() - startTime;

    return {
      totalInvoices: invoices.length,
      validInvoices: invoices.length - invalidInvoices,
      invalidInvoices,
      duplicateGroups,
      redInvoiceRelations,
      errors,
      processingTime,
      batchId: invoices[0]?.importBatchId || ''
    };
  }

  private validateBasicFields(invoice: Invoice, errors: ValidationError[]): void {
    if (!isValidInvoiceNumber(invoice.invoiceNumber)) {
      const error: ValidationError = {
        type: 'INVALID_INVOICE_NUMBER',
        message: `发票号码格式无效: ${invoice.invoiceNumber}`,
        field: 'invoiceNumber',
        relatedInvoiceId: invoice.id
      };
      invoice.validationErrors?.push(error);
      errors.push(error);
    }

    if (!isValidInvoiceCode(invoice.invoiceCode)) {
      const error: ValidationError = {
        type: 'INVALID_INVOICE_CODE',
        message: `发票代码格式无效: ${invoice.invoiceCode}`,
        field: 'invoiceCode',
        relatedInvoiceId: invoice.id
      };
      invoice.validationErrors?.push(error);
      errors.push(error);
    }

    if (invoice.invoiceDate && !isValidDate(invoice.invoiceDate)) {
      const error: ValidationError = {
        type: 'INVALID_DATE',
        message: `开票日期格式无效: ${invoice.invoiceDate}`,
        field: 'invoiceDate',
        relatedInvoiceId: invoice.id
      };
      invoice.validationErrors?.push(error);
      errors.push(error);
    }

    if (!this.options.strictMode) {
      if (!invoice.invoiceDate) {
        invoice.invoiceDate = '';
      }
    }
  }

  private validateAmountConsistency(invoice: Invoice, errors: ValidationError[]): void {
    const calculatedTotal = calculateTotalAmount(invoice.amount, invoice.taxAmount);
    const tolerance = 0.01;

    if (invoice.totalAmount !== 0 && Math.abs(calculatedTotal - invoice.totalAmount) > tolerance) {
      const error: ValidationError = {
        type: 'AMOUNT_TOTAL_MISMATCH',
        message: `金额不一致: 计算值 ${calculatedTotal.toFixed(2)} ≠ 申报值 ${invoice.totalAmount.toFixed(2)}`,
        field: 'totalAmount',
        relatedInvoiceId: invoice.id
      };
      invoice.validationErrors?.push(error);
      errors.push(error);
    }
  }

  private findDuplicates(
    allInvoices: Invoice[],
    currentBatchInvoices: Invoice[]
  ): DuplicateGroup[] {
    const invoiceMap = new Map<string, Invoice[]>();
    const groups: DuplicateGroup[] = [];
    const currentBatchIds = new Set(currentBatchInvoices.map(inv => inv.id));

    for (const invoice of allInvoices) {
      const key = createInvoiceKey(invoice.invoiceCode, invoice.invoiceNumber);
      if (!invoiceMap.has(key)) {
        invoiceMap.set(key, []);
      }
      invoiceMap.get(key)!.push(invoice);
    }

    for (const [key, invoices] of invoiceMap) {
      if (invoices.length > 1) {
        const hasCurrentBatchInvoice = invoices.some(inv => currentBatchIds.has(inv.id));
        if (hasCurrentBatchInvoice) {
          const recommendedInvoice = this.selectRecommendedInvoice(invoices);
          groups.push({
            key,
            invoices,
            recommendedInvoice
          });
        }
      }
    }

    return groups;
  }

  private selectRecommendedInvoice(invoices: Invoice[]): Invoice {
    const scores = invoices.map(inv => {
      let score = 0;
      if (inv.invoiceDate) score += 10;
      if (inv.sellerName) score += 5;
      if (inv.buyerName) score += 5;
      if (inv.amount > 0) score += 5;
      if (inv.importTime) {
        score += 1;
      }
      return { invoice: inv, score };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores[0].invoice;
  }

  private validateRedInvoice(
    redInvoice: Invoice,
    allInvoices: Invoice[]
  ): RedInvoiceRelation {
    if (redInvoice.originalInvoiceNumber && redInvoice.originalInvoiceCode) {
      const originalKey = createInvoiceKey(
        redInvoice.originalInvoiceCode,
        redInvoice.originalInvoiceNumber
      );
      
      const originalInvoice = allInvoices.find(inv => {
        const key = createInvoiceKey(inv.invoiceCode, inv.invoiceNumber);
        return key === originalKey && !inv.isRedInvoice;
      });

      if (originalInvoice) {
        const absRedTotal = Math.abs(redInvoice.totalAmount);
        const absOriginalTotal = Math.abs(originalInvoice.totalAmount);
        const tolerance = 0.01;

        if (Math.abs(absRedTotal - absOriginalTotal) > tolerance) {
          return {
            redInvoice,
            originalInvoice,
            isValid: false,
            reason: `红冲金额与原票金额不一致: 红冲 ${absRedTotal.toFixed(2)} ≠ 原票 ${absOriginalTotal.toFixed(2)}`
          };
        }

        return {
          redInvoice,
          originalInvoice,
          isValid: true
        };
      } else {
        return {
          redInvoice,
          isValid: false,
          reason: `未找到对应的原发票: ${redInvoice.originalInvoiceCode}-${redInvoice.originalInvoiceNumber}`
        };
      }
    } else {
      return {
        redInvoice,
        isValid: false,
        reason: '红冲发票缺少对应的原发票信息（原票代码或原票号码）'
      };
    }
  }
}

export function createValidationService(
  options?: Partial<ValidationOptions>
): ValidationService {
  return new ValidationService(options);
}
