const express = require('express');
const router = express.Router();
const storage = require('../storage');
const stateMachine = require('../stateMachine');

router.post('/register/start', async (req, res) => {
  try {
    const { username, displayName, email, deviceInfo } = req.body;
    const useSimulation = req.body.useSimulation !== false;

    if (!username) {
      return res.status(400).json({ success: false, error: '用户名不能为空' });
    }

    let user = storage.getUserByUsername(username);
    
    if (!user) {
      user = await stateMachine.startUserRegistration(
        username,
        displayName || username,
        email
      );
    }

    const registrationData = await stateMachine.startCredentialRegistration(
      user.id,
      deviceInfo || { name: '演练设备', type: 'platform' },
      useSimulation
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName
      },
      options: registrationData.options,
      challenge: registrationData.challenge,
      useSimulation
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/register/complete', async (req, res) => {
  try {
    const { userId, response } = req.body;
    const useSimulation = req.body.useSimulation !== false;

    if (!userId) {
      return res.status(400).json({ success: false, error: '用户ID不能为空' });
    }

    const result = await stateMachine.completeCredentialRegistration(
      userId,
      response,
      useSimulation
    );

    res.json({
      success: true,
      credential: result.credential,
      backupCodes: result.backupCodes
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/login/start', async (req, res) => {
  try {
    const { username } = req.body;
    const useSimulation = req.body.useSimulation !== false;

    if (!username) {
      return res.status(400).json({ success: false, error: '用户名不能为空' });
    }

    const result = await stateMachine.startAuthentication(username, useSimulation);

    res.json({
      success: true,
      ...result,
      useSimulation
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/login/complete', async (req, res) => {
  try {
    const { userId, credentialId, response } = req.body;
    const useSimulation = req.body.useSimulation !== false;

    if (!userId || !credentialId) {
      return res.status(400).json({ success: false, error: '用户ID和凭证ID不能为空' });
    }

    const result = await stateMachine.completeAuthentication(
      userId,
      response,
      credentialId,
      useSimulation
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/login/backup-code', async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ success: false, error: '用户ID和备用码不能为空' });
    }

    const result = await stateMachine.authenticateWithBackupCode(userId, code.toUpperCase());

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/credentials/:credentialId/revoke', async (req, res) => {
  try {
    const { credentialId } = req.params;
    const { reason } = req.body;

    if (!credentialId) {
      return res.status(400).json({ success: false, error: '凭证ID不能为空' });
    }

    const result = await stateMachine.revokeCredential(
      credentialId,
      reason || '管理员撤销'
    );

    res.json({
      success: true,
      credential: result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/users/:userId/backup-codes/regenerate', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: '用户ID不能为空' });
    }

    const newCodes = await stateMachine.regenerateBackupCodes(userId);

    res.json({
      success: true,
      backupCodes: newCodes
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
