import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportTask } from './entities/export-task.entity';
import { Certificate } from '../certificate/entities/certificate.entity';
import { CertificateDuplicate } from '../certificate/entities/certificate-duplicate.entity';
import { FlowHistory } from '../history/entities/flow-history.entity';
import { ReviewTask } from '../review/entities/review-task.entity';
import { ExportService } from './services/export.service';
import { ExportController } from './controllers/export.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExportTask,
      Certificate,
      CertificateDuplicate,
      FlowHistory,
      ReviewTask,
    ]),
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
