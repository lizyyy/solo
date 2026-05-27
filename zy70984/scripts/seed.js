const dayjs = require('dayjs');
const db = require('../src/db/database');
const BatchService = require('../src/services/batchService');
const PackageService = require('../src/services/packageService');

function seed() {
  console.log('开始生成示例数据...');

  const batch1 = BatchService.create({
    batch_no: 'B2026052001',
    name: '2026-05-20 日常到件批次',
    source: '中通快递',
    created_by: 'demo',
    remark: '系统演示数据'
  });
  console.log('创建批次:', batch1.batch_no);

  const returnBatch = BatchService.create({
    batch_no: 'RT2026052501',
    name: '5月第3周退回批次',
    source: '退件中心',
    created_by: 'demo',
    remark: '超期未取退回件'
  });
  console.log('创建退回批次:', returnBatch.batch_no);

  const packages = [
    {
      batch_id: batch1.id,
      pick_up_code: 'ZT78901',
      tracking_no: '731777000123456',
      receiver_name: '张三',
      receiver_phone: '13800138001',
      receiver_address: '北京市朝阳区建国路88号',
      arrived_at: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      status: 'pending',
      sms_count: 1
    },
    {
      batch_id: batch1.id,
      pick_up_code: 'ZT78902',
      tracking_no: '731777000123457',
      receiver_name: '李四',
      receiver_phone: '13900139002',
      receiver_address: '北京市海淀区中关村大街1号',
      arrived_at: dayjs().subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
      status: 'pending',
      sms_count: 3
    },
    {
      batch_id: batch1.id,
      pick_up_code: 'ZT78903',
      tracking_no: '731777000123458',
      receiver_name: '王五',
      receiver_phone: '13700137003',
      receiver_address: '北京市西城区金融街15号',
      arrived_at: dayjs().subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
      status: 'returned',
      sms_count: 3,
      return_reason: '超期5天未取，3次催取无效',
      return_batch_id: returnBatch.id,
      returned_at: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
      processed_by: '李站长',
      processed_at: dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss')
    },
    {
      batch_id: batch1.id,
      pick_up_code: 'ZT78904',
      tracking_no: '731777000123459',
      receiver_name: '赵六',
      receiver_phone: '13600136004',
      receiver_address: '北京市东城区王府井大街138号',
      arrived_at: dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
      status: 'picked',
      sms_count: 2,
      processed_by: '张站长',
      processed_at: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')
    }
  ];

  for (const p of packages) {
    const pkg = PackageService.create(p);
    console.log('创建包裹:', pkg.pick_up_code, pkg.receiver_name);

    for (let i = 0; i < p.sms_count; i++) {
      PackageService.addSmsRecord(
        pkg.id,
        p.receiver_phone,
        `【驿站】您的包裹${p.pick_up_code}已到，请到XX驿站取件，退订回T`,
        dayjs(p.arrived_at).add(i + 1, 'day').format('YYYY-MM-DD HH:mm:ss')
      );
    }
    console.log(`  插入${p.sms_count}条短信记录`);
  }

  console.log('\n示例数据生成完成！');
  console.log('查询示例：');
  console.log('  按取件码: GET /api/packages/code/ZT78903');
  console.log('  按收件人: GET /api/packages/search?receiver_name=王五');
  console.log('  按退回批次: GET /api/packages/search?return_batch_id=' + returnBatch.id);
  console.log('  导出CSV: GET /api/export/csv');
}

try {
  seed();
  process.exit(0);
} catch (e) {
  console.error('生成失败:', e);
  process.exit(1);
}
