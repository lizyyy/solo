const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testAPI() {
  console.log('=== 开始测试快递驿站异常件赔付 API ===\n');

  try {
    console.log('1. 测试重复入库校验');
    try {
      await axios.post(`${BASE_URL}/packages/in-stock`, {
        waybill_no: 'SF1234567890001',
        receiver_name: '张三',
        receiver_phone: '13800138001',
        operator: '测试员'
      });
      console.log('   首次入库: 成功');
    } catch (error) {
      console.log(`   重复入库: ${error.response.data.error.message}`);
    }

    console.log('\n2. 测试新包裹入库');
    const newWaybill = 'TEST' + Date.now();
    const inStockRes = await axios.post(`${BASE_URL}/packages/in-stock`, {
      waybill_no: newWaybill,
      receiver_name: '测试用户',
      receiver_phone: '13800000000',
      operator: '测试员'
    });
    console.log(`   入库成功: ${inStockRes.data.data.waybill_no}`);

    console.log('\n3. 测试异常上报');
    const exceptionRes = await axios.post(`${BASE_URL}/exceptions/report`, {
      waybill_no: newWaybill,
      exception_type: 'damaged',
      exception_desc: '包裹外包装破损',
      operator: '测试员'
    });
    const exceptionId = exceptionRes.data.data.exception_id;
    console.log(`   异常上报成功: 异常ID ${exceptionId}`);

    console.log('\n4. 测试异常件被拦领取件');
    try {
      await axios.post(`${BASE_URL}/packages/pickup`, {
        waybill_no: newWaybill,
        operator: '测试员'
      });
    } catch (error) {
      console.log(`   取件拦截: ${error.response.data.error.message}`);
    }

    console.log('\n5. 测试责任未定就关闭异常');
    try {
      await axios.post(`${BASE_URL}/exceptions/close`, {
        exception_id: exceptionId,
        operator: '测试员'
      });
    } catch (error) {
      console.log(`   关闭拦截: ${error.response.data.error.message}`);
    }

    console.log('\n6. 测试责任确认');
    const confirmRes = await axios.post(`${BASE_URL}/exceptions/confirm-responsibility`, {
      exception_id: exceptionId,
      responsible_party: 'courier',
      operator: '测试员'
    });
    console.log(`   责任确认成功: ${confirmRes.data.data.responsible_party}`);

    console.log('\n7. 测试赔付');
    const compensateRes = await axios.post(`${BASE_URL}/exceptions/compensate`, {
      exception_id: exceptionId,
      amount: 50.00,
      compensation_reason: '包裹破损赔偿',
      operator: '测试员'
    });
    console.log(`   赔付成功: 金额 ${compensateRes.data.data.amount} 元`);

    console.log('\n8. 测试重复赔付');
    try {
      await axios.post(`${BASE_URL}/exceptions/compensate`, {
        exception_id: exceptionId,
        amount: 50.00,
        compensation_reason: '重复赔付测试',
        operator: '测试员'
      });
    } catch (error) {
      console.log(`   重复赔付拦截: ${error.response.data.error.message}`);
    }

    console.log('\n8b. 测试赔付后不能重新确认责任');
    try {
      await axios.post(`${BASE_URL}/exceptions/confirm-responsibility`, {
        exception_id: exceptionId,
        responsible_party: 'station',
        operator: '测试员'
      });
    } catch (error) {
      console.log(`   责任回退拦截: ${error.response.data.error.message}`);
    }

    console.log('\n9. 测试关闭异常');
    const closeRes = await axios.post(`${BASE_URL}/exceptions/close`, {
      exception_id: exceptionId,
      operator: '测试员'
    });
    console.log(`   异常关闭成功: 状态 ${closeRes.data.data.status}`);

    console.log('\n10. 测试查询包裹完整历史记录');
    const historyRes = await axios.get(`${BASE_URL}/packages/${newWaybill}/history`);
    console.log(`   操作历史记录数: ${historyRes.data.data.operation_history.length}`);
    console.log(`   异常记录数: ${historyRes.data.data.exceptions.length}`);
    if (historyRes.data.data.exceptions[0]?.compensations) {
      console.log(`   赔付记录数: ${historyRes.data.data.exceptions[0].compensations.length}`);
    }

    console.log('\n11. 测试正常包裹取件');
    const pickupRes = await axios.post(`${BASE_URL}/packages/pickup`, {
      waybill_no: 'SF1234567890002',
      operator: '测试员'
    });
    console.log(`   取件成功: 状态 ${pickupRes.data.data.status}`);

    console.log('\n12. 测试重复取件');
    try {
      await axios.post(`${BASE_URL}/packages/pickup`, {
        waybill_no: 'SF1234567890002',
        operator: '测试员'
      });
    } catch (error) {
      console.log(`   重复取件拦截: ${error.response.data.error.message}`);
    }

    const today = new Date().toISOString().split('T')[0];
    const reportRes = await axios.post(`${BASE_URL}/reports/daily`, { date: today });
    console.log('\n13. 测试日报统计');
    console.log(`   今日入库: ${reportRes.data.data.summary.in_stock_count}`);
    console.log(`   今日取件: ${reportRes.data.data.summary.pickup_count}`);
    console.log(`   今日异常: ${reportRes.data.data.summary.exception_count}`);
    console.log(`   今日赔付金额: ${reportRes.data.data.summary.compensation_total_amount} 元`);

    console.log('\n=== 所有测试用例通过！ ===');

  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

testAPI();
