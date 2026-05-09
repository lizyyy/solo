"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const configuration_1 = __importDefault(require("./config/configuration"));
const clearance_batch_entity_1 = require("./entities/clearance-batch.entity");
const hs_code_version_entity_1 = require("./entities/hs-code-version.entity");
const invoice_entity_1 = require("./entities/invoice.entity");
const packing_list_entity_1 = require("./entities/packing-list.entity");
const compliance_task_entity_1 = require("./entities/compliance-task.entity");
const clearance_report_entity_1 = require("./entities/clearance-report.entity");
const clearance_batch_module_1 = require("./modules/clearance-batch/clearance-batch.module");
const version_management_module_1 = require("./modules/version-management/version-management.module");
const hs_code_validation_module_1 = require("./modules/hs-code-validation/hs-code-validation.module");
const packing_list_comparison_module_1 = require("./modules/packing-list-comparison/packing-list-comparison.module");
const missing_component_module_1 = require("./modules/missing-component/missing-component.module");
const compliance_task_module_1 = require("./modules/compliance-task/compliance-task.module");
const clearance_report_module_1 = require("./modules/clearance-report/clearance-report.module");
const entities = [
    clearance_batch_entity_1.ClearanceBatch,
    hs_code_version_entity_1.HsCodeVersion,
    invoice_entity_1.Invoice,
    packing_list_entity_1.PackingList,
    compliance_task_entity_1.ComplianceTask,
    clearance_report_entity_1.ClearanceReport,
];
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                load: [configuration_1.default],
                isGlobal: true,
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    type: 'postgres',
                    host: configService.get('database.host'),
                    port: configService.get('database.port'),
                    username: configService.get('database.username'),
                    password: configService.get('database.password'),
                    database: configService.get('database.database'),
                    entities,
                    synchronize: configService.get('database.synchronize'),
                    logging: configService.get('nodeEnv') === 'development',
                }),
            }),
            clearance_batch_module_1.ClearanceBatchModule,
            version_management_module_1.VersionManagementModule,
            hs_code_validation_module_1.HsCodeValidationModule,
            packing_list_comparison_module_1.PackingListComparisonModule,
            missing_component_module_1.MissingComponentModule,
            compliance_task_module_1.ComplianceTaskModule,
            clearance_report_module_1.ClearanceReportModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map