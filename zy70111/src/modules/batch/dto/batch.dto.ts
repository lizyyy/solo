import { IsString, IsNotEmpty, IsNumber, IsDate, IsOptional, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBatchDto {
  @ApiProperty({ description: '批次号', example: 'PC20240101001' })
  @IsString()
  @IsNotEmpty()
  batchNumber: string;

  @ApiProperty({ description: '批次名称', example: '2024年1月15日运输批次' })
  @IsString()
  @IsNotEmpty()
  batchName: string;

  @ApiProperty({ description: '目的地', example: '北京新发地农产品批发市场' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ description: '计划运输日期', example: '2024-01-16' })
  @IsDate()
  scheduledTransportDate: Date;

  @ApiProperty({ description: '运输车辆牌号', example: '京A12345', required: false })
  @IsString()
  @IsOptional()
  vehiclePlateNumber?: string;

  @ApiProperty({ description: '驾驶员姓名', example: '李四', required: false })
  @IsString()
  @IsOptional()
  driverName?: string;

  @ApiProperty({ description: '驾驶员电话', example: '13800138000', required: false })
  @IsString()
  @IsOptional()
  driverPhone?: string;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class BindCertificatesDto {
  @ApiProperty({ description: '批次ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  batchId: string;

  @ApiProperty({ description: '要绑定的检疫证ID列表', example: ['uuid1', 'uuid2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  certificateIds: string[];
}

export class UnbindCertificatesDto {
  @ApiProperty({ description: '批次ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  batchId: string;

  @ApiProperty({ description: '要解绑的检疫证ID列表', example: ['uuid1', 'uuid2'] })
  @IsArray()
  @IsUUID('4', { each: true })
  certificateIds: string[];

  @ApiProperty({ description: '解绑原因', example: '该批次已拆分运输' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class BatchQueryDto {
  @ApiProperty({ description: '批次号（支持模糊查询）', required: false })
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiProperty({ description: '批次状态', required: false, isArray: true })
  @IsString({ each: true })
  @IsOptional()
  status?: string[];

  @ApiProperty({ description: '目的地', required: false })
  @IsString()
  @IsOptional()
  destination?: string;

  @ApiProperty({ description: '是否包含重复证号', required: false })
  @IsString()
  @IsOptional()
  hasDuplicateCertificates?: boolean;

  @ApiProperty({ description: '页码', default: 1, required: false })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiProperty({ description: '每页数量', default: 20, required: false })
  @IsNumber()
  @IsOptional()
  pageSize?: number;
}
