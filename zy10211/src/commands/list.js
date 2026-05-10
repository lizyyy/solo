const storage = require('../services/storage');

module.exports = {
  name: 'list',
  description: '列出所有已确认的复盘记录',
  execute() {
    console.log('\n=== 已确认的复盘记录 ===\n');
    
    const records = storage.listConfirmed();
    
    if (records.length === 0) {
      console.log('暂无已确认的复盘记录。');
      console.log();
      return;
    }
    
    records.forEach((record, index) => {
      const s = record.summary || {};
      console.log(`${index + 1}. ${record.date}`);
      console.log(`   确认时间: ${record.confirmedAt}`);
      console.log(`   剩菜重量: ${s.leftoverWeight || '-'} kg`);
      console.log(`   剩菜成本: ¥${s.leftoverCost || '-'}`);
      console.log(`   到岗率: ${s.attendanceRate || '-'}`);
      console.log();
    });
    
    console.log(`共 ${records.length} 条记录`);
    console.log();
    console.log('查看详情: canteen-review query <date>');
    console.log();
  }
};
