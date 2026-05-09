import { Module } from '@nestjs/common';
import { PackingListComparisonController } from './packing-list-comparison.controller';
import { PackingListComparisonService } from './packing-list-comparison.service';
import { VersionManagementModule } from '../version-management/version-management.module';

@Module({
  imports: [VersionManagementModule],
  controllers: [PackingListComparisonController],
  providers: [PackingListComparisonService],
  exports: [PackingListComparisonService],
})
export class PackingListComparisonModule {}
