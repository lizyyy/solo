const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const initSampleData = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM member_packages', (err, row) => {
      if (err) return reject(err);
      if (row.count > 0) {
        console.log('Sample data already exists, skipping initialization');
        return resolve();
      }

      console.log('Initializing sample data...');
      
      const packageId1 = uuidv4();
      const packageId2 = uuidv4();
      const packageId3 = uuidv4();
      
      const now = moment().toISOString();

      db.serialize(() => {
        db.run(
          `INSERT INTO member_packages (id, member_id, member_name, package_name, total_classes, remaining_classes, price, purchase_date, expire_date, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [packageId1, 'M001', '张三', '高级私教课包', 30, 25, 9000, moment().subtract(1, 'month').toISOString(), moment().add(11, 'months').toISOString(), 'active', now, now]
        );

        db.run(
          `INSERT INTO member_packages (id, member_id, member_name, package_name, total_classes, remaining_classes, price, purchase_date, expire_date, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [packageId2, 'M002', '李四', '基础私教课包', 20, 18, 4000, moment().subtract(2, 'weeks').toISOString(), moment().add(6, 'months').toISOString(), 'active', now, now]
        );

        db.run(
          `INSERT INTO member_packages (id, member_id, member_name, package_name, total_classes, remaining_classes, price, purchase_date, expire_date, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [packageId3, 'M003', '王五', 'VIP私教课包', 50, 48, 20000, moment().subtract(3, 'days').toISOString(), moment().add(1, 'year').toISOString(), 'active', now, now]
        );

        const scheduleId1 = uuidv4();
        const scheduleId2 = uuidv4();
        
        db.run(
          `INSERT INTO coach_schedules (id, coach_id, coach_name, member_id, member_name, package_id, schedule_date, start_time, end_time, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [scheduleId1, 'C001', '王教练', 'M001', '张三', packageId1, moment().add(1, 'day').format('YYYY-MM-DD'), '10:00', '11:00', 'scheduled', '增肌训练', now, now]
        );

        db.run(
          `INSERT INTO coach_schedules (id, coach_id, coach_name, member_id, member_name, package_id, schedule_date, start_time, end_time, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [scheduleId2, 'C002', '李教练', 'M002', '李四', packageId2, moment().add(2, 'days').format('YYYY-MM-DD'), '14:00', '15:00', 'scheduled', '减脂训练', now, now]
        );

        const leaveId1 = uuidv4();
        
        db.run(
          `INSERT INTO leave_deductions (id, package_id, member_id, member_name, leave_date, reason, classes_deducted, status, approved_by, approved_at, old_remaining, new_remaining, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [leaveId1, packageId1, 'M001', '张三', moment().subtract(3, 'days').format('YYYY-MM-DD'), '身体不适请假', 1, 'approved', 'A001', moment().subtract(2, 'days').toISOString(), 26, 25, now, now]
        );

        const transferId1 = uuidv4();
        
        db.run(
          `INSERT INTO transfer_commissions (id, from_package_id, to_package_id, from_member_id, from_member_name, to_member_id, to_member_name, classes_transferred, commission_rate, commission_amount, status, approved_by, approved_at, from_old_remaining, from_new_remaining, to_old_remaining, to_new_remaining, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [transferId1, packageId1, packageId3, 'M001', '张三', 'M003', '王五', 2, 0.1, 120, 'pending', null, null, 27, 25, 48, 50, now, now]
        );

        const refundId1 = uuidv4();
        
        db.run(
          `INSERT INTO refund_trials (id, package_id, member_id, member_name, refund_reason, classes_used, classes_remaining, original_price, refund_amount, deduction_amount, status, approved_by, approved_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [refundId1, packageId2, 'M002', '李四', '搬家离店', 2, 18, 4000, 3200, 800, 'pending', null, null, now, now]
        );

        const ledgerId1 = uuidv4();
        const ledgerId2 = uuidv4();
        const ledgerId3 = uuidv4();

        db.run(
          `INSERT INTO balance_ledger (id, transaction_id, package_id, member_id, member_name, transaction_type, amount, classes_change, balance_before, balance_after, classes_before, classes_after, description, operator_id, operator_name, reference_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ledgerId1, 'TXN001', packageId1, 'M001', '张三', 'purchase', 9000, 30, 0, 9000, 0, 30, '购买高级私教课包', 'A001', '管理员', packageId1, moment().subtract(1, 'month').toISOString()]
        );

        db.run(
          `INSERT INTO balance_ledger (id, transaction_id, package_id, member_id, member_name, transaction_type, amount, classes_change, balance_before, balance_after, classes_before, classes_after, description, operator_id, operator_name, reference_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ledgerId2, 'TXN002', packageId1, 'M001', '张三', 'deduction', -300, -1, 9000, 8700, 26, 25, '请假扣课1节', 'A001', '管理员', leaveId1, moment().subtract(2, 'days').toISOString()]
        );

        db.run(
          `INSERT INTO balance_ledger (id, transaction_id, package_id, member_id, member_name, transaction_type, amount, classes_change, balance_before, balance_after, classes_before, classes_after, description, operator_id, operator_name, reference_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ledgerId3, 'TXN003', packageId2, 'M002', '李四', 'purchase', 4000, 20, 0, 4000, 0, 20, '购买基础私教课包', 'A002', '前台小王', packageId2, moment().subtract(2, 'weeks').toISOString()]
        );

        console.log('Sample data initialized successfully');
        resolve();
      });
    });
  });
};

module.exports = { initSampleData };
