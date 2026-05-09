import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PackingListService } from './packing-list.service';
import {
  CreatePackingListDto,
  UpdatePackingListDto,
  PackingListFilterDto,
} from './dto/packing-list.dto';
import { PackingList } from '../../entities/packing-list.entity';
import { DocumentStatus } from '../../entities/invoice.entity';

@ApiTags('箱单版本管理')
@Controller('packing-lists')
export class PackingListController {
  constructor(private readonly packingListService: PackingListService) {}

  @Post()
  @ApiOperation({ summary: '创建箱单（新版本）' })
  create(@Body() dto: CreatePackingListDto): Promise<PackingList> {
    return this.packingListService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询箱单列表' })
  findAll(@Query() filter: PackingListFilterDto): Promise<PackingList[]> {
    return this.packingListService.findAll(filter);
  }

  @Get('batch/:batchId')
  @ApiOperation({ summary: '按批次查询所有箱单版本' })
  findByBatch(@Param('batchId') batchId: string): Promise<PackingList[]> {
    return this.packingListService.findByBatch(batchId);
  }

  @Get('batch/:batchId/latest')
  @ApiOperation({ summary: '查询批次最新箱单版本' })
  findLatestByBatch(@Param('batchId') batchId: string): Promise<PackingList | null> {
    return this.packingListService.findLatestByBatch(batchId);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询箱单详情' })
  findOne(@Param('id') id: string): Promise<PackingList> {
    return this.packingListService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新箱单' })
  update(@Param('id') id: string, @Body() dto: UpdatePackingListDto): Promise<PackingList> {
    return this.packingListService.update(id, dto);
  }

  @Patch(':id/status/:status')
  @ApiOperation({ summary: '更新箱单状态' })
  updateStatus(
    @Param('id') id: string,
    @Param('status') status: DocumentStatus,
  ): Promise<PackingList> {
    return this.packingListService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除箱单' })
  remove(@Param('id') id: string): Promise<void> {
    return this.packingListService.remove(id);
  }
}
