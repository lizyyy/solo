"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const nestjs_pino_1 = require("nestjs-pino");
const certificate_module_1 = require("./modules/certificate/certificate.module");
const batch_module_1 = require("./modules/batch/batch.module");
const transport_module_1 = require("./modules/transport/transport.module");
const market_module_1 = require("./modules/market/market.module");
const void_module_1 = require("./modules/void/void.module");
const export_module_1 = require("./modules/export/export.module");
const history_module_1 = require("./modules/history/history.module");
const review_module_1 = require("./modules/review/review.module");
const health_module_1 = require("./modules/health/health.module");
const certificate_entity_1 = require("./modules/certificate/entities/certificate.entity");
const certificate_duplicate_entity_1 = require("./modules/certificate/entities/certificate-duplicate.entity");
const batch_entity_1 = require("./modules/batch/entities/batch.entity");
const transport_record_entity_1 = require("./modules/transport/entities/transport-record.entity");
const market_inspection_entity_1 = require("./modules/market/entities/market-inspection.entity");
const void_record_entity_1 = require("./modules/void/entities/void-record.entity");
const flow_history_entity_1 = require("./modules/history/entities/flow-history.entity");
const audit_log_entity_1 = require("./modules/history/entities/audit-log.entity");
const review_task_entity_1 = require("./modules/review/entities/review-task.entity");
const export_task_entity_1 = require("./modules/export/entities/export-task.entity");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env'],
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    type: 'postgres',
                    host: configService.get('DB_HOST', 'localhost'),
                    port: configService.get('DB_PORT', 5432),
                    username: configService.get('DB_USERNAME', 'postgres'),
                    password: configService.get('DB_PASSWORD', 'postgres'),
                    database: configService.get('DB_DATABASE', 'quarantine_cert'),
                    entities: [
                        certificate_entity_1.Certificate,
                        certificate_duplicate_entity_1.CertificateDuplicate,
                        batch_entity_1.Batch,
                        transport_record_entity_1.TransportRecord,
                        market_inspection_entity_1.MarketInspection,
                        void_record_entity_1.VoidRecord,
                        flow_history_entity_1.FlowHistory,
                        audit_log_entity_1.AuditLog,
                        review_task_entity_1.ReviewTask,
                        export_task_entity_1.ExportTask,
                    ],
                    synchronize: true,
                    logging: configService.get('LOG_LEVEL') === 'debug',
                }),
            }),
            nestjs_pino_1.LoggerModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    pinoHttp: {
                        level: configService.get('LOG_LEVEL', 'info'),
                        transport: process.env.NODE_ENV !== 'production'
                            ? { target: 'pino-pretty' }
                            : undefined,
                    },
                }),
            }),
            certificate_module_1.CertificateModule,
            batch_module_1.BatchModule,
            transport_module_1.TransportModule,
            market_module_1.MarketModule,
            void_module_1.VoidModule,
            export_module_1.ExportModule,
            history_module_1.HistoryModule,
            review_module_1.ReviewModule,
            health_module_1.HealthModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map