const express = require('express');
const bodyParser = require('body-parser');
const { sequelize, FineRule } = require('./models');
const routes = require('./routes');
const { FineRuleType } = require('./constants/status');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'road-occupation-approval-system'
  });
});

app.use('/api/v1', routes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

async function initializeDatabase() {
  const isTest = process.env.NODE_ENV === 'test';
  const syncOptions = isTest ? { force: true } : { alter: true };

  await sequelize.sync(syncOptions);

  const existingRules = await FineRule.count();
  if (existingRules === 0) {
    await FineRule.bulkCreate([
      {
        name: '超期占道日罚款',
        ruleType: FineRuleType.OVERTIME,
        code: 'OVERTIME_DAILY',
        description: '超过批准期限仍占道施工的，按每日计算罚款',
        baseAmount: 500.00,
        unit: 'day',
        priority: 100,
        conditions: {
          multipliers: [
            { field: 'days', operator: 'range', min: 1, max: 7, multiplier: 1.0 },
            { field: 'days', operator: 'range', min: 8, max: 30, multiplier: 1.5 },
            { field: 'days', operator: 'range', min: 31, max: 9999, multiplier: 2.0 }
          ]
        }
      },
      {
        name: '路面损坏罚款',
        ruleType: FineRuleType.DAMAGE,
        code: 'DAMAGE_ROAD',
        description: '施工造成路面损坏的罚款',
        baseAmount: 2000.00,
        unit: 'once',
        priority: 90
      },
      {
        name: '安全违规罚款',
        ruleType: FineRuleType.SAFETY_VIOLATION,
        code: 'SAFETY_GENERAL',
        description: '违反施工安全规定的罚款',
        baseAmount: 1000.00,
        unit: 'once',
        priority: 80
      },
      {
        name: '资料不全罚款',
        ruleType: FineRuleType.DOCUMENTATION,
        code: 'DOCS_INCOMPLETE',
        description: '撤场验收时资料不全的罚款',
        baseAmount: 300.00,
        unit: 'once',
        priority: 70
      }
    ]);
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/health`);
      });
    })
    .catch(err => {
      console.error('Failed to initialize:', err);
      process.exit(1);
    });
}

module.exports = { app, initializeDatabase };
