import { IsString, IsNotEmpty, IsEnum, IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VoidReason } from '../../../common/types';

export class VoidCertificateDto {
  @ApiProperty({ description: '要作废的检疫证ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  certificateId: string;

  @ApiProperty({ description: '作废原因', enum: VoidReason, example: VoidReason.DUPLICATE })
  @IsEnum(VoidReason)
  reason: VoidReason;

  @ApiProperty({ description: '作废详细说明', example: '证号重复，与另一条记录冲突，确认此条无效' })
  @IsString()
  @IsNotEmpty()
  reasonDetails: string;

  @ApiProperty({ description: '是否重新开具新证', example: true, required: false, default: false })
  @IsBoolean()
  @IsOptional()
  shouldReissue?: boolean;

  @ApiProperty({ description: '新证号（如需重新开具）', example: 'QZ2024010100001-NEW', required: false })
  @IsString()
  @IsOptional()
  newCertificateNumber?: string;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ReissueCertificateDto {
  @ApiProperty({ description: '原始检疫证ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  originalCertificateId: string;

  @ApiProperty({ description: '新证号', example: 'QZ2024010100001-R01' })
  @IsString()
  @IsNotEmpty()
  newCertificateNumber: string;

  @ApiProperty({ description: '重开原因', example: '原始证号重复，重新开具' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}
