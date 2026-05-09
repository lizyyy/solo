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
import { HsCodeSource } from '../../../entities/hs-code-version.entity';

class HsCodeItemDto {
  @IsString()
  @MaxLength(20)
  hsCode: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  productName: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class CreateHsCodeVersionDto {
  @IsString()
  batchId: string;

  @IsEnum(HsCodeSource)
  source: HsCodeSource;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HsCodeItemDto)
  items: HsCodeItemDto[];

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class HsCodeVersionFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ enum: HsCodeSource })
  @IsOptional()
  @IsEnum(HsCodeSource)
  source?: HsCodeSource;
}
