import redisClient from '../utils/redis';
import logger from '../utils/logger';

class SequenceService {
  private readonly SEQUENCE_KEY_PREFIX = 'sequence:room:';

  async getNextSequence(roomId: string): Promise<number> {
    const redis = redisClient.getClient();
    const key = `${this.SEQUENCE_KEY_PREFIX}${roomId}`;
    
    try {
      const sequence = await redis.incr(key);
      logger.debug('Generated sequence', { roomId, sequence });
      return sequence;
    } catch (error) {
      logger.error('Failed to generate sequence', error as Error, { roomId });
      throw error;
    }
  }

  async getCurrentSequence(roomId: string): Promise<number> {
    const redis = redisClient.getClient();
    const key = `${this.SEQUENCE_KEY_PREFIX}${roomId}`;
    
    const value = await redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  async resetSequence(roomId: string): Promise<void> {
    const redis = redisClient.getClient();
    const key = `${this.SEQUENCE_KEY_PREFIX}${roomId}`;
    
    await redis.del(key);
    logger.info('Sequence reset', { roomId });
  }

  async setSequence(roomId: string, sequence: number): Promise<void> {
    const redis = redisClient.getClient();
    const key = `${this.SEQUENCE_KEY_PREFIX}${roomId}`;
    
    await redis.set(key, sequence);
    logger.info('Sequence set', { roomId, sequence });
  }
}

export default new SequenceService();
