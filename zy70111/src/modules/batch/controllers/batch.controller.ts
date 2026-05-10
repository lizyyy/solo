import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BatchService } from '../services/batch.service';
import {
  CreateBatchDto,
  BindCertificatesDto,
  UnbindCertificatesDto,
  BatchQueryDto,
} from '../dto/batch.dto';
import { CurrentUser } from '../../../common/decorators';
import { UserContext } from '../../../common/types';

@ApiTags('批次管理')
@Controller('batches')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Post()
  @ApiOperation({ summary: '创建运输批次' })
  async create(
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.batchService.create(dto, user);
  }

  @Post('bind')
  @ApiOperation({ summary: '绑定检疫证到批次' })
  async bindCertificates(
    @Body() dto: BindCertificatesDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.batchService.bindCertificates(dto, user);
  }

  @Post('unbind')
  @ApiOperation({ summary: '从批次解绑检疫证' })
  async unbindCertificates(
    @Body() dto: UnbindCertificatesDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.batchService.unbindCertificates(dto, user);
  }

  @Get('detail/:batchId')
  @ApiOperation({ summary: '查询批次详情（含绑定的检疫证）' })
  @ApiParam({ name: 'batchId', description: '批次ID' })
  async getDetail(@Param('batchId') batchId: string) {
    return this.batchService.getBatchDetail(batchId);
  }

  @Get('id/:id')
  @ApiOperation({ summary: '通过ID查询批次' })
  @ApiParam({ name: 'id', description: '批次ID' })
  async getById(@Param('id') id: string) {
    return this.batchService.findById(id);
  }

  @Get('query')
  @ApiOperation({ summary: '分页查询批次列表' })
  async query(@Query() query: BatchQueryDto) {
    return this.batchService.query(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '更新批次状态' })
  @ApiParam({ name: 'id', description: '批次ID' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
    @CurrentUser() user: UserContext,
  ) {
    return this.batchService.updateBatchStatus(id, body.status, user, body.reason);
  }
}
