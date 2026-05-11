const { getDB, prepare, exec, saveDB } = require('../database');

function runSql(sql, params = []) {
  const stmt = prepare(sql);
  return stmt.run(...params);
}

function getAll(sql, params = []) {
  const stmt = prepare(sql);
  return stmt.all(...params);
}

(async () => {
  try {
    await getDB();
    console.log('开始初始化种子数据...');

    exec('DELETE FROM supply_orders');
    exec('DELETE FROM faults');
    exec('DELETE FROM consumables');
    exec('DELETE FROM devices');
    exec('DELETE FROM stores');

    let result;

    result = runSql('INSERT INTO stores (name, address, phone, created_at) VALUES (?, ?, ?, datetime("now"))', 
      ['中关村店', '北京市海淀区中关村大街1号', '010-12345678']);
    const store1Id = result.lastInsertRowid;

    result = runSql('INSERT INTO stores (name, address, phone, created_at) VALUES (?, ?, ?, datetime("now"))', 
      ['朝阳门店', '北京市东城区朝阳门北大街1号', '010-87654321']);
    const store2Id = result.lastInsertRowid;

    result = runSql('INSERT INTO stores (name, address, phone, created_at) VALUES (?, ?, ?, datetime("now"))', 
      ['国贸店', '北京市朝阳区建国门外大街1号', '010-11112222']);
    const store3Id = result.lastInsertRowid;

    result = runSql('INSERT INTO devices (store_id, device_code, model, location, status, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [store1Id, 'DEV-ZGC-001', 'HP M428fdw', '一层进门处', 'normal']);
    const device1Id = result.lastInsertRowid;

    result = runSql('INSERT INTO devices (store_id, device_code, model, location, status, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [store1Id, 'DEV-ZGC-002', 'Canon MF445dw', '二层休息区', 'fault']);
    const device2Id = result.lastInsertRowid;

    result = runSql('INSERT INTO devices (store_id, device_code, model, location, status, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [store2Id, 'DEV-CYM-001', 'Brother DCP-L2550dw', '前台左侧', 'normal']);
    const device3Id = result.lastInsertRowid;

    result = runSql('INSERT INTO devices (store_id, device_code, model, location, status, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [store2Id, 'DEV-CYM-002', 'HP M428fdw', '会议室门口', 'normal']);
    const device4Id = result.lastInsertRowid;

    result = runSql('INSERT INTO devices (store_id, device_code, model, location, status, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))',
      [store3Id, 'DEV-GM-001', 'Canon MF445dw', '地下一层', 'fault']);
    const device5Id = result.lastInsertRowid;

    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device1Id, '纸张', 45, 10]);
    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device1Id, '黑色墨粉', 60, 10]);
    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device1Id, '彩色墨粉', 75, 10]);

    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device2Id, '纸张', 5, 10]);
    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device2Id, '黑色墨粉', 8, 10]);
    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device2Id, '彩色墨粉', 90, 10]);

    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device3Id, '纸张', 90, 10]);
    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device3Id, '黑色墨粉', 5, 10]);

    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device4Id, '纸张', 8, 10]);
    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device4Id, '黑色墨粉', 45, 10]);
    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device4Id, '彩色墨粉', 20, 10]);

    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device5Id, '纸张', 50, 10]);
    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device5Id, '黑色墨粉', 70, 10]);
    runSql('INSERT INTO consumables (device_id, type, current_level, min_threshold, last_updated) VALUES (?, ?, ?, ?, datetime("now"))',
      [device5Id, '彩色墨粉', 12, 10]);

    runSql('INSERT INTO faults (device_id, fault_type, description, status, reported_at) VALUES (?, ?, ?, ?, datetime("now"))',
      [device2Id, '卡纸', '频繁卡纸，疑似进纸器故障', 'pending']);
    runSql('INSERT INTO faults (device_id, fault_type, description, status, reported_at) VALUES (?, ?, ?, ?, datetime("now"))',
      [device2Id, '打印不清晰', '输出模糊，有墨粉漏印', 'pending']);
    runSql('INSERT INTO faults (device_id, fault_type, description, status, reported_at) VALUES (?, ?, ?, ?, datetime("now"))',
      [device5Id, '无法开机', '按下电源键无任何反应', 'in_progress']);
    runSql('INSERT INTO faults (device_id, fault_type, description, status, reported_at, resolved_at) VALUES (?, ?, ?, ?, datetime("now"), ?)',
      [device3Id, '网络断开', '无法连接到WiFi，无法远程打印', 'resolved', '2026-05-08 10:30:00']);

    runSql('INSERT INTO supply_orders (store_id, device_id, type, item, quantity, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
      [store1Id, device2Id, '耗材补给', 'A4纸', 5, 'pending', '纸张即将耗尽']);
    runSql('INSERT INTO supply_orders (store_id, device_id, type, item, quantity, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
      [store2Id, device3Id, '耗材补给', '黑色墨粉盒', 2, 'pending', '墨粉余量不足5%']);
    runSql('INSERT INTO supply_orders (store_id, device_id, type, item, quantity, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))',
      [store3Id, null, '设备维修', '电源适配器', 1, 'in_progress', '设备无法开机，疑似电源问题']);
    runSql('INSERT INTO supply_orders (store_id, device_id, type, item, quantity, status, notes, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"), ?)',
      [store2Id, device4Id, '耗材补给', 'A4纸', 10, 'completed', '已完成补给', '2026-05-09 14:00:00']);

    console.log('种子数据初始化完成！');
    console.log('已创建: 3家门店, 5台设备, 14条耗材记录, 4个故障, 4个补给单');
    process.exit(0);
  } catch (err) {
    console.error('错误:', err);
    process.exit(1);
  }
})();
