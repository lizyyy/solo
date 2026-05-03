import { validateData } from '../src/validator';
import { LoadedData, Config } from '../src/types';

const defaultConfig: Config = {
  stallIds: ['stall-001'],
  stallNames: { 'stall-001': '主摊位' },
  fees: {
    defaultRentalFee: 500,
    utilityFeePerDay: 50,
    cleaningFeePerDay: 30,
    marketingFeePerDay: 20
  },
  platformFees: {
    wechat: 0.006,
    alipay: 0.006,
    cash: 0,
    other: 0
  },
  taxes: {
    rate: 0.03,
    threshold: 100000,
    enabled: false
  },
  inventory: {
    damageWarningThreshold: 0.05,
    negativeStockWarning: true,
    autoAdjust: false
  },
  businessHours: {
    crossDayCutoff: '06:00',
    startHour: 18,
    endHour: 2
  },
  currency: {
    symbol: '¥',
    decimalPlaces: 2
  },
  output: {
    defaultFormat: 'console',
    exportDirectory: './reports'
  }
};

describe('validator', () => {
  describe('validateSales', () => {
    it('should detect duplicate orders', () => {
      const data: LoadedData = {
        sales: [
          {
            orderId: 'ORD-001',
            timestamp: '2024-05-01 18:30:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 2,
            unitPrice: 15,
            totalAmount: 30,
            paymentMethod: 'wechat',
            paymentId: 'PAY-001'
          },
          {
            orderId: 'ORD-001',
            timestamp: '2024-05-01 18:35:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 2,
            unitPrice: 15,
            totalAmount: 30,
            paymentMethod: 'wechat',
            paymentId: 'PAY-002'
          }
        ],
        payments: [],
        inventory: { items: [], records: [] },
        fees: [],
        returns: [],
        config: defaultConfig
      };
      
      const result = validateData(data);
      
      expect(result.summary.duplicateOrders).toBeGreaterThan(0);
      expect(result.valid).toBe(false);
    });
    
    it('should detect missing orderId', () => {
      const data: LoadedData = {
        sales: [
          {
            orderId: '',
            timestamp: '2024-05-01 18:30:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 2,
            unitPrice: 15,
            totalAmount: 30,
            paymentMethod: 'wechat',
            paymentId: 'PAY-001'
          }
        ],
        payments: [],
        inventory: { items: [], records: [] },
        fees: [],
        returns: [],
        config: defaultConfig
      };
      
      const result = validateData(data);
      
      expect(result.summary.missingFields).toBeGreaterThan(0);
    });
    
    it('should detect invalid quantity (zero or negative)', () => {
      const data: LoadedData = {
        sales: [
          {
            orderId: 'ORD-001',
            timestamp: '2024-05-01 18:30:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 0,
            unitPrice: 15,
            totalAmount: 0,
            paymentMethod: 'wechat',
            paymentId: 'PAY-001'
          }
        ],
        payments: [],
        inventory: { items: [], records: [] },
        fees: [],
        returns: [],
        config: defaultConfig
      };
      
      const result = validateData(data);
      
      expect(result.valid).toBe(false);
    });
  });
  
  describe('validatePayments', () => {
    it('should detect payment amount mismatch', () => {
      const data: LoadedData = {
        sales: [
          {
            orderId: 'ORD-001',
            timestamp: '2024-05-01 18:30:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 2,
            unitPrice: 15,
            totalAmount: 30,
            paymentMethod: 'wechat',
            paymentId: 'PAY-001'
          }
        ],
        payments: [
          {
            paymentId: 'PAY-001',
            orderId: 'ORD-001',
            timestamp: '2024-05-01 18:30:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            amount: 25,
            method: 'wechat',
            status: 'success'
          }
        ],
        inventory: { items: [], records: [] },
        fees: [],
        returns: [],
        config: defaultConfig
      };
      
      const result = validateData(data);
      
      expect(result.summary.paymentMismatches).toBeGreaterThan(0);
    });
  });
  
  describe('validateInventory', () => {
    it('should detect negative stock', () => {
      const data: LoadedData = {
        sales: [
          {
            orderId: 'ORD-001',
            timestamp: '2024-05-01 18:30:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 10,
            unitPrice: 15,
            totalAmount: 150,
            paymentMethod: 'wechat',
            paymentId: 'PAY-001'
          }
        ],
        payments: [],
        inventory: {
          items: [
            {
              productId: 'PRD-001',
              productName: '珍珠奶茶',
              category: '饮品',
              unitCost: 5,
              unitPrice: 15,
              initialStock: 5,
              currentStock: 5,
              minStock: 10,
              unit: '杯'
            }
          ],
          records: []
        },
        fees: [],
        returns: [],
        config: defaultConfig
      };
      
      const result = validateData(data);
      
      expect(result.summary.negativeStock).toBeGreaterThan(0);
    });
  });
  
  describe('validateReturns', () => {
    it('should detect return without original order', () => {
      const data: LoadedData = {
        sales: [
          {
            orderId: 'ORD-001',
            timestamp: '2024-05-01 18:30:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 2,
            unitPrice: 15,
            totalAmount: 30,
            paymentMethod: 'wechat',
            paymentId: 'PAY-001'
          }
        ],
        payments: [],
        inventory: { items: [], records: [] },
        fees: [],
        returns: [
          {
            returnId: 'RET-001',
            timestamp: '2024-05-01 19:00:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            originalOrderId: 'ORD-NOT-EXIST',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 1,
            refundAmount: 15,
            reason: '不好喝',
            paymentMethod: 'wechat'
          }
        ],
        config: defaultConfig
      };
      
      const result = validateData(data);
      
      expect(result.summary.invalidReturns).toBeGreaterThan(0);
    });
  });
  
  describe('valid data', () => {
    it('should pass validation with valid data', () => {
      const data: LoadedData = {
        sales: [
          {
            orderId: 'ORD-001',
            timestamp: '2024-05-01 18:30:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 2,
            unitPrice: 15,
            totalAmount: 30,
            paymentMethod: 'wechat',
            paymentId: 'PAY-001'
          }
        ],
        payments: [
          {
            paymentId: 'PAY-001',
            orderId: 'ORD-001',
            timestamp: '2024-05-01 18:30:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            amount: 30,
            method: 'wechat',
            status: 'success'
          }
        ],
        inventory: {
          items: [
            {
              productId: 'PRD-001',
              productName: '珍珠奶茶',
              category: '饮品',
              unitCost: 5,
              unitPrice: 15,
              initialStock: 100,
              currentStock: 80,
              minStock: 20,
              unit: '杯'
            }
          ],
          records: []
        },
        fees: [
          {
            feeId: 'FEE-001',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            type: 'rental',
            amount: 500,
            description: '摊位租金'
          }
        ],
        returns: [],
        config: defaultConfig
      };
      
      const result = validateData(data);
      
      expect(result.valid).toBe(true);
    });
  });
});
