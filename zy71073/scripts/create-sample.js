const XLSX = require('xlsx');
const path = require('path');

function createSampleFinancialModel(outputPath) {
  const wb = XLSX.utils.book_new();

  const assumptionsData = [
    ['假设条件', '', '', ''],
    ['', '', '', ''],
    ['收入增长率', 0.05, '', ''],
    ['成本率', 0.6, '', ''],
    ['税率', 0.25, '', ''],
    ['折旧率', 0.1, '', ''],
    ['', '', '', ''],
    ['年份', 2024, 2025, 2026],
  ];

  const revenueData = [
    ['收入预测', '', '', ''],
    ['', '', '', ''],
    ['年份', 2024, 2025, 2026],
    ['收入', 1000, '=B4*(1+假设条件!$B$2)', '=C4*(1+假设条件!$B$2)'],
    ['', '', '', ''],
    ['成本', '=B4*假设条件!$B$3', '=C4*假设条件!$B$3', '=D4*假设条件!$B$3'],
  ];

  const profitData = [
    ['利润表', '', '', ''],
    ['', '', '', ''],
    ['年份', 2024, 2025, 2026],
    ['收入', '=收入!B4', '=收入!C4', '=收入!D4'],
    ['成本', '=收入!B6', '=收入!C6', '=收入!D6'],
    ['毛利', '=B4-B5', '=C4-C5', '=D4-D5'],
    ['折旧', '=B4*假设条件!$B$5', '=C4*假设条件!$B$5', '=D4*假设条件!$B$5'],
    ['税前利润', '=B6-B7', '=C6-C7', '=D6-D7'],
    ['所得税', '=B8*假设条件!$B$4', '=C8*假设条件!$B$4', '=D8*假设条件!$B$4'],
    ['净利润', '=B8-B9', '=C8-C9', '=D8-D9'],
  ];

  const summaryData = [
    ['关键指标汇总', '', '', ''],
    ['', '', '', ''],
    ['指标', 2024, 2025, 2026],
    ['收入', '=利润表!B4', '=利润表!C4', '=利润表!D4'],
    ['净利润', '=利润表!B10', '=利润表!C10', '=利润表!D10'],
    ['净利率', '=B5/B4', '=C5/C4', '=D5/D4'],
    ['复合增长率', '', '=POWER(C5/B5,1)-1', '=POWER(D5/B5,1/2)-1'],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(assumptionsData);
  XLSX.utils.book_append_sheet(wb, ws1, '假设条件');

  const ws2 = XLSX.utils.aoa_to_sheet(revenueData);
  XLSX.utils.book_append_sheet(wb, ws2, '收入');

  const ws3 = XLSX.utils.aoa_to_sheet(profitData);
  XLSX.utils.book_append_sheet(wb, ws3, '利润表');

  const ws4 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws4, '汇总');

  XLSX.writeFile(wb, outputPath);
  console.log(`样例文件已创建: ${outputPath}`);
}

if (require.main === module) {
  const outputPath = process.argv[2] || path.join(__dirname, '..', 'test', 'data', 'financial-model.xlsx');
  createSampleFinancialModel(outputPath);
}

module.exports = { createSampleFinancialModel };
