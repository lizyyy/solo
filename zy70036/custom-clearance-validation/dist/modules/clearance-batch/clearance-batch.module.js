"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClearanceBatchModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const clearance_batch_entity_1 = require("../../entities/clearance-batch.entity");
const clearance_batch_controller_1 = require("./clearance-batch.controller");
const clearance_batch_service_1 = require("./clearance-batch.service");
let ClearanceBatchModule = class ClearanceBatchModule {
};
exports.ClearanceBatchModule = ClearanceBatchModule;
exports.ClearanceBatchModule = ClearanceBatchModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([clearance_batch_entity_1.ClearanceBatch])],
        controllers: [clearance_batch_controller_1.ClearanceBatchController],
        providers: [clearance_batch_service_1.ClearanceBatchService],
        exports: [clearance_batch_service_1.ClearanceBatchService],
    })
], ClearanceBatchModule);
//# sourceMappingURL=clearance-batch.module.js.map