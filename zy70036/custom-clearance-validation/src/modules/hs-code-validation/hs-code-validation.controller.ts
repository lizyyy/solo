import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HsCodeValidationService, HsCodeBatchValidationResult } from './hs-code-validation.service';

@ApiTags('HS编码规则校验')
@Controller('hs-code-validation')
export class HsCodeValidationController {
  constructor(private readonly validationService: HsCodeValidationService) {}

  @Get('validate/:hsCode')
  @ApiOperation({ summary: '校验单个HS编码格式' })
  validateHsCode(@Param('hsCode') hsCode: string) {
    return this.validationService.validateHsCodeFormat(hsCode);
  }

  @Post('batch/:batchId')
  @ApiOperation({ summary: '校验批次所有HS编码' })
  validateBatch(
    @Param('batchId') batchId: string,
  ): Promise<HsCodeBatchValidationResult> {
    return this.validationService.validateBatchHsCodes(batchId);
  }
}
