import { IsString, IsNotEmpty, IsEnum, IsOptional, IsUUID, IsNumber, IsObject, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReviewStatus, ReviewPriority } from '../../../common/types';

export class CreateReviewTaskDto {
  @ApiProperty({ description: '关联检疫证号', required: false })
  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @ApiProperty({ description: '关联检疫证ID', required: false })
  @IsUUID()
  @IsOptional()
  certificateId?: string;

  @ApiProperty({ description: '关联批次号', required: false })
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiProperty({ description: '关联批次ID', required: false })
  @IsUUID()
  @IsOptional()
  batchId?: string;

  @ApiProperty({ description: '关联运输单号', required: false })
  @IsString()
  @IsOptional()
  transportNumber?: string;

  @ApiProperty({ description: '关联运输ID', required: false })
  @IsUUID()
  @IsOptional()
  transportId?: string;

  @ApiProperty({ description: '复核原因代码', example: 'DUPLICATE_CERTIFICATE_NUMBER' })
  @IsString()
  @IsNotEmpty()
  reasonCode: string;

  @ApiProperty({ description: '复核原因描述', example: '证号重复，需人工确认哪条有效' })
  @IsString()
  @IsNotEmpty()
  reasonDescription: string;

  @ApiProperty({ description: '优先级', enum: ReviewPriority, required: false, default: ReviewPriority.MEDIUM })
  @IsEnum(ReviewPriority)
  @IsOptional()
  priority?: ReviewPriority;

  @ApiProperty({ description: '相关数据上下文', required: false })
  @IsObject()
  @IsOptional()
  contextData?: Record<string, any>;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ResolveReviewTaskDto {
  @ApiProperty({ description: '复核任务ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  taskId: string;

  @ApiProperty({ description: '复核结论', example: '确认此证为原始有效证，另一条为重复无效证，已作废' })
  @IsString()
  @IsNotEmpty()
  conclusion: string;

  @ApiProperty({ description: '处理措施', required: false })
  @IsObject()
  @IsOptional()
  resolutionActions?: Record<string, any>;

  @ApiProperty({ description: '处理结果状态', enum: ReviewStatus, example: ReviewStatus.RESOLVED })
  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ReviewQueryDto {
  @ApiProperty({ description: '状态', required: false, isArray: true })
  @IsString({ each: true })
  @IsOptional()
  status?: string[];

  @ApiProperty({ description: '优先级', required: false, isArray: true })
  @IsString({ each: true })
  @IsOptional()
  priority?: string[];

  @ApiProperty({ description: '原因代码', required: false })
  @IsString()
  @IsOptional()
  reasonCode?: string;

  @ApiProperty({ description: '关联检疫证号', required: false })
  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @ApiProperty({ description: '处理人ID', required: false })
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiProperty({ description: '页码', default: 1, required: false })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiProperty({ description: '每页数量', default: 20, required: false })
  @IsNumber()
  @IsOptional()
  pageSize?: number;
}
