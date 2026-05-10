const { initDb, getDb } = require('./database');
const { withLock, acquireLock, releaseLock } = require('./lockManager');

const runTest = async () => {
  await initDb();
  
  console.log('数据库初始化完成');
  
  const db = getDb();
  
  console.log('\n测试1: 直接插入锁');
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 30000).toISOString();
  
  try {
    db.prepare(`
      INSERT INTO resource_locks (resource_type, resource_id, lock_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run('test', 'test1', 'token1', expires);
    console.log('插入成功');
  } catch (e) {
    console.log('插入错误:', e.message);
  }
  
  console.log('\n测试2: 检查锁是否存在');
  const lock = db.prepare(`
    SELECT 1 FROM resource_locks WHERE resource_type = ? AND resource_id = ?
  `).get('test', 'test1');
  console.log('锁存在:', !!lock);
  
  console.log('\n测试3: 用 withLock 测试');
  try {
    const result = await withLock('contract', 'TEST-001', () => {
      console.log('  获得锁，执行业务逻辑');
      return 'success';
    });
    console.log('withLock 结果:', result);
  } catch (e) {
    console.log('withLock 错误:', e.message);
  }
  
  console.log('\n测试4: 连续两次 withLock（应该都成功）');
  try {
    const r1 = await withLock('test2', 'id1', () => 'r1');
    console.log('第一次:', r1);
    
    const r2 = await withLock('test2', 'id1', () => 'r2');
    console.log('第二次:', r2);
  } catch (e) {
    console.log('错误:', e.message);
  }
  
  console.log('\n测试完成');
};

runTest().catch(console.error);
