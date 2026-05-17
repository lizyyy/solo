import * as path from 'path';
import { OpenApiParser } from '../src/openapi-parser';

describe('OpenApiParser', () => {
  const parser = new OpenApiParser();
  const testDataDir = path.join(__dirname, 'data');

  describe('parseFile', () => {
    it('应该正确解析正常的 OpenAPI 文件中的枚举', () => {
      const filePath = path.join(testDataDir, 'openapi-normal.yaml');
      const result = parser.parseFile(filePath);

      expect(result.badEntries).toHaveLength(0);
      expect(result.enums.length).toBeGreaterThan(0);
      
      const enumNames = result.enums.map(e => e.name);
      expect(enumNames).toContain('OrderStatus');
      expect(enumNames).toContain('PaymentMethod');
    });

    it('应该正确提取枚举值', () => {
      const filePath = path.join(testDataDir, 'openapi-normal.yaml');
      const result = parser.parseFile(filePath);

      const orderStatus = result.enums.find(e => e.name === 'OrderStatus');
      expect(orderStatus).toBeDefined();
      expect(orderStatus!.values.map(v => v.value)).toContain('PENDING');
      expect(orderStatus!.values.map(v => v.value)).toContain('PAID');
      expect(orderStatus!.values.map(v => v.value)).toContain('SHIPPED');
    });

    it('应该处理有语法错误的文件并保留坏条目', () => {
      const filePath = path.join(testDataDir, 'openapi-dirty.yaml');
      const result = parser.parseFile(filePath);

      expect(result.badEntries.length).toBeGreaterThan(0);
    });

    it('应该返回文件路径信息', () => {
      const filePath = path.join(testDataDir, 'openapi-normal.yaml');
      const result = parser.parseFile(filePath);

      result.enums.forEach(e => {
        expect(e.filePath).toBe(filePath);
      });
    });

    it('应该处理不存在的文件', () => {
      const filePath = path.join(testDataDir, 'nonexistent.yaml');
      const result = parser.parseFile(filePath);

      expect(result.enums).toHaveLength(0);
      expect(result.badEntries.length).toBeGreaterThan(0);
    });
  });
});
