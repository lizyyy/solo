import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ReviewService } from '../services/review.service';
import {
  CreateReviewTaskDto,
  ResolveReviewTaskDto,
  ReviewQueryDto,
} from '../dto/review.dto';
import { CurrentUser } from '../../../common/decorators';
import { UserContext } from '../../../common/types';

@ApiTags('人工复核')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @ApiOperation({ summary: '创建人工复核任务' })
  async createTask(
    @Body() dto: CreateReviewTaskDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.reviewService.createTask(dto, user);
  }

  @Post('resolve')
  @ApiOperation({ summary: '处理复核任务' })
  async resolveTask(
    @Body() dto: ResolveReviewTaskDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.reviewService.resolveTask(dto, user);
  }

  @Get('id/:id')
  @ApiOperation({ summary: '查询复核任务详情' })
  @ApiParam({ name: 'id', description: '复核任务ID' })
  async getById(@Param('id') id: string) {
    return this.reviewService.findById(id);
  }

  @Get('query')
  @ApiOperation({ summary: '分页查询复核任务列表' })
  async query(@Query() query: ReviewQueryDto) {
    return this.reviewService.query(query);
  }

  @Get('statistics')
  @ApiOperation({ summary: '获取复核任务统计' })
  async getStatistics() {
    return this.reviewService.getStatistics();
  }
}
