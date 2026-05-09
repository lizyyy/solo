import { IsOptional, IsEnum, IsString, IsNumber, Min, IsDateString } from 'class-validator';
import { RefundStatus } from '../../../common/enums/refund-status.enum';

export class QueryRefundDto {
  @IsOptional()
  @IsString()
  refundNo?: string;

  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @IsEnum(RefundStatus)
  status?: RefundStatus;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
