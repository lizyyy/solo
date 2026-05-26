const db = require('./db').getDb();

function importApplications(rows) {
  const ins = db.prepare(`
    INSERT INTO application(apply_no,owner_name,room_no,deposit_amount,start_date,end_date,remark)
    VALUES (@apply_no,@owner_name,@room_no,@deposit_amount,@start_date,@end_date,@remark)
    ON CONFLICT(apply_no) DO UPDATE SET
      owner_name=excluded.owner_name,
      room_no=excluded.room_no,
      deposit_amount=excluded.deposit_amount,
      start_date=excluded.start_date,
      end_date=excluded.end_date,
      remark=excluded.remark
  `);
  const tx = db.transaction((items) => {
    for (const r of items) ins.run(r);
    return items.length;
  });
  return tx(rows);
}

function listApplications(filter) {
  if (filter && filter.apply_no) {
    return db.prepare('SELECT * FROM application WHERE apply_no = ?').all(filter.apply_no);
  }
  return db.prepare('SELECT * FROM application ORDER BY apply_no').all();
}

function getApplication(applyNo) {
  return db.prepare('SELECT * FROM application WHERE apply_no = ?').get(applyNo);
}

module.exports = { importApplications, listApplications, getApplication };
