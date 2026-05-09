import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { Bill } from './bill.entity';
import { BillShare } from './bill-share.entity';
import { BillVersion } from './bill-version.entity';
import { GroupsModule } from '../groups/groups.module';
import { AuditModule } from '../audit/audit.module';
import { IdempotencyModule } from '../common/idempotency/idempotency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bill, BillShare, BillVersion]),
    GroupsModule,
    AuditModule,
    forwardRef(() => IdempotencyModule),
  ],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
