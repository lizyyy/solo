import axios from 'axios';
import * as fs from 'fs';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:3000/api';

async function testFlow() {
  console.log('=== 院线运营后端服务测试流程 ===\n');

  try {
    console.log('1. 健康检查...');
    const health = await axios.get('http://localhost:3000/health');
    console.log('   ✓ 服务运行正常:', health.data.message, '\n');

    console.log('2. 创建影片合同...');
    const contract1 = await axios.post(`${BASE_URL}/contracts`, {
      filmName: '流浪地球3',
      effectiveStartDate: '2026-05-01',
      effectiveEndDate: '2026-06-30',
      subsidyRate: 0.10,
      subsidyMaxAmount: 500,
      refundDeductionRate: 0.20,
      settlementCycle: 'weekly'
    });
    console.log('   ✓ 合同1创建成功:', contract1.data.contract.filmName);

    const contract2 = await axios.post(`${BASE_URL}/contracts`, {
      filmName: '哪吒闹海',
      effectiveStartDate: '2026-05-01',
      effectiveEndDate: '2026-06-30',
      subsidyRate: 0.10,
      subsidyMaxAmount: 1000,
      refundDeductionRate: 0.15,
      settlementCycle: 'weekly'
    });
    console.log('   ✓ 合同2创建成功:', contract2.data.contract.filmName);

    const contract3 = await axios.post(`${BASE_URL}/contracts`, {
      filmName: '速度与激情11',
      effectiveStartDate: '2026-05-01',
      effectiveEndDate: '2026-06-30',
      subsidyRate: 0.08,
      subsidyMaxAmount: 800,
      refundDeductionRate: 0.25,
      settlementCycle: 'monthly'
    });
    console.log('   ✓ 合同3创建成功:', contract3.data.contract.filmName, '\n');

    console.log('3. 创建新批次...');
    const batch = await axios.post(`${BASE_URL}/batches`, {
      name: '2026年5月第3周结算批次',
      createdBy: '运营专员张三',
      settlementPeriod: '2026-W21'
    });
    const batchId = batch.data.batch.id;
    console.log('   ✓ 批次创建成功, ID:', batchId, '\n');

    console.log('4. 上传场次CSV...');
    const showtimeForm = new FormData();
    showtimeForm.append('file', fs.readFileSync('./examples/showtimes.csv'), 'showtimes.csv');
    showtimeForm.append('handler', '运营专员张三');
    
    const uploadShowtimes = await axios.post(
      `${BASE_URL}/batches/${batchId}/showtimes`,
      showtimeForm,
      { headers: showtimeForm.getHeaders() }
    );
    console.log('   ✓ 场次上传成功:');
    console.log('     - 总场次:', uploadShowtimes.data.totalCount);
    console.log('     - 跨日场次:', uploadShowtimes.data.crossDayCount);
    if (uploadShowtimes.data.crossDayWarning) {
      console.log('     ⚠️  提示:', uploadShowtimes.data.crossDayWarning);
    }
    console.log('');

    console.log('5. 上传票房JSON...');
    const boxOfficeForm = new FormData();
    boxOfficeForm.append('file', fs.readFileSync('./examples/boxoffice.json'), 'boxoffice.json');
    boxOfficeForm.append('handler', '运营专员张三');
    
    const uploadBoxOffice = await axios.post(
      `${BASE_URL}/batches/${batchId}/boxoffice`,
      boxOfficeForm,
      { headers: boxOfficeForm.getHeaders() }
    );
    console.log('   ✓ 票房上传成功:');
    console.log('     - 票房数据:', uploadBoxOffice.data.boxOfficeCount);
    console.log('     - 生成记录:', uploadBoxOffice.data.recordCount);
    console.log('     - 边界情况统计:');
    console.log('       · 跨日场次记录:', uploadBoxOffice.data.boundarySummary.crossDayRecords);
    console.log('       · 补贴超限记录:', uploadBoxOffice.data.boundarySummary.subsidyLimitRecords);
    console.log('       · 退票扣减记录:', uploadBoxOffice.data.boundarySummary.refundDeductionRecords);
    console.log('');

    console.log('6. 获取批次详情...');
    const batchDetail = await axios.get(`${BASE_URL}/batches/${batchId}`);
    console.log('   ✓ 批次详情获取成功:');
    console.log('     - 批次名称:', batchDetail.data.batch.name);
    console.log('     - 总记录数:', batchDetail.data.stats.totalRecords);
    console.log('     - 含边界情况记录:', batchDetail.data.stats.boundaryRecords?.length || 0);
    console.log('');

    console.log('7. 查询记录（按影片名称）...');
    const queryResult = await axios.get(`${BASE_URL}/records?filmName=流浪地球`);
    console.log('   ✓ 查询成功,找到', queryResult.data.total, '条记录');
    if (queryResult.data.boundarySummary.hasBoundaryCases) {
      console.log('     - 含边界情况记录');
    }
    console.log('');

    if (queryResult.data.records && queryResult.data.records.length > 0) {
      const firstRecord = queryResult.data.records[0];
      console.log('8. 获取单条记录详情（含边界说明）...');
      const recordDetail = await axios.get(`${BASE_URL}/records/${firstRecord.id}`);
      console.log('   ✓ 记录详情获取成功:');
      console.log('     - 影片:', recordDetail.data.record.filmName);
      console.log('     - 影厅:', recordDetail.data.record.hallName);
      console.log('     - 状态:', recordDetail.data.record.status);
      console.log('     - 边界情况说明:');
      recordDetail.data.boundaryExplanations.forEach((exp: string, i: number) => {
        console.log(`       ${i + 1}. ${exp}`);
      });
      console.log('');
    }

    console.log('9. 退回一条记录修改...');
    const allRecords = await axios.get(`${BASE_URL}/records`);
    if (allRecords.data.records && allRecords.data.records.length > 0) {
      const recordToReturn = allRecords.data.records[0];
      const returnResult = await axios.post(`${BASE_URL}/records/${recordToReturn.id}/return`, {
        handler: '运营主管李四',
        reason: '场次时间与实际排片不符，请核实后重新提交'
      });
      console.log('   ✓ 记录退回成功:');
      console.log('     - 记录ID:', returnResult.data.record.id);
      console.log('     - 新状态:', returnResult.data.record.status);
      console.log('     - 退回原因:', returnResult.data.record.remarks);
      console.log('');
    }

    console.log('10. 通过其余记录...');
    const approveResult = await axios.post(`${BASE_URL}/batches/${batchId}/approve`, {
      handler: '运营主管李四'
    });
    console.log('   ✓ 批次处理完成:');
    console.log('     - 通过数量:', approveResult.data.approvedCount);
    console.log('     - 批次状态:', approveResult.data.batch.status);
    console.log('');

    console.log('11. 导出CSV...');
    const exportResult = await axios.get(`${BASE_URL}/export?format=csv&includeBoundaryDetails=true`, {
      responseType: 'arraybuffer'
    });
    const exportCount = exportResult.headers['x-export-count'];
    const exportSummary = decodeURIComponent(exportResult.headers['x-export-summary'] || '');
    console.log('   ✓ CSV导出成功:');
    console.log('     - 导出数量:', exportCount, '条');
    console.log('     - 导出说明:', exportSummary);
    fs.writeFileSync('./export-result.csv', exportResult.data);
    console.log('     - 文件已保存至: ./export-result.csv');
    console.log('');

    console.log('12. 边界情况统计...');
    const stats = await axios.get(`${BASE_URL}/statistics/boundary`);
    console.log('   ✓ 统计信息获取成功:');
    console.log('     - 总记录数:', stats.data.overall.totalRecords);
    console.log('     - 待处理:', stats.data.overall.pendingCount);
    console.log('     - 已通过:', stats.data.overall.approvedCount);
    console.log('     - 已退回:', stats.data.overall.returnedCount);
    console.log('     - 含边界情况:', stats.data.boundaryStatistics.withBoundaryCases);
    console.log('     - 跨日场次占比:', stats.data.breakdown.crossDayPercentage);
    console.log('     - 补贴超限占比:', stats.data.breakdown.subsidyLimitPercentage);
    console.log('     - 退票扣减占比:', stats.data.breakdown.refundDeductionPercentage);
    console.log('');

    console.log('=== 测试流程完成！ ===');
    console.log('\n提示: 数据已持久化保存至 ./data/cinema-data.json');
    console.log('      重启服务后数据仍可查询\n');

  } catch (error: any) {
    console.error('   ✗ 测试失败:', error.response?.data || error.message);
    console.error('\n请确保服务已启动: npm run dev');
    process.exit(1);
  }
}

testFlow();
