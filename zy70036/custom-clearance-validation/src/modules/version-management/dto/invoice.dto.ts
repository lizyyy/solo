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

class InvoiceItemDto {
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

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  totalAmount: number;
}

export class CreateInvoiceDto {
  @IsString()
  @MaxLength(50)
  invoiceNumber: string;

  @IsString()
  batchId: string;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shipperName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  consigneeName?: string;

  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsNumber()
  totalQuantity: number;

  @IsNumber()
  itemCount: number;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  invoiceDate?: string;

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
  totalAmount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  totalQuantity?: number;

  @IsOptional()
  @IsNumber()
  itemCount?: number;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class InvoiceFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;
}
