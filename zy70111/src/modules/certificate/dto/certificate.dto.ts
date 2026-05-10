import { IsString, IsNotEmpty, IsEnum, IsNumber, IsDate, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CertificateSource } from '../../../common/types';

export class CreateCertificateDto {
  @ApiProperty({ description: '检疫证号', example: 'QZ2024010100001' })
  @IsString()
  @IsNotEmpty()
  certificateNumber: string;

  @ApiProperty({ description: '证号来源', enum: CertificateSource, example: CertificateSource.SLAUGHTERHOUSE })
  @IsEnum(CertificateSource)
  source: CertificateSource;

  @ApiProperty({ description: '养殖场名称', example: '阳光养殖场' })
  @IsString()
  @IsNotEmpty()
  farmName: string;

  @ApiProperty({ description: '养殖场ID', required: false })
  @IsString()
  @IsOptional()
  farmId?: string;

  @ApiProperty({ description: '屠宰场名称', example: '和平屠宰场' })
  @IsString()
  @IsNotEmpty()
  slaughterhouseName: string;

  @ApiProperty({ description: '屠宰场ID', required: false })
  @IsString()
  @IsOptional()
  slaughterhouseId?: string;

  @ApiProperty({ description: '动物种类', example: '生猪' })
  @IsString()
  @IsNotEmpty()
  animalType: string;

  @ApiProperty({ description: '动物数量', example: 100 })
  @IsNumber()
  animalQuantity: number;

  @ApiProperty({ description: '总重量', example: 10000.5, required: false })
  @IsNumber()
  @IsOptional()
  totalWeight?: number;

  @ApiProperty({ description: '出栏日期', example: '2024-01-15' })
  @IsDate()
  slaughterDate: Date;

  @ApiProperty({ description: '检疫日期', example: '2024-01-15' })
  @IsDate()
  inspectionDate: Date;

  @ApiProperty({ description: '检疫人员姓名', example: '张三' })
  @IsString()
  @IsNotEmpty()
  inspectorName: string;

  @ApiProperty({ description: '扩展字段', required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class UpdateCertificateDto {
  @ApiProperty({ description: '养殖场名称', required: false })
  @IsString()
  @IsOptional()
  farmName?: string;

  @ApiProperty({ description: '屠宰场名称', required: false })
  @IsString()
  @IsOptional()
  slaughterhouseName?: string;

  @ApiProperty({ description: '动物种类', required: false })
  @IsString()
  @IsOptional()
  animalType?: string;

  @ApiProperty({ description: '动物数量', required: false })
  @IsNumber()
  @IsOptional()
  animalQuantity?: number;

  @ApiProperty({ description: '总重量', required: false })
  @IsNumber()
  @IsOptional()
  totalWeight?: number;

  @ApiProperty({ description: '扩展字段', required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ManualCorrectionDto {
  @ApiProperty({ description: '修正后的状态', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ description: '修正的字段', required: false })
  @IsObject()
  @IsOptional()
  fields?: Record<string, any>;

  @ApiProperty({ description: '修正原因', example: '证号重复，人工确认此证为原始证' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: '是否跳过重复检查', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  skipDuplicateCheck?: boolean;
}

export class CertificateQueryDto {
  @ApiProperty({ description: '检疫证号（支持模糊查询）', required: false })
  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @ApiProperty({ description: '状态', required: false, isArray: true })
  @IsString({ each: true })
  @IsOptional()
  status?: string[];

  @ApiProperty({ description: '来源', required: false, isArray: true })
  @IsString({ each: true })
  @IsOptional()
  source?: string[];

  @ApiProperty({ description: '养殖场名称', required: false })
  @IsString()
  @IsOptional()
  farmName?: string;

  @ApiProperty({ description: '屠宰场名称', required: false })
  @IsString()
  @IsOptional()
  slaughterhouseName?: string;

  @ApiProperty({ description: '动物种类', required: false })
  @IsString()
  @IsOptional()
  animalType?: string;

  @ApiProperty({ description: '是否有重复', required: false })
  @IsBoolean()
  @IsOptional()
  hasDuplicate?: boolean;

  @ApiProperty({ description: '是否有过人工修正', required: false })
  @IsBoolean()
  @IsOptional()
  hasManualCorrection?: boolean;

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

export class ProcessingResultDto {
  @ApiProperty({ description: '是否成功' })
  success: boolean;

  @ApiProperty({ description: '返回数据' })
  data?: any;

  @ApiProperty({ description: '是否需要人工复核' })
  needsReview: boolean;

  @ApiProperty({ description: '复核原因' })
  reviewReason?: string;

  @ApiProperty({ description: '复核优先级' })
  reviewPriority?: string;

  @ApiProperty({ description: '处理消息' })
  message: string;

  @ApiProperty({ description: '警告信息' })
  warnings?: string[];
}
