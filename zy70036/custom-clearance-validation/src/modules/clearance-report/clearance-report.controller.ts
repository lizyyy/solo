import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClearanceReportService } from './clearance-report.service';
import { ClearanceReport } from '../../entities/clearance-report.entity';

@ApiTags('清关报告')
@Controller('clearance-reports')
export class ClearanceReportController {
  constructor(private readonly reportService: ClearanceReportService) {}

  @Post('batch/:batchId/generate')
  @ApiOperation({ summary: '生成批次清关报告' })
  generate(@Param('batchId') batchId: string): Promise<ClearanceReport> {
    return this.reportService.generateReport(batchId);
  }

  @Get()
  @ApiOperation({ summary: '查询清关报告列表' })
  findAll(@Query('batchId') batchId?: string): Promise<ClearanceReport[]> {
    return this.reportService.findAll(batchId);
  }

  @Get('batch/:batchId')
  @ApiOperation({ summary: '查询批次所有清关报告' })
  findByBatch(@Param('batchId') batchId: string): Promise<ClearanceReport[]> {
    return this.reportService.findByBatch(batchId);
  }

  @Get('batch/:batchId/latest')
  @ApiOperation({ summary: '查询批次最新清关报告' })
  findLatestByBatch(@Param('batchId') batchId: string): Promise<ClearanceReport | null> {
    return this.reportService.findLatestByBatch(batchId);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询清关报告详情' })
  findOne(@Param('id') id: string): Promise<ClearanceReport> {
    return this.reportService.findOne(id);
  }
}
