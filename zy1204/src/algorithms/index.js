const TokenBucket = require('./tokenBucket');
const LeakyBucket = require('./leakyBucket');
const SlidingWindow = require('./slidingWindow');

const createRateLimiter = (type, config) => {
  switch (type) {
    case 'token_bucket':
      return new TokenBucket(config);
    case 'leaky_bucket':
      return new LeakyBucket(config);
    case 'sliding_window':
      return new SlidingWindow(config);
    default:
      throw new Error(`未知的限流类型: ${type}`);
  }
};

module.exports = {
  TokenBucket,
  LeakyBucket,
  SlidingWindow,
  createRateLimiter
};
