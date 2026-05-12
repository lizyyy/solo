import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { initDatabase } from '../models/database';
import { createContract } from '../services/contractService';
import { createRefundApplication, approveRefund, calculateRefund } from '../services/refundService';

const seedData = async () => {
  await initDatabase();
  console.log('开始插入种子数据...');
  
  const now = new Date().toISOString();
  
  const contract1Id = uuidv4();
  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO contracts (id, contract_no, student_id, student_name, campus_id, campus_name, course_name, total_lessons, paid_lessons, gifted_lessons, total_amount, material_fee, installment_fee, unit_price, status, signed_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contract1Id,
        'CONT001',
        'STU001',
        '张三',
        'CAMP001',
        '朝阳校区',
        '英语精品班',
        52,
        48,
        4,
        9600,
        500,
        300,
        200,
        'active',
        '2024-01-15',
        now,
        now
      ],
      (err) => err ? reject(err) : resolve()
    );
  });
  
  const installmentData1 = [
    { no: 1, principal: 3200, fee: 100, status: 'paid', date: '2024-01-15' },
    { no: 2, principal: 3200, fee: 100, status: 'paid', date: '2024-02-15' },
    { no: 3, principal: 3200, fee: 100, status: 'pending', date: '2024-03-15' },
  ];
  
  for (const inst of installmentData1) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO installments (id, contract_id, installment_no, due_date, amount, principal, fee, status, paid_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          contract1Id,
          inst.no,
          inst.date,
          inst.principal + inst.fee,
          inst.principal,
          inst.fee,
          inst.status,
          inst.status === 'paid' ? inst.date : null,
          now
        ],
        (err) => err ? reject(err) : resolve()
      );
    });
  }
  
  for (let i = 1; i <= 10; i++) {
    await new Promise<void>((resolve, reject) => {
      const scheduleId = uuidv4();
      db.run(
        `INSERT INTO schedules (id, contract_id, lesson_date, lesson_time, teacher_id, teacher_name, status, is_gifted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scheduleId,
          contract1Id,
          `2024-0${1 + Math.floor(i / 5)}-${10 + i}`,
          '14:00-16:00',
          'TEA001',
          '李老师',
          'completed',
          i <= 2 ? 1 : 0,
          now
        ],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          db.run(
            `INSERT INTO attendances (id, schedule_id, contract_id, attended_date, is_gifted, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              scheduleId,
              contract1Id,
              `2024-0${1 + Math.floor(i / 5)}-${10 + i}`,
              i <= 2 ? 1 : 0,
              now
            ],
            (err) => err ? reject(err) : resolve()
          );
        }
      );
    });
  }
  
  const contract2Id = uuidv4();
  await new Promise<void>((resolve, reject) => {
    db.run(
      `INSERT INTO contracts (id, contract_no, student_id, student_name, campus_id, campus_name, course_name, total_lessons, paid_lessons, gifted_lessons, total_amount, material_fee, installment_fee, unit_price, status, signed_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contract2Id,
        'CONT002',
        'STU002',
        '李四',
        'CAMP002',
        '海淀校区',
        '数学提高班',
        24,
        24,
        0,
        7200,
        300,
        0,
        300,
        'active',
        '2024-02-01',
        now,
        now
      ],
      (err) => err ? reject(err) : resolve()
    );
  });
  
  for (let i = 1; i <= 3; i++) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO installments (id, contract_id, installment_no, due_date, amount, principal, fee, status, paid_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          contract2Id,
          i,
          `2024-0${i + 1}-01`,
          2400,
          2400,
          0,
          'paid',
          `2024-0${i + 1}-01`,
          now
        ],
        (err) => err ? reject(err) : resolve()
      );
    });
  }
  
  for (let i = 1; i <= 5; i++) {
    await new Promise<void>((resolve, reject) => {
      const scheduleId = uuidv4();
      db.run(
        `INSERT INTO schedules (id, contract_id, lesson_date, lesson_time, teacher_id, teacher_name, status, is_gifted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          scheduleId,
          contract2Id,
          `2024-0${2 + Math.floor(i / 3)}-${5 + i}`,
          '09:00-11:00',
          'TEA002',
          '王老师',
          'completed',
          0,
          now
        ],
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          db.run(
            `INSERT INTO attendances (id, schedule_id, contract_id, attended_date, is_gifted, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              scheduleId,
              contract2Id,
              `2024-0${2 + Math.floor(i / 3)}-${5 + i}`,
              0,
              now
            ],
            (err) => err ? reject(err) : resolve()
          );
        }
      );
    });
  }
  
  console.log('合同1退费计算中...');
  const calc1 = await calculateRefund(contract1Id);
  console.log('方案1 - 分期未付清 + 赠课消费:', {
    应退总额: calc1.total_refund_amount,
    实退金额: calc1.actual_refund_amount,
    扣除项: calc1.items.map(i => `${i.name}: ${i.amount}`),
    警告: calc1.warnings
  });
  
  console.log('\n合同2退费计算中...');
  const calc2 = await calculateRefund(contract2Id);
  console.log('方案2 - 全额付清 + 无赠课:', {
    应退总额: calc2.total_refund_amount,
    实退金额: calc2.actual_refund_amount,
    扣除项: calc2.items.map(i => `${i.name}: ${i.amount}`),
    警告: calc2.warnings
  });
  
  const refund1 = await createRefundApplication(
    contract1Id,
    '学生转学',
    '2024-03-20',
    'ADMIN001',
    '管理员'
  );
  console.log('\n已创建退费申请1:', refund1.refund.application_no);
  
  const refund2 = await createRefundApplication(
    contract2Id,
    '课程调整',
    '2024-03-21',
    'ADMIN001',
    '管理员'
  );
  console.log('已创建退费申请2:', refund2.refund.application_no);
  
  await approveRefund(refund1.refund.id, 'MANAGER001', '张校长', '情况属实，同意退费');
  console.log('已批准退费申请1');
  
  console.log('\n种子数据插入完成!');
  console.log('\n=== 两种退费方案对比:');
  console.log('\n【方案1】- 分期未付清情况:');
  console.log('  学生: 张三 (CONT001)');
  console.log('  已上课时: 付费课8节 + 赠课2节');
  console.log('  分期情况: 3期已付2期，第3期未付');
  console.log(`  应退总额: ${calc1.total_refund_amount}元`);
  console.log(`  扣除分期手续费: ${calc1.unpaid_installment_fees}元`);
  console.log(`  实际退款: ${calc1.actual_refund_amount}元`);
  console.log('  扣款项明细:');
  calc1.items.forEach(item => {
    console.log(`    - ${item.name}: ${item.amount}元 (${item.remark})`);
  });
  
  console.log('\n【方案2】- 全额付清情况:');
  console.log('  学生: 李四 (CONT002)');
  console.log('  已上课时: 付费课5节，无赠课');
  console.log('  分期情况: 3期全部付清');
  console.log(`  应退总额: ${calc2.total_refund_amount}元`);
  console.log(`  实际退款: ${calc2.actual_refund_amount}元`);
  console.log('  扣款项明细:');
  calc2.items.forEach(item => {
    console.log(`    - ${item.name}: ${item.amount}元 (${item.remark})`);
  });
  
  process.exit(0);
};

seedData().catch(err => {
  console.error('种子数据插入失败:', err);
  process.exit(1);
});
