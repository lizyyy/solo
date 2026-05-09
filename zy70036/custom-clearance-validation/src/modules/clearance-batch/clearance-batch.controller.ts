import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClearanceBatchService } from './clearance-batch.service';
import {
  CreateClearanceBatchDto,
  UpdateClearanceBatchDto,
  ClearanceBatchFilterDto,
} from './dto/clearance-batch.dto';
import { ClearanceBatch } from '../../entities/clearance-batch.entity';

@ApiTags('清关批次管理')
@Controller('batches')
export class ClearanceBatchController {
  constructor(private readonly batchService: ClearanceBatchService) {}

  @Post()
  @ApiOperation({ summary: '创建清关批次' })
  create(@Body() dto: CreateClearanceBatchDto): Promise<ClearanceBatch> {
    return this.batchService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询清关批次列表' })
  findAll(@Query() filter: ClearanceBatchFilterDto): Promise<ClearanceBatch[]> {
    return this.batchService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询清关批次详情' })
  findOne(@Param('id') id: string): Promise<ClearanceBatch> {
    return this.batchService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新清关批次' })
  update(@Param('id') id: string, @Body() dto: UpdateClearanceBatchDto): Promise<ClearanceBatch> {
    return this.batchService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除清关批次' })
  remove(@Param('id') id: string): Promise<void> {
    return this.batchService.remove(id);
  }
}
