import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { CertificateModule } from './modules/certificate/certificate.module';
import { BatchModule } from './modules/batch/batch.module';
import { TransportModule } from './modules/transport/transport.module';
import { MarketModule } from './modules/market/market.module';
import { VoidModule } from './modules/void/void.module';
import { ExportModule } from './modules/export/export.module';
import { HistoryModule } from './modules/history/history.module';
import { ReviewModule } from './modules/review/review.module';
import { HealthModule } from './modules/health/health.module';

import { Certificate } from './modules/certificate/entities/certificate.entity';
import { CertificateDuplicate } from './modules/certificate/entities/certificate-duplicate.entity';
import { Batch } from './modules/batch/entities/batch.entity';
import { TransportRecord } from './modules/transport/entities/transport-record.entity';
import { MarketInspection } from './modules/market/entities/market-inspection.entity';
import { VoidRecord } from './modules/void/entities/void-record.entity';
import { FlowHistory } from './modules/history/entities/flow-history.entity';
import { AuditLog } from './modules/history/entities/audit-log.entity';
import { ReviewTask } from './modules/review/entities/review-task.entity';
import { ExportTask } from './modules/export/entities/export-task.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'quarantine_cert'),
        entities: [
          Certificate,
          CertificateDuplicate,
          Batch,
          TransportRecord,
          MarketInspection,
          VoidRecord,
          FlowHistory,
          AuditLog,
          ReviewTask,
          ExportTask,
        ],
        synchronize: true,
        logging: configService.get('LOG_LEVEL') === 'debug',
      }),
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get('LOG_LEVEL', 'info'),
          transport:
            process.env.NODE_ENV !== 'production'
              ? { target: 'pino-pretty' }
              : undefined,
        },
      }),
    }),
    CertificateModule,
    BatchModule,
    TransportModule,
    MarketModule,
    VoidModule,
    ExportModule,
    HistoryModule,
    ReviewModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
