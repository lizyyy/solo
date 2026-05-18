const fs = require('fs');
const path = require('path');

const EXIT_CODES = {
  SUCCESS: 0,
  ERROR_CONFIG: 1,
  ERROR_INPUT: 2,
  ERROR_CALCULATION: 3,
  ERROR_OUTPUT: 4,
  RECONCILIATION_FAILED: 5
};

class VegetableReconciler {
  constructor(configPath) {
    this.config = this.loadConfig(configPath);
    this.calculationSteps = [];
  }

  loadConfig(configPath) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      throw { code: EXIT_CODES.ERROR_CONFIG, message: `配置文件加载失败: ${error.message}` };
    }
  }

  convertToKg(weight, unit) {
    if (!this.config.unitConversion.enabled) {
      return weight;
    }

    const rate = this.config.unitConversion.rates[unit];
    if (rate === undefined) {
      throw { code: EXIT_CODES.ERROR_CALCULATION, message: `未知单位: ${unit}` };
    }

    const result = weight * rate;
    this.calculationSteps.push({
      type: 'unit_conversion',
      original: { weight, unit },
      converted: { weight: result, unit: 'kg' },
      rate
    });

    return result;
  }

  deductBasketWeight(grossWeightKg, basketType, basketCount = 1) {
    if (!this.config.basketDeduction.enabled) {
      return grossWeightKg;
    }

    const basketWeight = this.config.basketDeduction.basketTypes[basketType] 
      || this.config.basketDeduction.defaultBasketWeightKg;
    
    const totalDeduction = basketWeight * basketCount;
    const netWeight = grossWeightKg - totalDeduction;

    this.calculationSteps.push({
      type: 'basket_deduction',
      grossWeightKg,
      basketType,
      basketCount,
      basketWeightKg: basketWeight,
      totalDeductionKg: totalDeduction,
      netWeightKg: netWeight
    });

    return netWeight;
  }

  calculateTolerance(expectedWeightKg) {
    const toleranceByPercent = expectedWeightKg * (this.config.reconciliationRules.tolerancePercent / 100);
    const toleranceByKg = this.config.reconciliationRules.toleranceKg;

    return this.config.reconciliationRules.useMaxTolerance 
      ? Math.max(toleranceByPercent, toleranceByKg)
      : Math.min(toleranceByPercent, toleranceByKg);
  }

  reconcileItem(deliveryItem) {
    const steps = [];
    let expectedNetWeightKg;
    let actualNetWeightKg;

    steps.push({ step: 'expected_weight_calculation', description: '计算预期净重' });
    const expectedWeightKg = this.convertToKg(deliveryItem.expectedWeight, deliveryItem.expectedWeightUnit);
    expectedNetWeightKg = this.deductBasketWeight(
      expectedWeightKg, 
      deliveryItem.basketType, 
      deliveryItem.basketCount
    );
    steps.push(...this.calculationSteps.splice(-2));

    steps.push({ step: 'actual_weight_calculation', description: '计算实际净重' });
    const actualWeightKg = this.convertToKg(deliveryItem.actualWeight, deliveryItem.actualWeightUnit);
    actualNetWeightKg = this.deductBasketWeight(
      actualWeightKg, 
      deliveryItem.basketType, 
      deliveryItem.basketCount
    );
    steps.push(...this.calculationSteps.splice(-2));

    const differenceKg = actualNetWeightKg - expectedNetWeightKg;
    const differencePercent = expectedNetWeightKg > 0 
      ? (Math.abs(differenceKg) / expectedNetWeightKg) * 100 
      : 0;

    const toleranceKg = this.calculateTolerance(expectedNetWeightKg);
    const isWithinTolerance = Math.abs(differenceKg) <= toleranceKg;

    let expectedPrice = null;
    let actualPrice = null;
    let priceDifference = null;

    if (this.config.priceCalculation.enabled && deliveryItem.unitPrice !== undefined) {
      expectedPrice = Number((expectedNetWeightKg * deliveryItem.unitPrice).toFixed(this.config.priceCalculation.rounding));
      actualPrice = Number((actualNetWeightKg * deliveryItem.unitPrice).toFixed(this.config.priceCalculation.rounding));
      priceDifference = Number((actualPrice - expectedPrice).toFixed(this.config.priceCalculation.rounding));
    }

    return {
      vegetableName: deliveryItem.vegetableName,
      vegetableCode: deliveryItem.vegetableCode,
      basketType: deliveryItem.basketType,
      basketCount: deliveryItem.basketCount,
      
      expected: {
        grossWeight: deliveryItem.expectedWeight,
        grossUnit: deliveryItem.expectedWeightUnit,
        grossWeightKg: expectedWeightKg,
        netWeightKg: expectedNetWeightKg,
        price: expectedPrice
      },

      actual: {
        grossWeight: deliveryItem.actualWeight,
        grossUnit: deliveryItem.actualWeightUnit,
        grossWeightKg: actualWeightKg,
        netWeightKg: actualNetWeightKg,
        price: actualPrice
      },

      difference: {
        weightKg: Number(differenceKg.toFixed(4)),
        weightPercent: Number(differencePercent.toFixed(4)),
        price: priceDifference,
        toleranceKg: Number(toleranceKg.toFixed(4))
      },

      status: isWithinTolerance ? 'PASS' : 'FAIL',
      isWithinTolerance,
      calculationSteps: steps,
      remarks: deliveryItem.remarks || ''
    };
  }

  reconcile(inputData) {
    if (!inputData.deliveryId || !inputData.deliveryDate || !inputData.items) {
      throw { code: EXIT_CODES.ERROR_INPUT, message: '输入数据格式不正确，缺少必要字段' };
    }

    const results = {
      deliveryId: inputData.deliveryId,
      deliveryDate: inputData.deliveryDate,
      supplier: inputData.supplier || '',
      warehouse: inputData.warehouse || '',
      reconciliationTime: new Date().toISOString(),
      ruleVersion: this.config.ruleVersion,
      
      items: [],
      summary: {
        totalItems: 0,
        passItems: 0,
        failItems: 0,
        totalExpectedNetWeightKg: 0,
        totalActualNetWeightKg: 0,
        totalDifferenceKg: 0,
        totalExpectedPrice: 0,
        totalActualPrice: 0,
        totalPriceDifference: 0
      },
      
      overallStatus: 'PASS'
    };

    inputData.items.forEach(item => {
      const reconciledItem = this.reconcileItem(item);
      results.items.push(reconciledItem);

      results.summary.totalItems++;
      if (reconciledItem.status === 'PASS') {
        results.summary.passItems++;
      } else {
        results.summary.failItems++;
      }

      results.summary.totalExpectedNetWeightKg += reconciledItem.expected.netWeightKg;
      results.summary.totalActualNetWeightKg += reconciledItem.actual.netWeightKg;
      results.summary.totalDifferenceKg += reconciledItem.difference.weightKg;

      if (reconciledItem.expected.price !== null) {
        results.summary.totalExpectedPrice += reconciledItem.expected.price;
        results.summary.totalActualPrice += reconciledItem.actual.price;
        results.summary.totalPriceDifference += reconciledItem.difference.price;
      }
    });

    results.summary.totalExpectedNetWeightKg = Number(results.summary.totalExpectedNetWeightKg.toFixed(4));
    results.summary.totalActualNetWeightKg = Number(results.summary.totalActualNetWeightKg.toFixed(4));
    results.summary.totalDifferenceKg = Number(results.summary.totalDifferenceKg.toFixed(4));
    results.summary.totalExpectedPrice = Number(results.summary.totalExpectedPrice.toFixed(2));
    results.summary.totalActualPrice = Number(results.summary.totalActualPrice.toFixed(2));
    results.summary.totalPriceDifference = Number(results.summary.totalPriceDifference.toFixed(2));

    results.overallStatus = results.summary.failItems === 0 ? 'PASS' : 'FAIL';

    if (this.config.outputConfig.sortOutput) {
      results.items.sort((a, b) => a.vegetableCode.localeCompare(b.vegetableCode));
    }

    return results;
  }

  loadInputData(inputPath) {
    try {
      const inputContent = fs.readFileSync(inputPath, 'utf8');
      return JSON.parse(inputContent);
    } catch (error) {
      throw { code: EXIT_CODES.ERROR_INPUT, message: `输入文件加载失败: ${error.message}` };
    }
  }

  saveOutput(results, outputPath) {
    try {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const outputContent = JSON.stringify(results, null, 2);
      fs.writeFileSync(outputPath, outputContent, 'utf8');
    } catch (error) {
      throw { code: EXIT_CODES.ERROR_OUTPUT, message: `输出文件保存失败: ${error.message}` };
    }
  }

  printSummary(results) {
    console.log('\n========================================');
    console.log('    蔬菜配送站称重对账结果汇总');
    console.log('========================================');
    console.log(`配送单号: ${results.deliveryId}`);
    console.log(`配送日期: ${results.deliveryDate}`);
    console.log(`对账时间: ${results.reconciliationTime}`);
    console.log(`规则版本: ${results.ruleVersion}`);
    console.log('----------------------------------------');
    console.log(`总商品数: ${results.summary.totalItems}`);
    console.log(`通过: ${results.summary.passItems} 项`);
    console.log(`异常: ${results.summary.failItems} 项`);
    console.log('----------------------------------------');
    console.log(`预期总净重: ${results.summary.totalExpectedNetWeightKg} kg`);
    console.log(`实际总净重: ${results.summary.totalActualNetWeightKg} kg`);
    console.log(`重量差异: ${results.summary.totalDifferenceKg >= 0 ? '+' : ''}${results.summary.totalDifferenceKg} kg`);
    if (results.summary.totalExpectedPrice > 0) {
      console.log('----------------------------------------');
      console.log(`预期总金额: ¥${results.summary.totalExpectedPrice}`);
      console.log(`实际总金额: ¥${results.summary.totalActualPrice}`);
      console.log(`金额差异: ¥${results.summary.totalPriceDifference >= 0 ? '+' : ''}${results.summary.totalPriceDifference}`);
    }
    console.log('----------------------------------------');
    console.log(`整体状态: ${results.overallStatus === 'PASS' ? '✓ 通过' : '✗ 存在异常'}`);
    console.log('========================================\n');

    if (results.summary.failItems > 0) {
      console.log('异常商品明细:');
      results.items.filter(item => item.status === 'FAIL').forEach(item => {
        console.log(`  - ${item.vegetableName} (${item.vegetableCode}):`);
        console.log(`    预期: ${item.expected.netWeightKg} kg, 实际: ${item.actual.netWeightKg} kg`);
        console.log(`    差异: ${item.difference.weightKg >= 0 ? '+' : ''}${item.difference.weightKg} kg (容差: ±${item.difference.toleranceKg} kg)`);
      });
      console.log('');
    }
  }
}

module.exports = { VegetableReconciler, EXIT_CODES };
