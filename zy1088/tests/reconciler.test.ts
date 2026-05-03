import { reconcileData } from '../src/reconciler';
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

describe('reconciler', () => {
  describe('basic reconciliation', () => {
    it('should calculate correct revenue and profit', () => {
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
            orderId: 'ORD-002',
            timestamp: '2024-05-01 18:45:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-002',
            productName: '手打柠檬茶',
            quantity: 1,
            unitPrice: 18,
            totalAmount: 18,
            paymentMethod: 'alipay',
            paymentId: 'PAY-002'
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
          },
          {
            paymentId: 'PAY-002',
            orderId: 'ORD-002',
            timestamp: '2024-05-01 18:45:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            amount: 18,
            method: 'alipay',
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
            },
            {
              productId: 'PRD-002',
              productName: '手打柠檬茶',
              category: '饮品',
              unitCost: 6,
              unitPrice: 18,
              initialStock: 80,
              currentStock: 70,
              minStock: 15,
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
      
      const result = reconcileData(data);
      
      expect(result.overall.totalRevenue).toBe(48);
      
      const expectedCost = (2 * 5) + (1 * 6);
      expect(result.overall.totalCost).toBe(expectedCost);
      
      expect(result.overall.totalFees).toBeGreaterThan(0);
    });
    
    it('should handle returns correctly', () => {
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
            quantity: 4,
            unitPrice: 15,
            totalAmount: 60,
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
            amount: 60,
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
        fees: [],
        returns: [
          {
            returnId: 'RET-001',
            timestamp: '2024-05-01 19:00:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            originalOrderId: 'ORD-001',
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
      
      const result = reconcileData(data);
      
      expect(result.overall.totalReturns).toBe(15);
      
      const netRevenue = 60 - 15;
      expect(result.overall.totalRevenue).toBe(60);
    });
    
    it('should calculate platform fees correctly', () => {
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
            quantity: 1,
            unitPrice: 100,
            totalAmount: 100,
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
              unitCost: 50,
              unitPrice: 100,
              initialStock: 100,
              currentStock: 80,
              minStock: 20,
              unit: '杯'
            }
          ],
          records: []
        },
        fees: [],
        returns: [],
        config: {
          ...defaultConfig,
          platformFees: {
            wechat: 0.01,
            alipay: 0.01,
            cash: 0,
            other: 0
          }
        }
      };
      
      const result = reconcileData(data);
      
      expect(result.overall.totalPlatformFees).toBe(1);
    });
  });
  
  describe('by product analysis', () => {
    it('should group sales by product', () => {
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
            orderId: 'ORD-002',
            timestamp: '2024-05-01 18:45:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 3,
            unitPrice: 15,
            totalAmount: 45,
            paymentMethod: 'alipay',
            paymentId: 'PAY-002'
          },
          {
            orderId: 'ORD-003',
            timestamp: '2024-05-01 19:00:00',
            date: '2024-05-01',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-002',
            productName: '手打柠檬茶',
            quantity: 1,
            unitPrice: 18,
            totalAmount: 18,
            paymentMethod: 'cash',
            paymentId: 'PAY-003'
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
              initialStock: 100,
              currentStock: 80,
              minStock: 20,
              unit: '杯'
            },
            {
              productId: 'PRD-002',
              productName: '手打柠檬茶',
              category: '饮品',
              unitCost: 6,
              unitPrice: 18,
              initialStock: 80,
              currentStock: 70,
              minStock: 15,
              unit: '杯'
            }
          ],
          records: []
        },
        fees: [],
        returns: [],
        config: defaultConfig
      };
      
      const result = reconcileData(data);
      
      expect(result.byProduct['PRD-001']).toBeDefined();
      expect(result.byProduct['PRD-002']).toBeDefined();
      expect(result.byProduct['PRD-001'].totalQuantitySold).toBe(5);
      expect(result.byProduct['PRD-001'].totalRevenue).toBe(75);
    });
  });
  
  describe('date filtering', () => {
    it('should filter by date range', () => {
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
            quantity: 1,
            unitPrice: 15,
            totalAmount: 15,
            paymentMethod: 'wechat',
            paymentId: 'PAY-001'
          },
          {
            orderId: 'ORD-002',
            timestamp: '2024-05-02 18:30:00',
            date: '2024-05-02',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 1,
            unitPrice: 15,
            totalAmount: 15,
            paymentMethod: 'wechat',
            paymentId: 'PAY-002'
          },
          {
            orderId: 'ORD-003',
            timestamp: '2024-05-03 18:30:00',
            date: '2024-05-03',
            stallId: 'stall-001',
            stallName: '主摊位',
            productId: 'PRD-001',
            productName: '珍珠奶茶',
            quantity: 1,
            unitPrice: 15,
            totalAmount: 15,
            paymentMethod: 'wechat',
            paymentId: 'PAY-003'
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
              initialStock: 100,
              currentStock: 80,
              minStock: 20,
              unit: '杯'
            }
          ],
          records: []
        },
        fees: [],
        returns: [],
        config: defaultConfig
      };
      
      const result = reconcileData(data, {
        startDate: '2024-05-02',
        endDate: '2024-05-02'
      });
      
      expect(result.overall.totalRevenue).toBe(15);
      expect(result.period.startDate).toBe('2024-05-02');
      expect(result.period.endDate).toBe('2024-05-02');
    });
  });
});
