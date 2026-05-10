import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransportRecord } from './entities/transport-record.entity';
import { Certificate } from '../certificate/entities/certificate.entity';
import { TransportService } from './services/transport.service';
import { TransportController } from './controllers/transport.controller';
import { BatchModule } from '../batch/batch.module';
import { CertificateModule } from '../certificate/certificate.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransportRecord, Certificate]),
    forwardRef(() => BatchModule),
    forwardRef(() => CertificateModule),
  ],
  controllers: [TransportController],
  providers: [TransportService],
  exports: [TransportService],
})
export class TransportModule {}
