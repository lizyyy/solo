import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceTask } from '../../entities/compliance-task.entity';
import { ClearanceBatchModule } from '../clearance-batch/clearance-batch.module';
import { MissingComponentModule } from '../missing-component/missing-component.module';
import { ComplianceTaskController } from './compliance-task.controller';
import { ComplianceTaskService } from './compliance-task.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ComplianceTask]),
    ClearanceBatchModule,
    MissingComponentModule,
  ],
  controllers: [ComplianceTaskController],
  providers: [ComplianceTaskService],
  exports: [ComplianceTaskService],
})
export class ComplianceTaskModule {}
