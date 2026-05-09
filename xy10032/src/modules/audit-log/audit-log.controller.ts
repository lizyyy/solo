import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditLogService } from './audit-log.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { LogLevel } from '../../common/enums/log-level.enum';

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findAll(
    @Query('level') level?: LogLevel,
    @Query('actionType') actionType?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('performedById') performedById?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditLogService.findAll({
      level,
      actionType,
      entityType,
      entityId,
      performedById,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('refund/:refundId')
  async findByRefundId(@Query('refundId') refundId: string) {
    return this.auditLogService.findByRefundId(refundId);
  }
}
