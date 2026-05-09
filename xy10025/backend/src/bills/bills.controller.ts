import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { BillsService } from './bills.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';

@ApiTags('账单')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get('group/:groupId')
  async findByGroup(@Param('groupId') groupId: string, @Request() req) {
    return this.billsService.findByGroup(groupId, req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.billsService.findOne(id, req.user.id);
  }

  @Post()
  @ApiHeader({ name: 'X-Request-Id', required: false, description: '幂等请求ID' })
  async create(
    @Body() dto: CreateBillDto,
    @Request() req,
    @Headers('x-request-id') headerRequestId?: string,
  ) {
    const requestId = dto.requestId || headerRequestId;
    return this.billsService.create({ ...dto, requestId }, req.user.id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBillDto,
    @Request() req,
  ) {
    return this.billsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    return this.billsService.delete(id, req.user.id);
  }

  @Post(':id/settle')
  async settle(@Param('id') id: string, @Request() req) {
    return this.billsService.settle(id, req.user.id);
  }

  @Get(':id/history')
  async getHistory(@Param('id') id: string, @Request() req) {
    return this.billsService.getHistory(id, req.user.id);
  }

  @Get('statistics/:groupId')
  async getStatistics(@Param('groupId') groupId: string, @Request() req) {
    return this.billsService.getStatistics(groupId, req.user.id);
  }
}
