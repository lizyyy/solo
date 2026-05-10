import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketInspection } from './entities/market-inspection.entity';
import { Certificate } from '../certificate/entities/certificate.entity';
import { MarketService } from './services/market.service';
import { MarketController } from './controllers/market.controller';
import { CertificateModule } from '../certificate/certificate.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketInspection, Certificate]),
    forwardRef(() => CertificateModule),
  ],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
