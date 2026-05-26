const db = require('./db').getDb();

function getRule(code) {
  return db.prepare('SELECT * FROM rule WHERE code = ?').get(code);
}

function listRules() {
  return db.prepare('SELECT * FROM rule ORDER BY code').all();
}

function upsertRule(r) {
  db.prepare(`
    INSERT INTO rule(code,name,category,amount,requires_review,description)
    VALUES (@code,@name,@category,@amount,@requires_review,@description)
    ON CONFLICT(code) DO UPDATE SET
      name=excluded.name,
      category=excluded.category,
      amount=excluded.amount,
      requires_review=excluded.requires_review,
      description=excluded.description
  `).run(r);
}

module.exports = { getRule, listRules, upsertRule };
