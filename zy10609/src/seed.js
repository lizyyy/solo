const { db, initDatabase } = require('./database');

const unsubscribeData = [
  { phone: '13800000001', template_type: 'VERIFICATION', source: '用户主动退订', unsubscribe_time: '2026-05-10 09:30:00', operator: 'admin', remark: '用户回复TD' },
  { phone: '13800000001', template_type: 'MARKETING', source: '用户主动退订', unsubscribe_time: '2026-05-10 09:30:05', operator: 'admin', remark: '用户回复TD' },
  { phone: '13800000002', template_type: 'VERIFICATION', source: '用户主动退订', unsubscribe_time: '2026-05-11 14:20:00', operator: 'admin', remark: '用户回复TD' },
  { phone: '13800000003', template_type: 'MARKETING', source: '投诉退订', unsubscribe_time: '2026-05-12 10:15:00', operator: 'admin', remark: '用户投诉到运营商' },
  { phone: '13800000004', template_type: 'NOTICE', source: '用户主动退订', unsubscribe_time: '2026-05-13 16:45:00', operator: 'admin', remark: '用户点击退订链接' },
  { phone: '13800000005', template_type: 'VERIFICATION', source: '用户主动退订', unsubscribe_time: '2026-05-14 08:00:00', operator: 'admin', remark: '' },
  { phone: '13800000005', template_type: 'MARKETING', source: '用户主动退订', unsubscribe_time: '2026-05-14 08:00:02', operator: 'admin', remark: '' },
  { phone: '13800000006', template_type: 'VERIFICATION', source: '批量清理', unsubscribe_time: '2026-05-15 11:00:00', operator: 'system', remark: '定期清理无效号码' },
  { phone: '13800000007', template_type: 'MARKETING', source: '用户主动退订', unsubscribe_time: '2026-05-16 15:30:00', operator: 'admin', remark: '' },
  { phone: '13800000008', template_type: 'VERIFICATION', source: '用户主动退订', unsubscribe_time: '2026-05-17 09:00:00', operator: 'admin', remark: '' }
];

function seedData() {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO unsubscribe_records (phone, template_type, source, unsubscribe_time, operator, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    unsubscribeData.forEach(item => {
      stmt.run(item.phone, item.template_type, item.source, item.unsubscribe_time, item.operator, item.remark, (err) => {
        if (err) console.error('插入失败:', err);
        count++;
        if (count === unsubscribeData.length) {
          stmt.finalize();
          console.log('种子数据插入完成');
          resolve();
        }
      });
    });
  });
}

async function main() {
  await initDatabase();
  await seedData();
  db.close();
}

main().catch(console.error);