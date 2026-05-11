const db = require('./database');

const normalizeUnit = (price, fromUnit, toUnit, categoryId) => {
  if (fromUnit === toUnit) {
    return price;
  }
  
  const conversion = db.prepare(`
    SELECT factor FROM unit_conversions 
    WHERE (category_id = ? OR category_id IS NULL) 
    AND from_unit = ? AND to_unit = ?
  `).get(categoryId, fromUnit, toUnit);
  
  if (conversion) {
    return price / conversion.factor;
  }
  
  const reverse = db.prepare(`
    SELECT factor FROM unit_conversions 
    WHERE (category_id = ? OR category_id IS NULL) 
    AND from_unit = ? AND to_unit = ?
  `).get(categoryId, toUnit, fromUnit);
  
  if (reverse) {
    return price * reverse.factor;
  }
  
  return null;
};

const normalizePriceWithTax = (unitPrice, taxRate) => {
  const rate = taxRate !== null && taxRate !== undefined ? taxRate : 0;
  return unitPrice * (1 + rate);
};

const calculateDaysRemaining = (deliveryDeadline) => {
  if (!deliveryDeadline) return null;
  const deadline = new Date(deliveryDeadline);
  const now = new Date();
  return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
};

const analyzeQuote = (quote, materialItem) => {
  const risks = [];
  const normalizedUnitPrice = normalizeUnit(
    quote.unit_price, quote.unit, materialItem.unit, materialItem.category_id);
  const unitPriceWithTax = normalizedUnitPrice !== null 
    ? normalizePriceWithTax(normalizedUnitPrice, quote.tax_rate)
    : null;

  if (quote.tax_rate === null || quote.tax_rate === undefined) {
    risks.push({
      type: 'missing_tax',
      message: '报价缺少税率信息'
    });
  }

  if (normalizedUnitPrice === null) {
    risks.push({
      type: 'unit_mismatch',
      message: `无法换算单位: ${quote.unit} -> ${materialItem.unit}`
    });
  }

  const daysRemaining = calculateDaysRemaining(materialItem.delivery_deadline);
  if (quote.delivery_days !== null && quote.delivery_days !== undefined && daysRemaining !== null) {
    if (quote.delivery_days > daysRemaining) {
      risks.push({
        type: 'delivery_overdue',
        message: `送货周期(${quote.delivery_days}天)超过项目节点(剩余${Math.ceil(daysRemaining)}天)`
      });
    }
  }

  let specDiff = [];
  const itemSpec = (materialItem.spec || '').toLowerCase();
  const quoteSpec = (quote.spec || '').toLowerCase();
  if (itemSpec !== quoteSpec && quote.is_alternative === 1) {
    specDiff.push({
      type: 'alternative_spec',
      message: `规格与需求不符: 需求${materialItem.spec}, 报价${quote.spec}`
    });
  }

  return {
    quote,
    normalizedUnitPrice,
    unitPriceWithTax,
    risks,
    specDiff
  };
};

const analyzeAllQuotesForItem = (materialItem, quotes) => {
  const analyzed = quotes.map(q => analyzeQuote(q, materialItem));
  
  const valid = analyzed
    .filter(a => a.unitPriceWithTax !== null);
  
  const recommended = valid.length > 0
    ? valid.reduce((min, curr) => curr.unitPriceWithTax < min.unitPriceWithTax ? curr : min)
    : null;

  return {
    materialItem,
    analyzedQuotes: analyzed,
    recommended,
    budgetDiff: recommended && materialItem.budget_unit_price
      ? recommended.unitPriceWithTax - materialItem.budget_unit_price
      : null
  };
};

module.exports = {
  normalizeUnit,
  normalizePriceWithTax,
  calculateDaysRemaining,
  analyzeQuote,
  analyzeAllQuotesForItem
};
