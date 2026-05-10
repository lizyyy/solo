import { Module, OnModuleInit } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { AuthModule } from '../auth/auth.module';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule implements OnModuleInit {
  constructor(
    private queueService: QueueService,
    private exportService: ExportService,
  ) {}

  onModuleInit() {
    this.queueService.registerWorker(
      'export',
      {
        handle: async (payload: any) => {
          const options = {
            format: payload.data.format,
            storeId: payload.data.storeId,
            startTime: payload.data.startTime ? new Date(payload.data.startTime) : undefined,
            endTime: payload.data.endTime ? new Date(payload.data.endTime) : undefined,
            includeRecords: payload.data.includeRecords,
            includeTransfers: payload.data.includeTransfers,
          };

          const result = await this.exportService.exportInventory(options);
          return {
            filename: result.filename,
            contentType: result.contentType,
            size: result.data.length,
          };
        },
      },
      2,
    );
  }
}
