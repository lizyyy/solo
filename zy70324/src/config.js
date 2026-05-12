module.exports = {
  server: {
    port: 3000,
  },
  healthCheck: {
    defaultFrequencyMinutes: 15,
    minFrequencyMinutes: 1,
    maxFrequencyMinutes: 1440,
    timeoutSeconds: 10,
    successCodes: [200, 201, 202, 203, 204, 205, 206, 207, 208, 226],
    maxResponseTimeMs: 5000,
    slowResponseTimeMs: 1000,
    consecutiveFailuresToBlock: 5,
    consecutiveFailuresToNotify: 2,
    networkJitterTolerance: 1,
    certificateExpiryWarningDays: 14,
  },
  database: {
    path: './data/db.json',
  },
  notification: {
    enabled: true,
    email: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'notifications@example.com',
      pass: 'password',
      from: 'Open Platform <notifications@example.com>',
    },
  },
};