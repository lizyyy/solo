const { initDb } = require('./database');
const contractService = require('./contractService');

const runTest = async () => {
  await initDb();
  console.log('数据库初始化完成');
  
  const contractData = {
    contract_no: 'TEST-001',
    parties: {
      transferor: '张三',
      transferee: '李四'
    },
    start_date: '2024-01-01',
    end_date: '2026-01-01',
    land_plots: [
      { plot_no: 'P1', area: 50.5, location: '东村一组' },
      { plot_no: 'P2', area: 30.0, location: '东村二组' }
    ],
    rent_plans: [
      { period_start: '2024-01-01', period_end: '2025-01-01', amount: 10100 },
      { period_start: '2025-01-01', period_end: '2026-01-01', amount: 10100 }
    ]
  };

  try {
    console.log('\n创建合同...');
    const result = await contractService.createContract(contractData);
    console.log('创建成功!');
    console.log('合同ID:', result.id);
    console.log('总面积:', result.total_area);
    console.log('总租金:', result.total_rent);
    console.log('当前版本:', result.current_version);
    console.log('地块数:', result.land_plots.length);
    console.log('租金计划数:', result.rent_plans.length);
  } catch (e) {
    console.log('创建失败:', e.message);
    console.log('完整错误:', e);
  }
};

runTest().catch(console.error);
