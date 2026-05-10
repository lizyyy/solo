import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { VoidService } from '../services/void.service';
import { VoidCertificateDto, ReissueCertificateDto } from '../dto/void.dto';
import { CurrentUser } from '../../../common/decorators';
import { UserContext } from '../../../common/types';

@ApiTags('作废重开')
@Controller('void')
export class VoidController {
  constructor(private readonly voidService: VoidService) {}

  @Post()
  @ApiOperation({ summary: '作废检疫证（支持同时重新开具新证）' })
  async voidCertificate(
    @Body() dto: VoidCertificateDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.voidService.voidCertificate(dto, user);
  }

  @Post('reissue')
  @ApiOperation({ summary: '重新开具检疫证（单独重开接口）' })
  async reissueCertificate(
    @Body() dto: ReissueCertificateDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.voidService.reissueCertificate(dto, user);
  }

  @Get('certificate/:certificateId')
  @ApiOperation({ summary: '查询检疫证的作废记录' })
  @ApiParam({ name: 'certificateId', description: '检疫证ID' })
  async getByCertificateId(@Param('certificateId') certificateId: string) {
    return this.voidService.findByCertificateId(certificateId);
  }

  @Get('number/:certificateNumber')
  @ApiOperation({ summary: '通过证号查询作废记录' })
  @ApiParam({ name: 'certificateNumber', description: '检疫证号' })
  async getByCertificateNumber(@Param('certificateNumber') certificateNumber: string) {
    return this.voidService.findByCertificateNumber(certificateNumber);
  }
}
