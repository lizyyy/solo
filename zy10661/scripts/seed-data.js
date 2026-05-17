const { initDatabase } = require('../src/db');
const { createClaim } = require('../src/services/claimService');
const { createNotice } = require('../src/services/noticeService');

async function seed() {
  await initDatabase();

  const customers = [
    { name: '张三', phone: '13800138001' },
    { name: '李四', phone: '13800138002' },
    { name: '王五', phone: '13800138003' },
    { name: '赵六', phone: '13800138004' },
    { name: '陈七', phone: '13800138005' }
  ];

  const materials = [
    { code: 'DOC001', name: '身份证复印件' },
    { code: 'DOC002', name: '医院诊断证明' },
    { code: 'DOC003', name: '医疗费用发票' },
    { code: 'DOC004', name: '住院病历' },
    { code: 'DOC005', name: '事故责任认定书' }
  ];

  const channels = ['SMS', 'EMAIL', 'APP', 'WECHAT'];
  const flowTypes = ['NORMAL', 'REJECT', 'MANUAL'];

  for (let i = 1; i <= 5; i++) {
    const customer = customers[i - 1];
    const claimNo = `CLM${String(2024000 + i).padStart(7, '0')}`;
    
    const claim = createClaim({
      claim_no: claimNo,
      customer_name: customer.name,
      customer_phone: customer.phone,
      policy_no: `POL${String(2024000 + i).padStart(7, '0')}`,
      incident_type: ['意外医疗', '车辆事故', '重大疾病'][i % 3]
    });

    createNotice({
      claim_id: claim.id,
      channel: channels[i % 4],
      deadline: '2024-12-31T23:59:59',
      flow_type: flowTypes[i % 3],
      operator_id: 'OP001',
      operator_name: '张经理',
      remark: `第${i}号理赔案补材料通知',
      materials: materials.slice(0, 2 + (i % 3)).map(m => ({
        material_code: m.code,
        material_name: m.name
      }))
    });

    console.log(`已生成理赔案: ${claimNo} (${customer.name})`);
  }

  console.log('测试数据生成完成！');
}

seed().catch(console.error);
