import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { IdempotencyRequest } from './idempotency-request.entity';
import * as crypto from 'crypto';

export interface CreateOrGetResult {
  existing: boolean;
  response?: any;
  isCompleted: boolean;
}

@Injectable()
export class IdempotencyService {
  private readonly EXPIRATION_HOURS = 24;

  constructor(
    @InjectRepository(IdempotencyRequest)
    private readonly idempotencyRequestRepository: Repository<IdempotencyRequest>,
  ) {}

  async createOrGetRequest(
    requestId: string,
    userId: string,
    endpoint: string,
  ): Promise<CreateOrGetResult> {
    const key = this.generateKey(requestId, userId, endpoint);

    try {
      const existing = await this.idempotencyRequestRepository.findOne({
        where: { id: key },
      });

      if (existing) {
        if (existing.expiresAt < new Date()) {
          await this.idempotencyRequestRepository.remove(existing);
        } else {
          return {
            existing: true,
            response: existing.response,
            isCompleted: !!existing.response,
          };
        }
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.EXPIRATION_HOURS * 60 * 60 * 1000);

      const pendingRequest = this.idempotencyRequestRepository.create({
        id: key,
        userId,
        endpoint,
        createdAt: now,
        expiresAt,
        response: null,
      });

      await this.idempotencyRequestRepository
        .createQueryBuilder()
        .insert()
        .into(IdempotencyRequest)
        .values(pendingRequest)
        .orIgnore()
        .execute();

      const finalRecord = await this.idempotencyRequestRepository.findOne({
        where: { id: key },
      });

      if (finalRecord) {
        return {
          existing: !!finalRecord.response,
          response: finalRecord.response,
          isCompleted: !!finalRecord.response,
        };
      }

      return {
        existing: false,
        isCompleted: false,
      };
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const finalRecord = await this.idempotencyRequestRepository.findOne({
          where: { id: key },
        });

        if (finalRecord) {
          return {
            existing: !!finalRecord.response,
            response: finalRecord.response,
            isCompleted: !!finalRecord.response,
          };
        }
      }
      throw error;
    }
  }

  async markRequestCompleted(
    requestId: string,
    userId: string,
    endpoint: string,
    response: any,
  ): Promise<void> {
    const key = this.generateKey(requestId, userId, endpoint);

    try {
      await this.idempotencyRequestRepository
        .createQueryBuilder()
        .update(IdempotencyRequest)
        .set({ response })
        .where('id = :id', { id: key })
        .execute();
    } catch (error) {
      console.error('标记幂等请求完成失败:', error);
    }
  }

  async getResponse(
    requestId: string,
    userId: string,
    endpoint: string,
  ): Promise<any | null> {
    const key = this.generateKey(requestId, userId, endpoint);
    const existing = await this.idempotencyRequestRepository.findOne({
      where: { id: key },
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
