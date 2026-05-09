import { Invoice } from '../src/types/invoice';
import { createValidationService } from '../src/services/validationService';
import { generateId, generateBatchId } from '../src/utils/helpers';

function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const batchId = generateBatchId();
  return {
    id: generateId(),
    invoiceNumber: '00012345',
    invoiceCode: '123456789012',
    invoiceDate: '2024-01-15',
    amount: 1000,
    taxAmount: 130,
    totalAmount: 1130,
    sellerName: '测试销售方',
    buyerName: '测试购买方',
    invoiceType: '增值税专用发票',
    status: '正常',
    isRedInvoice: false,
    importBatchId: batchId,
    importTime: new Date(),
    validationErrors: [],
    ...overrides
  };
}

describe('ValidationService', () => {
  describe('Basic Validation', () => {
    it('should validate invoice basic fields', async () => {
      const service = createValidationService();
      const invoice = createMockInvoice();
      
      const result = await service.validate([invoice]);
      
      expect(result.totalInvoices).toBe(1);
      expect(result.validInvoices).toBe(1);
    });

    it('should detect invalid invoice number', async () => {
      const service = createValidationService();
      const invoice = createMockInvoice({ invoiceNumber: '123' });
      
      const result = await service.validate([invoice]);
      
      expect(result.invalidInvoices).toBe(1);
      expect(result.errors.some(e => e.type === 'INVALID_INVOICE_NUMBER')).toBe(true);
    });

    it('should detect invalid invoice code', async () => {
      const service = createValidationService();
      const invoice = createMockInvoice({ invoiceCode: '123' });
      
      const result = await service.validate([invoice]);
      
      expect(result.invalidInvoices).toBe(1);
      expect(result.errors.some(e => e.type === 'INVALID_INVOICE_CODE')).toBe(true);
    });
  });

  describe('Amount Consistency', () => {
    it('should detect amount total mismatch', async () => {
      const service = createValidationService();
      const invoice = createMockInvoice({
        amount: 1000,
        taxAmount: 130,
        totalAmount: 2000
      });
      
      const result = await service.validate([invoice]);
      
      expect(result.invalidInvoices).toBe(1);
      expect(result.errors.some(e => e.type === 'AMOUNT_TOTAL_MISMATCH')).toBe(true);
    });

    it('should pass when amounts are consistent', async () => {
      const service = createValidationService();
      const invoice = createMockInvoice({
        amount: 1000,
        taxAmount: 130,
        totalAmount: 1130
      });
      
      const result = await service.validate([invoice]);
      
      const amountErrors = result.errors.filter(e => e.type === 'AMOUNT_TOTAL_MISMATCH');
      expect(amountErrors.length).toBe(0);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate invoices in same batch', async () => {
      const service = createValidationService();
      const invoice1 = createMockInvoice();
      const invoice2 = createMockInvoice({ id: generateId() });
      
      const result = await service.validate([invoice1, invoice2]);
      
      expect(result.duplicateGroups.length).toBe(1);
      expect(result.duplicateGroups[0].invoices.length).toBe(2);
    });

    it('should detect duplicates with existing invoices', async () => {
      const service = createValidationService();
      const existingInvoice = createMockInvoice();
      const newInvoice = createMockInvoice({ 
        id: generateId(),
        importBatchId: generateBatchId()
      });
      
      const result = await service.validate([newInvoice], [existingInvoice]);
      
      expect(result.duplicateGroups.length).toBe(1);
    });

    it('should not flag unique invoices as duplicates', async () => {
      const service = createValidationService();
      const invoice1 = createMockInvoice({ invoiceNumber: '00012345' });
      const invoice2 = createMockInvoice({ 
        id: generateId(),
        invoiceNumber: '00012346' 
      });
      
      const result = await service.validate([invoice1, invoice2]);
      
      expect(result.duplicateGroups.length).toBe(0);
    });
  });

  describe('Red Invoice Validation', () => {
    it('should validate red invoice with matching original', async () => {
      const service = createValidationService();
      const originalInvoice = createMockInvoice({
        invoiceNumber: '00012345',
        totalAmount: 1130
      });
      const redInvoice = createMockInvoice({
        id: generateId(),
        invoiceNumber: '99999999',
        isRedInvoice: true,
        originalInvoiceCode: '123456789012',
        originalInvoiceNumber: '00012345',
        totalAmount: -1130
      });
      
      const result = await service.validate([redInvoice], [originalInvoice]);
      
      const redRelation = result.redInvoiceRelations[0];
      expect(redRelation.isValid).toBe(true);
      expect(redRelation.originalInvoice).toBeDefined();
    });

    it('should detect red invoice without original', async () => {
      const service = createValidationService();
      const redInvoice = createMockInvoice({
        invoiceNumber: '99999999',
        isRedInvoice: true,
        originalInvoiceCode: '123456789012',
        originalInvoiceNumber: '00099999',
        totalAmount: -1130
      });
      
      const result = await service.validate([redInvoice]);
      
      const redRelation = result.redInvoiceRelations[0];
      expect(redRelation.isValid).toBe(false);
    });

    it('should detect red invoice with amount mismatch', async () => {
      const service = createValidationService();
      const originalInvoice = createMockInvoice({
        invoiceNumber: '00012345',
        totalAmount: 1130
      });
      const redInvoice = createMockInvoice({
        id: generateId(),
        invoiceNumber: '99999999',
        isRedInvoice: true,
        originalInvoiceCode: '123456789012',
        originalInvoiceNumber: '00012345',
        totalAmount: -500
      });
      
      const result = await service.validate([redInvoice], [originalInvoice]);
      
      const redRelation = result.redInvoiceRelations[0];
      expect(redRelation.isValid).toBe(false);
    });

    it('should detect red invoice missing original info', async () => {
      const service = createValidationService();
      const redInvoice = createMockInvoice({
        invoiceNumber: '99999999',
        isRedInvoice: true,
        totalAmount: -1130
      });
      
      const result = await service.validate([redInvoice]);
      
      const redRelation = result.redInvoiceRelations[0];
      expect(redRelation.isValid).toBe(false);
    });
  });

  describe('Validation Options', () => {
    it('should skip duplicate check when disabled', async () => {
      const service = createValidationService({ checkDuplicates: false });
      const invoice1 = createMockInvoice();
      const invoice2 = createMockInvoice({ id: generateId() });
      
      const result = await service.validate([invoice1, invoice2]);
      
      expect(result.duplicateGroups.length).toBe(0);
    });

    it('should skip red invoice check when disabled', async () => {
      const service = createValidationService({ checkRedInvoices: false });
      const redInvoice = createMockInvoice({
        invoiceNumber: '99999999',
        isRedInvoice: true,
        totalAmount: -1130
      });
      
      const result = await service.validate([redInvoice]);
      
      expect(result.redInvoiceRelations.length).toBe(0);
    });

    it('should skip amount check when disabled', async () => {
      const service = createValidationService({ checkAmountConsistency: false });
      const invoice = createMockInvoice({
        amount: 1000,
        taxAmount: 130,
        totalAmount: 2000
      });
      
      const result = await service.validate([invoice]);
      
      const amountErrors = result.errors.filter(e => e.type === 'AMOUNT_TOTAL_MISMATCH');
      expect(amountErrors.length).toBe(0);
    });
  });

  describe('Recommended Invoice Selection', () => {
    it('should select invoice with more complete data', async () => {
      const service = createValidationService();
      const invoice1 = createMockInvoice({
        invoiceDate: '2024-01-15',
        sellerName: '完整数据销售方',
        buyerName: '完整数据购买方',
        amount: 1000
      });
      const invoice2 = createMockInvoice({
        id: generateId(),
        invoiceDate: '',
        sellerName: '',
        buyerName: '',
        amount: 0
      });
      
      const result = await service.validate([invoice1, invoice2]);
      
      expect(result.duplicateGroups[0].recommendedInvoice?.id).toBe(invoice1.id);
    });
  });
});
