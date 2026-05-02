const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

class Storage {
  constructor() {
    this.dataDir = path.resolve(config.dataDir);
    this.ensureDataDir();
    
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.credentialsFile = path.join(this.dataDir, 'credentials.json');
    this.challengesFile = path.join(this.dataDir, 'challenges.json');
    this.auditFile = path.join(this.dataDir, 'audit.json');
    this.backupCodesFile = path.join(this.dataDir, 'backupCodes.json');
    
    this.initFiles();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  initFiles() {
    const files = [
      { file: this.usersFile, defaultData: [] },
      { file: this.credentialsFile, defaultData: [] },
      { file: this.challengesFile, defaultData: [] },
      { file: this.auditFile, defaultData: [] },
      { file: this.backupCodesFile, defaultData: [] }
    ];

    files.forEach(({ file, defaultData }) => {
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
      }
    });
  }

  readJson(file) {
    try {
      const data = fs.readFileSync(file, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  writeJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }

  // Users
  getUsers() {
    return this.readJson(this.usersFile);
  }

  getUserById(userId) {
    const users = this.getUsers();
    return users.find(u => u.id === userId);
  }

  getUserByUsername(username) {
    const users = this.getUsers();
    return users.find(u => u.username === username);
  }

  createUser(userData) {
    const users = this.getUsers();
    const user = {
      id: uuidv4(),
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    users.push(user);
    this.writeJson(this.usersFile, users);
    return user;
  }

  updateUser(userId, updates) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = {
        ...users[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.writeJson(this.usersFile, users);
      return users[index];
    }
    return null;
  }

  deleteUser(userId) {
    const users = this.getUsers();
    const filtered = users.filter(u => u.id !== userId);
    this.writeJson(this.usersFile, filtered);
    return filtered.length !== users.length;
  }

  // Credentials
  getCredentials() {
    return this.readJson(this.credentialsFile);
  }

  getCredentialById(credentialId) {
    const credentials = this.getCredentials();
    return credentials.find(c => c.id === credentialId);
  }

  getCredentialsByUserId(userId) {
    const credentials = this.getCredentials();
    return credentials.filter(c => c.userId === userId && c.isActive);
  }

  createCredential(credentialData) {
    const credentials = this.getCredentials();
    const credential = {
      id: uuidv4(),
      ...credentialData,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    credentials.push(credential);
    this.writeJson(this.credentialsFile, credentials);
    return credential;
  }

  updateCredential(credentialId, updates) {
    const credentials = this.getCredentials();
    const index = credentials.findIndex(c => c.id === credentialId);
    if (index !== -1) {
      credentials[index] = {
        ...credentials[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.writeJson(this.credentialsFile, credentials);
      return credentials[index];
    }
    return null;
  }

  revokeCredential(credentialId, reason = '') {
    return this.updateCredential(credentialId, {
      isActive: false,
      revokedAt: new Date().toISOString(),
      revocationReason: reason
    });
  }

  // Challenges
  getChallenges() {
    return this.readJson(this.challengesFile);
  }

  getActiveChallenges() {
    const now = Date.now();
    const challenges = this.getChallenges();
    return challenges.filter(c => c.expiresAt > now);
  }

  getChallengeByUserId(userId, type) {
    const challenges = this.getActiveChallenges();
    return challenges.find(c => c.userId === userId && c.type === type);
  }

  createChallenge(userId, type, challengeData) {
    const challenges = this.getChallenges();
    const challenge = {
      id: uuidv4(),
      userId,
      type,
      ...challengeData,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + config.challengeTimeout
    };
    challenges.push(challenge);
    this.writeJson(this.challengesFile, challenges);
    return challenge;
  }

  deleteChallenge(challengeId) {
    const challenges = this.getChallenges();
    const filtered = challenges.filter(c => c.id !== challengeId);
    this.writeJson(this.challengesFile, filtered);
  }

  cleanupExpiredChallenges() {
    const now = Date.now();
    const challenges = this.getChallenges();
    const active = challenges.filter(c => c.expiresAt > now);
    this.writeJson(this.challengesFile, active);
  }

  // Audit Logs
  getAuditLogs() {
    return this.readJson(this.auditFile);
  }

  getAuditLogsByUserId(userId) {
    const logs = this.getAuditLogs();
    return logs.filter(l => l.userId === userId);
  }

  createAuditLog(logData) {
    const logs = this.getAuditLogs();
    const log = {
      id: uuidv4(),
      ...logData,
      timestamp: new Date().toISOString()
    };
    logs.push(log);
    this.writeJson(this.auditFile, logs);
    return log;
  }

  // Backup Codes
  getBackupCodes() {
    return this.readJson(this.backupCodesFile);
  }

  getBackupCodesByUserId(userId) {
    const codes = this.getBackupCodes();
    return codes.filter(c => c.userId === userId && !c.used);
  }

  createBackupCodes(userId, codes) {
    const backupCodes = this.getBackupCodes();
    const newCodes = codes.map(code => ({
      id: uuidv4(),
      userId,
      code,
      used: false,
      createdAt: new Date().toISOString()
    }));
    const allCodes = [...backupCodes, ...newCodes];
    this.writeJson(this.backupCodesFile, allCodes);
    return newCodes;
  }

  useBackupCode(userId, code) {
    const backupCodes = this.getBackupCodes();
    const index = backupCodes.findIndex(c => 
      c.userId === userId && c.code === code && !c.used
    );
    if (index !== -1) {
      backupCodes[index].used = true;
      backupCodes[index].usedAt = new Date().toISOString();
      this.writeJson(this.backupCodesFile, backupCodes);
      return backupCodes[index];
    }
    return null;
  }

  invalidateUserBackupCodes(userId) {
    const backupCodes = this.getBackupCodes();
    backupCodes.forEach(code => {
      if (code.userId === userId && !code.used) {
        code.used = true;
        code.usedAt = new Date().toISOString();
      }
    });
    this.writeJson(this.backupCodesFile, backupCodes);
  }

  // Reset all data (for testing)
  resetAll() {
    this.writeJson(this.usersFile, []);
    this.writeJson(this.credentialsFile, []);
    this.writeJson(this.challengesFile, []);
    this.writeJson(this.auditFile, []);
    this.writeJson(this.backupCodesFile, []);
  }
}

module.exports = new Storage();
