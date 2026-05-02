const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const dbPath = path.resolve(__dirname, '..', config.database.path);
const dbDir = path.dirname(dbPath);

let db = {
  users: [],
  credentials: [],
  challenges: [],
  auditLogs: []
};

function ensureDir() {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function loadDatabase() {
  ensureDir();
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      db = JSON.parse(data);
    } catch (error) {
      console.error('加载数据库失败，使用空数据库:', error.message);
      db = { users: [], credentials: [], challenges: [], auditLogs: [] };
    }
  }
}

function saveDatabase() {
  ensureDir();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

loadDatabase();

const Database = {
  users: {
    insert(user) {
      const newUser = {
        id: user.id || uuidv4(),
        username: user.username,
        display_name: user.displayName || user.display_name,
        user_handle: user.userHandle || user.user_handle,
        created_at: user.createdAt || user.created_at || Math.floor(Date.now() / 1000),
        updated_at: user.updatedAt || user.updated_at || Math.floor(Date.now() / 1000)
      };
      db.users.push(newUser);
      saveDatabase();
      return { changes: 1 };
    },

    getById(id) {
      return db.users.find(u => u.id === id);
    },

    getByUsername(username) {
      return db.users.find(u => u.username === username);
    },

    getByUserHandle(userHandle) {
      const buf = Buffer.isBuffer(userHandle) ? userHandle : Buffer.from(userHandle);
      return db.users.find(u => {
        const handle = Buffer.isBuffer(u.user_handle) ? u.user_handle : Buffer.from(u.user_handle);
        return handle.equals(buf);
      });
    },

    getAll() {
      return [...db.users];
    },

    update(id, fields) {
      const index = db.users.findIndex(u => u.id === id);
      if (index === -1) return { changes: 0 };
      
      if (fields.display_name !== undefined) {
        db.users[index].display_name = fields.display_name;
      }
      db.users[index].updated_at = Math.floor(Date.now() / 1000);
      saveDatabase();
      return { changes: 1 };
    },

    delete(id) {
      const index = db.users.findIndex(u => u.id === id);
      if (index === -1) return { changes: 0 };
      db.users.splice(index, 1);
      saveDatabase();
      return { changes: 1 };
    }
  },

  credentials: {
    insert(cred) {
      const newCred = {
        id: cred.id || uuidv4(),
        credential_id: cred.credentialId || cred.credential_id,
        user_id: cred.userId || cred.user_id,
        public_key: cred.publicKey || cred.public_key,
        algorithm: cred.algorithm,
        sign_count: cred.signCount || cred.sign_count || 0,
        rp_id: cred.rpId || cred.rp_id,
        origin: cred.origin,
        transports: cred.transports || [],
        device_remark: cred.deviceRemark || cred.device_remark,
        is_revoked: cred.isRevoked || cred.is_revoked || 0,
        revoked_at: cred.revokedAt || cred.revoked_at || null,
        created_at: cred.createdAt || cred.created_at || Math.floor(Date.now() / 1000),
        updated_at: cred.updatedAt || cred.updated_at || Math.floor(Date.now() / 1000)
      };
      db.credentials.push(newCred);
      saveDatabase();
      return { changes: 1 };
    },

    getById(id) {
      return db.credentials.find(c => c.id === id);
    },

    getByCredentialId(credentialId) {
      const buf = Buffer.isBuffer(credentialId) ? credentialId : Buffer.from(credentialId);
      return db.credentials.find(c => {
        const credId = Buffer.isBuffer(c.credential_id) ? c.credential_id : Buffer.from(c.credential_id);
        return credId.equals(buf);
      });
    },

    getByUserId(userId) {
      return db.credentials.filter(c => c.user_id === userId);
    },

    getAll() {
      return [...db.credentials];
    },

    updateSignCount(id, newSignCount) {
      const index = db.credentials.findIndex(c => c.id === id);
      if (index === -1) return { changes: 0 };
      db.credentials[index].sign_count = newSignCount;
      db.credentials[index].updated_at = Math.floor(Date.now() / 1000);
      saveDatabase();
      return { changes: 1 };
    },

    updateDeviceRemark(id, deviceRemark) {
      const index = db.credentials.findIndex(c => c.id === id);
      if (index === -1) return { changes: 0 };
      db.credentials[index].device_remark = deviceRemark;
      db.credentials[index].updated_at = Math.floor(Date.now() / 1000);
      saveDatabase();
      return { changes: 1 };
    },

    revoke(id) {
      const index = db.credentials.findIndex(c => c.id === id);
      if (index === -1) return { changes: 0 };
      db.credentials[index].is_revoked = 1;
      db.credentials[index].revoked_at = Math.floor(Date.now() / 1000);
      db.credentials[index].updated_at = Math.floor(Date.now() / 1000);
      saveDatabase();
      return { changes: 1 };
    },

    unrevoke(id) {
      const index = db.credentials.findIndex(c => c.id === id);
      if (index === -1) return { changes: 0 };
      db.credentials[index].is_revoked = 0;
      db.credentials[index].revoked_at = null;
      db.credentials[index].updated_at = Math.floor(Date.now() / 1000);
      saveDatabase();
      return { changes: 1 };
    },

    delete(id) {
      const index = db.credentials.findIndex(c => c.id === id);
      if (index === -1) return { changes: 0 };
      db.credentials.splice(index, 1);
      saveDatabase();
      return { changes: 1 };
    }
  },

  challenges: {
    insert(challenge) {
      const newChallenge = {
        id: challenge.id || uuidv4(),
        challenge: challenge.challenge,
        type: challenge.type,
        user_id: challenge.userId || challenge.user_id || null,
        used: challenge.used || 0,
        used_at: challenge.usedAt || challenge.used_at || null,
        expires_at: challenge.expiresAt || challenge.expires_at,
        created_at: challenge.createdAt || challenge.created_at || Math.floor(Date.now() / 1000)
      };
      db.challenges.push(newChallenge);
      saveDatabase();
      return { changes: 1 };
    },

    getByValue(challenge) {
      const buf = Buffer.isBuffer(challenge) ? challenge : Buffer.from(challenge);
      const now = Math.floor(Date.now() / 1000);
      
      db.challenges = db.challenges.filter(c => c.expires_at > now - 86400);
      saveDatabase();
      
      return db.challenges.find(c => {
        const chal = Buffer.isBuffer(c.challenge) ? c.challenge : Buffer.from(c.challenge);
        return chal.equals(buf) && c.used === 0 && c.expires_at > now;
      });
    },

    getById(id) {
      return db.challenges.find(c => c.id === id);
    },

    markAsUsed(id) {
      const index = db.challenges.findIndex(c => c.id === id);
      if (index === -1) return { changes: 0 };
      db.challenges[index].used = 1;
      db.challenges[index].used_at = Math.floor(Date.now() / 1000);
      saveDatabase();
      return { changes: 1 };
    },

    isUsed(challenge) {
      const buf = Buffer.isBuffer(challenge) ? challenge : Buffer.from(challenge);
      const found = db.challenges.find(c => {
        const chal = Buffer.isBuffer(c.challenge) ? c.challenge : Buffer.from(c.challenge);
        return chal.equals(buf);
      });
      return found ? found.used === 1 : false;
    },

    isExpired(challenge) {
      const buf = Buffer.isBuffer(challenge) ? challenge : Buffer.from(challenge);
      const now = Math.floor(Date.now() / 1000);
      const found = db.challenges.find(c => {
        const chal = Buffer.isBuffer(c.challenge) ? c.challenge : Buffer.from(c.challenge);
        return chal.equals(buf);
      });
      return found ? found.expires_at <= now : true;
    },

    cleanupExpired() {
      const now = Math.floor(Date.now() / 1000);
      const oldCount = db.challenges.length;
      db.challenges = db.challenges.filter(c => c.expires_at > now - 86400);
      if (db.challenges.length < oldCount) {
        saveDatabase();
      }
    }
  },

  auditLogs: {
    insert(log) {
      const newLog = {
        id: log.id || uuidv4(),
        action: log.action,
        user_id: log.userId || log.user_id || null,
        credential_id: log.credentialId || log.credential_id || null,
        success: log.success ? 1 : 0,
        error_code: log.errorCode || log.error_code || null,
        error_message: log.errorMessage || log.error_message || null,
        risk_flags: log.riskFlags || log.risk_flags || [],
        details: log.details || {},
        created_at: log.createdAt || log.created_at || Math.floor(Date.now() / 1000)
      };
      db.auditLogs.push(newLog);
      saveDatabase();
      return { changes: 1 };
    },

    getById(id) {
      return db.auditLogs.find(l => l.id === id);
    },

    getByUserId(userId, limit = 100) {
      return db.auditLogs
        .filter(l => l.user_id === userId)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit);
    },

    getByCredentialId(credentialId, limit = 100) {
      return db.auditLogs
        .filter(l => l.credential_id === credentialId)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit);
    },

    getAll(limit = 500) {
      return [...db.auditLogs]
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit);
    },

    getForExport() {
      return [...db.auditLogs].sort((a, b) => a.created_at - b.created_at);
    },

    clearOld(beforeTimestamp) {
      const oldCount = db.auditLogs.length;
      db.auditLogs = db.auditLogs.filter(l => l.created_at >= beforeTimestamp);
      if (db.auditLogs.length < oldCount) {
        saveDatabase();
      }
      return oldCount - db.auditLogs.length;
    }
  }
};

function prepare(sql) {
  return {
    run(...params) {
      if (sql.startsWith('INSERT INTO users')) {
        const [id, username, displayName, userHandle, createdAt, updatedAt] = params;
        return Database.users.insert({
          id, username, display_name: displayName, user_handle: userHandle,
          created_at: createdAt, updated_at: updatedAt
        });
      }
      if (sql.startsWith('INSERT INTO credentials')) {
        const [id, credentialId, userId, publicKey, algorithm, signCount, rpId, origin, transports, deviceRemark, isRevoked, createdAt, updatedAt] = params;
        return Database.credentials.insert({
          id, credential_id: credentialId, user_id: userId, public_key: publicKey,
          algorithm, sign_count: signCount, rp_id: rpId, origin, transports: JSON.parse(transports || '[]'),
          device_remark: deviceRemark, is_revoked: isRevoked,
          created_at: createdAt, updated_at: updatedAt
        });
      }
      if (sql.startsWith('INSERT INTO challenges')) {
        const [id, challenge, type, userId, used, expiresAt, createdAt] = params;
        return Database.challenges.insert({
          id, challenge, type, user_id: userId, used,
          expires_at: expiresAt, created_at: createdAt
        });
      }
      if (sql.startsWith('INSERT INTO audit_logs')) {
        const [id, action, userId, credentialId, success, errorCode, errorMessage, riskFlags, details, createdAt] = params;
        return Database.auditLogs.insert({
          id, action, user_id: userId, credential_id: credentialId,
          success: success === 1, error_code: errorCode, error_message: errorMessage,
          risk_flags: JSON.parse(riskFlags || '[]'), details: JSON.parse(details || '{}'),
          created_at: createdAt
        });
      }
      return { changes: 0 };
    },
    get(...params) {
      if (sql.includes('FROM users WHERE id = ?')) {
        return Database.users.getById(params[0]);
      }
      if (sql.includes('FROM users WHERE username = ?')) {
        return Database.users.getByUsername(params[0]);
      }
      if (sql.includes('FROM users WHERE user_handle = ?')) {
        return Database.users.getByUserHandle(params[0]);
      }
      if (sql.includes('FROM credentials WHERE id = ?')) {
        return Database.credentials.getById(params[0]);
      }
      if (sql.includes('FROM credentials WHERE credential_id = ?')) {
        return Database.credentials.getByCredentialId(params[0]);
      }
      if (sql.includes('FROM challenges WHERE id = ?')) {
        return Database.challenges.getById(params[0]);
      }
      if (sql.includes('FROM challenges WHERE challenge = ?') && sql.includes('used = 0')) {
        return Database.challenges.getByValue(params[0]);
      }
      if (sql.includes('SELECT used FROM challenges WHERE challenge = ?')) {
        const used = Database.challenges.isUsed(params[0]);
        return { used: used ? 1 : 0 };
      }
      if (sql.includes('SELECT expires_at FROM challenges WHERE challenge = ?')) {
        const row = db.challenges.find(c => {
          const buf = Buffer.isBuffer(params[0]) ? params[0] : Buffer.from(params[0]);
          const chal = Buffer.isBuffer(c.challenge) ? c.challenge : Buffer.from(c.challenge);
          return chal.equals(buf);
        });
        return row ? { expires_at: row.expires_at } : null;
      }
      if (sql.includes('FROM audit_logs WHERE id = ?')) {
        return Database.auditLogs.getById(params[0]);
      }
      return null;
    },
    all(...params) {
      if (sql.includes('FROM users ORDER BY')) {
        return Database.users.getAll();
      }
      if (sql.includes('FROM credentials WHERE user_id = ?')) {
        return Database.credentials.getByUserId(params[0]);
      }
      if (sql.includes('FROM credentials ORDER BY')) {
        return Database.credentials.getAll();
      }
      if (sql.includes('FROM audit_logs WHERE user_id = ?')) {
        return Database.auditLogs.getByUserId(params[0], params[1] || 100);
      }
      if (sql.includes('FROM audit_logs ORDER BY') && sql.includes('LIMIT ?')) {
        return Database.auditLogs.getAll(params[0] || 500);
      }
      return [];
    }
  };
}

function exec(sql) {
  if (sql.includes('UPDATE users SET')) {
    if (sql.includes('display_name')) {
      const match = sql.match(/WHERE id = \?/);
      if (match) return { changes: 0 };
    }
  }
  if (sql.includes('UPDATE challenges SET used = 1')) {
    const match = sql.match(/WHERE id = \?/);
    if (match) return { changes: 0 };
  }
  if (sql.includes('DELETE FROM')) {
    return { changes: 0 };
  }
  return { changes: 0 };
}

module.exports = {
  prepare,
  exec,
  Database
};
