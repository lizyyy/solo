const { initDatabase } = require('../database/init');

let dbInitialized = false;
let dbInitializing = null;

async function ensureDatabase() {
  if (dbInitialized) {
    return true;
  }

  if (dbInitializing) {
    return dbInitializing;
  }

  dbInitializing = (async () => {
    try {
      await initDatabase();
      dbInitialized = true;
      return true;
    } catch (error) {
      console.error('数据库初始化失败:', error.message);
      throw error;
    } finally {
      dbInitializing = null;
    }
  })();

  return dbInitializing;
}

function resetDatabaseState() {
  dbInitialized = false;
  dbInitializing = null;
}

module.exports = {
  ensureDatabase,
  resetDatabaseState
};
