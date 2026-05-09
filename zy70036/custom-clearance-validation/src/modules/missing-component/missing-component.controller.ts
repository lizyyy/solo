import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MissingComponentService, MissingComponentResult } from './missing-component.service';

@ApiTags('缺件拦截检测')
@Controller('missing-components')
export class MissingComponentController {
  constructor(private readonly missingComponentService: MissingComponentService) {}

  @Post('batch/:batchId/detect')
  @ApiOperation({ summary: '检测批次缺件' })
  detect(@Param('batchId') batchId: string): Promise<MissingComponentResult> {
    return this.missingComponentService.detectMissingComponents(batchId);
  }

  @Get('batch/:batchId')
  @ApiOperation({ summary: '获取批次缺件检测结果' })
  getResult(@Param('batchId') batchId: string): Promise<MissingComponentResult> {
    return this.missingComponentService.detectMissingComponents(batchId);
  }
}
