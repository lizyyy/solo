const express = require('express');
const router = express.Router();

const config = require('../config');
const userService = require('../services/userService');
const credentialService = require('../services/credentialService');
const { ChallengeService, CHALLENGE_TYPES } = require('../services/challengeService');
const { WebAuthnService, WebAuthnValidationError } = require('../services/webauthnService');
const { AuditService, ACTIONS, RISK_FLAGS } = require('../services/auditService');
const simulatorService = require('../services/simulatorService');
const exportService = require('../services/exportService');

router.get('/users', (req, res) => {
  try {
    const users = userService.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users/:id', (req, res) => {
  try {
    const user = userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/users', (req, res) => {
  try {
    const { username, displayName } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, error: '用户名不能为空' });
    }

    const user = userService.createUser(username, displayName);
    
    AuditService.log({
      action: ACTIONS.USER_CREATED,
      userId: user.id,
      success: true,
      details: { username, displayName }
    });

    res.json({ success: true, user });
  } catch (error) {
    if (error.message === 'USER_EXISTS') {
      AuditService.log({
        action: ACTIONS.USER_CREATED,
        success: false,
        errorCode: 'USER_EXISTS',
        errorMessage: '用户名已存在',
        details: { username: req.body.username }
      });
      return res.status(400).json({ success: false, error: '用户名已存在' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/users/:id', (req, res) => {
  try {
    const user = userService.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const deleted = userService.deleteUser(req.params.id);
    
    AuditService.log({
      action: ACTIONS.USER_DELETED,
      userId: req.params.id,
      success: deleted,
      details: { username: user.username }
    });

    res.json({ success: deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/credentials', (req, res) => {
  try {
    const credentials = credentialService.getAllCredentials();
    res.json({ success: true, credentials });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users/:userId/credentials', (req, res) => {
  try {
    const credentials = credentialService.getCredentialsByUserId(req.params.userId);
    res.json({ success: true, credentials });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/credentials/:id/revoke', (req, res) => {
  try {
    const credential = credentialService.getCredentialById(req.params.id);
    if (!credential) {
      return res.status(404).json({ success: false, error: '凭据不存在' });
    }

    const revoked = credentialService.revokeCredential(req.params.id);
    
    AuditService.log({
      action: ACTIONS.CREDENTIAL_REVOKED,
      userId: credential.userId,
      credentialId: credential.id,
      success: revoked,
      details: { deviceRemark: credential.deviceRemark }
    });

    res.json({ success: revoked });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/credentials/:id/unrevoke', (req, res) => {
  try {
    const credential = credentialService.getCredentialById(req.params.id);
    if (!credential) {
      return res.status(404).json({ success: false, error: '凭据不存在' });
    }

    const unrevoked = credentialService.unrevokeCredential(req.params.id);
    
    AuditService.log({
      action: ACTIONS.CREDENTIAL_UNREVOKED,
      userId: credential.userId,
      credentialId: credential.id,
      success: unrevoked,
      details: { deviceRemark: credential.deviceRemark }
    });

    res.json({ success: unrevoked });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/credentials/:id/remark', (req, res) => {
  try {
    const { deviceRemark } = req.body;
    const credential = credentialService.getCredentialById(req.params.id);
    
    if (!credential) {
      return res.status(404).json({ success: false, error: '凭据不存在' });
    }

    const updated = credentialService.updateDeviceRemark(req.params.id, deviceRemark);
    const updatedCredential = credentialService.getCredentialById(req.params.id);
    
    res.json({ success: updated, credential: updatedCredential });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/registration/start', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少 userId' });
    }

    const user = userService.getUserById(userId);
    if (!user) {
      AuditService.log({
        action: ACTIONS.REGISTRATION_FAILED,
        userId,
        success: false,
        errorCode: 'USER_NOT_FOUND',
        errorMessage: '用户不存在',
        riskFlags: [RISK_FLAGS.USER_NOT_FOUND],
        details: { userId }
      });
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const existingCredentials = credentialService.getCredentialsByUserId(userId);
    const { options, challengeId } = WebAuthnService.generateRegistrationOptions(user, existingCredentials);

    res.json({
      success: true,
      options,
      challengeId,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/registration/complete', (req, res) => {
  try {
    const { response, userId, challenge, deviceRemark } = req.body;

    if (!response || !userId || !challenge) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段',
        errorCode: 'MISSING_FIELDS'
      });
    }

    const user = userService.getUserById(userId);
    if (!user) {
      AuditService.log({
        action: ACTIONS.REGISTRATION_FAILED,
        userId,
        success: false,
        errorCode: 'USER_NOT_FOUND',
        errorMessage: '用户不存在',
        riskFlags: [RISK_FLAGS.USER_NOT_FOUND],
        details: { userId }
      });
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const validationResult = WebAuthnService.validateRegistrationResponse(
      response,
      challenge,
      config.webauthn.origin,
      config.webauthn.rpId
    );

    const existingCredential = credentialService.getCredentialByCredentialId(validationResult.credentialId);
    if (existingCredential) {
      if (validationResult.challengeId) {
        ChallengeService.markAsUsed(validationResult.challengeId);
      }
      
      AuditService.log({
        action: ACTIONS.REGISTRATION_FAILED,
        userId,
        success: false,
        errorCode: 'CREDENTIAL_EXISTS',
        errorMessage: '凭据已存在',
        riskFlags: [RISK_FLAGS.CREDENTIAL_DUPLICATE],
        details: { credentialIdBase64: validationResult.credentialId.toString('base64url') }
      });
      
      return res.status(400).json({
        success: false,
        error: '凭据已存在',
        errorCode: 'CREDENTIAL_EXISTS',
        riskFlags: [RISK_FLAGS.CREDENTIAL_DUPLICATE]
      });
    }

    if (validationResult.challengeId) {
      ChallengeService.markAsUsed(validationResult.challengeId);
    }

    const credential = credentialService.createCredential({
      credentialId: validationResult.credentialId,
      userId,
      publicKey: validationResult.publicKey,
      algorithm: validationResult.algorithm,
      rpId: config.webauthn.rpId,
      origin: config.webauthn.origin,
      transports: validationResult.transports,
      deviceRemark: deviceRemark || '新注册设备',
      signCount: validationResult.signCount
    });

    AuditService.log({
      action: ACTIONS.REGISTRATION_COMPLETE,
      userId,
      credentialId: credential.id,
      success: true,
      details: {
        credentialIdBase64: credential.credentialIdBase64,
        deviceRemark: credential.deviceRemark,
        algorithm: credential.algorithm,
        initialSignCount: credential.signCount
      }
    });

    res.json({
      success: true,
      credential,
      validationDetails: {
        signCount: validationResult.signCount,
        riskFlags: validationResult.riskFlags
      }
    });

  } catch (error) {
    if (error instanceof WebAuthnValidationError) {
      AuditService.log({
        action: ACTIONS.REGISTRATION_FAILED,
        userId: req.body.userId,
        success: false,
        errorCode: error.code,
        errorMessage: error.message,
        riskFlags: error.riskFlags,
        details: {}
      });
      
      return res.status(400).json({
        success: false,
        error: error.message,
        errorCode: error.code,
        riskFlags: error.riskFlags
      });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/authentication/start', (req, res) => {
  try {
    const { userId } = req.body;
    
    const { options, challengeId } = WebAuthnService.generateAuthenticationOptions(userId);

    if (userId) {
      const user = userService.getUserById(userId);
      const credentials = credentialService.getCredentialsByUserId(userId);
      
      options.allowCredentials = credentials.filter(c => !c.isRevoked).map(cred => ({
        id: cred.credentialIdBase64,
        type: 'public-key',
        transports: cred.transports || []
      }));

      res.json({
        success: true,
        options,
        challengeId,
        user: user ? { id: user.id, username: user.username } : null
      });
    } else {
      res.json({ success: true, options, challengeId });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/authentication/complete', (req, res) => {
  try {
    const { response, challenge, userId } = req.body;

    if (!response || !challenge) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段',
        errorCode: 'MISSING_FIELDS'
      });
    }

    const credentialIdBuffer = Buffer.from(response.id, 'base64url');
    const storedCredential = credentialService.getCredentialByCredentialId(credentialIdBuffer);

    if (!storedCredential) {
      AuditService.log({
        action: ACTIONS.AUTHENTICATION_FAILED,
        userId,
        success: false,
        errorCode: 'CREDENTIAL_NOT_FOUND',
        errorMessage: '凭据不存在',
        riskFlags: [RISK_FLAGS.CREDENTIAL_NOT_FOUND],
        details: { credentialIdBase64: response.id }
      });
      
      return res.status(404).json({
        success: false,
        error: '凭据不存在',
        errorCode: 'CREDENTIAL_NOT_FOUND',
        riskFlags: [RISK_FLAGS.CREDENTIAL_NOT_FOUND]
      });
    }

    const validationResult = WebAuthnService.validateAuthenticationResponse(
      response,
      challenge,
      config.webauthn.origin,
      config.webauthn.rpId,
      storedCredential
    );

    if (validationResult.challengeId) {
      ChallengeService.markAsUsed(validationResult.challengeId);
    }

    if (validationResult.newSignCount > storedCredential.signCount) {
      credentialService.updateSignCount(storedCredential.id, validationResult.newSignCount);
    }

    const user = userService.getUserById(storedCredential.userId);

    AuditService.log({
      action: ACTIONS.AUTHENTICATION_COMPLETE,
      userId: storedCredential.userId,
      credentialId: storedCredential.id,
      success: true,
      details: {
        credentialIdBase64: storedCredential.credentialIdBase64,
        oldSignCount: storedCredential.signCount,
        newSignCount: validationResult.newSignCount,
        userPresent: validationResult.userPresent,
        userVerified: validationResult.userVerified
      }
    });

    res.json({
      success: true,
      user: user ? { id: user.id, username: user.username, displayName: user.displayName } : null,
      credential: {
        id: storedCredential.id,
        credentialIdBase64: storedCredential.credentialIdBase64,
        deviceRemark: storedCredential.deviceRemark,
        signCount: validationResult.newSignCount
      },
      validationDetails: {
        userPresent: validationResult.userPresent,
        userVerified: validationResult.userVerified,
        riskFlags: validationResult.riskFlags
      }
    });

  } catch (error) {
    if (error instanceof WebAuthnValidationError) {
      AuditService.log({
        action: ACTIONS.AUTHENTICATION_FAILED,
        userId: req.body.userId,
        success: false,
        errorCode: error.code,
        errorMessage: error.message,
        riskFlags: error.riskFlags,
        details: {}
      });
      
      return res.status(400).json({
        success: false,
        error: error.message,
        errorCode: error.code,
        riskFlags: error.riskFlags
      });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/simulator/generate-key', (req, res) => {
  try {
    const keyPair = simulatorService.generateKeyPair();
    res.json({ success: true, keyPair });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/simulator/registration-response', (req, res) => {
  try {
    const { keyId, challenge, username, userHandle } = req.body;
    
    if (!keyId || !challenge) {
      return res.status(400).json({ success: false, error: '缺少必要字段' });
    }

    const response = simulatorService.createRegistrationResponse(
      keyId,
      challenge,
      username || 'simulator-user',
      userHandle
    );

    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/simulator/authentication-response', (req, res) => {
  try {
    const { keyId, challenge, credentialIdBase64 } = req.body;
    
    if (!keyId || !challenge || !credentialIdBase64) {
      return res.status(400).json({ success: false, error: '缺少必要字段' });
    }

    const response = simulatorService.createAuthenticationResponse(
      keyId,
      challenge,
      credentialIdBase64
    );

    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/simulator/replay-attack', (req, res) => {
  try {
    const { keyId, challenge, credentialIdBase64 } = req.body;
    
    if (!keyId || !challenge || !credentialIdBase64) {
      return res.status(400).json({ success: false, error: '缺少必要字段' });
    }

    const response = simulatorService.createReplayAttackResponse(
      keyId,
      challenge,
      credentialIdBase64
    );

    res.json({ 
      success: true, 
      response,
      note: '这是一个模拟的重放攻击，使用相同的签名计数器值'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/simulator/rollback-attack', (req, res) => {
  try {
    const { keyId, challenge, credentialIdBase64 } = req.body;
    
    if (!keyId || !challenge || !credentialIdBase64) {
      return res.status(400).json({ success: false, error: '缺少必要字段' });
    }

    const response = simulatorService.createRollbackAttackResponse(
      keyId,
      challenge,
      credentialIdBase64
    );

    res.json({ 
      success: true, 
      response,
      note: '这是一个模拟的签名计数器倒退攻击'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit-logs', (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logs = AuditService.getAllLogs(parseInt(limit));
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/json', (req, res) => {
  try {
    const data = exportService.exportJSON();
    
    AuditService.log({
      action: ACTIONS.EXPORT_REPORT,
      success: true,
      details: { format: 'json' }
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=passkey-audit.json');
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/markdown', (req, res) => {
  try {
    const markdown = exportService.exportMarkdown();
    
    AuditService.log({
      action: ACTIONS.EXPORT_REPORT,
      success: true,
      details: { format: 'markdown' }
    });

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=passkey-training-report.md');
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
