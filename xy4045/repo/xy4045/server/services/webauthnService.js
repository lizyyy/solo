const crypto = require('crypto');
const config = require('../config');
const { ChallengeService, CHALLENGE_TYPES } = require('./challengeService');
const { AuditService, ACTIONS, RISK_FLAGS } = require('./auditService');

const COSE_ALGORITHMS = {
  ES256: -7,
  RS256: -257
};

class WebAuthnValidationError extends Error {
  constructor(message, code, riskFlags = []) {
    super(message);
    this.name = 'WebAuthnValidationError';
    this.code = code;
    this.riskFlags = riskFlags;
  }
}

class WebAuthnService {
  generateRegistrationOptions(user, existingCredentials = []) {
    const challenge = ChallengeService.createChallenge(
      CHALLENGE_TYPES.REGISTRATION,
      user.id
    );

    const excludeCredentials = existingCredentials.map(cred => ({
      id: cred.credentialId.toString('base64url'),
      type: 'public-key',
      transports: cred.transports || []
    }));

    const options = {
      rp: {
        name: config.webauthn.rpName,
        id: config.webauthn.rpId
      },
      user: {
        id: user.userHandle.toString('base64url'),
        name: user.username,
        displayName: user.displayName
      },
      challenge: challenge.challengeBase64,
      pubKeyCredParams: [
        { type: 'public-key', alg: COSE_ALGORITHMS.ES256 },
        { type: 'public-key', alg: COSE_ALGORITHMS.RS256 }
      ],
      timeout: 60000,
      excludeCredentials,
      authenticatorSelection: {
        userVerification: config.webauthn.userVerification,
        residentKey: 'preferred'
      },
      attestation: config.webauthn.attestation
    };

    AuditService.log({
      action: ACTIONS.REGISTRATION_START,
      userId: user.id,
      success: true,
      details: {
        challengeId: challenge.id,
        username: user.username
      }
    });

    return { options, challengeId: challenge.id };
  }

  generateAuthenticationOptions(userId = null) {
    const challenge = ChallengeService.createChallenge(
      CHALLENGE_TYPES.AUTHENTICATION,
      userId
    );

    const options = {
      challenge: challenge.challengeBase64,
      timeout: 60000,
      rpId: config.webauthn.rpId,
      userVerification: config.webauthn.userVerification
    };

    AuditService.log({
      action: ACTIONS.AUTHENTICATION_START,
      userId,
      success: true,
      details: {
        challengeId: challenge.id
      }
    });

    return { options, challengeId: challenge.id };
  }

  validateRegistrationResponse(response, expectedChallenge, expectedOrigin, expectedRpId) {
    const riskFlags = [];
    
    if (!response.id || !response.rawId || !response.response) {
      throw new WebAuthnValidationError(
        '缺少必要字段',
        'MISSING_FIELDS',
        [RISK_FLAGS.MISSING_FIELDS]
      );
    }

    const clientDataJSON = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString()
    );

    if (clientDataJSON.type !== 'webauthn.create') {
      throw new WebAuthnValidationError(
        '无效的操作类型',
        'INVALID_TYPE',
        []
      );
    }

    const challengeBuffer = Buffer.from(expectedChallenge, 'base64url');
    
    if (ChallengeService.isChallengeUsed(challengeBuffer)) {
      riskFlags.push(RISK_FLAGS.CHALLENGE_REPLAY);
      throw new WebAuthnValidationError(
        '挑战值已被使用（重放攻击检测）',
        'CHALLENGE_REPLAY',
        riskFlags
      );
    }

    if (ChallengeService.isChallengeExpired(challengeBuffer)) {
      riskFlags.push(RISK_FLAGS.CHALLENGE_EXPIRED);
      throw new WebAuthnValidationError(
        '挑战值已过期',
        'CHALLENGE_EXPIRED',
        riskFlags
      );
    }

    const storedChallenge = ChallengeService.getChallengeByValue(challengeBuffer);
    if (!storedChallenge) {
      throw new WebAuthnValidationError(
        '无效的挑战值',
        'INVALID_CHALLENGE',
        []
      );
    }

    const receivedChallenge = clientDataJSON.challenge;
    if (receivedChallenge !== expectedChallenge) {
      riskFlags.push(RISK_FLAGS.CHALLENGE_REPLAY);
      throw new WebAuthnValidationError(
        '挑战值不匹配',
        'CHALLENGE_MISMATCH',
        riskFlags
      );
    }

    const origin = clientDataJSON.origin;
    if (origin !== expectedOrigin) {
      riskFlags.push(RISK_FLAGS.ORIGIN_MISMATCH);
      throw new WebAuthnValidationError(
        `Origin 不匹配: 期望 ${expectedOrigin}, 实际 ${origin}`,
        'ORIGIN_MISMATCH',
        riskFlags
      );
    }

    const authData = this._parseAuthenticatorData(
      Buffer.from(response.response.attestationObject, 'base64url')
    );

    if (authData.rpIdHash !== this._hashRpId(expectedRpId)) {
      riskFlags.push(RISK_FLAGS.RP_ID_MISMATCH);
      throw new WebAuthnValidationError(
        'RP ID 不匹配',
        'RP_ID_MISMATCH',
        riskFlags
      );
    }

    if (!authData.flags.userPresent) {
      throw new WebAuthnValidationError(
        '用户在场验证失败',
        'USER_PRESENCE_REQUIRED',
        []
      );
    }

    return {
      credentialId: Buffer.from(response.id, 'base64url'),
      publicKey: authData.attestedCredentialData.publicKey,
      algorithm: authData.attestedCredentialData.algorithm,
      signCount: authData.signCount,
      transports: response.response.transports || [],
      challengeId: storedChallenge.id,
      riskFlags
    };
  }

  validateAuthenticationResponse(response, expectedChallenge, expectedOrigin, expectedRpId, storedCredential) {
    const riskFlags = [];

    if (!response.id || !response.rawId || !response.response) {
      throw new WebAuthnValidationError(
        '缺少必要字段',
        'MISSING_FIELDS',
        [RISK_FLAGS.MISSING_FIELDS]
      );
    }

    const clientDataJSON = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString()
    );

    if (clientDataJSON.type !== 'webauthn.get') {
      throw new WebAuthnValidationError(
        '无效的操作类型',
        'INVALID_TYPE',
        []
      );
    }

    const challengeBuffer = Buffer.from(expectedChallenge, 'base64url');
    
    if (ChallengeService.isChallengeUsed(challengeBuffer)) {
      riskFlags.push(RISK_FLAGS.CHALLENGE_REPLAY);
      throw new WebAuthnValidationError(
        '挑战值已被使用（重放攻击检测）',
        'CHALLENGE_REPLAY',
        riskFlags
      );
    }

    if (ChallengeService.isChallengeExpired(challengeBuffer)) {
      riskFlags.push(RISK_FLAGS.CHALLENGE_EXPIRED);
      throw new WebAuthnValidationError(
        '挑战值已过期',
        'CHALLENGE_EXPIRED',
        riskFlags
      );
    }

    const storedChallenge = ChallengeService.getChallengeByValue(challengeBuffer);
    if (!storedChallenge) {
      throw new WebAuthnValidationError(
        '无效的挑战值',
        'INVALID_CHALLENGE',
        []
      );
    }

    const receivedChallenge = clientDataJSON.challenge;
    if (receivedChallenge !== expectedChallenge) {
      riskFlags.push(RISK_FLAGS.CHALLENGE_REPLAY);
      throw new WebAuthnValidationError(
        '挑战值不匹配',
        'CHALLENGE_MISMATCH',
        riskFlags
      );
    }

    const origin = clientDataJSON.origin;
    if (origin !== expectedOrigin) {
      riskFlags.push(RISK_FLAGS.ORIGIN_MISMATCH);
      throw new WebAuthnValidationError(
        `Origin 不匹配: 期望 ${expectedOrigin}, 实际 ${origin}`,
        'ORIGIN_MISMATCH',
        riskFlags
      );
    }

    const authData = this._parseAuthenticatorData(
      Buffer.from(response.response.authenticatorData, 'base64url')
    );

    if (authData.rpIdHash !== this._hashRpId(expectedRpId)) {
      riskFlags.push(RISK_FLAGS.RP_ID_MISMATCH);
      throw new WebAuthnValidationError(
        'RP ID 不匹配',
        'RP_ID_MISMATCH',
        riskFlags
      );
    }

    if (storedCredential.isRevoked) {
      riskFlags.push(RISK_FLAGS.CREDENTIAL_REVOKED);
      throw new WebAuthnValidationError(
        '凭据已被撤销',
        'CREDENTIAL_REVOKED',
        riskFlags
      );
    }

    if (authData.signCount > 0 && storedCredential.signCount > 0) {
      if (authData.signCount <= storedCredential.signCount) {
        riskFlags.push(RISK_FLAGS.SIGN_COUNT_ROLLBACK);
        throw new WebAuthnValidationError(
          `签名计数器倒退: 存储值 ${storedCredential.signCount}, 收到值 ${authData.signCount}`,
          'SIGN_COUNT_ROLLBACK',
          riskFlags
        );
      }
    }

    const signature = Buffer.from(response.response.signature, 'base64url');
    const clientDataJSONBuffer = Buffer.from(response.response.clientDataJSON, 'base64url');
    const authDataBuffer = Buffer.from(response.response.authenticatorData, 'base64url');
    
    const isValid = this._verifySignature(
      signature,
      authDataBuffer,
      clientDataJSONBuffer,
      storedCredential.publicKey,
      storedCredential.algorithm
    );

    if (!isValid) {
      riskFlags.push(RISK_FLAGS.SIGNATURE_INVALID);
      throw new WebAuthnValidationError(
        '签名验证失败',
        'SIGNATURE_INVALID',
        riskFlags
      );
    }

    return {
      credentialId: Buffer.from(response.id, 'base64url'),
      newSignCount: authData.signCount,
      challengeId: storedChallenge.id,
      riskFlags,
      userPresent: authData.flags.userPresent,
      userVerified: authData.flags.userVerified
    };
  }

  _parseAuthenticatorData(buffer) {
    let offset = 0;

    const rpIdHash = buffer.slice(offset, offset + 32);
    offset += 32;

    const flags = {
      userPresent: (buffer[offset] & 0x01) !== 0,
      userVerified: (buffer[offset] & 0x04) !== 0,
      backupEligibility: (buffer[offset] & 0x08) !== 0,
      backupState: (buffer[offset] & 0x10) !== 0,
      attestedCredentialData: (buffer[offset] & 0x40) !== 0,
      extensionData: (buffer[offset] & 0x80) !== 0
    };
    offset += 1;

    const signCount = buffer.readUInt32BE(offset);
    offset += 4;

    const result = {
      rpIdHash,
      flags,
      signCount
    };

    if (flags.attestedCredentialData) {
      const aaguid = buffer.slice(offset, offset + 16);
      offset += 16;

      const credentialIdLength = buffer.readUInt16BE(offset);
      offset += 2;

      const credentialId = buffer.slice(offset, offset + credentialIdLength);
      offset += credentialIdLength;

      const publicKeyInfo = this._extractPublicKeyFromCOSE(buffer, offset);
      
      result.attestedCredentialData = {
        aaguid,
        credentialId,
        credentialIdLength,
        algorithm: publicKeyInfo.algorithm,
        publicKey: publicKeyInfo.publicKey,
        publicKeyObject: publicKeyInfo.publicKeyObject
      };
    }

    return result;
  }

  _extractPublicKeyFromCOSE(buffer, offset) {
    const coseKey = this._parseCBOR(buffer, offset);
    let algorithm = null;
    let publicKeyBytes = null;

    if (coseKey.value.has(-7)) {
      algorithm = -7;
      const x = coseKey.value.get(-2);
      const y = coseKey.value.get(-3);
      
      publicKeyBytes = Buffer.concat([
        Buffer.from([0x04]),
        x,
        y
      ]);
    } else if (coseKey.value.has(-257)) {
      algorithm = -257;
      const n = coseKey.value.get(-1);
      const e = coseKey.value.get(-2);
      
      publicKeyBytes = this._createRSAPublicKey(n, e);
    }

    return {
      algorithm,
      publicKey: publicKeyBytes,
      publicKeyObject: coseKey
    };
  }

  _parseCBOR(buffer, offset = 0) {
    const firstByte = buffer[offset];
    const majorType = (firstByte >> 5) & 0x07;
    const additionalInfo = firstByte & 0x1F;
    
    offset += 1;
    
    let result;
    let value;

    if (additionalInfo < 24) {
      value = additionalInfo;
    } else if (additionalInfo === 24) {
      value = buffer[offset];
      offset += 1;
    } else if (additionalInfo === 25) {
      value = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (additionalInfo === 26) {
      value = buffer.readUInt32BE(offset);
      offset += 4;
    } else {
      value = 0;
    }

    if (majorType === 2) {
      result = buffer.slice(offset, offset + value);
      offset += value;
    } else if (majorType === 5) {
      const map = new Map();
      for (let i = 0; i < value; i++) {
        const keyResult = this._parseCBOR(buffer, offset);
        offset = keyResult.offset;
        const valResult = this._parseCBOR(buffer, offset);
        offset = valResult.offset;
        map.set(keyResult.value, valResult.value);
      }
      result = map;
    } else {
      result = value;
    }

    return { value: result, offset };
  }

  _createRSAPublicKey(modulus, exponent) {
    return modulus;
  }

  _hashRpId(rpId) {
    return crypto.createHash('sha256').update(rpId).digest();
  }

  _verifySignature(signature, authData, clientDataJSON, publicKey, algorithm) {
    const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
    const signedData = Buffer.concat([authData, clientDataHash]);

    try {
      if (algorithm === -7) {
        const key = crypto.createPublicKey({
          key: this._convertPublicKeyToPEM(publicKey, 'ES256'),
          format: 'pem',
          type: 'spki'
        });
        return crypto.verify('sha256', signedData, key, signature);
      } else if (algorithm === -257) {
        const key = crypto.createPublicKey({
          key: this._convertPublicKeyToPEM(publicKey, 'RS256'),
          format: 'pem',
          type: 'spki'
        });
        return crypto.verify('sha256', signedData, key, signature);
      }
    } catch (e) {
      console.error('签名验证错误:', e);
      return false;
    }

    return false;
  }

  _convertPublicKeyToPEM(publicKeyBytes, algorithm) {
    if (algorithm === 'ES256') {
      const x = publicKeyBytes.slice(1, 33);
      const y = publicKeyBytes.slice(33, 65);
      
      const der = Buffer.concat([
        Buffer.from([0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]),
        Buffer.from([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]),
        Buffer.from([0x03, 0x42, 0x00]),
        publicKeyBytes
      ]);
      
      return this._derToPem(der, 'PUBLIC KEY');
    }
    
    return publicKeyBytes;
  }

  _derToPem(der, type) {
    const base64 = der.toString('base64');
    const lines = base64.match(/.{1,64}/g).join('\n');
    return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
  }

  _parseAttestationObject(buffer) {
    const attestation = this._parseCBOR(buffer, 0);
    return attestation.value;
  }
}

module.exports = {
  WebAuthnService: new WebAuthnService(),
  WebAuthnValidationError,
  COSE_ALGORITHMS
};
