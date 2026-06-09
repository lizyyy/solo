const { ready, resetDB, initDB, DB_PATH } = require('./db');

(async () => {
  await ready();
  resetDB();
  initDB();
  console.log('[init-db] 数据库已创建: ' + DB_PATH);
})().catch(e => { console.error(e); process.exit(1); });
