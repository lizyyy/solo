const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../db/database');

function calculateTax(declaredValue, category = 'general') {
  const rules = {
    general: { dutyRate: 0.1, vatRate: 0.13, consumptionTaxRate: 0 },
    electronics: { dutyRate: 0.15, vatRate: 0.13, consumptionTaxRate: 0 },
    luxury: { dutyRate: 0.3, vatRate: 0.13, consumptionTaxRate: 0.2 },
    food: { dutyRate: 0.05, vatRate: 0.09, consumptionTaxRate: 0 },
    cosmetics: { dutyRate: 0.2, vatRate: 0.13, consumptionTaxRate: 0.15 }
  };

  const rule = rules[category] || rules.general;
  
  const customsDuty = declaredValue * rule.dutyRate;
  const taxableValue = declaredValue + customsDuty;
  const consumptionTax = taxableValue * rule.consumptionTaxRate / (1 - rule.consumptionTaxRate);
  const valueAddedTax = (declaredValue + customsDuty + consumptionTax) * rule.vatRate;
  const totalTax = customsDuty + consumptionTax + valueAddedTax;

  return {
    customsDuty: Math.round(customsDuty * 100) / 100,
    valueAddedTax: Math.round(valueAddedTax * 100) / 100,
    consumptionTax: Math.round(consumptionTax * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    calculationRules: JSON.stringify(rule)
  };
}

router.post('/calculate/:packageId', async (req, res) => {
  try {
    const { category, operator } = req.body;
    const pkg = await getQuery('SELECT * FROM packages WHERE id = ?', [req.params.packageId]);
    
    if (!pkg) {
      return res.status(404).json({ error: '包裹不存在' });
    }

    const taxResult = calculateTax(pkg.declared_value || 0, category);

    await runQuery(
      `INSERT INTO tax_calculations (id, package_id, customs_duty, value_added_tax, consumption_tax, total_tax, calculation_rules, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'calculated')`,
      [uuidv4(), req.params.packageId, taxResult.customsDuty, taxResult.valueAddedTax, taxResult.consumptionTax, taxResult.totalTax, taxResult.calculationRules]
    );

    await runQuery(
      `INSERT INTO operation_logs (id, package_id, operation_type, operator, details)
       VALUES (?, ?, 'tax_calculated', ?, ?)`,
      [uuidv4(), req.params.packageId, operator || 'system', JSON.stringify(taxResult)]
    );

    res.json(taxResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:packageId', async (req, res) => {
  try {
    const calculations = await allQuery(
      'SELECT * FROM tax_calculations WHERE package_id = ? ORDER BY created_at DESC',
      [req.params.packageId]
    );
    res.json(calculations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
