import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api';

async function verifyFixes() {
  console.log('=== 验证第二轮修复 ===\n');

  try {
    console.log('1. 测试结算周期查询（存在的周期）...');
    const result1 = await axios.get(`${BASE_URL}/records?settlementPeriod=2026-W21`);
    console.log('   ✓ 查询成功，返回', result1.data.total, '条记录');
    console.log('');

    console.log('2. 测试结算周期查询（不存在的周期）...');
    const result2 = await axios.get(`${BASE_URL}/records?settlementPeriod=NOT_EXIST`);
    console.log('   ✓ 查询成功，返回', result2.data.total, '条记录');
    if (result2.data.total === 0) {
      console.log('   ✓ 正确：不存在的结算周期返回 0 条');
    } else {
      console.log('   ✗ 错误：不存在的结算周期不应返回记录');
      process.exit(1);
    }
    console.log('');

    console.log('3. 测试座位数查询（100-150座）...');
    const result3 = await axios.get(`${BASE_URL}/records?minSeats=100&maxSeats=150`);
    console.log('   ✓ 查询成功，返回', result3.data.total, '条记录');
    console.log('');

    console.log('4. 测试座位数查询（最小150座）...');
    const result4 = await axios.get(`${BASE_URL}/records?minSeats=150`);
    console.log('   ✓ 查询成功，返回', result4.data.total, '条记录');
    console.log('');

    console.log('5. 测试座位数查询（最大100座）...');
    const result5 = await axios.get(`${BASE_URL}/records?maxSeats=100`);
    console.log('   ✓ 查询成功，返回', result5.data.total, '条记录');
    console.log('');

    console.log('6. 测试座位数查询（不存在的范围）...');
    const result6 = await axios.get(`${BASE_URL}/records?minSeats=200&maxSeats=300`);
    console.log('   ✓ 查询成功，返回', result6.data.total, '条记录');
    if (result6.data.total === 0) {
      console.log('   ✓ 正确：不存在的座位范围返回 0 条');
    } else {
      console.log('   ✗ 错误：不存在的座位范围不应返回记录');
      process.exit(1);
    }
    console.log('');

    console.log('7. 测试导出摘要（无效条件下返回 0 条并显示正确条件）...');
    try {
      await axios.get(`${BASE_URL}/export?settlementPeriod=NOT_EXIST`, {
        responseType: 'arraybuffer'
      });
      console.log('   ✗ 错误：无效条件下导出应返回 404');
      process.exit(1);
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('   ✓ 正确：无效条件下导出返回 404');
      } else {
        throw error;
      }
    }
    console.log('');

    console.log('8. 测试导出摘要（有效条件下显示正确信息）...');
    const exportResult = await axios.get(`${BASE_URL}/export?settlementPeriod=2026-W21&minSeats=100`, {
      responseType: 'arraybuffer'
    });
    const exportCount = exportResult.headers['x-export-count'];
    const exportSummary = decodeURIComponent(exportResult.headers['x-export-summary'] || '');
    console.log('   ✓ 导出成功');
    console.log('   - 导出数量:', exportCount, '条');
    console.log('   - 导出摘要:', exportSummary);
    
    if (exportSummary.includes('结算周期：2026-W21') && exportSummary.includes('座位数≥100')) {
      console.log('   ✓ 正确：摘要包含所有查询条件');
    } else {
      console.log('   ✗ 错误：摘要未正确显示查询条件');
      process.exit(1);
    }
    console.log('');

    console.log('9. 测试多条件组合查询（结算周期 + 影片 + 状态）...');
    const result9 = await axios.get(`${BASE_URL}/records?settlementPeriod=2026-W21&filmName=流浪地球&status=approved`);
    console.log('   ✓ 查询成功，返回', result9.data.total, '条记录');
    console.log('');

    console.log('=== 所有验证通过！ ===');
    console.log('\n修复总结:');
    console.log('- settlementPeriod 参数现在正确过滤记录');
    console.log('- 新增 minSeats/maxSeats 参数支持按影厅座位数查询');
    console.log('- 无效查询条件（如不存在的结算周期）正确返回 0 条');
    console.log('- 导出摘要正确显示所有查询条件，不再错误显示"全部数据"');

  } catch (error: any) {
    console.error('   ✗ 验证失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

verifyFixes();
