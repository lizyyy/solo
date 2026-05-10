import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Batch } from './entities/batch.entity';
import { Certificate } from '../certificate/entities/certificate.entity';
import { BatchService } from './services/batch.service';
import { BatchController } from './controllers/batch.controller';
import { CertificateModule } from '../certificate/certificate.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Batch, Certificate]),
    forwardRef(() => CertificateModule),
  ],
  controllers: [BatchController],
  providers: [BatchService],
  exports: [BatchService],
})
export class BatchModule {}
