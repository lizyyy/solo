import { Module, OnModuleInit } from '@nestjs/common';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../../infrastructure/queue/queue.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, QueueModule, AuditModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule implements OnModuleInit {
  constructor(
    private queueService: any,
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
