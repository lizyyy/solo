const XLSX = require('xlsx');
const path = require('path');

function generateTestExcel(outputPath) {
  const workbook = XLSX.utils.book_new();

  const data1 = [
    ['名称', '数值'],
    ['项目A', 100],
    ['项目B', 200],
    ['项目C', 300]
  ];
  const sheet1 = XLSX.utils.aoa_to_sheet(data1);
  XLSX.utils.book_append_sheet(workbook, sheet1, '数据源');

  const data2 = [
    ['项目', '值', '公式'],
    ['测试1', '=数据源!A2', '引用A列'],
    ['测试2', '=数据源!B100', '超出范围'],
    ['测试3', '=不存在的表!C5', '工作表不存在'],
    ['测试4', '=数据源!A1:C100', '正常范围'],
    ['测试5', '=数据源!A1:Z1000', '超出范围'],
  ];
  const sheet2 = XLSX.utils.aoa_to_sheet(data2);

  sheet2['B2'].f = '=数据源!A2';
  sheet2['B3'].f = '=数据源!B100';
  sheet2['B4'].f = '=不存在的表!C5';
  sheet2['B5'].f = '=数据源!A1:C100';
  sheet2['B6'].f = '=数据源!A1:Z1000';

  XLSX.utils.book_append_sheet(workbook, sheet2, '汇总表');

  const data3 = [
    ['ID', '计算'],
    [1, '=数据源!B2'],
    [2, '=数据源!B3'],
    [3, '=汇总表!B10'],
  ];
  const sheet3 = XLSX.utils.aoa_to_sheet(data3);
  sheet3['B2'].f = '=数据源!B2';
  sheet3['B3'].f = '=数据源!B3';
  sheet3['B4'].f = '=汇总表!B10';
  XLSX.utils.book_append_sheet(workbook, sheet3, '计算表');

  XLSX.writeFile(workbook, outputPath);
  console.log(`✅ 测试文件已生成: ${outputPath}`);
}

generateTestExcel(path.join(__dirname, 'test-data.xlsx'));
