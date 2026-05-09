import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RefundService } from './services/refund.service';
import { BatchOperationService } from './services/batch-operation.service';
import { ImportExportService } from './services/import-export.service';
import { RefundHistoryService } from './services/refund-history.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { UpdateRefundDto } from './dto/update-refund.dto';
import { QueryRefundDto } from './dto/query-refund.dto';
import { StatusTransitionDto } from './dto/status-transition.dto';
import { BatchOperationDto, BatchStatusChangeDto } from './dto/batch-operation.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';

@Controller('refunds')
@UseGuards(AuthGuard('jwt'))
export class RefundController {
  constructor(
    private readonly refundService: RefundService,
    private readonly batchOperationService: BatchOperationService,
    private readonly importExportService: ImportExportService,
    private readonly refundHistoryService: RefundHistoryService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UseGuards(RolesGuard)
  create(@Body() createRefundDto: CreateRefundDto, @CurrentUser() user: any) {
    return this.refundService.create(createRefundDto, user.id, user.username);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR, Role.VIEWER)
  @UseGuards(RolesGuard)
  findAll(@Query() query: QueryRefundDto) {
    return this.refundService.findAll(query);
  }

  @Get('statistics')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  getStatistics() {
    return this.refundService.getStatistics();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR, Role.VIEWER)
  @UseGuards(RolesGuard)
  findOne(@Param('id') id: string) {
    return this.refundService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UseGuards(RolesGuard)
  update(
    @Param('id') id: string,
    @Body() updateRefundDto: UpdateRefundDto,
    @CurrentUser() user: any,
  ) {
    return this.refundService.update(id, updateRefundDto, user.id, user.username, user.role);
  }

  @Post(':id/transition')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UseGuards(RolesGuard)
  transitionStatus(
    @Param('id') id: string,
    @Body() dto: StatusTransitionDto,
    @CurrentUser() user: any,
  ) {
    return this.refundService.transitionStatus(id, dto, user.id, user.username, user.role);
  }

  @Post(':id/retry')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  retry(@Param('id') id: string, @CurrentUser() user: any) {
    return this.refundService.retryRefund(id, user.id, user.username);
  }

  @Get(':id/history')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR, Role.VIEWER)
  @UseGuards(RolesGuard)
  getHistory(@Param('id') id: string) {
    return this.refundHistoryService.findByRefundId(id);
  }

  @Post('batch/transition')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  batchStatusChange(@Body() dto: BatchStatusChangeDto, @CurrentUser() user: any) {
    return this.batchOperationService.batchStatusChange(
      dto,
      user.id,
      user.username,
      user.role,
    );
  }

  @Post('batch/cancel')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  batchCancel(@Body() dto: BatchOperationDto, @CurrentUser() user: any) {
    return this.batchOperationService.batchCancel(dto, user.id, user.username, user.role);
  }

  @Post('batch/approve')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  batchApprove(@Body() dto: BatchOperationDto, @CurrentUser() user: any) {
    return this.batchOperationService.batchApprove(dto, user.id, user.username, user.role);
  }

  @Post('batch/retry')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  batchRetry(@Body() dto: BatchOperationDto, @CurrentUser() user: any) {
    return this.batchOperationService.batchRetry(dto, user.id, user.username, user.role);
  }

  @Get('export/csv')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UseGuards(RolesGuard)
  async exportCSV(@Query() query: QueryRefundDto, @CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.importExportService.exportToCSV(query, user.id, user.username);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=refunds-${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  }

  @Get('export/excel')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UseGuards(RolesGuard)
  async exportExcel(@Query() query: QueryRefundDto, @CurrentUser() user: any, @Res() res: Response) {
    const buffer = await this.importExportService.exportToExcel(query, user.id, user.username);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=refunds-${Date.now()}.xlsx`);
    res.send(buffer);
  }

  @Post('import/csv')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importCSV(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    const csvContent = file.buffer.toString('utf8');
    return this.importExportService.importFromCSV(csvContent, user.id, user.username, user.role);
  }

  @Post('import/excel')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OPERATOR)
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    return this.importExportService.importFromExcel(file.buffer, user.id, user.username, user.role);
  }
}
