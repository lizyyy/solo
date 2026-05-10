"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExportModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const export_task_entity_1 = require("./entities/export-task.entity");
const certificate_entity_1 = require("../certificate/entities/certificate.entity");
const certificate_duplicate_entity_1 = require("../certificate/entities/certificate-duplicate.entity");
const flow_history_entity_1 = require("../history/entities/flow-history.entity");
const review_task_entity_1 = require("../review/entities/review-task.entity");
const export_service_1 = require("./services/export.service");
const export_controller_1 = require("./controllers/export.controller");
let ExportModule = class ExportModule {
};
exports.ExportModule = ExportModule;
exports.ExportModule = ExportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                export_task_entity_1.ExportTask,
                certificate_entity_1.Certificate,
                certificate_duplicate_entity_1.CertificateDuplicate,
                flow_history_entity_1.FlowHistory,
                review_task_entity_1.ReviewTask,
            ]),
        ],
        controllers: [export_controller_1.ExportController],
        providers: [export_service_1.ExportService],
        exports: [export_service_1.ExportService],
    })
], ExportModule);
//# sourceMappingURL=export.module.js.map