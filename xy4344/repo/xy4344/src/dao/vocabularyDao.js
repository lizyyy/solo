const db = require('../database');

async function saveVocabulary(items) {
  await db.run(`DELETE FROM vocabulary`);
  
  const stmt = db.getDB().prepare(`
    INSERT INTO vocabulary (word, meaning, category, difficulty, tags)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  for (const item of items) {
    stmt.run([
      item.word,
      item.meaning,
      item.category,
      item.difficulty,
      JSON.stringify(item.tags || [])
    ]);
  }
  
  return new Promise((resolve, reject) => {
    stmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function getAllVocabulary() {
  const rows = await db.all(`SELECT * FROM vocabulary ORDER BY id ASC`);
  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '[]')
  }));
}

async function getVocabularyWords() {
  const rows = await db.all(`SELECT word FROM vocabulary`);
  return rows.map(row => row.word);
}

async function getVocabularyById(id) {
  const row = await db.get(`SELECT * FROM vocabulary WHERE id = ?`, [id]);
  if (row) {
    row.tags = JSON.parse(row.tags || '[]');
  }
  return row;
}

async function getVocabularyCount() {
  const result = await db.get(`SELECT COUNT(*) as count FROM vocabulary`);
  return result ? result.count : 0;
}

async function searchVocabularyByWord(word) {
  const rows = await db.all(
    `SELECT * FROM vocabulary WHERE word LIKE ?`,
    [`%${word}%`]
  );
  return rows.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '[]')
  }));
}

module.exports = {
  saveVocabulary,
  getAllVocabulary,
  getVocabularyWords,
  getVocabularyById,
  getVocabularyCount,
  searchVocabularyByWord
};
