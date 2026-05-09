import { Controller, Post, Get, Query, Body, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExportService, ExportOptions, ExportFormat } from './export.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestId } from '../../common/decorators/user.decorator';
import { User, UserRole, AuditOperation, AuditEntity } from '@prisma/client';
import { SetMetadata } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { Response } from 'express';
import { QueueService } from '../../infrastructure/queue/queue.service';

const ROLES_KEY = 'roles';
const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

class ExportRequestDto {
  format: ExportFormat;
  storeId?: string;
  startTime?: string;
  endTime?: string;
  includeRecords?: boolean;
  includeTransfers?: boolean;
}

@ApiTags('报表导出')
@ApiBearerAuth()
@Controller('export')
@UseGuards(AuthGuard)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly auditService: AuditService,
    private readonly queueService: QueueService,
  ) {}

  @Post('inventory')
  @ApiOperation({ summary: '导出库存报表' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async exportInventory(
    @Body() dto: ExportRequestDto,
    @CurrentUser() user: User,
    @RequestId() requestId: string,
    @Res() res: Response,
  ) {
    const options: ExportOptions = {
      format: dto.format,
      storeId: dto.storeId,
      startTime: dto.startTime ? new Date(dto.startTime) : undefined,
      endTime: dto.endTime ? new Date(dto.endTime) : undefined,
      includeRecords: dto.includeRecords !== false,
      includeTransfers: dto.includeTransfers !== false,
    };

    const result = await this.exportService.exportInventory(options);

    await this.auditService.log({
      requestId,
      operation: AuditOperation.EXPORT,
      entity: AuditEntity.INVENTORY,
      userId: user.id,
      operatorName: user.name,
      remark: `导出库存报表: ${dto.format}`,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    );

    return res.send(result.data);
  }

  @Post('inventory/async')
  @ApiOperation({ summary: '异步导出库存报表' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.ACCEPTED)
  async exportInventoryAsync(
    @Body() dto: ExportRequestDto,
    @CurrentUser() user: User,
    @RequestId() requestId: string,
  ) {
    const taskId = await this.queueService.addTask(
      'export',
      `导出库存报表 - ${dto.format}`,
      'export_inventory',
      {
        requestId,
        userId: user.id,
        data: {
          format: dto.format,
          storeId: dto.storeId,
          startTime: dto.startTime,
          endTime: dto.endTime,
          includeRecords: dto.includeRecords,
          includeTransfers: dto.includeTransfers,
        },
      },
    );

    return {
      success: true,
      data: { taskId },
      message: '导出任务已提交，请稍后查看结果',
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tasks')
  @ApiOperation({ summary: '获取导出任务列表' })
  @HttpCode(HttpStatus.OK)
  async getTasks(
    @CurrentUser() user: User,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.queueService.listTasks(undefined, limit, offset);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: '获取任务状态' })
  @HttpCode(HttpStatus.OK)
  async getTaskStatus(@Param('taskId') taskId: string) {
    const result = await this.queueService.getTaskStatus(taskId);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
