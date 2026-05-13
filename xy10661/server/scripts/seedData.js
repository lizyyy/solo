const db = require('../database/db');
const moment = require('moment');

const now = moment().format('YYYY-MM-DD HH:mm:ss');

db.serialize(() => {
  console.log('开始插入样例数据...');

  const packages = [
    { waybill_no: 'SF1000000001', status: 'completed', weight: 2.5, destination: '北京', receiver: '张三', receiver_phone: '13800138001', address: '北京市朝阳区某某街道1号' },
    { waybill_no: 'SF1000000002', status: 'completed', weight: 1.2, destination: '上海', receiver: '李四', receiver_phone: '13800138002', address: '上海市浦东新区某某路2号' },
    { waybill_no: 'SF1000000003', status: 'exception', weight: 100, destination: '广州', receiver: '王五', receiver_phone: '13800138003', address: '广州市天河区某某大道3号' },
    { waybill_no: 'SF1000000004', status: 'reviewing', weight: 0.05, destination: '深圳', receiver: '赵六', receiver_phone: '13800138004', address: '深圳市南山区某某科技园4号' },
    { waybill_no: 'SF1000000005', status: 'sorting', weight: null, destination: '杭州', receiver: '钱七', receiver_phone: '13800138005', address: '杭州市西湖区某某园区5号' },
    { waybill_no: 'SF1000000006', status: 'scanning', destination: '成都', receiver: '孙八', receiver_phone: '13800138006', address: '成都市武侯区某某大厦6号' }
  ];

  const packageIds = [];

  packages.forEach((pkg, index) => {
    db.run(
      'INSERT INTO packages (waybill_no, status, weight, destination, receiver, receiver_phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [pkg.waybill_no, pkg.status, pkg.weight, pkg.destination, pkg.receiver, pkg.receiver_phone, pkg.address, now, now],
      function(err) {
        if (err) {
          console.error('插入包裹失败:', err);
          return;
        }
        packageIds.push(this.lastID);
        console.log(`插入包裹 ${pkg.waybill_no} 成功`);

        db.run(
          'INSERT INTO status_history (package_id, status, status_text, operator, operate_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [this.lastID, 'pending', '待处理', '系统', moment().subtract(2, 'hours').format('YYYY-MM-DD HH:mm:ss'), '创建包裹', now]
        );

        if (index < 5) {
          db.run(
            'INSERT INTO scan_logs (package_id, scan_type, scan_time, scanner, location, status, intercepted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [this.lastID, 'inbound', moment().subtract(90, 'minutes').format('YYYY-MM-DD HH:mm:ss'), 'scan001', 'A区入口', 'success', 0, now]
          );

          db.run(
            'INSERT INTO status_history (package_id, status, status_text, operator, operate_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [this.lastID, 'scanning', '扫码中', 'scan001', moment().subtract(90, 'minutes').format('YYYY-MM-DD HH:mm:ss'), '入库扫码', now]
          );
        }

        if (index < 4) {
          const slotCode = `A0${index + 1}`;
          db.run(
            'INSERT INTO sorting_slots (package_id, slot_code, slot_name, status, sorted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [this.lastID, slotCode, `${pkg.destination}格口`, 'sorted', moment().subtract(60, 'minutes').format('YYYY-MM-DD HH:mm:ss'), now, now]
          );

          db.run(
            'INSERT INTO status_history (package_id, status, status_text, operator, operate_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [this.lastID, 'sorting', '分拣中', 'sort001', moment().subtract(60, 'minutes').format('YYYY-MM-DD HH:mm:ss'), `分拣至格口${slotCode}`, now]
          );
        }

        if (index < 3) {
          db.run(
            'INSERT INTO weight_records (package_id, weight, weight_time, operator, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [this.lastID, pkg.weight, moment().subtract(30, 'minutes').format('YYYY-MM-DD HH:mm:ss'), 'weight001', 'normal', now, now]
          );

          db.run(
            'INSERT INTO status_history (package_id, status, status_text, operator, operate_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [this.lastID, pkg.status, pkg.status === 'completed' ? '已完成' : '异常', 'weight001', moment().subtract(30, 'minutes').format('YYYY-MM-DD HH:mm:ss'), `称重完成: ${pkg.weight}kg${pkg.status === 'exception' ? ' - 重量异常' : ''}`, now]
          );
        }

        if (index === 3) {
          db.run(
            'INSERT INTO manual_reviews (package_id, reviewer, review_time, review_result, review_notes, responsible_party, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [this.lastID, 'review001', moment().subtract(15, 'minutes').format('YYYY-MM-DD HH:mm:ss'), 'pass', '确认重量无误，属于正常轻小件', '系统', now]
          );
        }
      }
    );
  });

  setTimeout(() => {
    console.log('样例数据插入完成');
    db.close();
  }, 2000);
});
