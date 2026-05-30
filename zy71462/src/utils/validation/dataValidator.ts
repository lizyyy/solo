import {
  Holding,
  TargetWeight,
  PriceQuote,
  MaterialType,
  ValidationError,
  RebalanceConfig,
} from '@/types';
import { validateTargetWeights } from '../optimization/rebalanceEngine';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  infos: ValidationError[];
}

function createError(
  category: ValidationError['category'],
  severity: ValidationError['severity'],
  materialId: string,
  materialType: MaterialType,
  message: string,
  fixSuggestion: string,
  options: Partial<ValidationError> = {}
): ValidationError {
  return {
    id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    category,
    severity,
    materialId,
    materialType,
    message,
    fixSuggestion,
    ...options,
  };
}

export function validateHoldings(
  holdings: Holding[],
  materialId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (holdings.length === 0) {
    errors.push(
      createError(
        'data_integrity',
        'error',
        materialId,
        'holding',
        '持仓表为空，没有任何持仓数据',
        '请导入包含至少一条持仓记录的CSV/Excel文件',
        {
          requiredData: {
            description: '资产持仓表',
            format: 'CSV或Excel，包含列：代码/名称/持仓数量/成本价/市价/买入日期',
            example: '600519,贵州茅台,100,1800.00,1850.00,2024-01-15',
          },
        }
      )
    );
    return errors;
  }

  const symbolSet = new Set<string>();

  holdings.forEach((holding, index) => {
    const rowNum = index + 1;

    if (!holding.symbol || holding.symbol.trim() === '') {
      errors.push(
        createError(
          'data_integrity',
          'error',
          materialId,
          'holding',
          `第${rowNum}行：证券代码为空`,
          '请补充该持仓的证券代码',
          { rowIndex: index, fieldName: 'symbol' }
        )
      );
    } else {
      if (symbolSet.has(holding.symbol)) {
        errors.push(
          createError(
            'data_integrity',
            'warning',
            materialId,
            'holding',
            `第${rowNum}行：证券代码${holding.symbol}重复出现`,
            '请检查并合并重复的持仓记录',
            { rowIndex: index, fieldName: 'symbol', currentValue: holding.symbol }
          )
        );
      }
      symbolSet.add(holding.symbol);
    }

    if (!holding.name || holding.name.trim() === '') {
      errors.push(
        createError(
          'data_integrity',
          'warning',
          materialId,
          'holding',
          `第${rowNum}行：证券名称为空`,
          '建议补充证券名称以便于识别',
          { rowIndex: index, fieldName: 'name' }
        )
      );
    }

    if (holding.quantity <= 0) {
      errors.push(
        createError(
          'data_integrity',
          'error',
          materialId,
          'holding',
          `第${rowNum}行：持仓数量${holding.quantity}不合法`,
          '请填写大于0的持仓数量',
          { rowIndex: index, fieldName: 'quantity', currentValue: holding.quantity, expectedValue: '> 0' }
        )
      );
    }

    if (holding.costBasis <= 0) {
      errors.push(
        createError(
          'tax',
          'warning',
          materialId,
          'holding',
          `第${rowNum}行：成本价${holding.costBasis}不合法，将影响税费计算`,
          '请补充正确的成本价，否则税费计算可能不准确',
          { rowIndex: index, fieldName: 'costBasis', currentValue: holding.costBasis }
        )
      );
    }

    if (holding.marketPrice <= 0) {
      errors.push(
        createError(
          'data_integrity',
          'error',
          materialId,
          'holding',
          `第${rowNum}行：市价${holding.marketPrice}不合法`,
          '请补充正确的当前市价',
          { rowIndex: index, fieldName: 'marketPrice', currentValue: holding.marketPrice }
        )
      );
    }

    if (!holding.purchaseDate || isNaN(holding.purchaseDate.getTime())) {
      errors.push(
        createError(
          'tax',
          'warning',
          materialId,
          'holding',
          `第${rowNum}行：买入日期为空或格式错误，将影响持有期判断`,
          '请补充正确的买入日期（格式：YYYY-MM-DD），否则无法准确计算持有期和适用税率',
          {
            rowIndex: index,
            fieldName: 'purchaseDate',
            requiredData: {
              description: '买入日期',
              format: 'YYYY-MM-DD',
              example: '2024-01-15',
            },
          }
        )
      );
    }
  });

  return errors;
}

export function validateTargetWeightsData(
  targetWeights: TargetWeight[],
  materialId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (targetWeights.length === 0) {
    errors.push(
      createError(
        'data_integrity',
        'error',
        materialId,
        'target',
        '目标权重表为空',
        '请导入包含目标权重配置的CSV/Excel文件',
        {
          requiredData: {
            description: '目标权重表',
            format: 'CSV或Excel，包含列：代码/目标权重',
            example: '600519,0.15',
          },
        }
      )
    );
    return errors;
  }

  const symbolSet = new Set<string>();

  targetWeights.forEach((tw, index) => {
    const rowNum = index + 1;

    if (!tw.symbol || tw.symbol.trim() === '') {
      errors.push(
        createError(
          'data_integrity',
          'error',
          materialId,
          'target',
          `第${rowNum}行：证券代码为空`,
          '请补充该条目标权重的证券代码',
          { rowIndex: index, fieldName: 'symbol' }
        )
      );
    } else {
      if (symbolSet.has(tw.symbol)) {
        errors.push(
          createError(
            'data_integrity',
            'error',
            materialId,
            'target',
            `第${rowNum}行：证券代码${tw.symbol}重复出现`,
            '请检查并删除重复的目标权重记录',
            { rowIndex: index, fieldName: 'symbol', currentValue: tw.symbol }
          )
        );
      }
      symbolSet.add(tw.symbol);
    }

    if (tw.targetWeight < 0 || tw.targetWeight > 1) {
      errors.push(
        createError(
          'weight',
          'error',
          materialId,
          'target',
          `第${rowNum}行：目标权重${tw.targetWeight}不合法，应在0到1之间`,
          '请填写0到1之间的目标权重（如0.15表示15%）',
          { rowIndex: index, fieldName: 'targetWeight', currentValue: tw.targetWeight, expectedValue: '0-1' }
        )
      );
    }
  });

  const weightValidation = validateTargetWeights(targetWeights);
  if (!weightValidation.valid) {
    errors.push(
      createError(
        'weight',
        'error',
        materialId,
        'target',
        `目标权重合计为${(weightValidation.sum * 100).toFixed(4)}%，与100%相差${(weightValidation.diff * 100).toFixed(4)}个百分点`,
        weightValidation.sum < 1.0 
          ? `权重不足，请增加${((1.0 - weightValidation.sum) * 100).toFixed(4)}个百分点的配置，或补全新增标的`
          : `权重超额，请减少${((weightValidation.sum - 1.0) * 100).toFixed(4)}个百分点的配置`,
        {
          category: 'weight',
          currentValue: weightValidation.sum,
          expectedValue: 1.0,
        }
      )
    );
  } else if (weightValidation.diff > 0.0001) {
    errors.push(
      createError(
        'weight',
        'info',
        materialId,
        'target',
        `目标权重合计为${(weightValidation.sum * 100).toFixed(4)}%，存在微小偏差`,
        '系统将自动按比例归一化，建议手动核对权重配置',
        {
          category: 'weight',
          currentValue: weightValidation.sum,
          expectedValue: 1.0,
        }
      )
    );
  }

  return errors;
}

export function validatePriceQuotes(
  priceQuotes: PriceQuote[],
  materialId: string,
  holdings: Holding[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (priceQuotes.length === 0) {
    errors.push(
      createError(
        'data_integrity',
        'warning',
        materialId,
        'price',
        '买卖报价表为空，将使用持仓表中的市价进行计算',
        '如有最新买卖报价，建议导入以获得更准确的交易成本估算',
        {
          requiredData: {
            description: '买卖报价表',
            format: 'CSV或Excel，包含列：代码/买入价/卖出价',
            example: '600519,1849.50,1850.50',
          },
        }
      )
    );
    return errors;
  }

  const holdingSymbols = new Set(holdings.map(h => h.symbol));
  const quoteSymbols = new Set(priceQuotes.map(q => q.symbol));

  holdings.forEach((holding, index) => {
    if (!quoteSymbols.has(holding.symbol)) {
      errors.push(
        createError(
          'data_integrity',
          'warning',
          materialId,
          'price',
          `持仓${holding.symbol}(${holding.name})缺少买卖报价，将使用持仓市价计算`,
          `请补充${holding.symbol}的买卖报价以提高计算准确性`,
          { rowIndex: index, fieldName: 'symbol', currentValue: holding.symbol }
        )
      );
    }
  });

  priceQuotes.forEach((quote, index) => {
    const rowNum = index + 1;

    if (!quote.symbol || quote.symbol.trim() === '') {
      errors.push(
        createError(
          'data_integrity',
          'error',
          materialId,
          'price',
          `第${rowNum}行：证券代码为空`,
          '请补充该报价的证券代码',
          { rowIndex: index, fieldName: 'symbol' }
        )
      );
    }

    if (quote.bidPrice <= 0) {
      errors.push(
        createError(
          'data_integrity',
          'error',
          materialId,
          'price',
          `第${rowNum}行：买入价${quote.bidPrice}不合法`,
          '请补充正确的买入报价',
          { rowIndex: index, fieldName: 'bidPrice', currentValue: quote.bidPrice }
        )
      );
    }

    if (quote.askPrice <= 0) {
      errors.push(
        createError(
          'data_integrity',
          'error',
          materialId,
          'price',
          `第${rowNum}行：卖出价${quote.askPrice}不合法`,
          '请补充正确的卖出报价',
          { rowIndex: index, fieldName: 'askPrice', currentValue: quote.askPrice }
        )
      );
    }

    if (quote.bidPrice > quote.askPrice) {
      errors.push(
        createError(
          'data_integrity',
          'warning',
          materialId,
          'price',
          `第${rowNum}行：买入价${quote.bidPrice}高于卖出价${quote.askPrice}，可能存在数据错误`,
          '请检查买卖报价是否填写颠倒',
          { rowIndex: index, fieldName: 'bidPrice', currentValue: quote.bidPrice }
        )
      );
    }

    if (!holdingSymbols.has(quote.symbol)) {
      errors.push(
        createError(
          'data_integrity',
          'info',
          materialId,
          'price',
          `报价${quote.symbol}不在持仓列表中，将被忽略`,
          '如该标的为拟新增标的，请先在目标权重表中配置',
          { rowIndex: index, fieldName: 'symbol', currentValue: quote.symbol }
        )
      );
    }
  });

  return errors;
}

export function validateCrossDataConsistency(
  holdings: Holding[],
  targetWeights: TargetWeight[],
  materialIds: { holding: string; target: string }
): ValidationError[] {
  const errors: ValidationError[] = [];

  const holdingSymbols = new Set(holdings.map(h => h.symbol));
  const targetSymbols = new Set(targetWeights.map(tw => tw.symbol));

  targetWeights.forEach((tw, index) => {
    if (!holdingSymbols.has(tw.symbol)) {
      errors.push(
        createError(
          'data_integrity',
          'warning',
          materialIds.target,
          'target',
          `目标权重中的${tw.symbol}不在持仓表中`,
          '如为新增标的，请确认买入计划；如为数据错误，请修正证券代码',
          { rowIndex: index, fieldName: 'symbol', currentValue: tw.symbol }
        )
      );
    }
  });

  holdings.forEach((holding, index) => {
    if (!targetSymbols.has(holding.symbol)) {
      errors.push(
        createError(
          'data_integrity',
          'warning',
          materialIds.holding,
          'holding',
          `持仓${holding.symbol}(${holding.name})不在目标权重表中`,
          '系统将默认目标权重为0，建议检查是否遗漏或该标的应全部卖出',
          { rowIndex: index, fieldName: 'symbol', currentValue: holding.symbol }
        )
      );
    }
  });

  return errors;
}

export function validateConfig(config: RebalanceConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.taxRules.stampDutyRate < 0) {
    errors.push(
      createError(
        'tax',
        'error',
        'config',
        'holding',
        `印花税率${config.taxRules.stampDutyRate}不能为负数`,
        '请设置大于等于0的印花税率',
        { fieldName: 'stampDutyRate', currentValue: config.taxRules.stampDutyRate }
      )
    );
  }

  if (config.taxRules.commissionRate < 0) {
    errors.push(
      createError(
        'tax',
        'error',
        'config',
        'holding',
        `佣金率${config.taxRules.commissionRate}不能为负数`,
        '请设置大于等于0的佣金率',
        { fieldName: 'commissionRate', currentValue: config.taxRules.commissionRate }
      )
    );
  }

  if (config.taxRules.commissionMin < 0) {
    errors.push(
      createError(
        'tax',
        'error',
        'config',
        'holding',
        `最低佣金${config.taxRules.commissionMin}不能为负数`,
        '请设置大于等于0的最低佣金',
        { fieldName: 'commissionMin', currentValue: config.taxRules.commissionMin }
      )
    );
  }

  if (config.constraints.maxTurnoverPct < 0 || config.constraints.maxTurnoverPct > 1) {
    errors.push(
      createError(
        'data_integrity',
        'error',
        'config',
        'holding',
        `最大换手率${config.constraints.maxTurnoverPct}应在0到1之间`,
        '请设置0到1之间的最大换手率（如0.3表示30%）',
        { fieldName: 'maxTurnoverPct', currentValue: config.constraints.maxTurnoverPct }
      )
    );
  }

  if (config.constraints.minTradeValue < 0) {
    errors.push(
      createError(
        'data_integrity',
        'error',
        'config',
        'holding',
        `最小交易金额${config.constraints.minTradeValue}不能为负数`,
        '请设置大于等于0的最小交易金额',
        { fieldName: 'minTradeValue', currentValue: config.constraints.minTradeValue }
      )
    );
  }

  return errors;
}

export function runFullValidation(
  holdings: Holding[],
  targetWeights: TargetWeight[],
  priceQuotes: PriceQuote[],
  config: RebalanceConfig,
  materialIds: { holding: string; target: string; price: string }
): ValidationResult {
  const allErrors: ValidationError[] = [];

  allErrors.push(...validateHoldings(holdings, materialIds.holding));
  allErrors.push(...validateTargetWeightsData(targetWeights, materialIds.target));
  allErrors.push(...validatePriceQuotes(priceQuotes, materialIds.price, holdings));
  allErrors.push(...validateCrossDataConsistency(holdings, targetWeights, materialIds));
  allErrors.push(...validateConfig(config));

  return {
    isValid: allErrors.filter(e => e.severity === 'error').length === 0,
    errors: allErrors.filter(e => e.severity === 'error'),
    warnings: allErrors.filter(e => e.severity === 'warning'),
    infos: allErrors.filter(e => e.severity === 'info'),
  };
}

export function validateAll(
  holdings: Holding[],
  targetWeights: TargetWeight[],
  priceQuotes: PriceQuote[],
  config: RebalanceConfig,
  materialIds: { holding: string; target: string; price: string }
): ValidationError[] {
  const result = runFullValidation(holdings, targetWeights, priceQuotes, config, materialIds);
  return [...result.errors, ...result.warnings, ...result.infos];
}
