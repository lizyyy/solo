const path = require('path');
const { initDb, closeDb } = require('../database');
const { compareReports } = require('../exporter');

async function run(oldReport, newReport, options) {
  const outputDir = path.resolve(options.output);
  
  console.log(`📊 对比分析报告...`);
  console.log(`  旧报告: ${oldReport}`);
  console.log(`  新报告: ${newReport}`);
  
  await initDb();
  
  try {
    const result = compareReports(oldReport, newReport, outputDir);
    return result;
  } finally {
    closeDb();
  }
}

module.exports = {
  run
};
