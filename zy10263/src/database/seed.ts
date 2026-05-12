import { v4 as uuidv4 } from 'uuid';
import { runAsync } from './connection';

const seedData = async () => {
  try {
    console.log('开始导入种子数据...');
    const now = new Date().toISOString();

    const skillWelderId = uuidv4();
    const skillAssemblerId = uuidv4();
    const skillPainterId = uuidv4();
    const skillQaId = uuidv4();

    await runAsync(
      `INSERT INTO skills (id, name, code, description, created_at) VALUES 
       (?, '焊接', 'WELDER', '焊接作业技能', ?),
       (?, '组装', 'ASSEMBLER', '产品组装技能', ?),
       (?, '喷漆', 'PAINTER', '喷漆作业技能', ?),
       (?, '质检', 'QA', '质量检验技能', ?)`,
      [skillWelderId, now, skillAssemblerId, now, skillPainterId, now, skillQaId, now]
    );

    const lineAId = uuidv4();
    const lineBId = uuidv4();
    const lineCId = uuidv4();

    await runAsync(
      `INSERT INTO production_lines (id, line_no, name, required_skill_id, status, created_at, updated_at) VALUES 
       (?, 'LINE-A', 'A线-焊接线', ?, 'active', ?, ?),
       (?, 'LINE-B', 'B线-组装线', ?, 'active', ?, ?),
       (?, 'LINE-C', 'C线-喷漆线', ?, 'active', ?, ?)`,
      [lineAId, skillWelderId, now, now, lineBId, skillAssemblerId, now, now, lineCId, skillPainterId, now, now]
    );

    const empZhangId = uuidv4();
    const empLiId = uuidv4();
    const empWangId = uuidv4();
    const empZhaoId = uuidv4();

    await runAsync(
      `INSERT INTO employees (id, employee_no, name, department, current_line_id, status, created_at, updated_at) VALUES 
       (?, 'E001', '张三', '生产一部', ?, 'active', ?, ?),
       (?, 'E002', '李四', '生产一部', ?, 'active', ?, ?),
       (?, 'E003', '王五', '生产二部', ?, 'active', ?, ?),
       (?, 'E004', '赵六', '生产二部', NULL, 'active', ?, ?)`,
      [empZhangId, lineAId, now, now, empLiId, lineAId, now, now, empWangId, lineBId, now, now, empZhaoId, now, now]
    );

    await runAsync(
      `INSERT INTO employee_skills (id, employee_id, skill_id, level, created_at) VALUES 
       (?, ?, ?, 4, ?),
       (?, ?, ?, 3, ?),
       (?, ?, ?, 5, ?),
       (?, ?, ?, 4, ?),
       (?, ?, ?, 2, ?)`,
      [
        uuidv4(), empZhangId, skillWelderId, now,
        uuidv4(), empZhangId, skillAssemblerId, now,
        uuidv4(), empLiId, skillWelderId, now,
        uuidv4(), empWangId, skillAssemblerId, now,
        uuidv4(), empZhaoId, skillPainterId, now
      ]
    );

    console.log('种子数据导入完成！');
    console.log('');
    console.log('员工信息:');
    console.log('  E001 张三 - A线(焊接) - 技能: 焊接(4级), 组装(3级)');
    console.log('  E002 李四 - A线(焊接) - 技能: 焊接(5级)');
    console.log('  E003 王五 - B线(组装) - 技能: 组装(4级)');
    console.log('  E004 赵六 - 待分配 - 技能: 喷漆(2级)');
    console.log('');
    console.log('产线信息:');
    console.log('  LINE-A A线-焊接线 - 需要: 焊接技能');
    console.log('  LINE-B B线-组装线 - 需要: 组装技能');
    console.log('  LINE-C C线-喷漆线 - 需要: 喷漆技能');
  } catch (error) {
    console.error('导入种子数据失败:', error);
    throw error;
  }
};

seedData().then(() => process.exit(0)).catch(() => process.exit(1));
