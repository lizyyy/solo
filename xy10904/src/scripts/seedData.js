const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const seedData = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        db.run('BEGIN TRANSACTION');

        const member1Id = uuidv4();
        const member2Id = uuidv4();
        const member3Id = uuidv4();
        
        await new Promise((resolve, reject) => {
          const memberStmt = db.prepare(`
            INSERT INTO members (id, name, phone, gender, birthday, status)
            VALUES (?, ?, ?, ?, ?, 'active')
          `);
          memberStmt.run(member1Id, '张三', '13800138001', '男', '1990-05-15');
          memberStmt.run(member2Id, '李四', '13800138002', '女', '1992-08-20');
          memberStmt.run(member3Id, '王五', '13800138003', '男', '1988-03-10');
          memberStmt.finalize(resolve);
        });

        const coach1Id = uuidv4();
        const coach2Id = uuidv4();
        
        await new Promise((resolve, reject) => {
          const coachStmt = db.prepare(`
            INSERT INTO coaches (id, name, phone, gender, specialty, status)
            VALUES (?, ?, ?, ?, ?, 'active')
          `);
          coachStmt.run(coach1Id, '李教练', '13900139001', '男', '增肌、力量训练');
          coachStmt.run(coach2Id, '王教练', '13900139002', '女', '瑜伽、普拉提、减脂');
          coachStmt.finalize(resolve);
        });

        const package1Id = uuidv4();
        const package2Id = uuidv4();
        
        await new Promise((resolve, reject) => {
          const packageStmt = db.prepare(`
            INSERT INTO course_packages (id, name, total_lessons, price, valid_days, description, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
          `);
          packageStmt.run(package1Id, '基础私教课24节', 24, 4800, 180, '适合新手的基础私教课程');
          packageStmt.run(package2Id, '进阶私教课48节', 48, 8600, 365, '进阶训练，包含更多专项训练');
          packageStmt.finalize(resolve);
        });

        const card1Id = uuidv4();
        const card2Id = uuidv4();
        
        await new Promise((resolve, reject) => {
          const cardStmt = db.prepare(`
            INSERT INTO membership_cards (
              id, member_id, course_package_id, coach_id, remaining_lessons,
              total_lessons, start_date, end_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
          `);
          cardStmt.run(card1Id, member1Id, package1Id, coach1Id, 24, 24, '2024-01-01', '2024-06-30');
          cardStmt.run(card2Id, member2Id, package2Id, coach2Id, 48, 48, '2024-01-15', '2025-01-14');
          cardStmt.finalize(resolve);
        });

        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const dayAfterTomorrow = new Date(Date.now() + 172800000).toISOString().split('T')[0];

        const appointment1Id = uuidv4();
        const appointment2Id = uuidv4();
        const appointment3Id = uuidv4();
        
        await new Promise((resolve, reject) => {
          const apptStmt = db.prepare(`
            INSERT INTO appointments (
              id, membership_card_id, member_id, coach_id, appointment_date,
              appointment_time, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          apptStmt.run(appointment1Id, card1Id, member1Id, coach1Id, today, '10:00', 'scheduled');
          apptStmt.run(appointment2Id, card1Id, member1Id, coach1Id, tomorrow, '14:00', 'scheduled');
          apptStmt.run(appointment3Id, card2Id, member2Id, coach2Id, dayAfterTomorrow, '09:00', 'scheduled');
          apptStmt.finalize(resolve);
        });

        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            console.log('✅ 样例数据插入成功!');
            console.log('');
            console.log('📋 生成的数据:');
            console.log('   - 会员: 3个 (张三、李四、王五)');
            console.log('   - 教练: 2个 (李教练、王教练)');
            console.log('   - 课程包: 2个 (24节基础课、48节进阶课)');
            console.log('   - 会员卡: 2张');
            console.log('   - 预约: 3个 (包含今日、明日、后日)');
            resolve();
          }
        });
      } catch (err) {
        db.run('ROLLBACK');
        reject(err);
      }
    });
  });
};

seedData()
  .then(() => {
    console.log('');
    console.log('🎉 数据初始化完成!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 数据初始化失败:', err);
    process.exit(1);
  });
