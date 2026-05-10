import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { TransportService } from '../services/transport.service';
import {
  CreateTransportDto,
  VerifyTransportDto,
  TransportQueryDto,
} from '../dto/transport.dto';
import { CurrentUser } from '../../../common/decorators';
import { UserContext } from '../../../common/types';

@ApiTags('运输核销')
@Controller('transports')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Post()
  @ApiOperation({ summary: '创建运输记录（开始运输）' })
  async create(
    @Body() dto: CreateTransportDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.transportService.create(dto, user);
  }

  @Post('verify')
  @ApiOperation({ summary: '运输核销（到达目的地确认）' })
  async verify(
    @Body() dto: VerifyTransportDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.transportService.verifyTransport(dto, user);
  }

  @Get('detail/:transportId')
  @ApiOperation({ summary: '查询运输详情（含批次内检疫证）' })
  @ApiParam({ name: 'transportId', description: '运输记录ID' })
  async getDetail(@Param('transportId') transportId: string) {
    return this.transportService.getTransportDetail(transportId);
  }

  @Get('id/:id')
  @ApiOperation({ summary: '通过ID查询运输记录' })
  @ApiParam({ name: 'id', description: '运输记录ID' })
  async getById(@Param('id') id: string) {
    return this.transportService.findById(id);
  }

  @Get('query')
  @ApiOperation({ summary: '分页查询运输记录' })
  async query(@Query() query: TransportQueryDto) {
    return this.transportService.query(query);
  }
}
