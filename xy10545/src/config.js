module.exports = {
  PORT: process.env.PORT || 3001,
  DB_PATH: process.env.DB_PATH || './data/conversations.json',
  EMOTION_PRIORITY: {
    'angry': 10,
    'frustrated': 8,
    'anxious': 7,
    'confused': 5,
    'neutral': 3,
    'happy': 1
  },
  MAX_QUEUE_SIZE: 50,
  IDEMPOTENCY_TTL_HOURS: 24,
  AGENT_RESPONSE_TIMEOUT_SECONDS: 300
};
