import { Controller, Post, Get, Patch, Body, Param, Query, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CertificateService } from '../services/certificate.service';
import {
  CreateCertificateDto,
  UpdateCertificateDto,
  ManualCorrectionDto,
  CertificateQueryDto,
  ProcessingResultDto,
} from '../dto/certificate.dto';
import { CurrentUser } from '../../../common/decorators';
import { UserContext } from '../../../common/types';

@ApiTags('检疫证管理')
@Controller('certificates')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '录入检疫证（检疫证号入口）' })
  @ApiResponse({ status: 201, description: '录入成功', type: ProcessingResultDto })
  @ApiResponse({ status: 409, description: '证号重复，需要人工复核' })
  async create(
    @Body() dto: CreateCertificateDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.certificateService.create(dto, user);
  }

  @Get('detail/:certificateNumber')
  @ApiOperation({ summary: '查询检疫证详情（含重复记录和流转历史）' })
  @ApiParam({ name: 'certificateNumber', description: '检疫证号' })
  async getDetail(@Param('certificateNumber') certificateNumber: string) {
    return this.certificateService.getCertificateDetail(certificateNumber);
  }

  @Get('id/:id')
  @ApiOperation({ summary: '通过ID查询检疫证' })
  @ApiParam({ name: 'id', description: '检疫证ID' })
  async getById(@Param('id') id: string) {
    return this.certificateService.findById(id);
  }

  @Get('number/:certificateNumber')
  @ApiOperation({ summary: '通过证号查询所有记录' })
  @ApiParam({ name: 'certificateNumber', description: '检疫证号' })
  async getByNumber(@Param('certificateNumber') certificateNumber: string) {
    return this.certificateService.findByNumber(certificateNumber);
  }

  @Get('query')
  @ApiOperation({ summary: '分页查询检疫证列表' })
  async query(@Query() query: CertificateQueryDto) {
    return this.certificateService.query(query);
  }

  @Patch(':id/manual-correction')
  @ApiOperation({ summary: '人工修正检疫证' })
  @ApiParam({ name: 'id', description: '检疫证ID' })
  async manualCorrection(
    @Param('id') id: string,
    @Body() dto: ManualCorrectionDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.certificateService.manualCorrection(id, dto, user);
  }

  @Get('statistics')
  @ApiOperation({ summary: '获取检疫证统计数据' })
  async getStatistics() {
    return this.certificateService.getStatistics();
  }
}
