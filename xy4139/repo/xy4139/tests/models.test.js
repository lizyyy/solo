const Chemical = require('../src/models/Chemical');
const Batch = require('../src/models/Batch');
const Request = require('../src/models/Request');
const AuditLog = require('../src/models/AuditLog');

describe('Model Tests', () => {
  describe('Chemical Model', () => {
    test('should create a chemical instance with default values', () => {
      const data = {
        name: '乙醇',
        danger_level: 'low',
        unit: 'mL'
      };
      
      const chemical = new Chemical(data);
      
      expect(chemical.id).toBeDefined();
      expect(chemical.name).toBe('乙醇');
      expect(chemical.danger_level).toBe('low');
      expect(chemical.unit).toBe('mL');
      expect(chemical.created_at).toBeDefined();
    });
    
    test('should validate chemical data correctly', () => {
      const validData = {
        name: '硫酸',
        danger_level: 'high',
        unit: 'mL'
      };
      
      const invalidData = {
        name: '盐酸'
      };
      
      expect(Chemical.validate(validData)).toEqual([]);
      expect(Chemical.validate(invalidData).length).toBeGreaterThan(0);
    });
    
    test('should convert to JSON correctly', () => {
      const chemical = new Chemical({
        name: '硝酸',
        danger_level: 'high',
        unit: 'mL'
      });
      
      const json = chemical.toJSON();
      
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('danger_level');
      expect(json).toHaveProperty('unit');
    });
  });
  
  describe('Batch Model', () => {
    test('should create a batch instance with default values', () => {
      const data = {
        chemical_id: 'chem-001',
        batch_number: 'BATCH-2024-001',
        expiry_date: '2025-12-31T23:59:59Z',
        initial_quantity: 100,
        unit: 'mL'
      };
      
      const batch = new Batch(data);
      
      expect(batch.id).toBeDefined();
      expect(batch.chemical_id).toBe('chem-001');
      expect(batch.batch_number).toBe('BATCH-2024-001');
      expect(batch.initial_quantity).toBe(100);
      expect(batch.current_quantity).toBe(100);
      expect(batch.status).toBe('active');
    });
    
    test('should validate batch data correctly', () => {
      const validData = {
        chemical_id: 'chem-001',
        batch_number: 'BATCH-2024-001',
        expiry_date: '2025-12-31T23:59:59Z',
        initial_quantity: 100
      };
      
      const invalidData = {
        chemical_id: 'chem-001',
        batch_number: 'BATCH-2024-001'
      };
      
      expect(Batch.validate(validData)).toEqual([]);
      expect(Batch.validate(invalidData).length).toBeGreaterThan(0);
    });
    
    test('should check expiry status correctly', () => {
      const futureBatch = new Batch({
        chemical_id: 'chem-001',
        batch_number: 'BATCH-2024-001',
        expiry_date: '2025-12-31T23:59:59Z',
        initial_quantity: 100,
        unit: 'mL'
      });
      
      expect(futureBatch.isExpired()).toBe(false);
    });
    
    test('should check low stock correctly', () => {
      const batch = new Batch({
        chemical_id: 'chem-001',
        batch_number: 'BATCH-2024-001',
        expiry_date: '2025-12-31T23:59:59Z',
        initial_quantity: 5,
        current_quantity: 5,
        unit: 'mL'
      });
      
      expect(batch.isLowStock(10)).toBe(true);
      expect(batch.isLowStock(3)).toBe(false);
    });
  });
  
  describe('Request Model', () => {
    test('should create a request instance with default values', () => {
      const data = {
        requester_id: 'user-001',
        chemical_id: 'chem-001',
        batch_id: 'batch-001',
        quantity: 10,
        purpose: '实验使用'
      };
      
      const request = new Request(data);
      
      expect(request.id).toBeDefined();
      expect(request.request_number).toBeDefined();
      expect(request.request_number).toMatch(/^REQ-/);
      expect(request.status).toBe('draft');
      expect(request.requester_id).toBe('user-001');
      expect(request.quantity).toBe(10);
      expect(request.purpose).toBe('实验使用');
    });
    
    test('should validate request data correctly', () => {
      const validData = {
        requester_id: 'user-001',
        chemical_id: 'chem-001',
        batch_id: 'batch-001',
        quantity: 10,
        purpose: '实验使用'
      };
      
      const invalidData = {
        requester_id: 'user-001',
        chemical_id: 'chem-001'
      };
      
      expect(Request.validate(validData)).toEqual([]);
      expect(Request.validate(invalidData).length).toBeGreaterThan(0);
    });
    
    test('should check state transitions correctly', () => {
      const draftRequest = new Request({
        requester_id: 'user-001',
        chemical_id: 'chem-001',
        batch_id: 'batch-001',
        quantity: 10,
        purpose: '实验使用',
        status: 'draft'
      });
      
      const pendingRequest = new Request({
        ...draftRequest,
        status: 'pending'
      });
      
      expect(draftRequest.canTransitionTo('pending')).toBe(true);
      expect(draftRequest.canTransitionTo('approved')).toBe(false);
      expect(pendingRequest.canTransitionTo('approved')).toBe(true);
      expect(pendingRequest.canTransitionTo('executed')).toBe(false);
    });
    
    test('should generate status text correctly', () => {
      const draftRequest = new Request({
        requester_id: 'user-001',
        chemical_id: 'chem-001',
        batch_id: 'batch-001',
        quantity: 10,
        purpose: '实验使用',
        status: 'draft'
      });
      
      expect(draftRequest.getStatusText()).toBe('草稿');
    });
  });
  
  describe('AuditLog Model', () => {
    test('should create an audit log instance with default values', () => {
      const data = {
        action: 'chemical.create',
        entity_type: 'chemical',
        entity_id: 'chem-001',
        entity_name: '乙醇',
        description: '创建试剂',
        user_id: 'user-001'
      };
      
      const auditLog = new AuditLog(data);
      
      expect(auditLog.id).toBeDefined();
      expect(auditLog.action).toBe('chemical.create');
      expect(auditLog.entity_type).toBe('chemical');
      expect(auditLog.entity_id).toBe('chem-001');
      expect(auditLog.user_id).toBe('user-001');
      expect(auditLog.created_at).toBeDefined();
    });
    
    test('should validate audit log data correctly', () => {
      const validData = {
        action: 'chemical.create',
        entity_type: 'chemical',
        user_id: 'user-001'
      };
      
      const invalidData = {
        action: 'chemical.create'
      };
      
      expect(AuditLog.validate(validData)).toEqual([]);
      expect(AuditLog.validate(invalidData).length).toBeGreaterThan(0);
    });
    
    test('should convert to JSON and back correctly', () => {
      const original = new AuditLog({
        action: 'chemical.create',
        entity_type: 'chemical',
        entity_id: 'chem-001',
        old_value: { name: '旧名称' },
        new_value: { name: '新名称' },
        user_id: 'user-001'
      });
      
      const json = original.toJSON();
      
      expect(json.old_value).toEqual({ name: '旧名称' });
      expect(json.new_value).toEqual({ name: '新名称' });
      
      const restored = AuditLog.fromJSON(json);
      expect(restored.action).toBe(original.action);
    });
  });
});
