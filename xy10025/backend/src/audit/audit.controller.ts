import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GroupsService } from '../groups/groups.service';

@ApiTags('审计日志')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly groupsService: GroupsService,
  ) {}

  @Get('group/:groupId')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getGroupLogs(
    @Param('groupId') groupId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Request() req,
  ) {
    const isMember = await this.groupsService.isGroupMember(
      groupId,
      req.user.id,
    );
    if (!isMember) {
      throw new ForbiddenException('您不是该分组成员');
    }

    return this.auditService.findByGroup(
      groupId,
      req.user.id,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('my')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Request() req,
  ) {
    return this.auditService.findByUser(req.user.id, parseInt(page), parseInt(limit));
  }
}
