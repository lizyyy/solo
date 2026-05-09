import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateRefundDto {
  @IsNotEmpty()
  @IsString()
  orderNo: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string = 'CNY';

  @IsOptional()
  @IsString()
  refundMethod?: string = 'original_payment';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
