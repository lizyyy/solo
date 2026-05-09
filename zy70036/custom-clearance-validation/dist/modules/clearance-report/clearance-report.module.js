"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClearanceReportModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const clearance_report_entity_1 = require("../../entities/clearance-report.entity");
const clearance_batch_module_1 = require("../clearance-batch/clearance-batch.module");
const version_management_module_1 = require("../version-management/version-management.module");
const hs_code_validation_module_1 = require("../hs-code-validation/hs-code-validation.module");
const packing_list_comparison_module_1 = require("../packing-list-comparison/packing-list-comparison.module");
const missing_component_module_1 = require("../missing-component/missing-component.module");
const compliance_task_module_1 = require("../compliance-task/compliance-task.module");
const clearance_report_controller_1 = require("./clearance-report.controller");
const clearance_report_service_1 = require("./clearance-report.service");
let ClearanceReportModule = class ClearanceReportModule {
};
exports.ClearanceReportModule = ClearanceReportModule;
exports.ClearanceReportModule = ClearanceReportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([clearance_report_entity_1.ClearanceReport]),
            clearance_batch_module_1.ClearanceBatchModule,
            version_management_module_1.VersionManagementModule,
            hs_code_validation_module_1.HsCodeValidationModule,
            packing_list_comparison_module_1.PackingListComparisonModule,
            missing_component_module_1.MissingComponentModule,
            compliance_task_module_1.ComplianceTaskModule,
        ],
        controllers: [clearance_report_controller_1.ClearanceReportController],
        providers: [clearance_report_service_1.ClearanceReportService],
        exports: [clearance_report_service_1.ClearanceReportService],
    })
], ClearanceReportModule);
//# sourceMappingURL=clearance-report.module.js.map