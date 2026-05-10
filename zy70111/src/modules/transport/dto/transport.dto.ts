import { IsString, IsNotEmpty, IsDate, IsOptional, IsUUID, IsNumber, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransportDto {
  @ApiProperty({ description: '运输单号', example: 'YS20240116001' })
  @IsString()
  @IsNotEmpty()
  transportNumber: string;

  @ApiProperty({ description: '批次ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  batchId: string;

  @ApiProperty({ description: '出发地', example: '和平屠宰场' })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({ description: '目的地', example: '北京新发地农产品批发市场' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ description: '途经地点', example: '石家庄服务区', required: false })
  @IsString()
  @IsOptional()
  route?: string;

  @ApiProperty({ description: '运输车辆牌号', example: '京A12345' })
  @IsString()
  @IsNotEmpty()
  vehiclePlateNumber: string;

  @ApiProperty({ description: '驾驶员姓名', example: '李四' })
  @IsString()
  @IsNotEmpty()
  driverName: string;

  @ApiProperty({ description: '驾驶员电话', example: '13800138000' })
  @IsString()
  @IsNotEmpty()
  driverPhone: string;

  @ApiProperty({ description: '发车时间', example: '2024-01-16T08:00:00Z' })
  @IsDate()
  departureTime: Date;

  @ApiProperty({ description: '预计到达时间', example: '2024-01-16T20:00:00Z', required: false })
  @IsDate()
  @IsOptional()
  estimatedArrivalTime?: Date;

  @ApiProperty({ description: '备注', required: false })
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class VerifyTransportDto {
  @ApiProperty({ description: '运输记录ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  transportId: string;

  @ApiProperty({ description: '实际到达时间', example: '2024-01-16T19:30:00Z', required: false })
  @IsDate()
  @IsOptional()
  actualArrivalTime?: Date;

  @ApiProperty({ description: '核销备注', example: '运输正常，无异常', required: false })
  @IsString()
  @IsOptional()
  verificationRemarks?: string;

  @ApiProperty({ description: '是否发现异常', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  hasAnomaly?: boolean;

  @ApiProperty({ description: '异常描述', required: false })
  @IsString()
  @IsOptional()
  anomalyDescription?: string;

  @ApiProperty({ description: '要核销的检疫证ID列表（可选，不传则核销批次全部）', required: false })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  certificateIds?: string[];
}

export class TransportQueryDto {
  @ApiProperty({ description: '运输单号（支持模糊查询）', required: false })
  @IsString()
  @IsOptional()
  transportNumber?: string;

  @ApiProperty({ description: '批次号（支持模糊查询）', required: false })
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiProperty({ description: '运输状态', required: false, isArray: true })
  @IsString({ each: true })
  @IsOptional()
  status?: string[];

  @ApiProperty({ description: '车辆牌号', required: false })
  @IsString()
  @IsOptional()
  vehiclePlateNumber?: string;

  @ApiProperty({ description: '是否有异常', required: false })
  @IsBoolean()
  @IsOptional()
  hasAnomaly?: boolean;

  @ApiProperty({ description: '页码', default: 1, required: false })
  @IsNumber()
  @IsOptional()
  page?: number;

  @ApiProperty({ description: '每页数量', default: 20, required: false })
  @IsNumber()
  @IsOptional()
  pageSize?: number;
}
