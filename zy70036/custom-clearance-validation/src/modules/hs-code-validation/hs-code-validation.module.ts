import { Module } from '@nestjs/common';
import { HsCodeValidationController } from './hs-code-validation.controller';
import { HsCodeValidationService } from './hs-code-validation.service';
import { VersionManagementModule } from '../version-management/version-management.module';

@Module({
  imports: [VersionManagementModule],
  controllers: [HsCodeValidationController],
  providers: [HsCodeValidationService],
  exports: [HsCodeValidationService],
})
export class HsCodeValidationModule {}
