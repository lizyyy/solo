import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { ClearanceBatch } from './entities/clearance-batch.entity';
import { HsCodeVersion } from './entities/hs-code-version.entity';
import { Invoice } from './entities/invoice.entity';
import { PackingList } from './entities/packing-list.entity';
import { ComplianceTask } from './entities/compliance-task.entity';
import { ClearanceReport } from './entities/clearance-report.entity';
import { ClearanceBatchModule } from './modules/clearance-batch/clearance-batch.module';
import { VersionManagementModule } from './modules/version-management/version-management.module';
import { HsCodeValidationModule } from './modules/hs-code-validation/hs-code-validation.module';
import { PackingListComparisonModule } from './modules/packing-list-comparison/packing-list-comparison.module';
import { MissingComponentModule } from './modules/missing-component/missing-component.module';
import { ComplianceTaskModule } from './modules/compliance-task/compliance-task.module';
import { ClearanceReportModule } from './modules/clearance-report/clearance-report.module';

const entities = [
  ClearanceBatch,
  HsCodeVersion,
  Invoice,
  PackingList,
  ComplianceTask,
  ClearanceReport,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities,
        synchronize: configService.get<boolean>('database.synchronize'),
        logging: configService.get<string>('nodeEnv') === 'development',
      }),
    }),
    ClearanceBatchModule,
    VersionManagementModule,
    HsCodeValidationModule,
    PackingListComparisonModule,
    MissingComponentModule,
    ComplianceTaskModule,
    ClearanceReportModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
