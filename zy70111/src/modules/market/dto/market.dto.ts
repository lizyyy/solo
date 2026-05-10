import { IsString, IsNotEmpty, IsEnum, IsDate, IsOptional, IsNumber, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MarketInspectionResult } from '../../../common/types';

export class MarketInspectionDto {
  @ApiProperty({ description: '检疫证号', example: 'QZ2024010100001' })
  @IsString()
  @IsNotEmpty()
  certificateNumber: string;

  @ApiProperty({ description: '检疫证ID（可选，有证号可自动关联）', required: false })
  @IsUUID()
  @IsOptional()
  certificateId?: string;

  @ApiProperty({ description: '运输记录ID（可选）', required: false })
  @IsUUID()
  @IsOptional()
  transportRecordId?: string;

  @ApiProperty({ description: '验收市场名称', example: '北京新发地农产品批发市场' })
  @IsString()
  @IsNotEmpty()
  marketName: string;

  @ApiProperty({ description: '验收市场ID', required: false })
  @IsString()
  @IsOptional()
  marketId?: string;

  @ApiProperty({ description: '经营户名称', example: '王五猪肉经营部' })
  @IsString()
  @IsNotEmpty()
  merchantName: string;

  @ApiProperty({ description: '经营户ID', required: false })
  @IsString()
  @IsOptional()
  merchantId?: string;

  @ApiProperty({
    description: '验收结果',
    enum: MarketInspectionResult,
    example: MarketInspectionResult.ACCEPTED,
  })
  @IsEnum(MarketInspectionResult)
  result: MarketInspectionResult;

  @ApiProperty({ description: '验收时间', example: '2024-01-17T09:00:00Z' })
  @IsDate()
  inspectedAt: Date;

  @ApiProperty({ description: '验收动物数量', example: 100 })
  @IsNumber()
  inspectedQuantity: number;

  @ApiProperty({ description: '验收重量', example: 10000.5, required: false })
  @IsNumber()
  @IsOptional()
  inspectedWeight?: number;

  @ApiProperty({ description: '验收发现的问题', required: false })
  @IsString()
  @IsOptional()
  issuesFound?: string;

  @ApiProperty({ description: '处理措施', required: false })
  @IsString()
  @IsOptional()
  measuresTaken?: string;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class MarketQueryDto {
  @ApiProperty({ description: '检疫证号', required: false })
  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @ApiProperty({ description: '验收结果', required: false, isArray: true })
  @IsString({ each: true })
  @IsOptional()
  result?: string[];

  @ApiProperty({ description: '市场名称', required: false })
  @IsString()
  @IsOptional()
  marketName?: string;

  @ApiProperty({ description: '经营户名称', required: false })
  @IsString()
  @IsOptional()
  merchantName?: string;

  @ApiProperty({ description: '开始日期', required: false })
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiProperty({ description: '结束日期', required: false })
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @ApiProperty({ description: '页码', default: 1, required: false })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiProperty({ description: '每页数量', default: 20, required: false })
  @IsNumber()
  @IsOptional()
  pageSize?: number;
}
