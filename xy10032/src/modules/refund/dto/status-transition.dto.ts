import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RefundStatus } from '../../../common/enums/refund-status.enum';

export class StatusTransitionDto {
  @IsEnum(RefundStatus)
  targetStatus: RefundStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
