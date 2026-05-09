import { v4 as uuidv4 } from 'uuid';
import { getDatabase, closeDatabase } from '../src/electron/database';
import * as importExportService from '../src/electron/services/importExportService';
import * as reorderService from '../src/electron/services/reorderService';
import { UserRole, User } from '../src/shared/types';

process.env.NODE_ENV = 'test';

describe('Import/Export Service', () => {
  let operator: User;

  beforeEach(() => {
    closeDatabase();
    const db = getDatabase();
    const now = new Date().toISOString();
    const operatorId = uuidv4();
    
    db.prepare(`
      INSERT INTO users (id, username, password, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(operatorId, 'operator', 'operator123', '操作人', UserRole.ADMIN, now, now);
    
    operator = {
      id: operatorId,
      username: 'operator',
      password: 'operator123',
      name: '操作人',
      role: UserRole.ADMIN,
      createdAt: now,
      updatedAt: now
    };
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('importFromCSV', () => {
    it('should import valid CSV data', () => {
      const csvContent = [
        '订单号,客户姓名,客户电话,客户地址,产品名称,产品SKU,数量,补发原因,备注',
        ',张三,13800000001,北京市,手机壳,SHELL-001,2,商品损坏,测试备注',
        ',李四,13800000002,上海市,充电器,CHARGER-001,1,发错商品,'
      ].join('\n');

      const result = importExportService.importFromCSV(csvContent, operator);

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('should report errors for invalid rows', () => {
      const csvContent = [
        '订单号,客户姓名,客户电话,客户地址,产品名称,产品SKU,数量,补发原因,备注',
        ',张三,,北京市,手机壳,SHELL-001,2,商品损坏,无电话',
        ',李四,13800000002,上海市,,CHARGER-001,1,发错商品,无产品名'
      ].join('\n');

      const result = importExportService.importFromCSV(csvContent, operator);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors.length).toBe(2);
    });

    it('should skip empty rows', () => {
      const csvContent = [
        '订单号,客户姓名,客户电话,客户地址,产品名称,产品SKU,数量,补发原因,备注',
        ',张三,13800000001,北京市,手机壳,SHELL-001,2,商品损坏,测试备注',
        ',,,,,,,,',
        ',李四,13800000002,上海市,充电器,CHARGER-001,1,发错商品,'
      ].join('\n');

      const result = importExportService.importFromCSV(csvContent, operator);

      expect(result.success).toBe(2);
    });
  });

  describe('exportToCSV', () => {
    it('should export orders to CSV', () => {
      reorderService.createOrder({
        orderNo: 'RS202605098888',
        customerName: '导出测试',
        customerPhone: '13800000888',
        customerAddress: '导出地址',
        productName: '导出商品',
        productSku: 'EXPORT-001',
        quantity: 2,
        reason: '测试导出',
        description: '导出备注'
      }, operator);

      const listResult = reorderService.listOrders({ page: 1, pageSize: 100 });
      const csvContent = importExportService.exportToCSV(listResult.data);

      expect(csvContent).toBeDefined();
      expect(csvContent.length).toBeGreaterThan(0);
      expect(csvContent.split('\n').length).toBeGreaterThan(1);
    });

    it('should include all required fields in CSV', () => {
      const order = reorderService.createOrder({
        orderNo: 'RS202605098887',
        customerName: '字段测试',
        customerPhone: '13800000887',
        productName: '测试商品',
        quantity: 1,
        reason: '测试原因'
      }, operator);

      const csvContent = importExportService.exportToCSV([order]);
      const lines = csvContent.split('\n');

      expect(lines[0]).toContain('订单号');
      expect(lines[0]).toContain('客户姓名');
      expect(lines[0]).toContain('客户电话');
      expect(lines[0]).toContain('产品名称');
      expect(lines[0]).toContain('状态');
      expect(lines[0]).toContain('创建时间');
    });
  });

  describe('exportToExcel', () => {
    it('should export orders to Excel buffer', () => {
      reorderService.createOrder({
        orderNo: 'RS202605098886',
        customerName: 'Excel测试',
        customerPhone: '13800000886',
        productName: 'Excel商品',
        quantity: 1,
        reason: 'Excel测试'
      }, operator);

      const listResult = reorderService.listOrders({ page: 1, pageSize: 100 });
      const buffer = importExportService.exportToExcel(listResult.data);

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('getImportTemplate', () => {
    it('should return valid Excel template', () => {
      const buffer = importExportService.getImportTemplate();

      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
