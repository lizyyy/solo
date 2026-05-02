const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../config');
const storage = require('./storage');

class WebAuthnService {
  constructor() {
    this.rpID = config.rpID;
    this.rpName = config.rpName;
    this.origin = config.origin;
  }

  async generateRegistrationOptions(user, existingCredentials = []) {
    const userHandle = Buffer.from(user.id).toString('base64url');
    
    const options = await generateRegistrationOptions({
      rpID: this.rpID,
      rpName: this.rpName,
      userID: userHandle,
      userName: user.username,
      userDisplayName: user.displayName || user.username,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.credentialID,
        type: 'public-key',
        transports: cred.transports || []
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform'
      }
    });

    return options;
  }

  async verifyRegistrationResponse(user, response, expectedChallenge) {
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        requireUserVerification: false
      });
    } catch (error) {
      throw new Error(`注册验证失败: ${error.message}`);
    }

    const { verified, registrationInfo } = verification;
    
    if (verified && registrationInfo) {
      const { credentialPublicKey, credentialID, counter } = registrationInfo;
      
      return {
        verified: true,
        credential: {
          credentialID: credentialID,
          credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64'),
          counter,
          transports: response.response.transports || [],
          deviceType: registrationInfo.credentialDeviceType || 'singleDevice',
          backedUp: registrationInfo.credentialBackedUp || false
        }
      };
    }

    return { verified: false };
  }

  async generateAuthenticationOptions(userCredentials = []) {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: userCredentials.map(cred => ({
        id: cred.credentialID,
        type: 'public-key',
        transports: cred.transports || []
      })),
      userVerification: 'preferred'
    });

    return options;
  }

  async verifyAuthenticationResponse(credential, response, expectedChallenge) {
    let verification;
    try {
      const credentialPublicKey = Buffer.from(credential.credentialPublicKey, 'base64');
      
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: credential.credentialID,
          publicKey: credentialPublicKey,
          counter: credential.counter || 0,
          transports: credential.transports || []
        },
        requireUserVerification: false
      });
    } catch (error) {
      throw new Error(`认证验证失败: ${error.message}`);
    }

    const { verified, authenticationInfo } = verification;
    
    if (verified && authenticationInfo) {
      return {
        verified: true,
        newCounter: authenticationInfo.newCounter
      };
    }

    return { verified: false };
  }

  simulateRegistration(user, deviceInfo = {}) {
    const credentialID = crypto.randomBytes(32).toString('base64url');
    const keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    const challenge = crypto.randomBytes(32).toString('base64url');

    return {
      options: {
        challenge,
        rp: { id: this.rpID, name: this.rpName },
        user: {
          id: Buffer.from(user.id).toString('base64url'),
          name: user.username,
          displayName: user.displayName || user.username
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        timeout: 60000,
        excludeCredentials: [],
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred'
        },
        attestation: 'none'
      },
      simulatedCredential: {
        credentialID,
        credentialPublicKey: keyPair.publicKey.toString('base64'),
        counter: 0,
        transports: deviceInfo.transports || ['internal', 'hybrid'],
        deviceName: deviceInfo.name || '模拟设备',
        deviceType: deviceInfo.type || 'platform',
        backedUp: deviceInfo.backedUp || false
      },
      challenge
    };
  }

  simulateAuthentication(credential, deviceInfo = {}) {
    const challenge = crypto.randomBytes(32).toString('base64url');

    return {
      options: {
        challenge,
        timeout: 60000,
        rpId: this.rpID,
        allowCredentials: [{
          id: credential.credentialID,
          type: 'public-key',
          transports: credential.transports || []
        }],
        userVerification: 'preferred'
      },
      challenge,
      newCounter: (credential.counter || 0) + 1
    };
  }
}

module.exports = new WebAuthnService();
