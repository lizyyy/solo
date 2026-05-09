import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { Refund } from './refund.entity';
import { RefundHistory } from './refund-history.entity';
import { RefundController } from './refund.controller';
import { RefundService } from './services/refund.service';
import { RefundHistoryService } from './services/refund-history.service';
import { StateMachineService } from './services/state-machine.service';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { BatchOperationService } from './services/batch-operation.service';
import { ImportExportService } from './services/import-export.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Refund, RefundHistory]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
    AuditLogModule,
    AuthModule,
  ],
  controllers: [RefundController],
  providers: [
    RefundService,
    RefundHistoryService,
    StateMachineService,
    PaymentGatewayService,
    BatchOperationService,
    ImportExportService,
  ],
  exports: [RefundService],
})
export class RefundModule {}
