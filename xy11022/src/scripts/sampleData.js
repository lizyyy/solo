const { v4: uuidv4 } = require('uuid');

const insertSampleData = (db) => {
  const storeId1 = uuidv4();
  const storeId2 = uuidv4();
  
  const storeStmt = db.prepare(`
    INSERT INTO stores (id, store_name, store_address, store_phone, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  storeStmt.run(storeId1, '朝阳健身旗舰店', '北京市朝阳区建国路88号', '010-88888888', 'active');
  storeStmt.run(storeId2, '海淀健身会所', '北京市海淀区中关村大街1号', '010-66666666', 'active');
  storeStmt.finalize();

  const coachId1 = uuidv4();
  const coachId2 = uuidv4();
  const coachId3 = uuidv4();

  const coachStmt = db.prepare(`
    INSERT INTO coaches (id, coach_name, phone, store_id, specialization, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  coachStmt.run(coachId1, '张教练', '13800138001', storeId1, '减脂塑形、力量训练', 'active');
  coachStmt.run(coachId2, '李教练', '13800138002', storeId1, '康复训练、瑜伽', 'active');
  coachStmt.run(coachId3, '王教练', '13800138003', storeId2, '增肌、搏击', 'active');
  coachStmt.finalize();

  const memberId1 = uuidv4();
  const memberId2 = uuidv4();
  const memberId3 = uuidv4();
  const memberId4 = uuidv4();

  const memberStmt = db.prepare(`
    INSERT INTO members (id, member_name, phone, member_level, store_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  memberStmt.run(memberId1, '陈明', '13900139001', '钻石会员', storeId1);
  memberStmt.run(memberId2, '刘芳', '13900139002', '金卡会员', storeId1);
  memberStmt.run(memberId3, '张伟', '13900139003', '普通会员', storeId1);
  memberStmt.run(memberId4, '赵丽', '13900139004', '金卡会员', storeId2);
  memberStmt.finalize();

  const transferStmt = db.prepare(`
    INSERT INTO class_transfers (
      id, transfer_no, transfer_date, store_id, store_name,
      assignor_id, assignor_name, assignor_phone,
      assignee_id, assignee_name, assignee_phone,
      coach_id, coach_name, class_package_id, class_package_name,
      transfer_class_count, remaining_class_count, original_unit_price,
      transfer_fee, total_amount, scheduled_class_time,
      status, handler_id, handler_name, approved_at, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  transferStmt.run(
    uuidv4(), 'TR202405010001', '2024-05-01', storeId1, '朝阳健身旗舰店',
    memberId1, '陈明', '13900139001',
    memberId2, '刘芳', '13900139002',
    coachId1, '张教练', 'PKG001', 'VIP减脂私教课30节包',
    10, 10, 280.00,
    50.00, 2850.00, '2024-05-10 14:00:00',
    'approved', 'H001', '张经理', '2024-05-02 10:30:00', '正常转让流程'
  );

  transferStmt.run(
    uuidv4(), 'TR202405030002', '2024-05-03', storeId1, '朝阳健身旗舰店',
    memberId2, '刘芳', '13900139002',
    memberId3, '张伟', '13900139003',
    coachId2, '李教练', 'PKG002', '康复理疗私教课20节包',
    5, 5, 350.00,
    0, 1750.00, '2024-05-15 09:00:00',
    'pending', null, null, null, '等待审核'
  );

  transferStmt.run(
    uuidv4(), 'TR202405050003', '2024-05-05', storeId2, '海淀健身会所',
    memberId4, '赵丽', '13900139004',
    memberId3, '张伟', '13900139003',
    coachId3, '王教练', 'PKG003', '搏击私教课40节包',
    15, 15, 220.00,
    100.00, 3400.00, '2024-05-20 18:00:00',
    'rejected', 'H002', '李主管', '2024-05-06 14:00:00', '受让人已有同时间段课程安排'
  );

  transferStmt.run(
    uuidv4(), 'TR202405080004', '2024-05-08', storeId1, '朝阳健身旗舰店',
    memberId1, '陈明', '13900139001',
    memberId4, '赵丽', '13900139004',
    coachId1, '张教练', 'PKG001', 'VIP减脂私教课30节包',
    8, 8, 280.00,
    50.00, 2290.00, null,
    'cancelled', 'H001', '张经理', '2024-05-09 09:00:00', '转让人主动取消'
  );

  transferStmt.finalize();

  console.log('样例数据插入成功！');
  console.log('门店: 2家, 教练: 3位, 会员: 4位, 转让记录: 4条');
  
  db.close();
};

module.exports = insertSampleData;
