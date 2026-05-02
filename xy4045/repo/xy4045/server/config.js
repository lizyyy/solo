const config = {
  server: {
    port: 3000,
    host: 'localhost'
  },
  webauthn: {
    rpId: 'localhost',
    rpName: '无密码登录训练场',
    origin: 'http://localhost:3000',
    challengeTimeout: 5 * 60 * 1000,
    attestation: 'none',
    userVerification: 'preferred'
  },
  database: {
    path: './data/passkey.db.json'
  },
  simulator: {
    enabled: true,
    algorithm: 'ES256'
  }
};

module.exports = config;
