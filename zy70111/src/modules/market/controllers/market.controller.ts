import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { MarketService } from '../services/market.service';
import { MarketInspectionDto, MarketQueryDto } from '../dto/market.dto';
import { CurrentUser } from '../../../common/decorators';
import { UserContext } from '../../../common/types';

@ApiTags('市场验收')
@Controller('market-inspections')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Post()
  @ApiOperation({ summary: '市场验收（检疫证最终落地核验）' })
  async inspect(
    @Body() dto: MarketInspectionDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.marketService.inspect(dto, user);
  }

  @Get('id/:id')
  @ApiOperation({ summary: '查询验收记录详情' })
  @ApiParam({ name: 'id', description: '验收记录ID' })
  async getById(@Param('id') id: string) {
    return this.marketService.findById(id);
  }

  @Get('query')
  @ApiOperation({ summary: '分页查询验收记录' })
  async query(@Query() query: MarketQueryDto) {
    return this.marketService.query(query);
  }
}
