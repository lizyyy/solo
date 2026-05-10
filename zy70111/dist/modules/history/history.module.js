"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const flow_history_entity_1 = require("./entities/flow-history.entity");
const audit_log_entity_1 = require("./entities/audit-log.entity");
const flow_history_service_1 = require("./services/flow-history.service");
const audit_log_service_1 = require("./services/audit-log.service");
const history_controller_1 = require("./controllers/history.controller");
let HistoryModule = class HistoryModule {
};
exports.HistoryModule = HistoryModule;
exports.HistoryModule = HistoryModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([flow_history_entity_1.FlowHistory, audit_log_entity_1.AuditLog])],
        controllers: [history_controller_1.HistoryController],
        providers: [flow_history_service_1.FlowHistoryService, audit_log_service_1.AuditLogService],
        exports: [flow_history_service_1.FlowHistoryService, audit_log_service_1.AuditLogService],
    })
], HistoryModule);
//# sourceMappingURL=history.module.js.map