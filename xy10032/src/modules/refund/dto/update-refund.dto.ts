import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateRefundDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  refundMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
