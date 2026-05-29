const { getDb } = require('./database');

function getArtistByCode(artistCode) {
  const db = getDb();
  return db.prepare('SELECT * FROM artists WHERE artist_code = ?').get(artistCode);
}

function getAllArtists() {
  const db = getDb();
  return db.prepare('SELECT * FROM artists ORDER BY artist_code').all();
}

function getArtistCommissionRate(artistCode) {
  const db = getDb();
  const result = db.prepare(`
    SELECT commission_rate, artist_level 
    FROM artists 
    WHERE artist_code = ?
  `).get(artistCode);
  return result;
}

function updateArtistCommission(artistCode, commissionRate, artistLevel) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE artists 
    SET commission_rate = ?, artist_level = ?, updated_at = CURRENT_TIMESTAMP
    WHERE artist_code = ?
  `);
  return stmt.run(commissionRate, artistLevel, artistCode);
}

function createArtist(artistData) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO artists (artist_code, artist_name, artist_level, commission_rate)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(
    artistData.artist_code,
    artistData.artist_name,
    artistData.artist_level || 'DEFAULT',
    artistData.commission_rate
  );
  return result.lastInsertRowid;
}

module.exports = {
  getArtistByCode,
  getAllArtists,
  getArtistCommissionRate,
  updateArtistCommission,
  createArtist
};
