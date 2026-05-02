const express = require('express');
const router = express.Router();
const storage = require('../storage');
const stateMachine = require('../stateMachine');
const importExport = require('../importExport');

router.get('/', (req, res) => {
  try {
    const users = storage.getUsers();
    const userList = users.map(user => {
      const credentials = storage.getCredentialsByUserId(user.id);
      return {
        ...user,
        credentialCount: credentials.length,
        credentials
      };
    });
    res.json({ success: true, users: userList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const user = storage.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const credentials = storage.getCredentialsByUserId(userId);
    const allCredentials = storage.getCredentials().filter(c => c.userId === userId);
    const backupCodes = storage.getBackupCodesByUserId(userId);
    const auditLogs = stateMachine.getAuditLogs({ userId });

    res.json({
      success: true,
      user: {
        ...user,
        credentials: allCredentials,
        activeCredentialCount: credentials.length,
        remainingBackupCodes: backupCodes.length,
        recentAuditLogs: auditLogs.slice(0, 20)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, displayName, email } = req.body;
    
    if (!username) {
      return res.status(400).json({ success: false, error: '用户名不能为空' });
    }

    const user = await stateMachine.startUserRegistration(
      username,
      displayName || username,
      email
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        state: user.state
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const user = storage.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const credentials = storage.getCredentialsByUserId(userId);
    credentials.forEach(cred => {
      storage.revokeCredential(cred.id, '用户被删除');
    });

    storage.invalidateUserBackupCodes(userId);
    const deleted = storage.deleteUser(userId);

    storage.createAuditLog({
      action: 'USER_DELETED',
      userId,
      username: user.username,
      details: {}
    });

    res.json({ success: deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:userId/credentials', (req, res) => {
  try {
    const { userId } = req.params;
    const user = storage.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const allCredentials = storage.getCredentials().filter(c => c.userId === userId);

    res.json({
      success: true,
      credentials: allCredentials
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
