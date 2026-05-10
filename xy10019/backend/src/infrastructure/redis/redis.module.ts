import { Module, Global, forwardRef } from '@nestjs/common';
import { RedisService } from './redis.service';
import { DistributedLockService } from './distributed-lock.service';
import { IdempotentService } from './idempotent.service';
import { CacheService } from './cache.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [forwardRef(() => PrismaModule)],
  providers: [RedisService, DistributedLockService, IdempotentService, CacheService],
  exports: [RedisService, DistributedLockService, IdempotentService, CacheService],
})
export class RedisModule {}
