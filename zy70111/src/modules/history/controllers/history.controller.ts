import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FlowHistoryService } from '../services/flow-history.service';
import { AuditLogService } from '../services/audit-log.service';

@ApiTags('历史记录')
@Controller('history')
export class HistoryController {
  constructor(
    private readonly flowHistoryService: FlowHistoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('flow/:certificateNumber')
  @ApiOperation({ summary: '查询检疫证流转历史' })
  @ApiParam({ name: 'certificateNumber', description: '检疫证号' })
  async getFlowHistory(@Param('certificateNumber') certificateNumber: string) {
    return this.flowHistoryService.getCertificateFullTimeline(certificateNumber);
  }

  @Get('flow/id/:certificateId')
  @ApiOperation({ summary: '通过ID查询检疫证流转历史' })
  @ApiParam({ name: 'certificateId', description: '检疫证ID' })
  async getFlowHistoryById(@Param('certificateId') certificateId: string) {
    return this.flowHistoryService.findByCertificateId(certificateId);
  }

  @Get('manual-correction/:certificateId')
  @ApiOperation({ summary: '查询人工修正历史' })
  @ApiParam({ name: 'certificateId', description: '检疫证ID' })
  async getManualCorrectionHistory(@Param('certificateId') certificateId: string) {
    return this.flowHistoryService.findManualCorrectionHistory(certificateId);
  }

  @Get('audit/entity/:entityType/:entityId')
  @ApiOperation({ summary: '查询实体审计日志' })
  @ApiParam({ name: 'entityType', description: '实体类型' })
  @ApiParam({ name: 'entityId', description: '实体ID' })
  async getEntityAuditLog(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.findByEntity(entityType as any, entityId);
  }
}
