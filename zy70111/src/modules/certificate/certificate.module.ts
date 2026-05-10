import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certificate } from './entities/certificate.entity';
import { CertificateDuplicate } from './entities/certificate-duplicate.entity';
import { CertificateService } from './services/certificate.service';
import { CertificateController } from './controllers/certificate.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Certificate, CertificateDuplicate])],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificateModule {}
