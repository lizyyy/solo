import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HsCodeVersionService } from './hs-code-version.service';
import {
  CreateHsCodeVersionDto,
  HsCodeVersionFilterDto,
} from './dto/hs-code-version.dto';
import { HsCodeVersion } from '../../entities/hs-code-version.entity';

@ApiTags('HS编码版本管理')
@Controller('hs-code-versions')
export class HsCodeVersionController {
  constructor(private readonly hsCodeService: HsCodeVersionService) {}

  @Post()
  @ApiOperation({ summary: '创建HS编码版本' })
  create(@Body() dto: CreateHsCodeVersionDto): Promise<HsCodeVersion[]> {
    return this.hsCodeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询HS编码版本列表' })
  findAll(@Query() filter: HsCodeVersionFilterDto): Promise<HsCodeVersion[]> {
    return this.hsCodeService.findAll(filter);
  }

  @Get('batch/:batchId/active')
  @ApiOperation({ summary: '查询批次活跃HS编码' })
  findActiveByBatch(@Param('batchId') batchId: string): Promise<HsCodeVersion[]> {
    return this.hsCodeService.findActiveByBatch(batchId);
  }
}
