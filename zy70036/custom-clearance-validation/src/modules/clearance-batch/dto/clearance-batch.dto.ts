import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClearanceBatchStatus } from '../../../entities/clearance-batch.entity';

export class CreateClearanceBatchDto {
  @IsString()
  @MaxLength(50)
  batchNumber: string;

  @IsString()
  @MaxLength(50)
  shipmentNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  originCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationCountry?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateClearanceBatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shipmentNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  originCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationCountry?: string;

  @IsOptional()
  @IsEnum(ClearanceBatchStatus)
  status?: ClearanceBatchStatus;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ClearanceBatchFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shipmentNumber?: string;

  @ApiPropertyOptional({ enum: ClearanceBatchStatus })
  @IsOptional()
  @IsEnum(ClearanceBatchStatus)
  status?: ClearanceBatchStatus;
}
