const path = require('path');
const { initDb, closeDb } = require('../database');
const { exportReport } = require('../exporter');

async function run(options) {
  const outputDir = path.resolve(options.output);
  const format = options.format || 'markdown';
  const reportId = options.report;
  
  if (!reportId) {
    console.error('❌ 请提供报告ID: msa export --report <id>');
    process.exit(1);
  }
  
  console.log(`📤 导出报告...`);
  console.log(`  报告ID: ${reportId}`);
  console.log(`  输出格式: ${format}`);
  
  await initDb();
  
  try {
    const result = exportReport(reportId, outputDir, format);
    return result;
  } finally {
    closeDb();
  }
}

module.exports = {
  run
};
