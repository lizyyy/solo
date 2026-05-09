import { 
  IsString, 
  IsNumber, 
  IsDate, 
  IsUUID, 
  IsOptional, 
  IsArray,
  ValidateNested,
  Min 
} from 'class-validator';
import { Type } from 'class-transformer';

export class BillShareDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsNumber()
  @IsOptional()
  percentage?: number;
}

export class CreateBillDto {
  @IsString()
  title: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsUUID()
  groupId: string;

  @IsUUID()
  paidByUserId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillShareDto)
  shares: BillShareDto[];

  @IsString()
  @IsOptional()
  requestId?: string;

  @IsOptional()
  expectedVersion?: number;
}
