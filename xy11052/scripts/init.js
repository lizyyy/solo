const { initTables, initStatusFlowRules, Database } = require('../src/models/database');
const { v4: uuidv4 } = require('uuid');

const initSampleData = async () => {
  const db = new Database();
  
  try {
    await db.run(`
      INSERT OR IGNORE INTO stores (
        store_id, store_name, franchisee_name, store_address, region, open_date
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'STORE001',
      '全家便利店(中关村店)',
      '张三',
      '北京市海淀区中关村大街1号',
      '华北区',
      '2022-03-15'
    ]);

    await db.run(`
      INSERT OR IGNORE INTO stores (
        store_id, store_name, franchisee_name, store_address, region, open_date
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'STORE002',
      '7-ELEVEN(国贸店)',
      '李四',
      '北京市朝阳区建国门外大街1号',
      '华北区',
      '2021-08-20'
    ]);

    await db.run(`
      INSERT OR IGNORE INTO inspections (
        inspection_id, store_id, inspector_id, inspector_name,
        inspection_date, inspection_type, overall_score, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'INSPECT20240115001',
      'STORE001',
      'INS001',
      '王督导',
      '2024-01-15',
      '常规巡检',
      85,
      'completed'
    ]);

    await db.run(`
      INSERT OR IGNORE INTO inspections (
        inspection_id, store_id, inspector_id, inspector_name,
        inspection_date, inspection_type, overall_score, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'INSPECT20240115002',
      'STORE002',
      'INS001',
      '王督导',
      '2024-01-15',
      '专项检查',
      78,
      'completed'
    ]);

    console.log('基础样例数据初始化完成');
  } catch (error) {
    console.error('初始化样例数据失败:', error);
    throw error;
  } finally {
    await db.close();
  }
};

const init = async () => {
  console.log('开始初始化便利店加盟督导巡店整改系统...\n');
  
  try {
    await initTables();
    await initStatusFlowRules();
    await initSampleData();
    
    console.log('\n✅ 系统初始化完成!');
    console.log('\n接下来请执行:');
    console.log('  npm install    - 安装依赖');
    console.log('  npm start      - 启动服务');
    console.log('  npm run test:all - 运行完整验收测试');
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  }
};

init();