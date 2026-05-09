import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VersionManagementService, VersionConsistencyInfo } from './version-management.service';

@ApiTags('资料版本一致性校验')
@Controller('version-management')
export class VersionManagementController {
  constructor(private readonly versionService: VersionManagementService) {}

  @Get('batch/:batchId/consistency')
  @ApiOperation({ summary: '检查批次资料版本一致性' })
  checkConsistency(@Param('batchId') batchId: string): Promise<VersionConsistencyInfo> {
    return this.versionService.getVersionConsistency(batchId);
  }

  @Get('batch/:batchId/summary')
  @ApiOperation({ summary: '获取批次资料版本摘要' })
  checkVersions(@Param('batchId') batchId: string): Promise<{
    hasInvoice: boolean;
    hasPackingList: boolean;
    hasHsCodes: boolean;
    latestInvoiceVersion: number;
    latestPackingListVersion: number;
    latestHsCodeVersion: number;
  }> {
    return this.versionService.checkVersions(batchId);
  }
}
