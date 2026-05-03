import murmurhash from 'murmurhash';

export class HashService {
  constructor() {
    this.seed = 0x12345678;
  }

  consistentHash(userId, flagKey) {
    const combined = `${userId}:${flagKey}`;
    const hash = murmurhash.v3(combined, this.seed);
    const bucket = (hash % 100) + 1;
    return bucket;
  }

  isInPercentage(userId, flagKey, percentage) {
    if (percentage <= 0) return false;
    if (percentage >= 100) return true;
    
    const bucket = this.consistentHash(userId, flagKey);
    return bucket <= percentage;
  }

  getBucket(userId, flagKey) {
    return this.consistentHash(userId, flagKey);
  }
}

export const hashService = new HashService();
