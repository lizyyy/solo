class App {
  constructor() {
    this.users = [];
    this.credentials = [];
    this.auditLogs = [];
    this.selectedUser = null;
    this.selectedCredential = null;
    this.loginSelectedCredential = null;
    this.revokeSelectedCredential = null;
    this.attackSelectedCredential = null;
    this.currentChallenge = null;
    
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadUsers();
    await this.loadAuditLogs();
    this.checkWebAuthnSupport();
  }

  checkWebAuthnSupport() {
    const supported = webAuthnAdapter.isWebAuthnSupported();
    if (!supported) {
      document.getElementById('mode-select').value = 'simulator';
      webAuthnAdapter.setMode('simulator');
      this.showToast('当前浏览器不支持 WebAuthn，已自动切换到模拟器模式', 'warning');
    }
  }

  bindEvents() {
    document.getElementById('mode-select').addEventListener('change', (e) => {
      const mode = e.target.value;
      webAuthnAdapter.setMode(mode);
      this.updateModeUI(mode);
    });

    document.getElementById('create-user').addEventListener('click', () => this.createUser());
    document.getElementById('new-username').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.createUser();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    document.getElementById('start-register').addEventListener('click', () => this.startRegistration());
    document.getElementById('start-login').addEventListener('click', () => this.startAuthentication());

    document.getElementById('generate-sim-key').addEventListener('click', () => this.generateSimulatorKey());

    document.getElementById('revoke-credential').addEventListener('click', () => this.revokeCredential());
    document.getElementById('unrevoke-credential').addEventListener('click', () => this.unrevokeCredential());

    document.getElementById('demo-replay').addEventListener('click', () => this.demoReplayAttack());
    document.getElementById('demo-rollback').addEventListener('click', () => this.demoRollbackAttack());

    document.getElementById('export-json').addEventListener('click', () => this.exportJSON());
    document.getElementById('export-markdown').addEventListener('click', () => this.exportMarkdown());
    document.getElementById('refresh-logs').addEventListener('click', () => this.loadAuditLogs());
  }

  updateModeUI(mode) {
    const simKeySection = document.getElementById('simulator-key-section');
    const attackTabs = document.querySelector('.tab-btn[data-tab="attacks"]');
    
    if (mode === 'simulator') {
      simKeySection.style.display = 'block';
      attackTabs.style.display = 'block';
    } else {
      simKeySection.style.display = 'none';
      attackTabs.style.display = 'none';
      if (document.querySelector('.tab-btn[data-tab="attacks"]').classList.contains('active')) {
        this.switchTab('register');
      }
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
    document.getElementById(`tab-${tabName}`).style.display = 'block';
  }

  async loadUsers() {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (data.success) {
        this.users = data.users;
        this.renderUserList();
      }
    } catch (error) {
      console.error('加载用户失败:', error);
    }
  }

  renderUserList() {
    const container = document.getElementById('user-list');
    
    if (this.users.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无用户，请先创建</div>';
      return;
    }

    container.innerHTML = this.users.map(user => `
      <div class="user-item ${this.selectedUser?.id === user.id ? 'selected' : ''}" data-id="${user.id}">
        <div class="username">${user.username}</div>
        <div class="meta">${user.displayName || user.username} · ${new Date(user.createdAt).toLocaleDateString()}</div>
      </div>
    `).join('');

    container.querySelectorAll('.user-item').forEach(item => {
      item.addEventListener('click', () => this.selectUser(item.dataset.id));
    });
  }

  async selectUser(userId) {
    this.selectedUser = this.users.find(u => u.id === userId);
    this.selectedCredential = null;
    this.loginSelectedCredential = null;
    this.revokeSelectedCredential = null;
    this.attackSelectedCredential = null;
    
    this.renderUserList();
    
    const selectedUserEl = document.getElementById('selected-user-register');
    if (this.selectedUser) {
      selectedUserEl.innerHTML = `
        <div class="user-info">
          <div class="avatar">${this.selectedUser.username.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-weight: 500;">${this.selectedUser.username}</div>
            <div style="font-size: 11px; color: var(--text-secondary);">${this.selectedUser.displayName || ''}</div>
          </div>
        </div>
      `;
      
      document.getElementById('credentials-section').style.display = 'block';
      await this.loadUserCredentials();
    } else {
      selectedUserEl.innerHTML = '<span class="placeholder">请先从左侧选择用户</span>';
      document.getElementById('credentials-section').style.display = 'none';
    }
  }

  async loadUserCredentials() {
    if (!this.selectedUser) return;

    try {
      const response = await fetch(`/api/users/${this.selectedUser.id}/credentials`);
      const data = await response.json();
      
      if (data.success) {
        this.credentials = data.credentials;
        this.renderCredentialList();
        this.renderLoginCredentialSelect();
        this.renderRevokeCredentialSelect();
        this.renderAttackCredentialSelect();
      }
    } catch (error) {
      console.error('加载凭据失败:', error);
    }
  }

  renderCredentialList() {
    const container = document.getElementById('credential-list');
    
    if (this.credentials.length === 0) {
      container.innerHTML = '<div class="empty-state">该用户尚未注册 Passkey</div>';
      return;
    }

    container.innerHTML = this.credentials.map(cred => `
      <div class="credential-item ${cred.isRevoked ? 'revoked' : ''}">
        <div class="device-name">
          ${cred.deviceRemark || '未命名设备'}
          <span class="status-badge ${cred.isRevoked ? 'revoked' : 'active'}">
            ${cred.isRevoked ? '已撤销' : '正常'}
          </span>
        </div>
        <div class="credential-meta">
          <span>签名计数器: ${cred.signCount}</span>
          <span>算法: ${cred.algorithm === -7 ? 'ES256' : 'RS256'}</span>
        </div>
      </div>
    `).join('');
  }

  renderLoginCredentialSelect() {
    const container = document.getElementById('login-credential-select');
    
    if (this.credentials.length === 0) {
      container.innerHTML = '<div class="empty-state">请先选择用户并注册 Passkey</div>';
      return;
    }

    const activeCredentials = this.credentials.filter(c => !c.isRevoked);
    
    if (activeCredentials.length === 0) {
      container.innerHTML = '<div class="empty-state">该用户的所有凭据都已被撤销</div>';
      return;
    }

    container.innerHTML = activeCredentials.map(cred => `
      <div class="credential-option ${this.loginSelectedCredential?.id === cred.id ? 'selected' : ''}" data-id="${cred.id}">
        <div class="option-header">
          <span class="option-name">${cred.deviceRemark || '未命名设备'}</span>
          <span class="option-status active">正常</span>
        </div>
        <div class="option-meta">签名计数器: ${cred.signCount}</div>
      </div>
    `).join('');

    container.querySelectorAll('.credential-option').forEach(option => {
      option.addEventListener('click', () => {
        this.loginSelectedCredential = this.credentials.find(c => c.id === option.dataset.id);
        this.renderLoginCredentialSelect();
      });
    });
  }

  renderRevokeCredentialSelect() {
    const container = document.getElementById('revoke-credential-select');
    
    if (this.credentials.length === 0) {
      container.innerHTML = '<div class="empty-state">请先选择用户并注册 Passkey</div>';
      return;
    }

    container.innerHTML = this.credentials.map(cred => `
      <div class="credential-option ${cred.isRevoked ? 'revoked' : ''} ${this.revokeSelectedCredential?.id === cred.id ? 'selected' : ''}" data-id="${cred.id}">
        <div class="option-header">
          <span class="option-name">${cred.deviceRemark || '未命名设备'}</span>
          <span class="option-status ${cred.isRevoked ? 'revoked' : 'active'}">
            ${cred.isRevoked ? '已撤销' : '正常'}
          </span>
        </div>
        <div class="option-meta">签名计数器: ${cred.signCount}</div>
      </div>
    `).join('');

    container.querySelectorAll('.credential-option').forEach(option => {
      option.addEventListener('click', () => {
        this.revokeSelectedCredential = this.credentials.find(c => c.id === option.dataset.id);
        this.renderRevokeCredentialSelect();
      });
    });
  }

  renderAttackCredentialSelect() {
    const container = document.getElementById('attack-credential-select');
    
    if (this.credentials.length === 0) {
      container.innerHTML = '<div class="empty-state">请先选择用户并注册 Passkey</div>';
      return;
    }

    const activeCredentials = this.credentials.filter(c => !c.isRevoked);
    
    if (activeCredentials.length === 0) {
      container.innerHTML = '<div class="empty-state">该用户的所有凭据都已被撤销</div>';
      return;
    }

    container.innerHTML = activeCredentials.map(cred => `
      <div class="credential-option ${this.attackSelectedCredential?.id === cred.id ? 'selected' : ''}" data-id="${cred.id}">
        <div class="option-header">
          <span class="option-name">${cred.deviceRemark || '未命名设备'}</span>
          <span class="option-status active">正常</span>
        </div>
        <div class="option-meta">签名计数器: ${cred.signCount}</div>
      </div>
    `).join('');

    container.querySelectorAll('.credential-option').forEach(option => {
      option.addEventListener('click', () => {
        this.attackSelectedCredential = this.credentials.find(c => c.id === option.dataset.id);
        this.renderAttackCredentialSelect();
      });
    });
  }

  async createUser() {
    const username = document.getElementById('new-username').value.trim();
    const displayName = document.getElementById('new-displayname').value.trim();

    if (!username) {
      this.showToast('请输入用户名', 'error');
      return;
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName: displayName || null })
      });

      const data = await response.json();
      
      if (data.success) {
        this.showToast('用户创建成功', 'success');
        document.getElementById('new-username').value = '';
        document.getElementById('new-displayname').value = '';
        await this.loadUsers();
        await this.loadAuditLogs();
      } else {
        this.showToast(data.error || '创建失败', 'error');
      }
    } catch (error) {
      this.showToast('创建用户失败: ' + error.message, 'error');
    }
  }

  async generateSimulatorKey() {
    try {
      const keyPair = await webAuthnAdapter.generateSimulatorKey();
      this.showToast('模拟器密钥对生成成功', 'success');
      this.renderSimulatorKeyInfo(keyPair);
    } catch (error) {
      this.showToast('生成密钥失败: ' + error.message, 'error');
    }
  }

  renderSimulatorKeyInfo(keyPair) {
    const container = document.getElementById('simulator-key-info');
    container.innerHTML = `
      <div class="key-row">
        <span>密钥 ID</span>
        <span class="key-value">${keyPair.keyId.substring(0, 12)}...</span>
      </div>
      <div class="key-row">
        <span>凭据 ID</span>
        <span class="key-value">${keyPair.credentialIdBase64.substring(0, 16)}...</span>
      </div>
      <div class="key-row">
        <span>算法</span>
        <span class="key-value">ES256</span>
      </div>
    `;
  }

  async startRegistration() {
    if (!this.selectedUser) {
      this.showToast('请先选择用户', 'error');
      return;
    }

    if (webAuthnAdapter.mode === 'simulator' && !webAuthnAdapter.simulatorKeyId) {
      this.showToast('请先生成模拟器密钥对', 'error');
      return;
    }

    try {
      const startResponse = await fetch('/api/registration/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.selectedUser.id })
      });

      const startData = await startResponse.json();
      
      if (!startData.success) {
        this.showToast(startData.error || '获取注册选项失败', 'error');
        return;
      }

      this.currentChallenge = startData.options.challenge;
      
      this.updateDetailView({
        type: 'registration',
        step: 'start',
        challenge: startData.options.challenge,
        user: startData.user,
        rp: startData.options.rp
      });

      let credential;
      try {
        credential = await webAuthnAdapter.createCredential(startData.options);
      } catch (error) {
        this.showToast('注册被取消或失败: ' + error.message, 'error');
        return;
      }

      const deviceRemark = document.getElementById('register-device-remark').value.trim() || '新注册设备';

      const completeResponse = await fetch('/api/registration/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: credential,
          userId: this.selectedUser.id,
          challenge: this.currentChallenge,
          deviceRemark
        })
      });

      const completeData = await completeResponse.json();
      
      if (completeData.success) {
        this.showToast('注册成功', 'success');
        this.updateDetailView({
          type: 'registration',
          step: 'complete',
          success: true,
          credential: completeData.credential,
          validationDetails: completeData.validationDetails
        });
        await this.loadUserCredentials();
        await this.loadAuditLogs();
      } else {
        this.showToast('注册失败: ' + (completeData.error || '未知错误'), 'error');
        this.updateDetailView({
          type: 'registration',
          step: 'complete',
          success: false,
          error: completeData.error,
          errorCode: completeData.errorCode,
          riskFlags: completeData.riskFlags
        });
        await this.loadAuditLogs();
      }

    } catch (error) {
      this.showToast('注册失败: ' + error.message, 'error');
    }
  }

  async startAuthentication() {
    if (!this.loginSelectedCredential) {
      this.showToast('请先选择要登录的凭据', 'error');
      return;
    }

    if (webAuthnAdapter.mode === 'simulator' && !webAuthnAdapter.simulatorKeyId) {
      this.showToast('请先生成模拟器密钥对', 'error');
      return;
    }

    try {
      const startResponse = await fetch('/api/authentication/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.selectedUser.id })
      });

      const startData = await startResponse.json();
      
      if (!startData.success) {
        this.showToast(startData.error || '获取认证选项失败', 'error');
        return;
      }

      startData.options.allowCredentials = [{
        id: this.loginSelectedCredential.credentialIdBase64,
        type: 'public-key',
        transports: this.loginSelectedCredential.transports || []
      }];

      this.currentChallenge = startData.options.challenge;
      
      this.updateDetailView({
        type: 'authentication',
        step: 'start',
        challenge: startData.options.challenge,
        credential: this.loginSelectedCredential
      });

      let assertion;
      try {
        assertion = await webAuthnAdapter.getCredential(startData.options);
      } catch (error) {
        this.showToast('认证被取消或失败: ' + error.message, 'error');
        return;
      }

      const completeResponse = await fetch('/api/authentication/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: assertion,
          challenge: this.currentChallenge,
          userId: this.selectedUser.id
        })
      });

      const completeData = await completeResponse.json();
      
      if (completeData.success) {
        this.showToast('登录成功', 'success');
        this.updateDetailView({
          type: 'authentication',
          step: 'complete',
          success: true,
          user: completeData.user,
          credential: completeData.credential,
          validationDetails: completeData.validationDetails
        });
        await this.loadUserCredentials();
        await this.loadAuditLogs();
      } else {
        this.showToast('登录失败: ' + (completeData.error || '未知错误'), 'error');
        this.updateDetailView({
          type: 'authentication',
          step: 'complete',
          success: false,
          error: completeData.error,
          errorCode: completeData.errorCode,
          riskFlags: completeData.riskFlags
        });
        await this.loadAuditLogs();
      }

    } catch (error) {
      this.showToast('登录失败: ' + error.message, 'error');
    }
  }

  async revokeCredential() {
    if (!this.revokeSelectedCredential) {
      this.showToast('请先选择要撤销的凭据', 'error');
      return;
    }

    if (this.revokeSelectedCredential.isRevoked) {
      this.showToast('该凭据已被撤销', 'warning');
      return;
    }

    try {
      const response = await fetch(`/api/credentials/${this.revokeSelectedCredential.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (data.success) {
        this.showToast('凭据已撤销', 'success');
        await this.loadUserCredentials();
        await this.loadAuditLogs();
      } else {
        this.showToast('撤销失败: ' + data.error, 'error');
      }
    } catch (error) {
      this.showToast('撤销失败: ' + error.message, 'error');
    }
  }

  async unrevokeCredential() {
    if (!this.revokeSelectedCredential) {
      this.showToast('请先选择要恢复的凭据', 'error');
      return;
    }

    if (!this.revokeSelectedCredential.isRevoked) {
      this.showToast('该凭据未被撤销', 'warning');
      return;
    }

    try {
      const response = await fetch(`/api/credentials/${this.revokeSelectedCredential.id}/unrevoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (data.success) {
        this.showToast('凭据已恢复', 'success');
        await this.loadUserCredentials();
        await this.loadAuditLogs();
      } else {
        this.showToast('恢复失败: ' + data.error, 'error');
      }
    } catch (error) {
      this.showToast('恢复失败: ' + error.message, 'error');
    }
  }

  async demoReplayAttack() {
    if (webAuthnAdapter.mode !== 'simulator') {
      this.showToast('重放攻击演示仅在模拟器模式下可用', 'warning');
      return;
    }

    if (!this.attackSelectedCredential) {
      this.showToast('请先选择要演示的凭据', 'error');
      return;
    }

    try {
      const startResponse = await fetch('/api/authentication/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.selectedUser.id })
      });

      const startData = await startResponse.json();
      
      if (!startData.success) {
        this.showToast(startData.error || '获取认证选项失败', 'error');
        return;
      }

      startData.options.allowCredentials = [{
        id: this.attackSelectedCredential.credentialIdBase64,
        type: 'public-key',
        transports: this.attackSelectedCredential.transports || []
      }];

      this.showToast('正在执行第一次正常登录...', 'warning');

      let assertion;
      try {
        assertion = await webAuthnAdapter.getCredential(startData.options);
      } catch (error) {
        this.showToast('认证失败: ' + error.message, 'error');
        return;
      }

      const firstResponse = await fetch('/api/authentication/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: assertion,
          challenge: startData.options.challenge,
          userId: this.selectedUser.id
        })
      });

      const firstData = await firstResponse.json();
      
      if (!firstData.success) {
        this.showToast('第一次登录失败: ' + firstData.error, 'error');
        await this.loadAuditLogs();
        return;
      }

      this.showToast('第一次登录成功，现在尝试重放相同的挑战值...', 'warning');

      this.updateDetailView({
        type: 'replay_attack',
        step: 'first_login',
        success: true,
        message: '第一次登录成功，现在将尝试使用相同的挑战值进行重放攻击'
      });

      const startResponse2 = await fetch('/api/authentication/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.selectedUser.id })
      });

      const startData2 = await startResponse2.json();
      
      startData2.options.allowCredentials = [{
        id: this.attackSelectedCredential.credentialIdBase64,
        type: 'public-key',
        transports: this.attackSelectedCredential.transports || []
      }];

      const replayAssertion = await webAuthnAdapter.createReplayAttackResponse(startData2.options);

      const replayResponse = await fetch('/api/authentication/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: replayAssertion,
          challenge: startData2.options.challenge,
          userId: this.selectedUser.id
        })
      });

      const replayData = await replayResponse.json();
      
      if (replayData.success) {
        this.showToast('重放攻击意外成功！这是一个安全漏洞', 'error');
      } else {
        this.showToast('重放攻击已被正确阻止', 'success');
      }

      this.updateDetailView({
        type: 'replay_attack',
        step: 'attack_result',
        success: !replayData.success,
        expectedBlocked: true,
        response: replayData
      });

      await this.loadUserCredentials();
      await this.loadAuditLogs();

    } catch (error) {
      this.showToast('演示失败: ' + error.message, 'error');
    }
  }

  async demoRollbackAttack() {
    if (webAuthnAdapter.mode !== 'simulator') {
      this.showToast('计数器倒退攻击演示仅在模拟器模式下可用', 'warning');
      return;
    }

    if (!this.attackSelectedCredential) {
      this.showToast('请先选择要演示的凭据', 'error');
      return;
    }

    if (this.attackSelectedCredential.signCount <= 0) {
      this.showToast('需要先进行至少一次正常登录以初始化签名计数器', 'warning');
      return;
    }

    try {
      const startResponse = await fetch('/api/authentication/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.selectedUser.id })
      });

      const startData = await startResponse.json();
      
      if (!startData.success) {
        this.showToast(startData.error || '获取认证选项失败', 'error');
        return;
      }

      startData.options.allowCredentials = [{
        id: this.attackSelectedCredential.credentialIdBase64,
        type: 'public-key',
        transports: this.attackSelectedCredential.transports || []
      }];

      this.showToast('正在模拟计数器倒退攻击...', 'warning');

      this.updateDetailView({
        type: 'rollback_attack',
        step: 'start',
        message: `当前存储的签名计数器值: ${this.attackSelectedCredential.signCount}，将使用小于该值的计数器进行攻击`
      });

      const rollbackAssertion = await webAuthnAdapter.createRollbackAttackResponse(startData.options);

      const rollbackResponse = await fetch('/api/authentication/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: rollbackAssertion,
          challenge: startData.options.challenge,
          userId: this.selectedUser.id
        })
      });

      const rollbackData = await rollbackResponse.json();
      
      if (rollbackData.success) {
        this.showToast('计数器倒退攻击意外成功！这是一个安全漏洞', 'error');
      } else {
        this.showToast('计数器倒退攻击已被正确阻止', 'success');
      }

      this.updateDetailView({
        type: 'rollback_attack',
        step: 'attack_result',
        success: !rollbackData.success,
        expectedBlocked: true,
        response: rollbackData
      });

      await this.loadUserCredentials();
      await this.loadAuditLogs();

    } catch (error) {
      this.showToast('演示失败: ' + error.message, 'error');
    }
  }

  async loadAuditLogs() {
    try {
      const response = await fetch('/api/audit-logs');
      const data = await response.json();
      
      if (data.success) {
        this.auditLogs = data.logs;
        this.renderAuditLogs();
      }
    } catch (error) {
      console.error('加载审计日志失败:', error);
    }
  }

  renderAuditLogs() {
    const container = document.getElementById('audit-log-list');
    
    if (this.auditLogs.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无操作记录</div>';
      return;
    }

    const actionNames = {
      'registration_start': '开始注册',
      'registration_complete': '注册完成',
      'registration_failed': '注册失败',
      'authentication_start': '开始登录',
      'authentication_complete': '登录成功',
      'authentication_failed': '登录失败',
      'credential_revoked': '撤销凭据',
      'credential_unrevoked': '恢复凭据',
      'user_created': '创建用户',
      'user_deleted': '删除用户',
      'export_report': '导出报告'
    };

    container.innerHTML = this.auditLogs.slice(0, 50).map(log => `
      <div class="audit-log-item">
        <div class="log-header">
          <span class="log-action ${log.success ? 'success' : 'failed'}">
            ${log.success ? '✓' : '✗'} ${actionNames[log.action] || log.action}
          </span>
          <span class="log-time">${new Date(log.createdAt).toLocaleTimeString()}</span>
        </div>
        ${log.errorMessage ? `<div class="log-details">${log.errorMessage}</div>` : ''}
        ${log.riskFlags && log.riskFlags.length > 0 ? `
          <div class="log-risks">
            ${log.riskFlags.map(flag => `<span class="risk-flag">⚠ ${this.getRiskName(flag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  getRiskName(flag) {
    const names = {
      'challenge_replay': '重放攻击',
      'challenge_expired': '挑战值过期',
      'credential_revoked': '已撤销凭据',
      'credential_duplicate': '重复凭据',
      'sign_count_rollback': '计数器倒退',
      'rp_id_mismatch': 'RP ID 不匹配',
      'origin_mismatch': 'Origin 不匹配',
      'user_not_found': '用户不存在',
      'credential_not_found': '凭据不存在',
      'signature_invalid': '签名无效',
      'missing_fields': '缺少字段'
    };
    return names[flag] || flag;
  }

  updateDetailView(data) {
    const container = document.getElementById('detail-view');
    
    let html = '';

    if (data.type === 'registration' || data.type === 'authentication') {
      const isRegistration = data.type === 'registration';
      const typeName = isRegistration ? '注册' : '登录';

      if (data.step === 'start') {
        html = `
          <div class="detail-group">
            <h4>操作类型</h4>
            <div class="detail-row">
              <span class="label">类型</span>
              <span class="value">${typeName}流程</span>
            </div>
          </div>
          <div class="detail-group">
            <h4>挑战值</h4>
            <div class="detail-row">
              <span class="label">值</span>
              <span class="value code">${data.challenge.substring(0, 20)}...</span>
            </div>
            <div class="detail-row">
              <span class="label">状态</span>
              <span class="value success">待使用</span>
            </div>
          </div>
          ${data.user ? `
          <div class="detail-group">
            <h4>用户信息</h4>
            <div class="detail-row">
              <span class="label">用户名</span>
              <span class="value">${data.user.username}</span>
            </div>
            ${data.user.displayName ? `
            <div class="detail-row">
              <span class="label">显示名</span>
              <span class="value">${data.user.displayName}</span>
            </div>
            ` : ''}
          </div>
          ` : ''}
          ${data.rp ? `
          <div class="detail-group">
            <h4>依赖方信息</h4>
            <div class="detail-row">
              <span class="label">名称</span>
              <span class="value">${data.rp.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">ID</span>
              <span class="value">${data.rp.id}</span>
            </div>
          </div>
          ` : ''}
        `;
      } else if (data.step === 'complete') {
        html = `
          <div class="detail-group">
            <h4>操作结果</h4>
            <div class="detail-row">
              <span class="label">状态</span>
              <span class="value ${data.success ? 'success' : 'error'}">
                ${data.success ? '成功' : '失败'}
              </span>
            </div>
          </div>
          ${data.success ? `
          <div class="detail-group">
            <h4>${isRegistration ? '凭据' : '用户'}信息</h4>
            ${data.credential ? `
            <div class="detail-row">
              <span class="label">设备</span>
              <span class="value">${data.credential.deviceRemark || '未命名'}</span>
            </div>
            <div class="detail-row">
              <span class="label">凭据 ID</span>
              <span class="value code">${data.credential.credentialIdBase64.substring(0, 16)}...</span>
            </div>
            <div class="detail-row">
              <span class="label">签名计数器</span>
              <span class="value">${data.credential.signCount}</span>
            </div>
            ` : ''}
            ${data.user ? `
            <div class="detail-row">
              <span class="label">用户名</span>
              <span class="value">${data.user.username}</span>
            </div>
            ` : ''}
          </div>
          ` : `
          <div class="detail-group">
            <h4>错误信息</h4>
            ${data.errorCode ? `
            <div class="detail-row">
              <span class="label">错误码</span>
              <span class="value code">${data.errorCode}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="label">错误</span>
              <span class="value error">${data.error}</span>
            </div>
          </div>
          `}
          ${data.riskFlags && data.riskFlags.length > 0 ? `
          <div class="detail-group">
            <h4>检测到的风险</h4>
            <div class="risk-flags">
              ${data.riskFlags.map(flag => `<span class="risk-flag">⚠ ${this.getRiskName(flag)}</span>`).join('')}
            </div>
          </div>
          ` : ''}
        `;
      }
    } else if (data.type === 'replay_attack' || data.type === 'rollback_attack') {
      const attackName = data.type === 'replay_attack' ? '重放攻击' : '计数器倒退攻击';
      
      html = `
        <div class="detail-group">
          <h4>攻击演示</h4>
          <div class="detail-row">
            <span class="label">类型</span>
            <span class="value">${attackName}</span>
          </div>
        </div>
        ${data.step === 'attack_result' ? `
        <div class="detail-group">
          <h4>检测结果</h4>
          <div class="detail-row">
            <span class="label">预期行为</span>
            <span class="value">阻止攻击</span>
          </div>
          <div class="detail-row">
            <span class="label">实际结果</span>
            <span class="value ${data.success ? 'success' : 'error'}">
              ${data.success ? '已正确阻止' : '未被阻止（漏洞！）'}
            </span>
          </div>
        </div>
        ${data.response && data.response.riskFlags && data.response.riskFlags.length > 0 ? `
        <div class="detail-group">
          <h4>检测到的风险</h4>
          <div class="risk-flags">
            ${data.response.riskFlags.map(flag => `<span class="risk-flag">⚠ ${this.getRiskName(flag)}</span>`).join('')}
          </div>
        </div>
        ` : ''}
        ${data.response && data.response.error ? `
        <div class="detail-group">
          <h4>服务器响应</h4>
          <div class="detail-row">
            <span class="label">错误</span>
            <span class="value error">${data.response.error}</span>
          </div>
        </div>
        ` : ''}
        ` : `
        <div class="detail-group">
          <h4>状态</h4>
          <div class="detail-row">
            <span class="label">消息</span>
            <span class="value">${data.message}</span>
          </div>
        </div>
        `}
      `;
    }

    if (!html) {
      html = '<div class="empty-state">执行操作后，这里会显示详细信息</div>';
    }

    container.innerHTML = html;
  }

  async exportJSON() {
    try {
      window.open('/api/export/json', '_blank');
      await this.loadAuditLogs();
      this.showToast('JSON 导出已开始', 'success');
    } catch (error) {
      this.showToast('导出失败: ' + error.message, 'error');
    }
  }

  async exportMarkdown() {
    try {
      window.open('/api/export/markdown', '_blank');
      await this.loadAuditLogs();
      this.showToast('Markdown 报告导出已开始', 'success');
    } catch (error) {
      this.showToast('导出失败: ' + error.message, 'error');
    }
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
