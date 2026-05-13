const db = require('../config/database');
const moment = require('moment');

const seedData = () => {
  db.serialize(() => {
    const stmtSubscribers = db.prepare('INSERT INTO subscribers (name, phone, address) VALUES (?, ?, ?)');
    const subscribers = [
      ['张三', '13800138001', '北京市朝阳区建国路88号'],
      ['李四', '13800138002', '上海市浦东新区陆家嘴环路1000号'],
      ['王五', '13800138003', '广州市天河区珠江新城华夏路16号'],
      ['赵六', '13800138004', '深圳市南山区科技园南区'],
      ['钱七', '13800138005', '杭州市西湖区文三路478号']
    ];
    subscribers.forEach(s => stmtSubscribers.run(s));
    stmtSubscribers.finalize();

    const stmtNewspapers = db.prepare('INSERT INTO newspapers (name, code, price_per_issue) VALUES (?, ?, ?)');
    const newspapers = [
      ['人民日报', 'RMRB', 2.0],
      ['光明日报', 'GMRB', 1.8],
      ['经济日报', 'JJRB', 2.2],
      ['中国日报', 'ZGRB', 2.5]
    ];
    newspapers.forEach(n => stmtNewspapers.run(n));
    stmtNewspapers.finalize();

    const stmtSubscriptions = db.prepare('INSERT INTO subscriptions (subscriber_id, newspaper_id, total_issues, remaining_issues, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const subscriptions = [
      [1, 1, 52, 35, '2026-01-01', '2026-12-31', 'active'],
      [1, 2, 26, 20, '2026-03-01', '2026-08-31', 'active'],
      [2, 1, 52, 48, '2026-01-01', '2026-12-31', 'active'],
      [3, 3, 12, 8, '2026-04-01', '2027-03-31', 'active'],
      [4, 4, 24, 0, '2026-01-01', '2026-06-30', 'completed'],
      [5, 1, 52, 45, '2026-01-01', '2026-12-31', 'paused']
    ];
    subscriptions.forEach(s => stmtSubscriptions.run(s));
    stmtSubscriptions.finalize();

    const stmtDelivery = db.prepare('INSERT INTO delivery_calendar (subscription_id, delivery_date, issue_number, status, delivered_at) VALUES (?, ?, ?, ?, ?)');
    const deliveries = [];
    for (let i = 1; i <= 20; i++) {
      const date = moment('2026-05-01').add(i - 1, 'days').format('YYYY-MM-DD');
      const statuses = ['delivered', 'delivered', 'delivered', 'scheduled', 'missed', 'delivered'];
      const status = statuses[i % statuses.length];
      const deliveredAt = status === 'delivered' ? date + ' 08:30:00' : null;
      deliveries.push([1, date, i, status, deliveredAt]);
      deliveries.push([2, date, i, status === 'missed' ? 'delivered' : status, deliveredAt]);
    }
    deliveries.push([1, '2026-05-21', 21, 'scheduled', null]);
    deliveries.push([1, '2026-05-22', 22, 'scheduled', null]);
    deliveries.forEach(d => stmtDelivery.run(d));
    stmtDelivery.finalize();

    const stmtPause = db.prepare('INSERT INTO pause_requests (subscription_id, request_date, start_date, end_date, reason, status, approved_by, approved_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    const pauseRequests = [
      [5, '2026-04-15', '2026-04-20', '2026-05-10', '用户外出旅游', 'approved', '管理员A', '2026-04-16 10:00:00', '业务员B'],
      [1, '2026-05-10', '2026-05-15', '2026-05-20', '用户出差', 'pending', null, null, '业务员C'],
      [2, '2026-05-08', '2026-05-12', '2026-05-18', '地址变更', 'approved', '管理员A', '2026-05-09 14:30:00', '业务员B']
    ];
    pauseRequests.forEach(p => stmtPause.run(p));
    stmtPause.finalize();

    const stmtReDelivery = db.prepare('INSERT INTO re_deliveries (delivery_id, request_date, reason, new_delivery_date, status, handled_by, handled_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const reDeliveries = [
      [5, '2026-05-06', '用户未收到报纸', '2026-05-07', 'completed', '投递员甲', '2026-05-07 09:00:00'],
      [11, '2026-05-12', '地址错误', '2026-05-13', 'pending', null, null],
      [17, '2026-05-18', '天气原因延误', null, 'in_progress', '投递员乙', null]
    ];
    reDeliveries.forEach(r => stmtReDelivery.run(r));
    stmtReDelivery.finalize();

    const stmtAdjustments = db.prepare('INSERT INTO manual_adjustments (subscription_id, adjustment_type, old_value, new_value, reason, adjusted_by) VALUES (?, ?, ?, ?, ?, ?)');
    const adjustments = [
      [1, 'remaining_issues', '36', '35', '漏投一期，扣减一期', '管理员A'],
      [3, 'total_issues', '50', '52', '用户续费两期', '业务员C']
    ];
    adjustments.forEach(a => stmtAdjustments.run(a));
    stmtAdjustments.finalize();

    const stmtExceptions = db.prepare('INSERT INTO exceptions (type, related_id, description, status, priority, assigned_to) VALUES (?, ?, ?, ?, ?, ?)');
    const exceptions = [
      ['missed_delivery', 5, '2026-05-05 第5期投递失败', 'resolved', 'high', '投递员甲'],
      ['pause_conflict', 2, '暂停日期与已有投递计划冲突', 'open', 'medium', '管理员A'],
      ['missed_delivery', 11, '2026-05-11 第11期投递失败', 'in_progress', 'high', '投递员乙'],
      ['remaining_negative', 4, '剩余期数计算异常', 'open', 'high', '管理员A']
    ];
    exceptions.forEach(e => stmtExceptions.run(e));
    stmtExceptions.finalize();

    console.log('演示数据插入完成');
  });
};

seedData();
