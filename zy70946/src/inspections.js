const db = require('./db').getDb();

function importInspections(items) {
  db.exec('DELETE FROM inspection');
  const ins = db.prepare(`
    INSERT INTO inspection(apply_no,seq,inspector,inspect_date,rule_code,detail,raw_json)
    VALUES (@apply_no,@seq,@inspector,@inspect_date,@rule_code,@detail,@raw_json)
  `);
  const tx = db.transaction((arr) => {
    for (const r of arr) ins.run(r);
    return arr.length;
  });
  return tx(items);
}

function getInspectionsByApply(applyNo) {
  return db.prepare(
    'SELECT * FROM inspection WHERE apply_no = ? ORDER BY seq'
  ).all(applyNo);
}

function getAllInspections() {
  return db.prepare('SELECT * FROM inspection ORDER BY apply_no, seq').all();
}

module.exports = { importInspections, getInspectionsByApply, getAllInspections };
