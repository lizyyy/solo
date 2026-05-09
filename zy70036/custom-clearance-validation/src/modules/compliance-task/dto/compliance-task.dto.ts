import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  TaskPriority,
  TaskStatus,
  MissingComponentType,
} from '../../../entities/compliance-task.entity';

class AffectedItemDto {
  @IsNumber()
  lineNumber: number;

  @IsString()
  hsCode: string;

  @IsString()
  productName: string;

  @IsString()
  issue: string;
}

export class CreateComplianceTaskDto {
  @IsString()
  batchId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(MissingComponentType)
  componentType: MissingComponentType;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AffectedItemDto)
  affectedItems?: AffectedItemDto[];
}

export class UpdateComplianceTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(MissingComponentType)
  componentType?: MissingComponentType;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AffectedItemDto)
  affectedItems?: AffectedItemDto[];
}

export class ComplianceTaskFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: MissingComponentType })
  @IsOptional()
  @IsEnum(MissingComponentType)
  componentType?: MissingComponentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignee?: string;
}
