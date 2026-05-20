import {
  ValidationRule,
  ValidationContext,
  ValidationResult,
  SkuAlias,
} from '../../shared/types';

export const skuAliasMap: SkuAlias[] = [
  {
    standardSku: 'SKU001',
    standardName: '可口可乐500ml',
    aliases: ['可乐', 'Coca-Cola', '可口可乐', '可口可乐大瓶'],
  },
  {
    standardSku: 'SKU002',
    standardName: '百事可乐500ml',
    aliases: ['百事', 'Pepsi', '百事可乐'],
  },
  {
    standardSku: 'SKU003',
    standardName: '农夫山泉550ml',
    aliases: ['矿泉水', '农夫山泉', '饮用水'],
  },
  {
    standardSku: 'SKU004',
    standardName: '康师傅红烧牛肉面',
    aliases: ['方便面', '红烧牛肉面', '康师傅泡面'],
  },
  {
    standardSku: 'SKU005',
    standardName: '乐事薯片原味75g',
    aliases: ['薯片', '乐事薯片', 'Lays'],
  },
];

export const rules: ValidationRule[] = [
  {
    name: 'sku-alias-validation',
    type: 'warning',
    validate: (item: any, context: ValidationContext): ValidationResult => {
      const skuName = item.skuName || item['商品名称'] || item.name || '';
      const foundAlias = context.skuAliases.find(
        (alias) =>
          alias.aliases.some((a) => skuName.includes(a)) ||
          alias.standardName === skuName
      );
      if (!foundAlias && skuName.trim() !== '') {
        return {
          passed: false,
          errorType: 'SKU_ALIAS_NOT_FOUND',
          message: `SKU名称"${skuName}"未在别名映射表中找到`,
          suggestion:
            '请核对商品名称是否正确，或在SKU别名表中添加该商品的映射关系',
          confidence: 0.3,
        };
      }
      return { passed: true };
    },
  },
  {
    name: 'quantity-format-validation',
    type: 'error',
    validate: (item: any): ValidationResult => {
      const quantity = item.quantity || item['数量'] || item.qty;
      const qty = Number(quantity);
      if (isNaN(qty) || qty < 0) {
        return {
          passed: false,
          errorType: 'INVALID_QUANTITY',
          message: `数量"${quantity}"格式不正确，必须是非负数字`,
          suggestion: '请将数量修改为有效的非负数字格式',
          confidence: 0,
        };
      }
      return { passed: true };
    },
  },
  {
    name: 'expiry-date-validation',
    type: 'warning',
    validate: (item: any): ValidationResult => {
      const expiryDate = item.expiryDate || item['过期日期'] || item['有效期'];
      if (!expiryDate) {
        return { passed: true };
      }
      try {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const daysUntilExpiry = Math.ceil(
          (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilExpiry <= 0) {
          return {
            passed: false,
            errorType: 'PRODUCT_EXPIRED',
            message: `商品已过期，过期日期：${expiryDate}`,
            suggestion: '请立即下架该商品，避免销售过期商品',
            confidence: 0,
          };
        }
        if (daysUntilExpiry <= 30) {
          return {
            passed: false,
            errorType: 'NEAR_EXPIRY',
            message: `商品即将临期，剩余${daysUntilExpiry}天过期`,
            suggestion: '建议进行促销活动或打折销售，避免商品过期损耗',
            confidence: 0.5,
          };
        }
      } catch (e) {
        return { passed: true };
      }
      return { passed: true };
    },
  },
  {
    name: 'replenishment-quantity-validation',
    type: 'warning',
    validate: (item: any, context: ValidationContext): ValidationResult => {
      const quantity = Number(item.quantity || item['数量'] || item.qty || 0);
      const sku = item.sku || item['商品编码'] || item.skuCode || '';
      if (context.expectedSales && context.expectedSales[sku]) {
        const expected = context.expectedSales[sku];
        const ratio = quantity / expected;
        if (ratio > 3) {
          return {
            passed: false,
            errorType: 'OVER_REPLENISHMENT',
            message: `补货量(${quantity})超出预期销量(${expected})的3倍，补货比率：${ratio.toFixed(1)}`,
            suggestion: '建议减少补货量，避免库存积压和过期损耗',
            confidence: 0.4,
          };
        }
        if (ratio < 0.3 && expected > 10) {
          return {
            passed: false,
            errorType: 'UNDER_REPLENISHMENT',
            message: `补货量(${quantity})仅为预期销量(${expected})的${(ratio * 100).toFixed(0)}%，可能导致缺货`,
            suggestion: '建议增加补货量，防止因缺货影响销售',
            confidence: 0.6,
          };
        }
      }
      return { passed: true };
    },
  },
  {
    name: 'sku-format-validation',
    type: 'error',
    validate: (item: any): ValidationResult => {
      const sku = item.sku || item['商品编码'] || item.skuCode || '';
      if (!sku || sku.trim() === '') {
        return {
          passed: false,
          errorType: 'EMPTY_SKU',
          message: '商品编码不能为空',
          suggestion: '请填写有效的商品编码',
          confidence: 0,
        };
      }
      return { passed: true };
    },
  },
];

export function applyRules(
  item: any,
  context: ValidationContext
): ValidationResult[] {
  return rules.map((rule) => rule.validate(item, context));
}

export function getItemStatus(
  results: ValidationResult[]
): 'normal' | 'pending' | 'failed' {
  const errors = results.filter((r) => !r.passed && r.confidence === 0);
  const warnings = results.filter(
    (r) => !r.passed && (r.confidence || 0.5) > 0
  );
  if (errors.length > 0) {
    return 'failed';
  }
  if (warnings.length > 0) {
    return 'pending';
  }
  return 'normal';
}

export function normalizeItem(item: any, source: string, storeId: string) {
  const sku = String(item.sku || item['商品编码'] || item.skuCode || '');
  const skuName = String(
    item.skuName || item['商品名称'] || item.name || ''
  );
  const quantity = Number(item.quantity || item['数量'] || item.qty || 0);
  return {
    sku,
    skuName,
    quantity,
    source,
    storeId,
    originalData: { ...item },
  };
}

export function getStandardSku(skuName: string): {
  sku: string;
  name: string;
} | null {
  const found = skuAliasMap.find(
    (alias) =>
      alias.aliases.some((a) => skuName.includes(a)) ||
      alias.standardName === skuName
  );
  if (found) {
    return { sku: found.standardSku, name: found.standardName };
  }
  return null;
}
