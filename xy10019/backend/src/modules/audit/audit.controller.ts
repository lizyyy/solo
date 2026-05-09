import { Controller, Get, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditOperation, AuditEntity } from '@prisma/client';
import { success } from '../../common/types/api-response.type';

@ApiTags('审计日志')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: '查询审计日志' })
  @ApiQuery({ name: 'operation', required: false, enum: AuditOperation })
  @ApiQuery({ name: 'entity', required: false, enum: AuditEntity })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'startTime', required: false })
  @ApiQuery({ name: 'endTime', required: false })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @HttpCode(HttpStatus.OK)
  async query(
    @Query('operation') operation?: AuditOperation,
    @Query('entity') entity?: AuditEntity,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('keyword') keyword?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.auditService.query(
      {
        operation,
        entity,
        entityId,
        userId,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        keyword,
      },
      limit,
      offset,
    );

    return success(result);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取审计日志详情' })
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    const result = await this.auditService.findById(id);
    return success(result);
  }

  @Get('request/:requestId')
  @ApiOperation({ summary: '按请求ID查询审计日志' })
  @HttpCode(HttpStatus.OK)
  async findByRequestId(@Param('requestId') requestId: string) {
    const result = await this.auditService.findByRequestId(requestId);
    return success(result);
  }

  @Get('entity/:entity/:entityId')
  @ApiOperation({ summary: '查询实体的审计日志' })
  @HttpCode(HttpStatus.OK)
  async findByEntity(
    @Param('entity') entity: AuditEntity,
    @Param('entityId') entityId: string,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.auditService.findByEntity(entity, entityId, limit, offset);
    return success(result);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: '查询用户的操作日志' })
  @HttpCode(HttpStatus.OK)
  async findByUser(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.auditService.findByUser(userId, limit, offset);
    return success(result);
  }

  @Get('replay/:id')
  @ApiOperation({ summary: '回放单个操作' })
  @HttpCode(HttpStatus.OK)
  async replayOperation(@Param('id') id: string) {
    const result = await this.auditService.replayOperation(id);
    return success(result);
  }

  @Get('replay/request/:requestId')
  @ApiOperation({ summary: '回放整个请求' })
  @HttpCode(HttpStatus.OK)
  async replayRequest(@Param('requestId') requestId: string) {
    const result = await this.auditService.replayRequest(requestId);
    return success(result);
  }

  @Get('history/:entity/:entityId')
  @ApiOperation({ summary: '获取实体历史版本' })
  @HttpCode(HttpStatus.OK)
  async getEntityHistory(
    @Param('entity') entity: AuditEntity,
    @Param('entityId') entityId: string,
  ) {
    const result = await this.auditService.getEntityHistory(entity, entityId);
    return success(result);
  }

  @Get('snapshot/:entity/:entityId')
  @ApiOperation({ summary: '获取实体在指定时间点的快照' })
  @HttpCode(HttpStatus.OK)
  async getEntityAtPointInTime(
    @Param('entity') entity: AuditEntity,
    @Param('entityId') entityId: string,
    @Query('timestamp') timestamp: string,
  ) {
    const result = await this.auditService.getEntityAtPointInTime(
      entity,
      entityId,
      new Date(timestamp),
    );
    return success(result);
  }

  @Get('summary/:entity/:entityId')
  @ApiOperation({ summary: '获取实体操作统计' })
  @HttpCode(HttpStatus.OK)
  async getOperationSummary(
    @Param('entity') entity: AuditEntity,
    @Param('entityId') entityId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const result = await this.auditService.getOperationSummary(
      entity,
      entityId,
      new Date(startDate),
      new Date(endDate),
    );
    return success(result);
  }
}
