process.env.DB_PATH = ':memory:';

const ruleValidator = require('../src/rule-validator');

console.log('\n🎯 运行规则验证器...');
console.log('   这会自动创建测试数据并验证每条业务规则\n');

const report = ruleValidator.runAllValidations();
const allPassed = ruleValidator.printValidationReport(report);

process.exit(allPassed ? 0 : 1);
