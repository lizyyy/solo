import { Module } from '@nestjs/common';
import { MissingComponentController } from './missing-component.controller';
import { MissingComponentService } from './missing-component.service';
import { VersionManagementModule } from '../version-management/version-management.module';

@Module({
  imports: [VersionManagementModule],
  controllers: [MissingComponentController],
  providers: [MissingComponentService],
  exports: [MissingComponentService],
})
export class MissingComponentModule {}
