import { IsArray, ArrayMinSize, IsEnum, IsOptional, IsString } from 'class-validator';
import { RefundStatus } from '../../../common/enums/refund-status.enum';

export class BatchOperationDto {
  @IsArray()
  @ArrayMinSize(1)
  refundIds: string[];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class BatchStatusChangeDto {
  @IsArray()
  @ArrayMinSize(1)
  refundIds: string[];

  @IsEnum(RefundStatus)
  targetStatus: RefundStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
