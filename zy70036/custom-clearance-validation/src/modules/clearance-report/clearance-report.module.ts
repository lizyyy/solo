import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClearanceReport } from '../../entities/clearance-report.entity';
import { ClearanceBatchModule } from '../clearance-batch/clearance-batch.module';
import { VersionManagementModule } from '../version-management/version-management.module';
import { HsCodeValidationModule } from '../hs-code-validation/hs-code-validation.module';
import { PackingListComparisonModule } from '../packing-list-comparison/packing-list-comparison.module';
import { MissingComponentModule } from '../missing-component/missing-component.module';
import { ComplianceTaskModule } from '../compliance-task/compliance-task.module';
import { ClearanceReportController } from './clearance-report.controller';
import { ClearanceReportService } from './clearance-report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClearanceReport]),
    ClearanceBatchModule,
    VersionManagementModule,
    HsCodeValidationModule,
    PackingListComparisonModule,
    MissingComponentModule,
    ComplianceTaskModule,
  ],
  controllers: [ClearanceReportController],
  providers: [ClearanceReportService],
  exports: [ClearanceReportService],
})
export class ClearanceReportModule {}
