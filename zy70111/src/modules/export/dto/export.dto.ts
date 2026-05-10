import { IsString, IsNotEmpty, IsEnum, IsDate, IsOptional, IsObject, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ExportType } from '../../../common/types';

export class CreateExportTaskDto {
  @ApiProperty({ description: '导出类型', enum: ExportType, example: ExportType.DUPLICATE_ANALYSIS })
  @IsEnum(ExportType)
  exportType: ExportType;

  @ApiProperty({ description: '导出名称', example: '2024年1月证号重复分析报告' })
  @IsString()
  @IsNotEmpty()
  exportName: string;

  @ApiProperty({ description: '开始日期', example: '2024-01-01', required: false })
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiProperty({ description: '结束日期', example: '2024-01-31', required: false })
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @ApiProperty({ description: '扩展筛选条件', required: false })
  @IsObject()
  @IsOptional()
  filters?: Record<string, any>;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ExportQueryDto {
  @ApiProperty({ description: '导出类型', required: false, isArray: true })
  @IsString({ each: true })
  @IsOptional()
  exportType?: string[];

  @ApiProperty({ description: '状态', required: false, isArray: true })
  @IsString({ each: true })
  @IsOptional()
  status?: string[];

  @ApiProperty({ description: '页码', default: 1, required: false })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiProperty({ description: '每页数量', default: 20, required: false })
  @IsNumber()
  @IsOptional()
  pageSize?: number;
}
