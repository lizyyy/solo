import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IdempotencyRequest } from './idempotency-request.entity';
import * as crypto from 'crypto';

@Injectable()
export class IdempotencyService {
  private readonly EXPIRATION_HOURS = 24;

  constructor(
    @InjectRepository(IdempotencyRequest)
    private readonly idempotencyRequestRepository: Repository<IdempotencyRequest>,
  ) {}

  async getResponse(
    requestId: string,
    userId: string,
    endpoint: string,
  ): Promise<any | null> {
    const existing = await this.idempotencyRequestRepository.findOne({
      where: { id: this.generateKey(requestId, userId, endpoint) },
    });

    if (!existing) {
      return null;
    }

    if (existing.expiresAt < new Date()) {
      await this.idempotencyRequestRepository.remove(existing);
      return null;
    }

    return existing.response;
  }

  async saveResponse(
    requestId: string,
    userId: string,
    endpoint: string,
    response: any,
  ): Promise<void> {
    const key = this.generateKey(requestId, userId, endpoint);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.EXPIRATION_HOURS * 60 * 60 * 1000);

    const idempotencyRequest = this.idempotencyRequestRepository.create({
      id: key,
      userId,
      endpoint,
      createdAt: now,
      expiresAt,
      response,
    });

    try {
      await this.idempotencyRequestRepository
        .createQueryBuilder()
        .insert()
        .into(IdempotencyRequest)
        .values(idempotencyRequest)
        .orIgnore()
        .execute();
    } catch (error) {
      console.error('保存幂等请求失败:', error);
    }
  }

  async cleanupExpired(): Promise<void> {
    await this.idempotencyRequestRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();
  }

  private generateKey(
    requestId: string,
    userId: string,
    endpoint: string,
  ): string {
    return crypto
      .createHash('sha256')
      .update(`${requestId}:${userId}:${endpoint}`)
      .digest('hex');
  }
}
