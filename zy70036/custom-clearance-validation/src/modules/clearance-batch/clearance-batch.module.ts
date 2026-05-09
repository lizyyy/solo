import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClearanceBatch } from '../../entities/clearance-batch.entity';
import { ClearanceBatchController } from './clearance-batch.controller';
import { ClearanceBatchService } from './clearance-batch.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClearanceBatch])],
  controllers: [ClearanceBatchController],
  providers: [ClearanceBatchService],
  exports: [ClearanceBatchService],
})
export class ClearanceBatchModule {}
