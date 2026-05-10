import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PrismaService } from '../prisma/prisma.service';

export interface IdempotentOptions {
  ttl?: number;
  generateKey?: (...args: any[]) => string;
}

const IDEMPOTENT_PREFIX = 'idempotent:';
const DEFAULT_TTL = 24 * 60 * 60;

@Injectable()
export class IdempotentService {
  constructor(
    @Inject(forwardRef(() => RedisService))
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => PrismaService))
    private readonly prismaService: PrismaService,
  ) {}

  async checkAndSet(
    requestId: string,
    requestKey: string,
  ): Promise<{ isDuplicate: boolean; response?: any }> {
    const cacheKey = `${IDEMPOTENT_PREFIX}${requestKey}`;

    const cached = await this.redisService.getJson<{ response: any }>(cacheKey);
    if (cached && cached.response !== undefined) {
      return { isDuplicate: true, response: cached.response };
    }

    const dbRecord = await this.prismaService.idempotentRequest.findUnique({
      where: { requestKey },
    });

    if (dbRecord) {
      if (dbRecord.status === 'processing') {
        return { isDuplicate: true };
      }
      if (dbRecord.status === 'completed' && dbRecord.response) {
        await this.redisService.setJson(cacheKey, dbRecord, DEFAULT_TTL);
        return { isDuplicate: true, response: dbRecord.response };
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_TTL * 1000);

    try {
      await this.prismaService.idempotentRequest.create({
        data: {
          requestId,
          requestKey,
          status: 'processing',
          createdAt: now,
          expiresAt,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return { isDuplicate: true };
      }
      throw error;
    }

    return { isDuplicate: false };
  }

  async complete(
    requestKey: string,
    response: any,
  ): Promise<void> {
    const cacheKey = `${IDEMPOTENT_PREFIX}${requestKey}`;

    await this.prismaService.idempotentRequest.update({
      where: { requestKey },
      data: {
        status: 'completed',
        response: response as any,
      },
    });

    await this.redisService.setJson(
      cacheKey,
      { response, status: 'completed' },
      DEFAULT_TTL,
    );
  }

  async fail(requestKey: string, error?: string): Promise<void> {
    const cacheKey = `${IDEMPOTENT_PREFIX}${requestKey}`;

    await this.prismaService.idempotentRequest.update({
      where: { requestKey },
      data: {
        status: 'failed',
        response: { error } as any,
      },
    });

    await this.redisService.setJson(
      cacheKey,
      { status: 'failed', error },
      300,
    );
  }

  generateKey(prefix: string, ...params: any[]): string {
    const sorted = [...params].filter(p => p !== undefined && p !== null).sort();
    return `${prefix}:${sorted.join(':')}`;
  }

  async cleanup(): Promise<number> {
    const deleted = await this.prismaService.idempotentRequest.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return deleted.count;
  }
}
