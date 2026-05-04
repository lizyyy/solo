const Database = require('better-sqlite3');
const config = require('../config');

class RFCheckerModel {
  constructor(dbPath = config.db.path) {
    this.db = new Database(dbPath);
  }

  createSession(name, description = '') {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (name, description, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    const result = stmt.run(name, description);
    return result.lastInsertRowid;
  }

  getSession(sessionId) {
    return this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `).get(sessionId);
  }

  getAllSessions() {
    return this.db.prepare(`
      SELECT * FROM sessions ORDER BY created_at DESC
    `).all();
  }

  createDevice(sessionId, device) {
    const stmt = this.db.prepare(`
      INSERT INTO devices (session_id, name, type, manufacturer, model, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      sessionId,
      device.name,
      device.type || 'microphone',
      device.manufacturer,
      device.model,
      device.notes
    );
    return result.lastInsertRowid;
  }

  createFrequency(sessionId, deviceId, freq) {
    const stmt = this.db.prepare(`
      INSERT INTO frequencies (session_id, device_id, frequency, band, channel, tx_power, antenna_gain, is_backup, backup_for_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      sessionId,
      deviceId,
      freq.frequency,
      freq.band || this._detectBand(freq.frequency),
      freq.channel,
      freq.tx_power,
      freq.antenna_gain,
      freq.is_backup ? 1 : 0,
      freq.backup_for_id,
      freq.notes
    );
    return result.lastInsertRowid;
  }

  getFrequencies(sessionId) {
    return this.db.prepare(`
      SELECT f.*, d.name as device_name, d.type as device_type
      FROM frequencies f
      JOIN devices d ON f.device_id = d.id
      WHERE f.session_id = ?
      ORDER BY f.frequency ASC
    `).all(sessionId);
  }

  getDevices(sessionId) {
    return this.db.prepare(`
      SELECT * FROM devices WHERE session_id = ?
    `).all(sessionId);
  }

  createForbiddenBand(sessionId, band) {
    const stmt = this.db.prepare(`
      INSERT INTO forbidden_bands (session_id, name, freq_start, freq_end, reason, priority)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      sessionId,
      band.name,
      band.freq_start,
      band.freq_end,
      band.reason,
      band.priority || 1
    );
    return result.lastInsertRowid;
  }

  getForbiddenBands(sessionId) {
    return this.db.prepare(`
      SELECT * FROM forbidden_bands WHERE session_id = ?
      ORDER BY priority DESC, freq_start ASC
    `).all(sessionId);
  }

  createConflict(sessionId, conflict) {
    const stmt = this.db.prepare(`
      INSERT INTO conflicts (session_id, type, severity, frequency_1_id, frequency_2_id, details, intermod_value, intermod_orders, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);
    const result = stmt.run(
      sessionId,
      conflict.type,
      conflict.severity,
      conflict.frequency_1_id,
      conflict.frequency_2_id,
      conflict.details,
      conflict.intermod_value,
      conflict.intermod_orders
    );
    return result.lastInsertRowid;
  }

  getConflicts(sessionId) {
    return this.db.prepare(`
      SELECT c.*, 
             f1.frequency as freq1, d1.name as device1_name,
             f2.frequency as freq2, d2.name as device2_name,
             f3.frequency as freq_im, d3.name as device_im_name
      FROM conflicts c
      LEFT JOIN frequencies f1 ON c.frequency_1_id = f1.id
      LEFT JOIN devices d1 ON f1.device_id = d1.id
      LEFT JOIN frequencies f2 ON c.frequency_2_id = f2.id
      LEFT JOIN devices d2 ON f2.device_id = d2.id
      WHERE c.session_id = ?
      ORDER BY 
        CASE c.severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        c.created_at ASC
    `).all(sessionId);
  }

  updateConflictStatus(conflictId, status) {
    const stmt = this.db.prepare(`
      UPDATE conflicts SET status = ? WHERE id = ?
    `);
    return stmt.run(status, conflictId);
  }

  createResolutionNote(resolution) {
    const stmt = this.db.prepare(`
      INSERT INTO resolution_notes (conflict_id, frequency_id, action, suggested_frequency, notes, resolved_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const result = stmt.run(
      resolution.conflict_id,
      resolution.frequency_id,
      resolution.action,
      resolution.suggested_frequency,
      resolution.notes
    );

    if (resolution.action === 'resolved' || resolution.action === 'accepted') {
      this.updateConflictStatus(resolution.conflict_id, 'resolved');
    }

    return result.lastInsertRowid;
  }

  getResolutionNotes(conflictId) {
    return this.db.prepare(`
      SELECT rn.*, f.frequency
      FROM resolution_notes rn
      LEFT JOIN frequencies f ON rn.frequency_id = f.id
      WHERE rn.conflict_id = ?
      ORDER BY rn.created_at ASC
    `).all(conflictId);
  }

  clearSessionData(sessionId) {
    this.db.prepare('DELETE FROM resolution_notes WHERE conflict_id IN (SELECT id FROM conflicts WHERE session_id = ?)').run(sessionId);
    this.db.prepare('DELETE FROM conflicts WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM forbidden_bands WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM frequencies WHERE session_id = ?').run(sessionId);
    this.db.prepare('DELETE FROM devices WHERE session_id = ?').run(sessionId);
  }

  deleteSession(sessionId) {
    this.clearSessionData(sessionId);
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  }

  _detectBand(frequency) {
    const bands = config.frequency.bands;
    if (frequency >= bands.uhfLow.min && frequency < bands.uhfLow.max) {
      return 'uhfLow';
    } else if (frequency >= bands.uhfMid.min && frequency < bands.uhfMid.max) {
      return 'uhfMid';
    } else if (frequency >= bands.uhfHigh.min && frequency <= bands.uhfHigh.max) {
      return 'uhfHigh';
    }
    return 'unknown';
  }

  close() {
    this.db.close();
  }
}

module.exports = RFCheckerModel;
