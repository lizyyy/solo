import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoidRecord } from './entities/void-record.entity';
import { Certificate } from '../certificate/entities/certificate.entity';
import { VoidService } from './services/void.service';
import { VoidController } from './controllers/void.controller';
import { CertificateModule } from '../certificate/certificate.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VoidRecord, Certificate]),
    forwardRef(() => CertificateModule),
  ],
  controllers: [VoidController],
  providers: [VoidService],
  exports: [VoidService],
})
export class VoidModule {}
