import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('报告')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('group/:groupId/excel')
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async exportExcel(
    @Param('groupId') groupId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Request() req?: any,
    @Res() res?: Response,
  ) {
    const buffer = await this.reportsService.generateExcelReport(
      groupId,
      req.user.id,
      startDate,
      endDate,
    );

    const fileName = `账单报告_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    res.send(buffer);
  }
}
