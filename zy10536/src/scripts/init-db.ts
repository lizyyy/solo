import { createTables, dropTables } from '../database/schema';
import { getDatabase } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

async function insertSampleData() {
  const db = getDatabase();
  const now = new Date().toISOString();
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const defectId1 = uuidv4();
  const defectId2 = uuidv4();

  const insertDefect1 = db.prepare(`
    INSERT INTO defects (id, procurement_order_no, equipment_no, defect_type, description, status, inspector, registered_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertDefect1.run(defectId1, 'PO-2024-001', 'EQ-001', 'appearance', '外壳有划痕，表面不平整', 'registered', '张三', now, now);

  const insertDefect2 = db.prepare(`
    INSERT INTO defects (id, procurement_order_no, equipment_no, defect_type, description, status, inspector, registered_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertDefect2.run(defectId2, 'PO-2024-001', 'EQ-002', 'functional', '启动时噪音过大，运行不稳定', 'in_rectification', '李四', now, now);

  const insertPhoto1 = db.prepare(`
    INSERT INTO defect_photos (id, defect_id, url, filename, uploaded_at, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertPhoto1.run(uuidv4(), defectId1, 'http://example.com/photos/scratch1.jpg', 'scratch1.jpg', now, '张三');

  const insertRectification = db.prepare(`
    INSERT INTO rectification_requirements (id, defect_id, content, deadline, responsible_person, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertRectification.run(uuidv4(), defectId2, '请更换风扇轴承，检查散热系统', deadline, '王五', now, now);

  console.log('示例数据插入完成');
}

async function main() {
  try {
    console.log('开始初始化数据库...');
    await dropTables();
    await createTables();
    await insertSampleData();
    console.log('数据库初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

main();
