class TaxSeparationService {
  static roundToTwoDecimals(num) {
    return Math.round(num * 100) / 100;
  }

  static roundToSixDecimals(num) {
    return Math.round(num * 1000000) / 1000000;
  }

  static calculateFromIncludingTax(amountWithTax, taxRate) {
    const taxRateDecimal = this.roundToSixDecimals(taxRate);
    const amountWithoutTax = this.roundToTwoDecimals(amountWithTax / (1 + taxRateDecimal));
    const taxAmount = this.roundToTwoDecimals(amountWithTax - amountWithoutTax);
    
    return {
      amountWithTax: this.roundToTwoDecimals(amountWithTax),
      amountWithoutTax: amountWithoutTax,
      taxAmount: taxAmount,
      taxRate: taxRateDecimal,
      verification: {
        checkAmount: this.roundToTwoDecimals(amountWithoutTax + taxAmount),
        equalsInput: this.roundToTwoDecimals(amountWithoutTax + taxAmount) === this.roundToTwoDecimals(amountWithTax),
        formulaUsed: `不含税价 = 含税价 ÷ (1 + 税率) = ${amountWithTax} ÷ (1 + ${taxRateDecimal}) = ${amountWithoutTax}`
      }
    };
  }

  static calculateFromExcludingTax(amountWithoutTax, taxRate) {
    const taxRateDecimal = this.roundToSixDecimals(taxRate);
    const taxAmount = this.roundToTwoDecimals(amountWithoutTax * taxRateDecimal);
    const amountWithTax = this.roundToTwoDecimals(amountWithoutTax + taxAmount);
    
    return {
      amountWithTax: amountWithTax,
      amountWithoutTax: this.roundToTwoDecimals(amountWithoutTax),
      taxAmount: taxAmount,
      taxRate: taxRateDecimal,
      verification: {
        checkAmount: this.roundToTwoDecimals(amountWithoutTax + taxAmount),
        equalsCalculated: this.roundToTwoDecimals(amountWithoutTax + taxAmount) === amountWithTax,
        formulaUsed: `含税价 = 不含税价 × (1 + 税率) = ${amountWithoutTax} × (1 + ${taxRateDecimal}) = ${amountWithTax}`
      }
    };
  }

  static calculateFromTotalAmount(totalAmount, taxRate, priceType) {
    if (priceType === 'WITH_TAX') {
      return this.calculateFromIncludingTax(totalAmount, taxRate);
    } else if (priceType === 'WITHOUT_TAX') {
      return this.calculateFromExcludingTax(totalAmount, taxRate);
    } else {
      throw new Error(`未知的价格类型: ${priceType}。请使用 'WITH_TAX'（含税价）或 'WITHOUT_TAX'（不含税价）。`);
    }
  }

  static calculateItems(items, taxRate, priceType) {
    const calculatedItems = items.map((item, index) => {
      const itemTaxRate = item.taxRate !== undefined ? item.taxRate : taxRate;
      const itemPriceType = item.priceType || priceType;
      
      let calculation;
      if (itemPriceType === 'WITH_TAX') {
        calculation = this.calculateFromIncludingTax(item.amount, itemTaxRate);
      } else if (itemPriceType === 'WITHOUT_TAX') {
        calculation = this.calculateFromExcludingTax(item.amount, itemTaxRate);
      } else {
        throw new Error(`明细项 ${index + 1} 的价格类型无效: ${itemPriceType}`);
      }
      
      return {
        ...item,
        taxRate: itemTaxRate,
        priceType: itemPriceType,
        amountWithTax: calculation.amountWithTax,
        amountWithoutTax: calculation.amountWithoutTax,
        taxAmount: calculation.taxAmount,
        verification: calculation.verification
      };
    });

    const totals = calculatedItems.reduce(
      (acc, item) => ({
        amountWithTax: acc.amountWithTax + item.amountWithTax,
        amountWithoutTax: acc.amountWithoutTax + item.amountWithoutTax,
        taxAmount: acc.taxAmount + item.taxAmount
      }),
      { amountWithTax: 0, amountWithoutTax: 0, taxAmount: 0 }
    );

    const roundedTotals = {
      amountWithTax: this.roundToTwoDecimals(totals.amountWithTax),
      amountWithoutTax: this.roundToTwoDecimals(totals.amountWithoutTax),
      taxAmount: this.roundToTwoDecimals(totals.taxAmount)
    };

    return {
      items: calculatedItems,
      totals: {
        ...roundedTotals,
        verification: {
          sumCheck: `明细合计：含税价 ${roundedTotals.amountWithTax} = 不含税价 ${roundedTotals.amountWithoutTax} + 税额 ${roundedTotals.taxAmount}`,
          mathCheck: this.roundToTwoDecimals(roundedTotals.amountWithoutTax + roundedTotals.taxAmount) === roundedTotals.amountWithTax
        }
      }
    };
  }

  static verifyCalculation(calculation) {
    const { amountWithTax, amountWithoutTax, taxAmount, taxRate } = calculation;
    
    const expectedTaxFromIncluding = this.roundToTwoDecimals(amountWithTax * taxRate / (1 + taxRate));
    const expectedTaxFromExcluding = this.roundToTwoDecimals(amountWithoutTax * taxRate);
    const sumCheck = this.roundToTwoDecimals(amountWithoutTax + taxAmount);
    const equalsWithTax = sumCheck === this.roundToTwoDecimals(amountWithTax);
    
    return {
      isValid: equalsWithTax,
      checks: {
        sumCheck: `${amountWithoutTax} + ${taxAmount} = ${sumCheck} ${equalsWithTax ? '=' : '≠'} ${amountWithTax}`,
        taxFromIncludingTax: `按含税价反算税额：${amountWithTax} × ${taxRate} / (1 + ${taxRate}) = ${expectedTaxFromIncluding}`,
        taxFromExcludingTax: `按不含税价反算税额：${amountWithoutTax} × ${taxRate} = ${expectedTaxFromExcluding}`,
        roundingNote: '所有金额均保留两位小数，可能存在四舍五入差异'
      }
    };
  }

  static formatCurrency(num) {
    return '¥' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  static generateBusinessReport(calculation, contractInfo = {}) {
    const verification = this.verifyCalculation(calculation);
    
    return {
      businessSummary: {
        contractTitle: contractInfo.title || '未命名合同',
        contractNo: contractInfo.contractNo || '未编号',
        calculationDate: new Date().toISOString().split('T')[0],
        taxRate: (calculation.taxRate * 100).toFixed(2) + '%'
      },
      amounts: {
        amountWithTax: calculation.amountWithTax,
        amountWithTaxFormatted: this.formatCurrency(calculation.amountWithTax),
        amountWithoutTax: calculation.amountWithoutTax,
        amountWithoutTaxFormatted: this.formatCurrency(calculation.amountWithoutTax),
        taxAmount: calculation.taxAmount,
        taxAmountFormatted: this.formatCurrency(calculation.taxAmount)
      },
      calculationLogic: calculation.verification?.formulaUsed || '已应用价税分离公式',
      verification: {
        status: verification.isValid ? '计算正确' : '计算存在差异，请检查',
        details: verification.checks
      },
      breakdown: {
        description: `本合同含税价 ${this.formatCurrency(calculation.amountWithTax)}，其中不含税价 ${this.formatCurrency(calculation.amountWithoutTax)}，增值税税额 ${this.formatCurrency(calculation.taxAmount)}。`
      }
    };
  }
}

module.exports = TaxSeparationService;
