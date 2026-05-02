const { PermissionValidator, PermissionError } = require('../src/validation/PermissionValidator');
const { StockValidator, StockError } = require('../src/validation/StockValidator');
const { ExpiryValidator, ExpiryError } = require('../src/validation/ExpiryValidator');
const { DangerLevelValidator, DangerLevelError } = require('../src/validation/DangerLevelValidator');
const { DuplicateSubmitValidator, DuplicateSubmitError, globalValidator } = require('../src/validation/DuplicateSubmitValidator');
const config = require('../src/config');

describe('Validation Tests', () => {
  describe('PermissionValidator', () => {
    test('should check permission correctly', () => {
      expect(PermissionValidator.hasPermission('admin', 'create_chemical')).toBe(true);
      expect(PermissionValidator.hasPermission('safety_officer', 'create_chemical')).toBe(true);
      expect(PermissionValidator.hasPermission('user', 'create_chemical')).toBe(false);
    });
    
    test('should throw error when permission denied', () => {
      expect(() => {
        PermissionValidator.checkPermission('user', 'create_chemical');
      }).toThrow(PermissionError);
    });
    
    test('should check admin role correctly', () => {
      expect(PermissionValidator.isAdmin('admin')).toBe(true);
      expect(PermissionValidator.isAdmin('safety_officer')).toBe(false);
      expect(PermissionValidator.isAdmin('user')).toBe(false);
    });
    
    test('should check safety officer role correctly', () => {
      expect(PermissionValidator.isSafetyOfficer('admin')).toBe(true);
      expect(PermissionValidator.isSafetyOfficer('safety_officer')).toBe(true);
      expect(PermissionValidator.isSafetyOfficer('user')).toBe(false);
    });
    
    test('should validate role correctly', () => {
      expect(() => {
        PermissionValidator.validateRole('admin');
      }).not.toThrow();
      
      expect(() => {
        PermissionValidator.validateRole('invalid_role');
      }).toThrow(PermissionError);
    });
    
    test('should check specific permissions correctly', () => {
      expect(PermissionValidator.canCreateChemical('admin')).toBe(true);
      expect(PermissionValidator.canCreateChemical('safety_officer')).toBe(true);
      expect(PermissionValidator.canCreateChemical('user')).toBe(false);
      
      expect(PermissionValidator.canApproveRequest('admin')).toBe(true);
      expect(PermissionValidator.canApproveRequest('safety_officer')).toBe(true);
      expect(PermissionValidator.canApproveRequest('user')).toBe(false);
      
      expect(PermissionValidator.canCreateRequest('user')).toBe(true);
    });
  });
  
  describe('StockValidator', () => {
    test('should validate sufficient stock correctly', () => {
      expect(() => {
        StockValidator.validateSufficientStock(100, 50);
      }).not.toThrow();
      
      expect(() => {
        StockValidator.validateSufficientStock(50, 100);
      }).toThrow(StockError);
    });
    
    test('should validate positive quantity correctly', () => {
      expect(() => {
        StockValidator.validatePositiveQuantity(10);
      }).not.toThrow();
      
      expect(() => {
        StockValidator.validatePositiveQuantity(0);
      }).toThrow(StockError);
      
      expect(() => {
        StockValidator.validatePositiveQuantity(-5);
      }).toThrow(StockError);
    });
    
    test('should validate return quantity correctly', () => {
      expect(() => {
        StockValidator.validateReturnQuantity(100, 50);
      }).not.toThrow();
      
      expect(() => {
        StockValidator.validateReturnQuantity(100, 150);
      }).toThrow(StockError);
      
      expect(() => {
        StockValidator.validateReturnQuantity(100, 0);
      }).toThrow(StockError);
    });
    
    test('should check low stock correctly', () => {
      expect(StockValidator.isLowStock(5, 10)).toBe(true);
      expect(StockValidator.isLowStock(15, 10)).toBe(false);
      expect(StockValidator.isLowStock(10, 10)).toBe(true);
    });
    
    test('should validate batch active correctly', () => {
      expect(() => {
        StockValidator.validateBatchActive('active');
      }).not.toThrow();
      
      expect(() => {
        StockValidator.validateBatchActive('inactive');
      }).toThrow(StockError);
    });
    
    test('should calculate new stock correctly', () => {
      expect(StockValidator.calculateNewStock(100, 'deduct', 30)).toBe(70);
      expect(StockValidator.calculateNewStock(100, 'add', 30)).toBe(130);
    });
  });
  
  describe('ExpiryValidator', () => {
    test('should check expiry correctly', () => {
      const futureDate = '2025-12-31T23:59:59Z';
      expect(ExpiryValidator.isExpired(futureDate)).toBe(false);
    });
    
    test('should validate not expired correctly', () => {
      const futureDate = '2025-12-31T23:59:59Z';
      expect(() => {
        ExpiryValidator.validateNotExpired(futureDate);
      }).not.toThrow();
    });
    
    test('should get days until expiry correctly', () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const days = ExpiryValidator.getDaysUntilExpiry(futureDate);
      expect(days).toBeGreaterThanOrEqual(9);
    });
    
    test('should check near expiry correctly', () => {
      const nearFuture = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
      
      expect(ExpiryValidator.isNearExpiry(nearFuture, 30)).toBe(true);
      expect(ExpiryValidator.isNearExpiry(farFuture, 30)).toBe(false);
    });
    
    test('should validate expiry date correctly', () => {
      expect(() => {
        ExpiryValidator.validateExpiryDate('2025-12-31', '2024-01-01');
      }).not.toThrow();
      
      expect(() => {
        ExpiryValidator.validateExpiryDate('2024-01-01', '2025-12-31');
      }).toThrow(ExpiryError);
      
      expect(() => {
        ExpiryValidator.validateExpiryDate('invalid-date');
      }).toThrow(ExpiryError);
    });
    
    test('should get expiry status correctly', () => {
      const nearFuture = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const status = ExpiryValidator.getExpiryStatus(nearFuture);
      
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('text');
      expect(status).toHaveProperty('daysUntilExpiry');
    });
  });
  
  describe('DangerLevelValidator', () => {
    test('should validate danger level correctly', () => {
      expect(() => {
        DangerLevelValidator.validate('low');
      }).not.toThrow();
      
      expect(() => {
        DangerLevelValidator.validate('high');
      }).not.toThrow();
      
      expect(() => {
        DangerLevelValidator.validate('invalid');
      }).toThrow(DangerLevelError);
      
      expect(() => {
        DangerLevelValidator.validate(null);
      }).toThrow(DangerLevelError);
    });
    
    test('should get danger level info correctly', () => {
      const info = DangerLevelValidator.getInfo('high');
      expect(info).toBeDefined();
      expect(info.name).toBe('高危险');
      expect(info.approval_required).toBe(true);
    });
    
    test('should check approval required correctly', () => {
      expect(DangerLevelValidator.requiresApproval('low')).toBe(false);
      expect(DangerLevelValidator.requiresApproval('medium')).toBe(false);
      expect(DangerLevelValidator.requiresApproval('high')).toBe(true);
      expect(DangerLevelValidator.requiresApproval('extreme')).toBe(true);
    });
    
    test('should compare danger levels correctly', () => {
      expect(DangerLevelValidator.compare('high', 'low')).toBeGreaterThan(0);
      expect(DangerLevelValidator.compare('low', 'high')).toBeLessThan(0);
      expect(DangerLevelValidator.compare('medium', 'medium')).toBe(0);
    });
    
    test('should check higher or equal correctly', () => {
      expect(DangerLevelValidator.isHigherOrEqual('high', 'low')).toBe(true);
      expect(DangerLevelValidator.isHigherOrEqual('low', 'high')).toBe(false);
      expect(DangerLevelValidator.isHigherOrEqual('medium', 'medium')).toBe(true);
    });
    
    test('should get all danger levels correctly', () => {
      const levels = DangerLevelValidator.getAllDangerLevels();
      expect(levels.length).toBe(4);
      expect(levels[0].level).toBe('low');
      expect(levels[3].level).toBe('extreme');
    });
  });
  
  describe('DuplicateSubmitValidator', () => {
    beforeEach(() => {
      globalValidator.clearCache();
    });
    
    test('should generate key correctly', () => {
      const key = globalValidator.generateKey('user1', 'action1', 'key1');
      expect(key).toBe('user1:action1:key1');
    });
    
    test('should check duplicate correctly', () => {
      const key = 'test-duplicate-key';
      
      expect(() => {
        globalValidator.checkDuplicate(key);
      }).not.toThrow();
      
      globalValidator.recordSubmission(key);
      
      expect(() => {
        globalValidator.checkDuplicate(key);
      }).toThrow(DuplicateSubmitError);
    });
    
    test('should validate and record correctly', () => {
      const key = 'test-validate-key';
      
      expect(() => {
        globalValidator.validateAndRecord(key);
      }).not.toThrow();
      
      expect(() => {
        globalValidator.validateAndRecord(key);
      }).toThrow(DuplicateSubmitError);
    });
    
    test('should clear cache correctly', () => {
      const key = 'test-clear-key';
      globalValidator.recordSubmission(key);
      globalValidator.clearCache(key);
      
      expect(() => {
        globalValidator.checkDuplicate(key);
      }).not.toThrow();
    });
  });
});
