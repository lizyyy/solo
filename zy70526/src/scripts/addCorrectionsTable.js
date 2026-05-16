const db = require('../database/db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS manual_corrections (
      id TEXT PRIMARY KEY,
      risk_sample_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      correction_reason TEXT NOT NULL,
      old_risk_level TEXT,
      new_risk_level TEXT,
      old_status TEXT,
      new_status TEXT,
      old_identified_fields TEXT,
      new_identified_fields TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (risk_sample_id) REFERENCES risk_samples(id)
    )
  `, function(err) {
    if (err) {
      console.error('创建修正记录表失败:', err.message);
    } else {
      console.log('修正记录表创建成功');
    }
    db.close();
  });
});