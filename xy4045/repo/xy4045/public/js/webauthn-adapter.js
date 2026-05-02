class WebAuthnAdapter {
  constructor() {
    this.mode = 'webauthn';
    this.simulatorKeyId = null;
    this.lastChallenge = null;
  }

  setMode(mode) {
    this.mode = mode;
  }

  isWebAuthnSupported() {
    return typeof PublicKeyCredential !== 'undefined';
  }

  _base64urlToUint8Array(base64url) {
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  _uint8ArrayToBase64url(array) {
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async createCredential(options) {
    if (this.mode === 'simulator') {
      return this._simulatorCreateCredential(options);
    }

    if (!this.isWebAuthnSupported()) {
      throw new Error('当前浏览器不支持 WebAuthn，请使用模拟器模式');
    }

    const publicKey = {
      rp: options.rp,
      user: {
        id: this._base64urlToUint8Array(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName
      },
      challenge: this._base64urlToUint8Array(options.challenge),
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      excludeCredentials: (options.excludeCredentials || []).map(cred => ({
        id: this._base64urlToUint8Array(cred.id),
        type: cred.type,
        transports: cred.transports
      })),
      authenticatorSelection: options.authenticatorSelection,
      attestation: options.attestation
    };

    this.lastChallenge = options.challenge;

    const credential = await navigator.credentials.create({ publicKey });

    return {
      id: credential.id,
      rawId: this._uint8ArrayToBase64url(credential.rawId),
      response: {
        clientDataJSON: this._uint8ArrayToBase64url(credential.response.clientDataJSON),
        attestationObject: this._uint8ArrayToBase64url(credential.response.attestationObject),
        transports: credential.response.getTransports ? credential.response.getTransports() : []
      },
      type: credential.type
    };
  }

  async getCredential(options) {
    if (this.mode === 'simulator') {
      return this._simulatorGetCredential(options);
    }

    if (!this.isWebAuthnSupported()) {
      throw new Error('当前浏览器不支持 WebAuthn，请使用模拟器模式');
    }

    const publicKey = {
      challenge: this._base64urlToUint8Array(options.challenge),
      timeout: options.timeout,
      rpId: options.rpId,
      allowCredentials: (options.allowCredentials || []).map(cred => ({
        id: this._base64urlToUint8Array(cred.id),
        type: cred.type,
        transports: cred.transports
      })),
      userVerification: options.userVerification
    };

    this.lastChallenge = options.challenge;

    const assertion = await navigator.credentials.get({ publicKey });

    return {
      id: assertion.id,
      rawId: this._uint8ArrayToBase64url(assertion.rawId),
      response: {
        authenticatorData: this._uint8ArrayToBase64url(assertion.response.authenticatorData),
        clientDataJSON: this._uint8ArrayToBase64url(assertion.response.clientDataJSON),
        signature: this._uint8ArrayToBase64url(assertion.response.signature),
        userHandle: assertion.response.userHandle 
          ? this._uint8ArrayToBase64url(assertion.response.userHandle) 
          : null
      },
      type: assertion.type
    };
  }

  async _simulatorCreateCredential(options) {
    if (!this.simulatorKeyId) {
      throw new Error('请先生成模拟器密钥对');
    }

    const response = await fetch('/api/simulator/registration-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId: this.simulatorKeyId,
        challenge: options.challenge,
        username: options.user.name,
        userHandle: options.user.id
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '模拟器注册失败');
    }

    this.lastChallenge = options.challenge;
    return data.response;
  }

  async _simulatorGetCredential(options) {
    if (!this.simulatorKeyId) {
      throw new Error('请先生成模拟器密钥对');
    }

    if (!options.allowCredentials || options.allowCredentials.length === 0) {
      throw new Error('未指定凭据');
    }

    const credentialIdBase64 = options.allowCredentials[0].id;

    const response = await fetch('/api/simulator/authentication-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId: this.simulatorKeyId,
        challenge: options.challenge,
        credentialIdBase64: credentialIdBase64
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '模拟器认证失败');
    }

    this.lastChallenge = options.challenge;
    return data.response;
  }

  async generateSimulatorKey() {
    const response = await fetch('/api/simulator/generate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '生成密钥失败');
    }

    this.simulatorKeyId = data.keyPair.keyId;
    return data.keyPair;
  }

  async createReplayAttackResponse(options) {
    if (this.mode !== 'simulator') {
      throw new Error('重放攻击演示仅在模拟器模式下可用');
    }

    if (!this.simulatorKeyId) {
      throw new Error('请先生成模拟器密钥对');
    }

    const credentialIdBase64 = options.allowCredentials[0].id;

    const response = await fetch('/api/simulator/replay-attack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId: this.simulatorKeyId,
        challenge: options.challenge,
        credentialIdBase64: credentialIdBase64
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '创建重放攻击响应失败');
    }

    return data.response;
  }

  async createRollbackAttackResponse(options) {
    if (this.mode !== 'simulator') {
      throw new Error('计数器倒退攻击演示仅在模拟器模式下可用');
    }

    if (!this.simulatorKeyId) {
      throw new Error('请先生成模拟器密钥对');
    }

    const credentialIdBase64 = options.allowCredentials[0].id;

    const response = await fetch('/api/simulator/rollback-attack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId: this.simulatorKeyId,
        challenge: options.challenge,
        credentialIdBase64: credentialIdBase64
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '创建计数器倒退攻击响应失败');
    }

    return data.response;
  }

  getLastChallenge() {
    return this.lastChallenge;
  }
}

window.webAuthnAdapter = new WebAuthnAdapter();
