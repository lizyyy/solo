const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const config = require('../config');

const CHALLENGE_TYPES = {
  REGISTRATION: 'registration',
  AUTHENTICATION: 'authentication'
};

class ChallengeService {
  generateChallenge() {
    return crypto.randomBytes(32);
  }

  createChallenge(type, userId = null) {
    const id = uuidv4();
    const challenge = this.generateChallenge();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + Math.floor(config.webauthn.challengeTimeout / 1000);

    db.prepare(`
      INSERT INTO challenges (id, challenge, type, user_id, used, expires_at, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, challenge, type, userId, expiresAt, now);

    return {
      id,
      challenge,
      challengeBase64: challenge.toString('base64url'),
      type,
      userId,
      expiresAt: new Date(expiresAt * 1000).toISOString()
    };
  }

  getChallengeByValue(challengeBuffer) {
    this._cleanupExpired();
    
    const row = db.prepare(`
      SELECT * FROM challenges 
      WHERE challenge = ? AND used = 0 AND expires_at > strftime('%s', 'now')
    `).get(challengeBuffer);

    return row ? this._formatChallenge(row) : null;
  }

  getChallengeById(id) {
    const row = db.prepare('SELECT * FROM challenges WHERE id = ?').get(id);
    return row ? this._formatChallenge(row) : null;
  }

  markAsUsed(id) {
    const now = Math.floor(Date.now() / 1000);
    const result = db.prepare(`
      UPDATE challenges SET used = 1, used_at = ? WHERE id = ?
    `).run(now, id);
    return result.changes > 0;
  }

  isChallengeUsed(challengeBuffer) {
    const row = db.prepare(`
      SELECT used FROM challenges WHERE challenge = ?
    `).get(challengeBuffer);
    return row ? row.used === 1 : false;
  }

  isChallengeExpired(challengeBuffer) {
    const row = db.prepare(`
      SELECT expires_at FROM challenges WHERE challenge = ?
    `).get(challengeBuffer);
    if (!row) return true;
    const now = Math.floor(Date.now() / 1000);
    return row.expires_at <= now;
  }

  _cleanupExpired() {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM challenges WHERE expires_at < ?').run(now - 86400);
  }

  _formatChallenge(row) {
    return {
      id: row.id,
      challenge: row.challenge,
      challengeBase64: row.challenge.toString('base64url'),
      type: row.type,
      userId: row.user_id,
      used: row.used === 1,
      usedAt: row.used_at ? new Date(row.used_at * 1000).toISOString() : null,
      expiresAt: new Date(row.expires_at * 1000).toISOString(),
      createdAt: new Date(row.created_at * 1000).toISOString()
    };
  }
}

module.exports = {
  ChallengeService: new ChallengeService(),
  CHALLENGE_TYPES
};
