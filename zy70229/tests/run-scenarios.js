const { TestRunner, scenarios } = require('./scenarios');

const runner = new TestRunner();

console.log(`\n${'='.repeat(70)}`);
console.log(`  电商赠品库存锁定 API - 验收测试`);
console.log(`  执行日期: ${new Date().toLocaleString()}`);
console.log(`${'='.repeat(70)}`);

console.log(`\n\n📋 测试场景列表:`);
Object.keys(scenarios).forEach((name, index) => {
  console.log(`  ${index + 1}. ${name}`);
});

const scenarioNames = Object.keys(scenarios);
let index = 0;

function runNext() {
  if (index >= scenarioNames.length) {
    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`所有场景执行完毕`);
    console.log(`${'='.repeat(70)}`);
    runner.printSummary();
    return;
  }

  runner.reset();

  const name = scenarioNames[index];
  const scenario = scenarios[name];

  runner.runScenario(name, scenario.description, scenario.steps);

  index++;
  setTimeout(runNext, 100);
}

runNext();
