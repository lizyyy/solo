const crypto = require('crypto');
const config = require('../config');
const storage = require('./storage');
const webauthn = require('./webauthn');

const AUTH_STATES = {
  INITIAL: 'initial',
  REGISTRATION_STARTED: 'registration_started',
  REGISTRATION_CHALLENGE_ISSUED: 'registration_challenge_issued',
  REGISTRATION_COMPLETED: 'registration_completed',
  AUTHENTICATION_STARTED: 'authentication_started',
  AUTHENTICATION_CHALLENGE_ISSUED: 'authentication_challenge_issued',
  AUTHENTICATION_COMPLETED: 'authentication_completed',
  DEVICE_REVOKED: 'device_revoked',
  BACKUP_CODE_USED: 'backup_code_used',
  ERROR: 'error'
};

class StateMachine {
  constructor() {
    this.audit = (action, data) => {
      return storage.createAuditLog({
        action,
        userId: data.userId || null,
        username: data.username || null,
        credentialId: data.credentialId || null,
        details: data.details || {},
        success: data.success !== false
      });
    };
  }

  generateBackupCodes() {
    const codes = [];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    
    for (let i = 0; i < config.backupCodeCount; i++) {
      let code = '';
      for (let j = 0; j < config.backupCodeLength; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      codes.push(code);
    }
    
    return codes;
  }

  async startUserRegistration(username, displayName, email) {
    let user = storage.getUserByUsername(username);
    
    if (user) {
      this.audit('REGISTRATION_START_FAILED', {
        username,
        details: { reason: '用户已存在' },
        success: false
      });
      throw new Error('用户名已存在');
    }

    user = storage.createUser({
      username,
      displayName: displayName || username,
      email: email || null,
      state: AUTH_STATES.INITIAL
    });

    this.audit('REGISTRATION_STARTED', {
      userId: user.id,
      username: user.username,
      details: { displayName, email }
    });

    return user;
  }

  async startCredentialRegistration(userId, deviceInfo = {}, useSimulation = true) {
    const user = storage.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const existingCredentials = storage.getCredentialsByUserId(userId);
    let registrationData;

    if (useSimulation) {
      registrationData = webauthn.simulateRegistration(user, deviceInfo);
    } else {
      const options = await webauthn.generateRegistrationOptions(user, existingCredentials);
      registrationData = {
        options,
        challenge: options.challenge
      };
    }

    storage.createChallenge(userId, 'registration', {
      challenge: registrationData.challenge,
      options: registrationData.options,
      useSimulation,
      deviceInfo
    });

    storage.updateUser(userId, {
      state: AUTH_STATES.REGISTRATION_CHALLENGE_ISSUED
    });

    this.audit('REGISTRATION_CHALLENGE_ISSUED', {
      userId: user.id,
      username: user.username,
      details: { useSimulation, deviceInfo }
    });

    return registrationData;
  }

  async completeCredentialRegistration(userId, response, useSimulation = true) {
    const user = storage.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const challenge = storage.getChallengeByUserId(userId, 'registration');
    if (!challenge) {
      throw new Error('未找到有效的注册挑战');
    }

    let credentialData;

    if (useSimulation) {
      const existingCredentials = storage.getCredentialsByUserId(userId);
      const simulation = webauthn.simulateRegistration(user, challenge.deviceInfo || {});
      credentialData = {
        verified: true,
        credential: simulation.simulatedCredential
      };
    } else {
      credentialData = await webauthn.verifyRegistrationResponse(
        user,
        response,
        challenge.challenge
      );
    }

    if (!credentialData.verified) {
      this.audit('REGISTRATION_COMPLETED_FAILED', {
        userId: user.id,
        username: user.username,
        details: { reason: '验证失败' },
        success: false
      });
      throw new Error('凭证验证失败');
    }

    const credential = storage.createCredential({
      userId: user.id,
      ...credentialData.credential,
      registeredAt: new Date().toISOString()
    });

    storage.deleteChallenge(challenge.id);

    storage.updateUser(userId, {
      state: AUTH_STATES.REGISTRATION_COMPLETED,
      hasCredentials: true
    });

    const backupCodes = this.generateBackupCodes();
    storage.createBackupCodes(userId, backupCodes);

    this.audit('REGISTRATION_COMPLETED', {
      userId: user.id,
      username: user.username,
      credentialId: credential.id,
      details: {
        credentialID: credential.credentialID.substring(0, 20) + '...',
        deviceName: credential.deviceName,
        backupCodesGenerated: backupCodes.length
      }
    });

    return {
      success: true,
      credential,
      backupCodes
    };
  }

  async startAuthentication(username, useSimulation = true) {
    const user = storage.getUserByUsername(username);
    if (!user) {
      this.audit('AUTHENTICATION_START_FAILED', {
        username,
        details: { reason: '用户不存在' },
        success: false
      });
      throw new Error('用户不存在');
    }

    const credentials = storage.getCredentialsByUserId(user.id);
    if (credentials.length === 0) {
      this.audit('AUTHENTICATION_START_FAILED', {
        userId: user.id,
        username: user.username,
        details: { reason: '无可用凭证' },
        success: false
      });
      throw new Error('该用户没有可用的登录凭证');
    }

    let authData;

    if (useSimulation) {
      authData = webauthn.simulateAuthentication(credentials[0]);
    } else {
      const options = await webauthn.generateAuthenticationOptions(credentials);
      authData = {
        options,
        challenge: options.challenge
      };
    }

    storage.createChallenge(user.id, 'authentication', {
      challenge: authData.challenge,
      options: authData.options,
      useSimulation,
      credentialIds: credentials.map(c => c.id)
    });

    storage.updateUser(user.id, {
      state: AUTH_STATES.AUTHENTICATION_CHALLENGE_ISSUED
    });

    this.audit('AUTHENTICATION_CHALLENGE_ISSUED', {
      userId: user.id,
      username: user.username,
      details: { useSimulation, credentialCount: credentials.length }
    });

    return {
      user: { id: user.id, username: user.username, displayName: user.displayName },
      ...authData,
      availableCredentials: credentials.map(c => ({
        id: c.id,
        deviceName: c.deviceName || '未知设备',
        deviceType: c.deviceType,
        lastUsedAt: c.lastUsedAt
      }))
    };
  }

  async completeAuthentication(userId, response, credentialId, useSimulation = true) {
    const user = storage.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const challenge = storage.getChallengeByUserId(userId, 'authentication');
    if (!challenge) {
      throw new Error('未找到有效的认证挑战');
    }

    const credential = storage.getCredentialById(credentialId);
    if (!credential || !credential.isActive) {
      this.audit('AUTHENTICATION_COMPLETED_FAILED', {
        userId: user.id,
        username: user.username,
        credentialId,
        details: { reason: '凭证无效或已撤销' },
        success: false
      });
      throw new Error('凭证无效或已被撤销');
    }

    let verification;

    if (useSimulation) {
      const simulation = webauthn.simulateAuthentication(credential);
      verification = {
        verified: true,
        newCounter: simulation.newCounter
      };
    } else {
      verification = await webauthn.verifyAuthenticationResponse(
        credential,
        response,
        challenge.challenge
      );
    }

    if (!verification.verified) {
      this.audit('AUTHENTICATION_COMPLETED_FAILED', {
        userId: user.id,
        username: user.username,
        credentialId: credential.id,
        details: { reason: '验证失败' },
        success: false
      });
      throw new Error('认证验证失败');
    }

    storage.updateCredential(credential.id, {
      counter: verification.newCounter,
      lastUsedAt: new Date().toISOString()
    });

    storage.deleteChallenge(challenge.id);

    storage.updateUser(userId, {
      state: AUTH_STATES.AUTHENTICATION_COMPLETED,
      lastLoginAt: new Date().toISOString()
    });

    this.audit('AUTHENTICATION_COMPLETED', {
      userId: user.id,
      username: user.username,
      credentialId: credential.id,
      details: {
        credentialID: credential.credentialID.substring(0, 20) + '...',
        deviceName: credential.deviceName,
        newCounter: verification.newCounter
      }
    });

    return {
      success: true,
      user: { id: user.id, username: user.username, displayName: user.displayName },
      credential: {
        id: credential.id,
        deviceName: credential.deviceName,
        deviceType: credential.deviceType
      }
    };
  }

  async authenticateWithBackupCode(userId, code) {
    const user = storage.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const usedCode = storage.useBackupCode(userId, code);
    
    if (!usedCode) {
      this.audit('BACKUP_CODE_AUTH_FAILED', {
        userId: user.id,
        username: user.username,
        details: { reason: '备用码无效或已使用', code: code.substring(0, 4) + '...' },
        success: false
      });
      throw new Error('备用码无效或已被使用');
    }

    storage.updateUser(userId, {
      state: AUTH_STATES.BACKUP_CODE_USED,
      lastLoginAt: new Date().toISOString()
    });

    this.audit('BACKUP_CODE_USED', {
      userId: user.id,
      username: user.username,
      details: { codeId: usedCode.id }
    });

    const remainingCodes = storage.getBackupCodesByUserId(userId);

    return {
      success: true,
      user: { id: user.id, username: user.username, displayName: user.displayName },
      remainingCodes: remainingCodes.length
    };
  }

  async revokeCredential(credentialId, reason = '') {
    const credential = storage.getCredentialById(credentialId);
    if (!credential) {
      throw new Error('凭证不存在');
    }

    const user = storage.getUserById(credential.userId);
    
    const revoked = storage.revokeCredential(credentialId, reason);
    
    if (!revoked) {
      throw new Error('撤销凭证失败');
    }

    if (user) {
      const activeCredentials = storage.getCredentialsByUserId(user.id);
      if (activeCredentials.length === 0) {
        storage.updateUser(user.id, {
          hasCredentials: false
        });
      }
    }

    this.audit('CREDENTIAL_REVOKED', {
      userId: credential.userId,
      username: user ? user.username : null,
      credentialId: credential.id,
      details: {
        credentialID: credential.credentialID.substring(0, 20) + '...',
        deviceName: credential.deviceName,
        reason
      }
    });

    return revoked;
  }

  async regenerateBackupCodes(userId) {
    const user = storage.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    storage.invalidateUserBackupCodes(userId);

    const newCodes = this.generateBackupCodes();
    storage.createBackupCodes(userId, newCodes);

    this.audit('BACKUP_CODES_REGENERATED', {
      userId: user.id,
      username: user.username,
      details: { count: newCodes.length }
    });

    return newCodes;
  }

  getAuditLogs(filters = {}) {
    let logs = storage.getAuditLogs();
    
    if (filters.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }
    
    if (filters.action) {
      logs = logs.filter(l => l.action === filters.action);
    }
    
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      logs = logs.filter(l => new Date(l.timestamp) >= start);
    }
    
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      logs = logs.filter(l => new Date(l.timestamp) <= end);
    }

    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getStatistics() {
    const users = storage.getUsers();
    const credentials = storage.getCredentials();
    const auditLogs = storage.getAuditLogs();
    
    const activeCredentials = credentials.filter(c => c.isActive);
    const revokedCredentials = credentials.filter(c => !c.isActive);
    const usersWithCredentials = users.filter(u => u.hasCredentials);
    
    const actions = {};
    auditLogs.forEach(log => {
      actions[log.action] = (actions[log.action] || 0) + 1;
    });

    return {
      users: {
        total: users.length,
        withCredentials: usersWithCredentials.length,
        withoutCredentials: users.length - usersWithCredentials.length
      },
      credentials: {
        total: credentials.length,
        active: activeCredentials.length,
        revoked: revokedCredentials.length
      },
      audit: {
        total: auditLogs.length,
        actions
      }
    };
  }
}

module.exports = new StateMachine();
