import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlowHistory } from './entities/flow-history.entity';
import { AuditLog } from './entities/audit-log.entity';
import { FlowHistoryService } from './services/flow-history.service';
import { AuditLogService } from './services/audit-log.service';
import { HistoryController } from './controllers/history.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([FlowHistory, AuditLog])],
  controllers: [HistoryController],
  providers: [FlowHistoryService, AuditLogService],
  exports: [FlowHistoryService, AuditLogService],
})
export class HistoryModule {}
