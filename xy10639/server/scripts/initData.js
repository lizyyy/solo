const db = require('../config/database');

function initData() {
  db.serialize(() => {
    const stmtRoute = db.prepare(`INSERT OR IGNORE INTO routes (route_name, route_code, direction, capacity, status) VALUES (?, ?, ?, ?, ?)`);
    stmtRoute.run('张江线', 'ZJ001', '上班', 45, 'active');
    stmtRoute.run('张江线', 'ZJ002', '下班', 45, 'active');
    stmtRoute.run('虹桥线', 'HQ001', '上班', 50, 'active');
    stmtRoute.run('虹桥线', 'HQ002', '下班', 50, 'active');
    stmtRoute.finalize();

    const stmtStation = db.prepare(`INSERT OR IGNORE INTO stations (route_id, station_name, station_order, arrival_time) VALUES (?, ?, ?, ?)`);
    stmtStation.run(1, '人民广场', 1, '07:30');
    stmtStation.run(1, '张江高科', 2, '08:15');
    stmtStation.run(2, '张江高科', 1, '18:30');
    stmtStation.run(2, '人民广场', 2, '19:15');
    stmtStation.run(3, '徐家汇', 1, '07:45');
    stmtStation.run(3, '虹桥火车站', 2, '08:30');
    stmtStation.run(4, '虹桥火车站', 1, '18:45');
    stmtStation.run(4, '徐家汇', 2, '19:30');
    stmtStation.finalize();

    const stmtReservation = db.prepare(`INSERT OR IGNORE INTO reservations (route_id, user_id, user_name, station_id, reservation_date, time_slot, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const today = new Date().toISOString().split('T')[0];
    for (let i = 1; i <= 40; i++) {
      stmtReservation.run(1, `U${1000+i}`, `员工${i}`, i % 2 === 0 ? 2 : 1, today, '07:30', 'confirmed');
    }
    stmtReservation.finalize();

    const stmtWaitlist = db.prepare(`INSERT OR IGNORE INTO waitlists (route_id, user_id, user_name, station_id, reservation_date, time_slot, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (let i = 41; i <= 50; i++) {
      stmtWaitlist.run(1, `U${1000+i}`, `员工${i}`, 1, today, '07:30', i - 40, 'waiting');
    }
    stmtWaitlist.finalize();

    const stmtCredit = db.prepare(`INSERT OR IGNORE INTO credit_records (user_id, user_name, type, points, reason) VALUES (?, ?, ?, ?, ?)`);
    stmtCredit.run('U1001', '员工1', 'no_show', -5, '2026-05-10 张江线班车爽约');
    stmtCredit.run('U1002', '员工2', 'no_show', -5, '2026-05-12 张江线班车爽约');
    stmtCredit.run('U1003', '员工3', 'restore', 3, '误判爽约信用恢复');
    stmtCredit.finalize();

    const stmtException = db.prepare(`INSERT OR IGNORE INTO exceptions (route_id, exception_type, severity, description, reason, status) VALUES (?, ?, ?, ?, ?, ?)`);
    stmtException.run(1, 'overload', 'high', '张江线上班班车超载', '预约人数45人，候补10人，满载率122%', 'pending');
    stmtException.run(3, 'credit_abnormal', 'medium', '虹桥线用户信用异常', '用户U1005连续3次爽约', 'pending');
    stmtException.finalize();

    console.log('测试数据初始化完成');
  });
}

initData();
