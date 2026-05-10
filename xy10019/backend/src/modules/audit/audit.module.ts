import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController from './audit.controller';
import { RollbackService } from './rollback.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, RollbackService],
  exports: [AuditService, RollbackService],
})
export class AuditModule {}
