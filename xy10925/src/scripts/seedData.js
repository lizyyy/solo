const db = require('../database/db');

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const seedData = async () => {
  console.log('开始导入样例数据...');

  try {
    await runQuery('BEGIN TRANSACTION');

    const groups = [
      { name: '男子甲组', max_participants: 3, description: '18-30岁男子组' },
      { name: '女子甲组', max_participants: 2, description: '18-30岁女子组' }
    ];

    const groupIds = {};
    for (const group of groups) {
      let result = await runQuery(
        'INSERT OR IGNORE INTO groups (name, max_participants, description) VALUES (?, ?, ?)',
        [group.name, group.max_participants, group.description]
      );
      if (result.lastID) {
        groupIds[group.name] = result.lastID;
      } else {
        const existing = await getQuery('SELECT id FROM groups WHERE name = ?', [group.name]);
        groupIds[group.name] = existing.id;
      }
    }

    const athletes = [
      { name: '张三', id_card: '110101199001011234', phone: '13800138001', email: 'zhangsan@example.com', group: '男子甲组' },
      { name: '李四', id_card: '110101199002022345', phone: '13800138002', email: 'lisi@example.com', group: '男子甲组' },
      { name: '王五', id_card: '110101199003033456', phone: '13800138003', email: 'wangwu@example.com', group: null },
      { name: '赵六', id_card: '110101199004044567', phone: '13800138004', email: 'zhaoliu@example.com', group: '女子甲组' }
    ];

    const athleteIds = {};
    for (const athlete of athletes) {
      const groupId = athlete.group ? groupIds[athlete.group] : null;
      let result = await runQuery(
        'INSERT OR IGNORE INTO athletes (name, id_card, phone, email, group_id) VALUES (?, ?, ?, ?, ?)',
        [athlete.name, athlete.id_card, athlete.phone, athlete.email, groupId]
      );
      if (result.lastID) {
        athleteIds[athlete.name] = result.lastID;
      } else {
        const existing = await getQuery('SELECT id FROM athletes WHERE id_card = ?', [athlete.id_card]);
        athleteIds[athlete.name] = existing.id;
      }
    }

    const documents = [
      { athlete: '张三', doc_type: '身份证', doc_number: '110101199001011234', is_valid: 1 },
      { athlete: '张三', doc_type: '参赛证明', doc_number: 'CERT001', is_valid: 1 },
      { athlete: '张三', doc_type: '健康证明', doc_number: 'HEALTH001', is_valid: 1 },
      { athlete: '李四', doc_type: '身份证', doc_number: '110101199002022345', is_valid: 1 },
      { athlete: '李四', doc_type: '参赛证明', doc_number: 'CERT002', is_valid: 0 },
      { athlete: '王五', doc_type: '身份证', doc_number: '110101199003033456', is_valid: 1 },
      { athlete: '王五', doc_type: '参赛证明', doc_number: 'CERT003', is_valid: 1 },
      { athlete: '王五', doc_type: '健康证明', doc_number: 'HEALTH003', is_valid: 1 },
      { athlete: '赵六', doc_type: '身份证', doc_number: '110101199004044567', is_valid: 1 },
      { athlete: '赵六', doc_type: '参赛证明', doc_number: 'CERT004', is_valid: 1 },
      { athlete: '赵六', doc_type: '健康证明', doc_number: 'HEALTH004', is_valid: 1 }
    ];

    for (const doc of documents) {
      await runQuery(
        'INSERT OR IGNORE INTO documents (athlete_id, doc_type, doc_number, is_valid) VALUES (?, ?, ?, ?)',
        [athleteIds[doc.athlete], doc.doc_type, doc.doc_number, doc.is_valid]
      );
    }

    await runQuery(
      'INSERT OR IGNORE INTO substitutes (athlete_id, group_id, priority) VALUES (?, ?, ?)',
      [athleteIds['王五'], groupIds['男子甲组'], 1]
    );

    await runQuery('COMMIT');

    console.log('样例数据导入成功!');
    console.log('');
    console.log('已创建:');
    console.log('  - 2 个组别 (男子甲组、女子甲组)');
    console.log('  - 4 个选手 (张三、李四、王五、赵六)');
    console.log('  - 张三: 证件齐全，可以正常检录');
    console.log('  - 李四: 参赛证明未验证，会检录异常');
    console.log('  - 王五: 证件齐全，是替补选手，会自动递补');
    console.log('  - 赵六: 证件齐全，可以正常检录');
    console.log('');
    console.log('提示: 支持重复执行，数据不会重复导入');

    db.close();
  } catch (err) {
    await runQuery('ROLLBACK');
    console.error('导入失败:', err.message);
    db.close();
  }
};

seedData();
