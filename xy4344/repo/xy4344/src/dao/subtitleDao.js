const db = require('../database');

async function saveSubtitles(subtitles) {
  await db.run(`DELETE FROM subtitles`);
  
  const stmt = db.getDB().prepare(`
    INSERT INTO subtitles (index_num, start_time, end_time, start_time_str, end_time_str, text, duration, source_file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const sub of subtitles) {
    stmt.run([
      sub.index,
      sub.startTime,
      sub.endTime,
      sub.startTimeStr,
      sub.endTimeStr,
      sub.text,
      sub.duration,
      sub.sourceFile
    ]);
  }
  
  return new Promise((resolve, reject) => {
    stmt.finalize((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function getAllSubtitles() {
  return db.all(`SELECT * FROM subtitles ORDER BY start_time ASC`);
}

async function getSubtitlesByTimeRange(startTime, endTime) {
  return db.all(
    `SELECT * FROM subtitles WHERE start_time < ? AND end_time > ? ORDER BY start_time ASC`,
    [endTime, startTime]
  );
}

async function getSubtitleById(id) {
  return db.get(`SELECT * FROM subtitles WHERE id = ?`, [id]);
}

async function getSubtitleCount() {
  const result = await db.get(`SELECT COUNT(*) as count FROM subtitles`);
  return result ? result.count : 0;
}

module.exports = {
  saveSubtitles,
  getAllSubtitles,
  getSubtitlesByTimeRange,
  getSubtitleById,
  getSubtitleCount
};
