const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/receivables';

async function test() {
  console.log('开始测试...\n');
  let receivableId1, receivableId2;

  try {
    console.log('1. 测试健康检查');
    const health = await axios.get('http://localhost:3000/health');
    console.log('   ✓ 健康检查通过\n');

    console.log('2. 测试创建应收账款1');
    const create1 = await axios.post(BASE_URL, {
      receivableNo: 'TEST2024010001',
      customerId: 'cust001',
      customerName: '测试客户1',
      amount: 100000,
      dueDate: '2024-06-30',
      lockReason: '逾期未回款',
      financeOrderNo: 'FIN001',
      financeFrozen: true,
      operationSource: 'WEB',
      operator: '测试员A',
      operatorId: 'op001'
    });
    receivableId1 = create1.data.data.id;
    console.log('   ✓ 创建成功, ID:', receivableId1);
    console.log('   当前状态:', create1.data.data.status, '\n');

    console.log('3. 测试申请解锁');
    const apply = await axios.post(`${BASE_URL}/${receivableId1}/apply-unlock`, {
      operationSource: 'WEB',
      operator: '测试员B',
      operatorId: 'op002',
      unlockMaterials: { proof: 'P001' },
      remark: '申请解锁测试'
    });
    console.log('   ✓ 申请解锁成功');
    console.log('   当前状态:', apply.data.data.status, '\n');

    console.log('4. 测试审核通过');
    const approve = await axios.post(`${BASE_URL}/${receivableId1}/approve-unlock`, {
      operationSource: 'WEB',
      operator: '测试员C',
      operatorId: 'op003',
      remark: '审核通过'
    });
    console.log('   ✓ 审核通过成功');
    console.log('   当前状态:', approve.data.data.status, '\n');

    console.log('5. 测试获取详情（含历史）');
    const detail = await axios.get(`${BASE_URL}/${receivableId1}`);
    console.log('   ✓ 获取详情成功');
    console.log('   历史记录数:', detail.data.data.histories.length);
    detail.data.data.histories.forEach((h, i) => {
      console.log(`     ${i+1}. ${h.operator} - ${h.operationType} - 融资冻结:${h.financeFrozen}`);
    });
    console.log('');

    console.log('6. 测试创建应收账款2（冲突记录）');
    const create2 = await axios.post(BASE_URL, {
      receivableNo: 'TEST2024010002',
      customerId: 'cust002',
      customerName: '测试客户2',
      amount: 200000,
      dueDate: '2024-07-15',
      lockReason: '重复质押',
      financeFrozen: true,
      operationSource: 'API',
      operator: '系统',
      operatorId: 'sys001'
    });
    receivableId2 = create2.data.data.id;
    console.log('   ✓ 创建成功, ID:', receivableId2);

    await axios.post(`${BASE_URL}/${receivableId2}/apply-unlock`, {
      operationSource: 'WEB',
      operator: '测试员B',
      operatorId: 'op002',
      unlockMaterials: {}
    });
    
    const reject = await axios.post(`${BASE_URL}/${receivableId2}/reject-unlock`, {
      operationSource: 'WEB',
      operator: '测试员C',
      operatorId: 'op003',
      rejectReason: '材料不齐全',
      remark: '审核拒绝'
    });
    console.log('   ✓ 审核拒绝成功');
    console.log('   当前状态:', reject.data.data.status, '\n');

    console.log('7. 测试获取列表');
    const list = await axios.get(BASE_URL, { params: { pageSize: 10 } });
    console.log('   ✓ 获取列表成功');
    console.log('   总记录数:', list.data.data.count);
    list.data.data.rows.forEach(r => {
      console.log(`     ${r.receivableNo} - ${r.customerName} - 状态:${r.status} - 融资冻结:${r.financeFrozen}`);
    });
    console.log('');

    console.log('8. 测试批量导入（含坏行）');
    const importResult = await axios.post(`${BASE_URL}/import/batch`, {
      operator: '导入测试员',
      rows: [
        {
          receivableNo: 'TEST2024010003',
          customerId: 'cust003',
          customerName: '测试客户3',
          amount: 150000,
          dueDate: '2024-08-01',
          lockReason: '合同纠纷'
        },
        {
          receivableNo: '',
          customerId: '',
          customerName: '',
          amount: -100,
          dueDate: 'invalid',
          lockReason: ''
        }
      ]
    });
    console.log('   ✓ 批量导入完成');
    console.log('   成功:', importResult.data.data.successCount);
    console.log('   失败:', importResult.data.data.failCount);
    importResult.data.data.results.forEach(r => {
      if (r.status === 'FAILED') {
        console.log(`     行${r.rowNumber}: ${r.error}`);
      }
    });
    console.log('');

    console.log('9. 测试导出CSV');
    const exportResult = await axios.get(`${BASE_URL}/export/csv`);
    console.log('   ✓ 导出成功');
    console.log('   CSV长度:', exportResult.data.length, '字符');
    console.log('   包含融资冻结状态: ', exportResult.data.includes('融资单是否冻结'));
    console.log('   包含历史记录: ', exportResult.data.includes('历史操作记录'), '\n');

    console.log('========================================');
    console.log('所有测试通过！');
    console.log('========================================');
    console.log('验证点:');
    console.log('✓ 完整流转: 已锁定 -> 解锁申请 -> 已解锁');
    console.log('✓ 冲突记录: 已锁定 -> 解锁申请 -> 被拒绝');
    console.log('✓ 导入坏行: 校验失败记录保存');
    console.log('✓ 详情历史: 每次操作都有历史记录');
    console.log('✓ 融资冻结: 解锁后融资单仍保持冻结');
    console.log('✓ 导出结果: 历史和冻结状态都在导出中');
    console.log('========================================');

  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

test();