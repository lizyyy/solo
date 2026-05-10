import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ExportService } from '../services/export.service';
import { CreateExportTaskDto, ExportQueryDto } from '../dto/export.dto';
import { CurrentUser } from '../../../common/decorators';
import { UserContext } from '../../../common/types';

@ApiTags('监管导出')
@Controller('exports')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post()
  @ApiOperation({ summary: '创建导出任务（业务复核专用导出）' })
  async createTask(
    @Body() dto: CreateExportTaskDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.exportService.createTask(dto, user);
  }

  @Get('id/:id')
  @ApiOperation({ summary: '查询导出任务详情' })
  @ApiParam({ name: 'id', description: '导出任务ID' })
  async getById(@Param('id') id: string) {
    return this.exportService.findById(id);
  }

  @Get('query')
  @ApiOperation({ summary: '分页查询导出任务列表' })
  async query(@Query() query: ExportQueryDto) {
    return this.exportService.query(query);
  }
}
