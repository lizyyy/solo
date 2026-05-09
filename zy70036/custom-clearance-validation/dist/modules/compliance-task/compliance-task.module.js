"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceTaskModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const compliance_task_entity_1 = require("../../entities/compliance-task.entity");
const clearance_batch_module_1 = require("../clearance-batch/clearance-batch.module");
const missing_component_module_1 = require("../missing-component/missing-component.module");
const compliance_task_controller_1 = require("./compliance-task.controller");
const compliance_task_service_1 = require("./compliance-task.service");
let ComplianceTaskModule = class ComplianceTaskModule {
};
exports.ComplianceTaskModule = ComplianceTaskModule;
exports.ComplianceTaskModule = ComplianceTaskModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([compliance_task_entity_1.ComplianceTask]),
            clearance_batch_module_1.ClearanceBatchModule,
            missing_component_module_1.MissingComponentModule,
        ],
        controllers: [compliance_task_controller_1.ComplianceTaskController],
        providers: [compliance_task_service_1.ComplianceTaskService],
        exports: [compliance_task_service_1.ComplianceTaskService],
    })
], ComplianceTaskModule);
//# sourceMappingURL=compliance-task.module.js.map