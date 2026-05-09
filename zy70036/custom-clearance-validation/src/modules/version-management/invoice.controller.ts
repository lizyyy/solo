import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvoiceService } from './invoice.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceFilterDto,
} from './dto/invoice.dto';
import { Invoice, DocumentStatus } from '../../entities/invoice.entity';

@ApiTags('发票版本管理')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @ApiOperation({ summary: '创建发票（新版本）' })
  create(@Body() dto: CreateInvoiceDto): Promise<Invoice> {
    return this.invoiceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询发票列表' })
  findAll(@Query() filter: InvoiceFilterDto): Promise<Invoice[]> {
    return this.invoiceService.findAll(filter);
  }

  @Get('batch/:batchId')
  @ApiOperation({ summary: '按批次查询所有发票版本' })
  findByBatch(@Param('batchId') batchId: string): Promise<Invoice[]> {
    return this.invoiceService.findByBatch(batchId);
  }

  @Get('batch/:batchId/latest')
  @ApiOperation({ summary: '查询批次最新发票版本' })
  findLatestByBatch(@Param('batchId') batchId: string): Promise<Invoice | null> {
    return this.invoiceService.findLatestByBatch(batchId);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询发票详情' })
  findOne(@Param('id') id: string): Promise<Invoice> {
    return this.invoiceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新发票' })
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto): Promise<Invoice> {
    return this.invoiceService.update(id, dto);
  }

  @Patch(':id/status/:status')
  @ApiOperation({ summary: '更新发票状态' })
  updateStatus(
    @Param('id') id: string,
    @Param('status') status: DocumentStatus,
  ): Promise<Invoice> {
    return this.invoiceService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除发票' })
  remove(@Param('id') id: string): Promise<void> {
    return this.invoiceService.remove(id);
  }
}
