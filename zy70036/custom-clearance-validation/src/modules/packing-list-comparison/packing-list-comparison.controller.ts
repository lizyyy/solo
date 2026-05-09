import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PackingListComparisonService, PackingListComparisonResult } from './packing-list-comparison.service';

@ApiTags('箱单比对校验')
@Controller('packing-list-comparison')
export class PackingListComparisonController {
  constructor(private readonly comparisonService: PackingListComparisonService) {}

  @Get('batch/:batchId')
  @ApiOperation({ summary: '比对批次发票与箱单' })
  compareBatch(@Param('batchId') batchId: string): Promise<PackingListComparisonResult> {
    return this.comparisonService.compareBatch(batchId);
  }
}
