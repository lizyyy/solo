import { IsEnum, IsNotEmpty, IsOptional, IsString, IsJSON } from 'class-validator';
import { ActionType } from '../../../common/enums/action-type.enum';
import { LogLevel } from '../../../common/enums/log-level.enum';

export class CreateAuditLogDto {
  @IsEnum(LogLevel)
  @IsOptional()
  level?: LogLevel;

  @IsEnum(ActionType)
  @IsNotEmpty()
  actionType: ActionType;

  @IsString()
  @IsNotEmpty()
  entityType: string;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  performedById?: string;

  @IsString()
  @IsOptional()
  performedByUsername?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  details?: Record<string, any>;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsString()
  @IsOptional()
  stackTrace?: string;

  @IsString()
  @IsOptional()
  requestId?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;
}
