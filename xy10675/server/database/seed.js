const db = require('./db');
const { v4: uuidv4 } = require('uuid');

const now = new Date().toISOString();

const seedData = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const member1Id = uuidv4();
      const member2Id = uuidv4();
      const member3Id = uuidv4();
      const member4Id = uuidv4();

      const stmt = db.prepare('INSERT INTO members (id, name, phone, baby_name, baby_birthday, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      stmt.run(member1Id, '王芳', '13800138001', '小宝', '2024-01-15', now, now);
      stmt.run(member2Id, '李娜', '13800138002', '贝贝', '2023-06-20', now, now);
      stmt.run(member3Id, '张丽', '13800138003', '豆豆', '2023-11-05', now, now);
      stmt.run(member4Id, '刘静', '13800138004', '糖糖', '2024-03-10', now, now);
      stmt.finalize();

      const pkg1Id = uuidv4();
      const pkg2Id = uuidv4();
      const pkg3Id = uuidv4();
      const pkg4Id = uuidv4();

      const pkgStmt = db.prepare('INSERT INTO benefit_packages (id, name, min_month, max_month, benefits, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      pkgStmt.run(pkg1Id, '新生儿礼包(0-3月)', 0, 3, JSON.stringify(['奶粉试用装', '纸尿裤体验包', '婴儿抚触服务']), now);
      pkgStmt.run(pkg2Id, '成长礼包(4-6月)', 4, 6, JSON.stringify(['辅食工具', '益智玩具', '体检套餐']), now);
      pkgStmt.run(pkg3Id, '启蒙礼包(7-12月)', 7, 12, JSON.stringify(['早教课程', '爬行垫', '安全防护套装']), now);
      pkgStmt.run(pkg4Id, '幼儿礼包(13-24月)', 13, 24, JSON.stringify(['绘本套装', '户外玩具', '育儿咨询服务']), now);
      pkgStmt.finalize();

      const benefit1Id = uuidv4();
      const benefit2Id = uuidv4();
      const benefit3Id = uuidv4();
      const benefit4Id = uuidv4();

      const benefitStmt = db.prepare('INSERT INTO member_benefits (id, member_id, package_id, status, operator, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      benefitStmt.run(benefit1Id, member1Id, pkg1Id, 'ACTIVE', 'admin', '正常发放', now, now);
      benefitStmt.run(benefit2Id, member2Id, pkg3Id, 'PENDING_REVIEW', 'admin', '月龄异常待复核', now, now);
      benefitStmt.run(benefit3Id, member3Id, pkg2Id, 'CANCELLED', 'admin', '用户申请取消', now, now);
      benefitStmt.run(benefit4Id, member4Id, pkg1Id, 'ERROR', 'system', '系统校验失败：月龄超出范围', now, now);
      benefitStmt.finalize();

      const benefitLogStmt = db.prepare('INSERT INTO benefit_logs (id, benefit_id, old_status, new_status, operator, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      benefitLogStmt.run(uuidv4(), benefit1Id, null, 'ACTIVE', 'admin', '初始发放', now);
      benefitLogStmt.run(uuidv4(), benefit2Id, null, 'PENDING_REVIEW', 'admin', '月龄异常，进入复核流程', now);
      benefitLogStmt.run(uuidv4(), benefit3Id, 'ACTIVE', 'CANCELLED', 'admin', '用户主动申请取消', now);
      benefitLogStmt.run(uuidv4(), benefit4Id, null, 'ERROR', 'system', '月龄校验不通过，发放失败', now);
      benefitLogStmt.finalize();

      const appt1Id = uuidv4();
      const appt2Id = uuidv4();
      const appt3Id = uuidv4();

      const apptStmt = db.prepare('INSERT INTO experience_appointments (id, member_id, appointment_time, experience_type, status, operator, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      apptStmt.run(appt1Id, member1Id, '2024-05-20 10:00:00', '婴儿游泳', 'CONFIRMED', '客服小王', '已确认', now, now);
      apptStmt.run(appt2Id, member2Id, '2024-05-21 14:00:00', '育儿讲座', 'CANCELLED', '客服小李', '用户临时有事取消', now, now);
      apptStmt.run(appt3Id, member3Id, '2024-05-22 09:30:00', '产后修复', 'PENDING', '客服小张', '待确认', now, now);
      apptStmt.finalize();

      const apptLogStmt = db.prepare('INSERT INTO appointment_logs (id, appointment_id, old_time, new_time, old_status, new_status, operator, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      apptLogStmt.run(uuidv4(), appt1Id, null, '2024-05-20 10:00:00', null, 'CONFIRMED', '客服小王', '预约成功', now);
      apptLogStmt.run(uuidv4(), appt2Id, null, '2024-05-21 14:00:00', 'PENDING', 'CANCELLED', '客服小李', '用户取消预约', now);
      apptLogStmt.run(uuidv4(), appt3Id, null, '2024-05-22 09:30:00', null, 'PENDING', '客服小张', '提交预约', now);
      apptLogStmt.finalize();

      const return1Id = uuidv4();
      const return2Id = uuidv4();

      const returnStmt = db.prepare('INSERT INTO return_recycles (id, member_id, product_name, product_code, return_type, status, operator, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      returnStmt.run(return1Id, member1Id, '婴儿推车', 'TC-2024-001', 'RETURN', 'PROCESSING', '客服小王', '质量问题退货', now, now);
      returnStmt.run(return2Id, member2Id, '奶粉罐回收', 'HS-2024-002', 'RECYCLE', 'COMPLETED', '客服小李', '空罐回收完成', now, now);
      returnStmt.finalize();

      const returnLogStmt = db.prepare('INSERT INTO return_logs (id, return_id, old_status, new_status, operator, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      returnLogStmt.run(uuidv4(), return1Id, null, 'PROCESSING', '客服小王', '退货申请已受理', now);
      returnLogStmt.run(uuidv4(), return2Id, null, 'COMPLETED', '客服小李', '回收完成，积分已到账', now);
      returnLogStmt.finalize();

      const birthdayStmt = db.prepare('INSERT INTO baby_birthday_logs (id, member_id, old_birthday, new_birthday, operator, status, remarks, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      birthdayStmt.run(uuidv4(), member1Id, null, '2024-01-15', 'admin', 'CONFIRMED', '初始录入', now);
      birthdayStmt.run(uuidv4(), member2Id, '2023-01-20', '2023-06-20', '客服小张', 'REVIEWED', '客户更正生日，已复核', now);
      birthdayStmt.finalize();

      const csStmt = db.prepare('INSERT INTO customer_service_notes (id, member_id, content, operator, is_public, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      csStmt.run(uuidv4(), member1Id, '客户咨询新生儿礼包内容，已详细解答', '客服小王', 1, now);
      csStmt.run(uuidv4(), member1Id, '客户反馈产品质量问题，已安排退货', '客服小王', 1, now);
      csStmt.run(uuidv4(), member2Id, '客户对月龄限制有疑问，需要进一步解释', '客服小李', 1, now);
      csStmt.run(uuidv4(), member3Id, 'VIP客户，优先处理所有请求', '主管', 0, now);
      csStmt.finalize();

      console.log('样例数据插入成功');
      resolve();
    });
  });
};

seedData().then(() => {
  db.close();
  process.exit(0);
}).catch((err) => {
  console.error('样例数据插入失败:', err);
  db.close();
  process.exit(1);
});
