const { v4: uuidv4 } = require('uuid');
const db = require('./database');

function initSampleData(callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    const pkg1Id = uuidv4();
    const pkg2Id = uuidv4();
    const pkg3Id = uuidv4();
    const pkg4Id = uuidv4();
    
    db.run(
      `INSERT OR IGNORE INTO packages (id, tracking_number, sender, receiver, origin, destination, status)
       VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)`,
      [
        pkg1Id, 'SF1000001', '张三', '李四', '北京', '上海', 'normal',
        pkg2Id, 'SF1000002', '王五', '赵六', '广州', '深圳', 'blocked',
        pkg3Id, 'SF1000003', '陈七', '周八', '成都', '重庆', 'reviewing',
        pkg4Id, 'SF1000004', '吴九', '郑十', '杭州', '南京', 'normal'
      ]
    );
    
    const tracks = [
      [uuidv4(), pkg1Id, '北京转运中心', 'transit', '到达北京转运中心', '操作员A'],
      [uuidv4(), pkg1Id, '上海浦东网点', 'delivered', '已送达上海浦东网点', '操作员B'],
      [uuidv4(), pkg2Id, '广州转运中心', 'transit', '到达广州转运中心', '操作员C'],
      [uuidv4(), pkg2Id, '深圳南山网点', 'misclassified', '错分至深圳南山网点', '操作员D'],
      [uuidv4(), pkg3Id, '成都转运中心', 'transit', '到达成都转运中心', '操作员E'],
      [uuidv4(), pkg4Id, '杭州转运中心', 'transit', '到达杭州转运中心', '操作员F']
    ];
    
    tracks.forEach(track => {
      db.run(
        `INSERT OR IGNORE INTO package_tracks (id, package_id, location, status, description, operator)
         VALUES (?, ?, ?, ?, ?, ?)`,
        track
      );
    });
    
    const shift1Id = uuidv4();
    const shift2Id = uuidv4();
    
    db.run(
      `INSERT OR IGNORE INTO branch_shifts (id, branch_name, shift_code, shift_date, start_time, end_time, manager, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        shift1Id, '深圳南山网点', 'SH001', '2024-01-15', '08:00', '16:00', '王经理', 'active',
        shift2Id, '上海浦东网点', 'SH002', '2024-01-15', '09:00', '17:00', '李经理', 'active'
      ]
    );
    
    const handoff1Id = uuidv4();
    const handoff2Id = uuidv4();
    
    db.run(
      `INSERT OR IGNORE INTO driver_handovers (id, shift_id, driver_name, driver_phone, vehicle_number, handover_time, package_count, status, operator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        handoff1Id, shift1Id, '刘司机', '13800138001', '粤B12345', '2024-01-15 08:30:00', 120, 'completed', '调度员A',
        handoff2Id, shift2Id, '陈司机', '13900139002', '沪A67890', '2024-01-15 09:15:00', 95, 'completed', '调度员B'
      ]
    );
    
    const mis1Id = uuidv4();
    const mis2Id = uuidv4();
    
    db.run(
      `INSERT OR IGNORE INTO misclassification_records (id, package_id, misclassified_branch, correct_branch, found_time, reporter, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mis1Id, pkg2Id, '深圳南山网点', '深圳福田网点', '2024-01-15 14:20:00', '分拣员张', 'resolved', '地址识别错误导致错分',
        mis2Id, pkg3Id, '重庆江北网点', '重庆渝中网点', '2024-01-15 16:45:00', '分拣员李', 'pending', '邮编填写不清晰'
      ]
    );
    
    const reassign1Id = uuidv4();
    
    db.run(
      `INSERT OR IGNORE INTO reassignments (id, misclassification_id, handler, reassign_time, new_route, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        reassign1Id, mis1Id, '处理员王', '2024-01-15 15:00:00', '南山网点 -> 福田网点', 'completed', '已重新安排配送'
      ]
    );
    
    db.run(
      `INSERT OR IGNORE INTO compensations (id, misclassification_id, amount, responsible_person, approve_time, status, request_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), mis1Id, 50.00, '分拣员张', '2024-01-15 17:00:00', 'approved', 'COMP001', '错分赔付已批准'
      ]
    );
    
    const logs = [
      [uuidv4(), 'create', pkg1Id, 'package', '系统管理员', '导入包裹数据'],
      [uuidv4(), 'create', mis1Id, 'misclassification', '分拣员张', '登记错分包裹'],
      [uuidv4(), 'update', pkg2Id, 'package', '系统自动', '包裹状态更新为拦截'],
      [uuidv4(), 'create', reassign1Id, 'reassignment', '处理员王', '创建重派处理'],
      [uuidv4(), 'create', uuidv4(), 'compensation', '主管审批', '创建赔付记录']
    ];
    
    logs.forEach(log => {
      db.run(
        `INSERT OR IGNORE INTO operation_logs (id, operation_type, target_id, target_type, operator, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        log
      );
    });
    
    db.run('COMMIT', (err) => {
      callback(err);
    });
  });
}

module.exports = { initSampleData };
