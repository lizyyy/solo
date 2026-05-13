const { runQuery, allQuery } = require('./db');

const seedData = async () => {
  try {
    const tableTypes = await allQuery('SELECT * FROM table_types');
    if (tableTypes.length === 0) {
      await runQuery(
        'INSERT INTO table_types (name, capacity, description) VALUES (?, ?, ?)',
        ['二人桌', 2, '适合情侣或两人用餐']
      );
      await runQuery(
        'INSERT INTO table_types (name, capacity, description) VALUES (?, ?, ?)',
        ['四人桌', 4, '适合家庭或朋友聚会']
      );
      await runQuery(
        'INSERT INTO table_types (name, capacity, description) VALUES (?, ?, ?)',
        ['六人桌', 6, '适合小型聚会']
      );
      await runQuery(
        'INSERT INTO table_types (name, capacity, description) VALUES (?, ?, ?)',
        ['八人桌', 8, '适合大型聚会']
      );
      console.log('桌台类型数据插入完成');
    }

    const tables = await allQuery('SELECT * FROM tables');
    if (tables.length === 0) {
      const tableData = [
        { number: 'A1', type: 1 },
        { number: 'A2', type: 1 },
        { number: 'A3', type: 1 },
        { number: 'B1', type: 2 },
        { number: 'B2', type: 2 },
        { number: 'B3', type: 2 },
        { number: 'B4', type: 2 },
        { number: 'C1', type: 3 },
        { number: 'C2', type: 3 },
        { number: 'D1', type: 4 },
      ];

      for (const t of tableData) {
        await runQuery(
          'INSERT INTO tables (table_number, type_id, status) VALUES (?, ?, ?)',
          [t.number, t.type, 'available']
        );
      }
      console.log('桌台数据插入完成');
    }

    const queues = await allQuery('SELECT * FROM queue_numbers');
    if (queues.length === 0) {
      const queueData = [
        { number: 'A001', size: 2, name: '张先生', phone: '13800138001', type: 1, status: 'waiting' },
        { number: 'A002', size: 2, name: '李女士', phone: '13800138002', type: 1, status: 'waiting' },
        { number: 'B001', size: 4, name: '王先生', phone: '13800138003', type: 2, status: 'calling' },
        { number: 'B002', size: 3, name: '刘女士', phone: '13800138004', type: 2, status: 'waiting' },
        { number: 'B003', size: 4, name: '陈先生', phone: '13800138005', type: 2, status: 'seated' },
        { number: 'C001', size: 6, name: '赵女士', phone: '13800138006', type: 3, status: 'skipped' },
        { number: 'D001', size: 8, name: '孙先生', phone: '13800138007', type: 4, status: 'waiting' },
      ];

      for (const q of queueData) {
        await runQuery(
          `INSERT INTO queue_numbers 
           (queue_number, party_size, customer_name, phone, table_type_id, status, checkin_time) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [q.number, q.size, q.name, q.phone, q.type, q.status, new Date().toISOString()]
        );
      }
      console.log('排号数据插入完成');
    }

    const skipRecords = await allQuery('SELECT * FROM skip_records');
    if (skipRecords.length === 0) {
      await runQuery(
        `INSERT INTO skip_records 
         (queue_id, skip_count, skip_reason, skipped_by, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [6, 1, '顾客暂时离开', '张三', 'skipped']
      );
      console.log('过号记录数据插入完成');
    }

    console.log('演示数据初始化完成');
  } catch (error) {
    console.error('初始化演示数据失败:', error);
  }
};

seedData();
