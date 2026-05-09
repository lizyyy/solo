import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ComplianceTaskService } from './compliance-task.service';
import {
  CreateComplianceTaskDto,
  UpdateComplianceTaskDto,
  ComplianceTaskFilterDto,
} from './dto/compliance-task.dto';
import { ComplianceTask } from '../../entities/compliance-task.entity';

@ApiTags('补料任务管理')
@Controller('compliance-tasks')
export class ComplianceTaskController {
  constructor(private readonly taskService: ComplianceTaskService) {}

  @Post()
  @ApiOperation({ summary: '创建补料任务' })
  create(@Body() dto: CreateComplianceTaskDto): Promise<ComplianceTask> {
    return this.taskService.create(dto);
  }

  @Post('batch/:batchId/generate')
  @ApiOperation({ summary: '根据缺件检测自动生成补料任务' })
  createFromDetection(@Param('batchId') batchId: string): Promise<ComplianceTask[]> {
    return this.taskService.createFromMissingDetection(batchId);
  }

  @Get()
  @ApiOperation({ summary: '查询补料任务列表' })
  findAll(@Query() filter: ComplianceTaskFilterDto): Promise<ComplianceTask[]> {
    return this.taskService.findAll(filter);
  }

  @Get('batch/:batchId')
  @ApiOperation({ summary: '查询批次补料任务' })
  findByBatch(@Param('batchId') batchId: string): Promise<ComplianceTask[]> {
    return this.taskService.findByBatch(batchId);
  }

  @Get('batch/:batchId/stats')
  @ApiOperation({ summary: '获取批次补料任务统计' })
  getStats(@Param('batchId') batchId: string) {
    return this.taskService.getTaskStats(batchId);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询补料任务详情' })
  findOne(@Param('id') id: string): Promise<ComplianceTask> {
    return this.taskService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新补料任务' })
  update(@Param('id') id: string, @Body() dto: UpdateComplianceTaskDto): Promise<ComplianceTask> {
    return this.taskService.update(id, dto);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: '解决补料任务' })
  resolve(
    @Param('id') id: string,
    @Body() body?: { resolutionNotes?: string },
  ): Promise<ComplianceTask> {
    return this.taskService.resolve(id, body?.resolutionNotes);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: '取消补料任务' })
  cancel(@Param('id') id: string): Promise<ComplianceTask> {
    return this.taskService.cancel(id);
  }
}
