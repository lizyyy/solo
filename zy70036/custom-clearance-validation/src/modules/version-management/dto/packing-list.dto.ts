import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '../../../entities/invoice.entity';

class PackingListItemDto {
  @IsNumber()
  lineNumber: number;

  @IsString()
  @MaxLength(20)
  hsCode: string;

  @IsString()
  productName: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  packages?: number;

  @IsOptional()
  @IsNumber()
  grossWeight?: number;

  @IsOptional()
  @IsNumber()
  netWeight?: number;

  @IsOptional()
  @IsNumber()
  volume?: number;
}

export class CreatePackingListDto {
  @IsString()
  @MaxLength(50)
  packingListNumber: string;

  @IsString()
  batchId: string;

  @IsOptional()
  @IsString()
  packingDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shipperName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  consigneeName?: string;

  @IsNumber()
  totalPackages: number;

  @IsNumber()
  totalGrossWeight: number;

  @IsNumber()
  totalNetWeight: number;

  @IsNumber()
  totalVolume: number;

  @IsOptional()
  @IsString()
  weightUnit?: string;

  @IsOptional()
  @IsString()
  volumeUnit?: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PackingListItemDto)
  items: PackingListItemDto[];

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdatePackingListDto {
  @IsOptional()
  @IsString()
  packingDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shipperName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  consigneeName?: string;

  @IsOptional()
  @IsNumber()
  totalPackages?: number;

  @IsOptional()
  @IsNumber()
  totalGrossWeight?: number;

  @IsOptional()
  @IsNumber()
  totalNetWeight?: number;

  @IsOptional()
  @IsNumber()
  totalVolume?: number;

  @IsOptional()
  @IsString()
  weightUnit?: string;

  @IsOptional()
  @IsString()
  volumeUnit?: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackingListItemDto)
  items?: PackingListItemDto[];

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class PackingListFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  packingListNumber?: string;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}
