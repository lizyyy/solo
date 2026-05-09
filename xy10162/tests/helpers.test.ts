import {
  normalizeInvoiceNumber,
  normalizeInvoiceCode,
  isValidInvoiceNumber,
  isValidInvoiceCode,
  sanitizeNumber,
  isRedInvoiceSignaled,
  createInvoiceKey,
  calculateTotalAmount,
  normalizeInvoiceType,
  normalizeInvoiceStatus
} from '../src/utils/helpers';

describe('Helpers', () => {
  describe('normalizeInvoiceNumber', () => {
    it('should trim and uppercase invoice number', () => {
      expect(normalizeInvoiceNumber('  00012345  ')).toBe('00012345');
      expect(normalizeInvoiceNumber('ab123456')).toBe('AB123456');
    });

    it('should remove spaces', () => {
      expect(normalizeInvoiceNumber('0001 2345')).toBe('00012345');
    });
  });

  describe('normalizeInvoiceCode', () => {
    it('should trim and remove spaces from invoice code', () => {
      expect(normalizeInvoiceCode('  123456789012  ')).toBe('123456789012');
      expect(normalizeInvoiceCode('1234 5678 9012')).toBe('123456789012');
    });
  });

  describe('isValidInvoiceNumber', () => {
    it('should return true for valid invoice numbers', () => {
      expect(isValidInvoiceNumber('00012345')).toBe(true);
      expect(isValidInvoiceNumber('ABC123456789')).toBe(true);
    });

    it('should return false for invalid invoice numbers', () => {
      expect(isValidInvoiceNumber('')).toBe(false);
      expect(isValidInvoiceNumber('123')).toBe(false);
      expect(isValidInvoiceNumber('invalid!')).toBe(false);
    });
  });

  describe('isValidInvoiceCode', () => {
    it('should return true for valid invoice codes', () => {
      expect(isValidInvoiceCode('123456789012')).toBe(true);
      expect(isValidInvoiceCode('1234567890')).toBe(true);
    });

    it('should return false for invalid invoice codes', () => {
      expect(isValidInvoiceCode('')).toBe(false);
      expect(isValidInvoiceCode('12345')).toBe(false);
      expect(isValidInvoiceCode('ABC123456789')).toBe(false);
    });
  });

  describe('sanitizeNumber', () => {
    it('should handle numbers directly', () => {
      expect(sanitizeNumber(100)).toBe(100);
      expect(sanitizeNumber(-50.5)).toBe(-50.5);
    });

    it('should parse string numbers', () => {
      expect(sanitizeNumber('100.50')).toBe(100.5);
      expect(sanitizeNumber('-200')).toBe(-200);
    });

    it('should handle currency symbols and commas', () => {
      expect(sanitizeNumber('￥1,234.56')).toBe(1234.56);
      expect(sanitizeNumber('¥1,000.00')).toBe(1000);
      expect(sanitizeNumber('1,500.50')).toBe(1500.5);
    });

    it('should return 0 for invalid values', () => {
      expect(sanitizeNumber('invalid')).toBe(0);
      expect(sanitizeNumber(null)).toBe(0);
      expect(sanitizeNumber(undefined)).toBe(0);
    });
  });

  describe('calculateTotalAmount', () => {
    it('should calculate total correctly', () => {
      expect(calculateTotalAmount(100, 13)).toBe(113);
      expect(calculateTotalAmount(500, 65)).toBe(565);
    });
  });

  describe('isRedInvoiceSignaled', () => {
    it('should detect red invoice by keyword', () => {
      expect(isRedInvoiceSignaled({ status: '红冲' })).toBe(true);
      expect(isRedInvoiceSignaled({ remark: '红字发票' })).toBe(true);
    });

    it('should detect red invoice by negative amount', () => {
      expect(isRedInvoiceSignaled({ amount: -100 })).toBe(true);
      expect(isRedInvoiceSignaled({ totalAmount: -1000 })).toBe(true);
    });

    it('should return false for normal invoices', () => {
      expect(isRedInvoiceSignaled({ amount: 100, status: '正常' })).toBe(false);
    });
  });

  describe('createInvoiceKey', () => {
    it('should create unique key from code and number', () => {
      const key = createInvoiceKey('123456789012', '00012345');
      expect(key).toBe('123456789012-00012345');
    });
  });

  describe('normalizeInvoiceType', () => {
    it('should normalize common type names', () => {
      expect(normalizeInvoiceType('专用发票')).toBe('增值税专用发票');
      expect(normalizeInvoiceType('电子发票')).toBe('电子普通发票');
    });

    it('should preserve unknown types', () => {
      expect(normalizeInvoiceType('自定义类型')).toBe('自定义类型');
    });
  });

  describe('normalizeInvoiceStatus', () => {
    it('should normalize common status names', () => {
      expect(normalizeInvoiceStatus('正常')).toBe('正常');
      expect(normalizeInvoiceStatus('红冲')).toBe('红冲');
      expect(normalizeInvoiceStatus('作废')).toBe('作废');
    });

    it('should default to 待核验 for unknown status', () => {
      expect(normalizeInvoiceStatus('未知状态')).toBe('待核验');
    });
  });
});
