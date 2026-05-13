import db, { run, get } from '../database';
import dayjs from 'dayjs';

const seedData = async () => {
  try {
    const departments = ['外科', '内科', '妇产科', '骨科', '眼科'];
    const handlers = ['张三', '李四', '王五', '赵六', '钱七'];
    const packageTypes = ['手术器械包', '换药包', '缝合包', '骨科器械包', '眼科器械包'];

    for (let i = 1; i <= 20; i++) {
      await run(
        'INSERT INTO instrument_packages (package_no, name, type, instruments, status) VALUES (?, ?, ?, ?, ?)',
        [
          `PKG${String(i).padStart(4, '0')}`,
          `${packageTypes[i % 5]}${i}号`,
          packageTypes[i % 5],
          JSON.stringify(['手术刀', '镊子', '剪刀', '止血钳']),
          'active'
        ]
      );
    }

    for (let i = 1; i <= 30; i++) {
      await run(
        'INSERT INTO recovery_records (recovery_no, package_id, department, recovery_time, receiver, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          `REC${String(i).padStart(4, '0')}`,
          (i % 20) + 1,
          departments[i % 5],
          dayjs().subtract(i, 'hour').format('YYYY-MM-DD HH:mm:ss'),
          handlers[i % 5],
          i % 5 === 0 ? 'pending' : 'completed',
          i % 3 === 0 ? '有污渍需特别处理' : null
        ]
      );
    }

    for (let i = 1; i <= 25; i++) {
      const result = i % 7 === 0 ? 'failed' : 'passed';
      await run(
        'INSERT INTO cleaning_records (cleaning_no, recovery_id, cleaner, cleaning_method, start_time, end_time, result, temperature, duration, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          `CLN${String(i).padStart(4, '0')}`,
          i,
          handlers[i % 5],
          i % 2 === 0 ? '全自动清洗' : '手工清洗',
          dayjs().subtract(i * 2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
          dayjs().subtract(i * 2 - 1, 'hour').format('YYYY-MM-DD HH:mm:ss'),
          result,
          85 + Math.random() * 10,
          30 + Math.floor(Math.random() * 30),
          result === 'failed' ? '清洗不达标，需重新清洗' : null
        ]
      );
    }

    for (let i = 1; i <= 10; i++) {
      const result = i % 5 === 0 ? 'failed' : 'passed';
      await run(
        'INSERT INTO sterilization_batches (batch_no, cleaning_ids, sterilizer, sterilization_method, start_time, end_time, temperature, pressure, duration, result, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          `STL${String(i).padStart(4, '0')}`,
          JSON.stringify([(i - 1) * 2 + 1, (i - 1) * 2 + 2]),
          handlers[i % 5],
          '高压蒸汽灭菌',
          dayjs().subtract(i, 'day').format('YYYY-MM-DD HH:mm:ss'),
          dayjs().subtract(i, 'day').add(2, 'hour').format('YYYY-MM-DD HH:mm:ss'),
          134 + Math.random() * 2,
          210 + Math.random() * 10,
          45 + Math.floor(Math.random() * 15),
          result,
          result === 'failed' ? '灭菌参数不达标' : null
        ]
      );
    }

    await run(
      'INSERT INTO failure_isolations (isolation_no, source_type, source_id, reason, handler, isolation_time, status, corrective_action, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'ISO0001',
        'cleaning',
        7,
        '清洗后仍有可见污渍',
        handlers[2],
        dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
        'resolved',
        '重新手工清洗并检查',
        '已完成重新清洗并验证通过'
      ]
    );

    await run(
      'INSERT INTO failure_isolations (isolation_no, source_type, source_id, reason, handler, isolation_time, status, corrective_action, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'ISO0002',
        'sterilization',
        5,
        '生物监测不合格',
        handlers[3],
        dayjs().subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
        'isolated',
        null,
        '等待重新灭菌'
      ]
    );

    for (let i = 1; i <= 15; i++) {
      await run(
        'INSERT INTO department_distributions (distribution_no, package_id, department, distributor, distribution_time, receiver, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          `DST${String(i).padStart(4, '0')}`,
          i,
          departments[i % 5],
          handlers[(i + 2) % 5],
          dayjs().subtract(i, 'day').format('YYYY-MM-DD HH:mm:ss'),
          handlers[(i + 1) % 5],
          'distributed',
          null
        ]
      );
    }

    console.log('初始化数据插入成功');
    db.close();
  } catch (error) {
    console.error('初始化数据插入失败:', error);
    db.close();
  }
};

seedData();
