const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

const SIMULATOR_KEYS = new Map();

class SimulatorService {
  generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    const keyId = uuidv4();
    const credentialId = crypto.randomBytes(32);
    
    const publicKeyDer = crypto.createPublicKey(publicKey).export({
      type: 'spki',
      format: 'der'
    });

    const publicKeyRaw = this._extractRawPublicKey(publicKeyDer);

    SIMULATOR_KEYS.set(keyId, {
      privateKey,
      publicKey,
      publicKeyRaw,
      credentialId,
      signCount: 0
    });

    return {
      keyId,
      credentialId,
      credentialIdBase64: credentialId.toString('base64url'),
      publicKey: publicKeyRaw,
      publicKeyBase64: publicKeyRaw.toString('base64url'),
      algorithm: -7
    };
  }

  getKey(keyId) {
    return SIMULATOR_KEYS.get(keyId);
  }

  createRegistrationResponse(keyId, challenge, username, userHandle) {
    const keyData = this.getKey(keyId);
    if (!keyData) {
      throw new Error('密钥不存在');
    }

    const clientData = {
      type: 'webauthn.create',
      challenge: challenge,
      origin: config.webauthn.origin,
      crossOrigin: false
    };

    const clientDataJSON = Buffer.from(JSON.stringify(clientData));
    const clientDataJSONBase64 = clientDataJSON.toString('base64url');

    const rpIdHash = crypto.createHash('sha256').update(config.webauthn.rpId).digest();
    
    const flags = 0x41;
    
    const signCount = 0;
    keyData.signCount = signCount;

    const aaguid = Buffer.alloc(16);
    const credentialIdLengthBuffer = Buffer.alloc(2);
    credentialIdLengthBuffer.writeUInt16BE(keyData.credentialId.length, 0);

    const cosePublicKey = this._createCOSEPublicKey(keyData.publicKeyRaw);

    const authData = Buffer.concat([
      rpIdHash,
      Buffer.from([flags]),
      Buffer.from([0, 0, 0, signCount]),
      aaguid,
      credentialIdLengthBuffer,
      keyData.credentialId,
      cosePublicKey
    ]);

    const attestationObject = this._createAttestationObject(authData);

    return {
      id: keyData.credentialId.toString('base64url'),
      rawId: keyData.credentialId.toString('base64url'),
      response: {
        clientDataJSON: clientDataJSONBase64,
        attestationObject: attestationObject.toString('base64url'),
        transports: ['internal']
      },
      type: 'public-key'
    };
  }

  createAuthenticationResponse(keyId, challenge, credentialIdBase64) {
    const keyData = this.getKey(keyId);
    if (!keyData) {
      throw new Error('密钥不存在');
    }

    const clientData = {
      type: 'webauthn.get',
      challenge: challenge,
      origin: config.webauthn.origin,
      crossOrigin: false
    };

    const clientDataJSON = Buffer.from(JSON.stringify(clientData));
    const clientDataJSONBase64 = clientDataJSON.toString('base64url');

    const rpIdHash = crypto.createHash('sha256').update(config.webauthn.rpId).digest();
    
    const flags = 0x01;
    
    keyData.signCount += 1;
    const signCount = keyData.signCount;

    const authData = Buffer.concat([
      rpIdHash,
      Buffer.from([flags]),
      this._uint32ToBuffer(signCount)
    ]);

    const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
    const signedData = Buffer.concat([authData, clientDataHash]);

    const signature = crypto.sign(
      'sha256',
      signedData,
      {
        key: keyData.privateKey,
        dsaEncoding: 'der'
      }
    );

    return {
      id: credentialIdBase64,
      rawId: credentialIdBase64,
      response: {
        authenticatorData: authData.toString('base64url'),
        clientDataJSON: clientDataJSONBase64,
        signature: signature.toString('base64url'),
        userHandle: null
      },
      type: 'public-key'
    };
  }

  createReplayAttackResponse(keyId, challenge, credentialIdBase64) {
    const keyData = this.getKey(keyId);
    if (!keyData) {
      throw new Error('密钥不存在');
    }

    const originalSignCount = keyData.signCount;
    const response = this.createAuthenticationResponse(keyId, challenge, credentialIdBase64);
    
    keyData.signCount = originalSignCount;
    
    return response;
  }

  createRollbackAttackResponse(keyId, challenge, credentialIdBase64) {
    const keyData = this.getKey(keyId);
    if (!keyData) {
      throw new Error('密钥不存在');
    }

    if (keyData.signCount <= 0) {
      throw new Error('需要先进行一次正常登录');
    }

    keyData.signCount = Math.max(0, keyData.signCount - 2);
    
    return this.createAuthenticationResponse(keyId, challenge, credentialIdBase64);
  }

  _createCOSEPublicKey(publicKeyRaw) {
    const x = publicKeyRaw.slice(1, 33);
    const y = publicKeyRaw.slice(33, 65);

    const map = new Map();
    map.set(1, 2);
    map.set(3, -7);
    map.set(-1, 1);
    map.set(-2, x);
    map.set(-3, y);

    return this._encodeCBORMap(map);
  }

  _encodeCBORMap(map) {
    const parts = [];
    const size = map.size;
    
    if (size < 24) {
      parts.push(Buffer.from([0xa0 + size]));
    } else {
      throw new Error('Map too large');
    }

    for (const [key, value] of map) {
      if (typeof key === 'number') {
        parts.push(this._encodeCBORInt(key));
      } else {
        parts.push(this._encodeCBORBytes(key));
      }

      if (typeof value === 'number') {
        parts.push(this._encodeCBORInt(value));
      } else if (Buffer.isBuffer(value)) {
        parts.push(this._encodeCBORBytes(value));
      }
    }

    return Buffer.concat(parts);
  }

  _encodeCBORInt(n) {
    if (n >= 0 && n < 24) {
      return Buffer.from([n]);
    } else if (n < 0 && n >= -24) {
      return Buffer.from([0x20 + (-n - 1)]);
    } else if (n < 0) {
      const value = -n - 1;
      if (value <= 0xff) {
        return Buffer.from([0x38, value]);
      }
    }
    throw new Error('Integer too large');
  }

  _encodeCBORBytes(buffer) {
    const len = buffer.length;
    const parts = [];

    if (len < 24) {
      parts.push(Buffer.from([0x40 + len]));
    } else if (len <= 0xff) {
      parts.push(Buffer.from([0x58, len]));
    } else if (len <= 0xffff) {
      parts.push(Buffer.from([0x59, len >> 8, len & 0xff]));
    } else {
      throw new Error('Bytes too large');
    }

    parts.push(buffer);
    return Buffer.concat(parts);
  }

  _createAttestationObject(authData) {
    const map = new Map();
    map.set('fmt', 'none');
    map.set('authData', authData);
    map.set('attStmt', new Map());

    return this._encodeCBORAttestation(map);
  }

  _encodeCBORAttestation(map) {
    const parts = [Buffer.from([0xa3])];

    parts.push(this._encodeCBORString('fmt'));
    parts.push(this._encodeCBORString('none'));

    parts.push(this._encodeCBORString('authData'));
    parts.push(this._encodeCBORBytes(map.get('authData')));

    parts.push(this._encodeCBORString('attStmt'));
    parts.push(Buffer.from([0xa0]));

    return Buffer.concat(parts);
  }

  _encodeCBORString(str) {
    const buffer = Buffer.from(str, 'utf8');
    const len = buffer.length;
    const parts = [];

    if (len < 24) {
      parts.push(Buffer.from([0x60 + len]));
    } else {
      throw new Error('String too large');
    }

    parts.push(buffer);
    return Buffer.concat(parts);
  }

  _extractRawPublicKey(publicKeyDer) {
    const spkiHeaderES256 = Buffer.from([
      0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
      0x03, 0x42, 0x00
    ]);

    if (publicKeyDer.length > spkiHeaderES256.length) {
      const rawKey = publicKeyDer.slice(spkiHeaderES256.length);
      if (rawKey.length === 65 && rawKey[0] === 0x04) {
        return rawKey;
      }
    }

    return publicKeyDer;
  }

  _uint32ToBuffer(n) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(n, 0);
    return buffer;
  }
}

module.exports = new SimulatorService();
