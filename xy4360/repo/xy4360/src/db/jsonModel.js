const fs = require('fs');
const path = require('path');
const config = require('../config');

class RFCheckerModel {
  constructor(dbPath = config.db.path) {
    this.dbPath = dbPath;
    this.dataDir = path.dirname(dbPath);
    
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this._loadData();
  }

  _loadData() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const content = fs.readFileSync(this.dbPath, 'utf-8');
        this.data = JSON.parse(content);
      } catch (error) {
        this._initEmptyData();
      }
    } else {
      this._initEmptyData();
    }
  }

  _initEmptyData() {
    this.data = {
      sessions: [],
      devices: [],
      frequencies: [],
      forbiddenBands: [],
      conflicts: [],
      resolutionNotes: []
    };
    this._saveData();
  }

  _saveData() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  createSession(name, description = '') {
    const session = {
      id: Date.now(),
      name: name,
      description: description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    this.data.sessions.push(session);
    this._saveData();
    
    return session.id;
  }

  getSession(sessionId) {
    return this.data.sessions.find(s => s.id === parseInt(sessionId));
  }

  getAllSessions() {
    return [...this.data.sessions].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  }

  createDevice(sessionId, device) {
    const newDevice = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      session_id: parseInt(sessionId),
      name: device.name,
      type: device.type || 'microphone',
      manufacturer: device.manufacturer,
      model: device.model,
      notes: device.notes,
      created_at: new Date().toISOString()
    };
    
    this.data.devices.push(newDevice);
    this._saveData();
    
    return newDevice.id;
  }

  getDevices(sessionId) {
    return this.data.devices.filter(d => d.session_id === parseInt(sessionId));
  }

  createFrequency(sessionId, deviceId, freq) {
    const newFreq = {
      id: Date.now() + Math.floor(Math.random() * 10000),
      session_id: parseInt(sessionId),
      device_id: parseInt(deviceId),
      frequency: parseFloat(freq.frequency),
      band: freq.band || this._detectBand(freq.frequency),
      channel: freq.channel,
      tx_power: freq.tx_power,
      antenna_gain: freq.antenna_gain,
      is_backup: freq.is_backup ? 1 : 0,
      backup_for_id: freq.backup_for_id,
      notes: freq.notes,
      created_at: new Date().toISOString()
    };
    
    this.data.frequencies.push(newFreq);
    this._saveData();
    
    return newFreq.id;
  }

  getFrequencies(sessionId) {
    const sid = parseInt(sessionId);
    const freqs = this.data.frequencies.filter(f => f.session_id === sid);
    const devices = this.data.devices;
    
    return freqs.map(freq => {
      const device = devices.find(d => d.id === freq.device_id);
      return {
        ...freq,
        device_name: device ? device.name : '未知设备',
        device_type: device ? device.type : 'unknown'
      };
    }).sort((a, b) => a.frequency - b.frequency);
  }

  createForbiddenBand(sessionId, band) {
    const newBand = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      session_id: parseInt(sessionId),
      name: band.name || '未命名频段',
      freq_start: parseFloat(band.freq_start),
      freq_end: parseFloat(band.freq_end),
      reason: band.reason,
      priority: band.priority || 1,
      created_at: new Date().toISOString()
    };
    
    this.data.forbiddenBands.push(newBand);
    this._saveData();
    
    return newBand.id;
  }

  getForbiddenBands(sessionId) {
    return this.data.forbiddenBands
      .filter(b => b.session_id === parseInt(sessionId))
      .sort((a, b) => b.priority - a.priority || a.freq_start - b.freq_start);
  }

  createConflict(sessionId, conflict) {
    const newConflict = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      session_id: parseInt(sessionId),
      type: conflict.type,
      severity: conflict.severity,
      frequency_1_id: conflict.frequency_1_id,
      frequency_2_id: conflict.frequency_2_id,
      details: conflict.details,
      intermod_value: conflict.intermod_value,
      intermod_orders: conflict.intermod_orders,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    this.data.conflicts.push(newConflict);
    this._saveData();
    
    return newConflict.id;
  }

  getConflicts(sessionId) {
    const sid = parseInt(sessionId);
    const conflicts = this.data.conflicts.filter(c => c.session_id === sid);
    const freqs = this.data.frequencies;
    const devices = this.data.devices;

    return conflicts.map(conflict => {
      const f1 = freqs.find(f => f.id === conflict.frequency_1_id);
      const f2 = freqs.find(f => f.id === conflict.frequency_2_id);
      const d1 = f1 ? devices.find(d => d.id === f1.device_id) : null;
      const d2 = f2 ? devices.find(d => d.id === f2.device_id) : null;

      return {
        ...conflict,
        freq1: f1 ? f1.frequency : null,
        device1_name: d1 ? d1.name : null,
        freq2: f2 ? f2.frequency : null,
        device2_name: d2 ? d2.name : null
      };
    }).sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const orderA = severityOrder[a.severity] || 99;
      const orderB = severityOrder[b.severity] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  updateConflictStatus(conflictId, status) {
    const conflict = this.data.conflicts.find(c => c.id === parseInt(conflictId));
    if (conflict) {
      conflict.status = status;
      conflict.updated_at = new Date().toISOString();
      this._saveData();
    }
  }

  createResolutionNote(resolution) {
    const note = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      conflict_id: parseInt(resolution.conflict_id),
      frequency_id: resolution.frequency_id,
      action: resolution.action,
      suggested_frequency: resolution.suggested_frequency,
      notes: resolution.notes,
      resolved_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    this.data.resolutionNotes.push(note);
    
    if (resolution.action === 'resolved' || resolution.action === 'accepted') {
      this.updateConflictStatus(resolution.conflict_id, 'resolved');
    }
    
    this._saveData();
    
    return note.id;
  }

  getResolutionNotes(conflictId) {
    const cid = parseInt(conflictId);
    const notes = this.data.resolutionNotes.filter(n => n.conflict_id === cid);
    const freqs = this.data.frequencies;

    return notes.map(note => {
      const freq = freqs.find(f => f.id === note.frequency_id);
      return {
        ...note,
        frequency: freq ? freq.frequency : null
      };
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  clearSessionData(sessionId) {
    const sid = parseInt(sessionId);
    
    const conflictIds = this.data.conflicts.filter(c => c.session_id === sid).map(c => c.id);
    
    this.data.resolutionNotes = this.data.resolutionNotes.filter(n => !conflictIds.includes(n.conflict_id));
    this.data.conflicts = this.data.conflicts.filter(c => c.session_id !== sid);
    this.data.forbiddenBands = this.data.forbiddenBands.filter(b => b.session_id !== sid);
    this.data.frequencies = this.data.frequencies.filter(f => f.session_id !== sid);
    this.data.devices = this.data.devices.filter(d => d.session_id !== sid);
    
    this._saveData();
  }

  deleteSession(sessionId) {
    this.clearSessionData(sessionId);
    this.data.sessions = this.data.sessions.filter(s => s.id !== parseInt(sessionId));
    this._saveData();
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
  }
}

module.exports = RFCheckerModel;
