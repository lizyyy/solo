const { initDb, getDb, DB_PATH } = require('../src/database/init');
const fs = require('fs');

function main() {
  console.log('=== 重置数据库 ===');
  console.log('');
  
  console.log(`数据库路径: ${DB_PATH}`);
  console.log('');
  
  if (fs.existsSync(DB_PATH)) {
    try {
      fs.unlinkSync(DB_PATH);
      console.log('✓ 已删除旧数据库文件');
    } catch (e) {
      console.log('警告: 删除数据库文件失败:', e.message);
    }
    
    const walFile = DB_PATH + '-wal';
    const shmFile = DB_PATH + '-shm';
    
    [walFile, shmFile].forEach(f => {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch (e) {}
      }
    });
  }
  
  console.log('正在初始化新数据库...');
  initDb();
  
  const db = getDb();
  
  const deptCount = db.prepare('SELECT COUNT(*) as cnt FROM departments').get().cnt;
  
  console.log('✓ 数据库初始化完成');
  console.log('');
  console.log('数据库状态:');
  console.log(`  - 部门数据: ${deptCount} 个`);
  console.log('');
  console.log('下一步:');
  console.log('  npm run init-data  - 初始化测试数据');
  console.log('  npm start          - 启动服务');
  console.log('  npm test           - 运行测试');
}

main();
