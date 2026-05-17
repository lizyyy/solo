import { EnumComparator } from '../src/enum-comparator';
import { EnumDefinition } from '../src/types';

describe('EnumComparator', () => {
  const comparator = new EnumComparator();

  const createOpenapiEnum = (name: string, values: string[]): EnumDefinition => ({
    name,
    values: values.map(v => ({ value: v, source: 'openapi' })),
    source: 'openapi',
    filePath: 'test.yaml'
  });

  const createSourceEnum = (name: string, values: string[]): EnumDefinition => ({
    name,
    values: values.map(v => ({ value: v, source: 'source' })),
    source: 'source',
    filePath: 'test.ts'
  });

  describe('compare', () => {
    it('应该检测完全匹配的枚举', () => {
      const openapiEnums = [createOpenapiEnum('OrderStatus', ['PENDING', 'PAID', 'SHIPPED'])];
      const sourceEnums = [createSourceEnum('OrderStatus', ['PENDING', 'PAID', 'SHIPPED'])];

      const differences = comparator.compare(openapiEnums, sourceEnums);
      expect(differences).toHaveLength(0);
    });

    it('应该检测仅在 OpenAPI 中存在的枚举值', () => {
      const openapiEnums = [createOpenapiEnum('OrderStatus', ['PENDING', 'PAID', 'SHIPPED', 'EXTRA'])];
      const sourceEnums = [createSourceEnum('OrderStatus', ['PENDING', 'PAID', 'SHIPPED'])];

      const differences = comparator.compare(openapiEnums, sourceEnums);
      expect(differences).toHaveLength(1);
      expect(differences[0].onlyInOpenApi).toHaveLength(1);
      expect(differences[0].onlyInOpenApi[0].value).toBe('EXTRA');
    });

    it('应该检测仅在源代码中存在的枚举值', () => {
      const openapiEnums = [createOpenapiEnum('OrderStatus', ['PENDING', 'PAID'])];
      const sourceEnums = [createSourceEnum('OrderStatus', ['PENDING', 'PAID', 'SHIPPED'])];

      const differences = comparator.compare(openapiEnums, sourceEnums);
      expect(differences).toHaveLength(1);
      expect(differences[0].onlyInSource).toHaveLength(1);
      expect(differences[0].onlyInSource[0].value).toBe('SHIPPED');
    });

    it('应该检测双向差异', () => {
      const openapiEnums = [createOpenapiEnum('OrderStatus', ['PENDING', 'PAID', 'ONLY_IN_OPENAPI'])];
      const sourceEnums = [createSourceEnum('OrderStatus', ['PENDING', 'PAID', 'ONLY_IN_SOURCE'])];

      const differences = comparator.compare(openapiEnums, sourceEnums);
      expect(differences).toHaveLength(1);
      expect(differences[0].onlyInOpenApi).toHaveLength(1);
      expect(differences[0].onlyInSource).toHaveLength(1);
    });

    it('应该正确处理大小写不敏感的比较', () => {
      const openapiEnums = [createOpenapiEnum('OrderStatus', ['pending', 'paid'])];
      const sourceEnums = [createSourceEnum('OrderStatus', ['PENDING', 'PAID'])];

      const differences = comparator.compare(openapiEnums, sourceEnums);
      expect(differences).toHaveLength(0);
    });
  });

  describe('compareByName', () => {
    it('应该只比较指定的枚举名称', () => {
      const openapiEnums = [
        createOpenapiEnum('OrderStatus', ['PENDING', 'PAID']),
        createOpenapiEnum('PaymentMethod', ['CREDIT_CARD'])
      ];
      const sourceEnums = [
        createSourceEnum('OrderStatus', ['PENDING', 'PAID', 'EXTRA']),
        createSourceEnum('PaymentMethod', ['CREDIT_CARD'])
      ];

      const differences = comparator.compareByName(openapiEnums, sourceEnums, ['OrderStatus']);
      expect(differences).toHaveLength(1);
      expect(differences[0].enumName).toBe('OrderStatus');
    });
  });

  describe('getMatchingEnums', () => {
    it('应该返回匹配的枚举名称列表', () => {
      const openapiEnums = [
        createOpenapiEnum('OrderStatus', ['PENDING', 'PAID']),
        createOpenapiEnum('PaymentMethod', ['CREDIT_CARD', 'PAYPAL'])
      ];
      const sourceEnums = [
        createSourceEnum('OrderStatus', ['PENDING', 'PAID']),
        createSourceEnum('PaymentMethod', ['CREDIT_CARD'])
      ];

      const matching = comparator.getMatchingEnums(openapiEnums, sourceEnums);
      expect(matching).toContain('OrderStatus');
      expect(matching).not.toContain('PaymentMethod');
    });
  });
});
