import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { BillsModule } from './bills/bills.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { User } from './users/user.entity';
import { Group } from './groups/group.entity';
import { Bill } from './bills/bill.entity';
import { BillShare } from './bills/bill-share.entity';
import { BillVersion } from './bills/bill-version.entity';
import { AuditLog } from './audit/audit-log.entity';
import { IdempotencyRequest } from './common/idempotency/idempotency-request.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'billsplitter'),
        entities: [
          User,
          Group,
          Bill,
          BillShare,
          BillVersion,
          AuditLog,
          IdempotencyRequest,
        ],
        synchronize: true,
        logging: process.env.NODE_ENV !== 'production',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    GroupsModule,
    BillsModule,
    AuditModule,
    ReportsModule,
    IdempotencyModule,
  ],
})
export class AppModule {}
