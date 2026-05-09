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
import { BillShareDto } from './create-bill.dto';

export class UpdateBillDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  date?: Date;

  @IsUUID()
  @IsOptional()
  paidByUserId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillShareDto)
  @IsOptional()
  shares?: BillShareDto[];

  @IsString()
  @IsOptional()
  changeDescription?: string;

  @IsNumber()
  expectedVersion: number;
}
