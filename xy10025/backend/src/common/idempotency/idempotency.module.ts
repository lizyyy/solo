import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyRequest } from './idempotency-request.entity';
import { BillsModule } from '../../bills/bills.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdempotencyRequest]),
    forwardRef(() => BillsModule),
  ],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
