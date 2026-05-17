import * as path from 'path';
import { SourceScanner } from '../src/source-scanner';

describe('SourceScanner', () => {
  const scanner = new SourceScanner();
  const testDataDir = path.join(__dirname, 'data');

  describe('scanFiles', () => {
    it('应该正确扫描 TypeScript 枚举', () => {
      const filePath = path.join(testDataDir, 'source-normal.ts');
      const result = scanner.scanFiles([filePath]);

      expect(result.badEntries).toHaveLength(0);
      expect(result.enums.length).toBeGreaterThan(0);
      
      const enumNames = result.enums.map(e => e.name);
      expect(enumNames).toContain('OrderStatus');
      expect(enumNames).toContain('PaymentMethod');
      expect(enumNames).toContain('UserRole');
      expect(enumNames).toContain('UserStatus');
    });

    it('应该正确提取枚举值', () => {
      const filePath = path.join(testDataDir, 'source-normal.ts');
      const result = scanner.scanFiles([filePath]);

      const orderStatus = result.enums.find(e => e.name === 'OrderStatus');
      expect(orderStatus).toBeDefined();
      expect(orderStatus!.values.map(v => v.value)).toContain('PENDING');
      expect(orderStatus!.values.map(v => v.value)).toContain('PAID');
      expect(orderStatus!.values.map(v => v.value)).toContain('SHIPPED');
    });

    it('应该返回文件路径信息', () => {
      const filePath = path.join(testDataDir, 'source-normal.ts');
      const result = scanner.scanFiles([filePath]);

      result.enums.forEach(e => {
        expect(e.filePath).toBe(filePath);
      });
    });

    it('应该处理不存在的文件', () => {
      const filePath = path.join(testDataDir, 'nonexistent.ts');
      const result = scanner.scanFiles([filePath]);

      expect(result.enums).toHaveLength(0);
      expect(result.badEntries.length).toBeGreaterThan(0);
    });

    it('应该返回行列位置信息', () => {
      const filePath = path.join(testDataDir, 'source-normal.ts');
      const result = scanner.scanFiles([filePath]);

      const orderStatus = result.enums.find(e => e.name === 'OrderStatus');
      expect(orderStatus).toBeDefined();
      expect(orderStatus!.values[0].line).toBeDefined();
      expect(orderStatus!.values[0].line).toBeGreaterThan(0);
    });
  });
});
