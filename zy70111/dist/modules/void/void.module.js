"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoidModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const void_record_entity_1 = require("./entities/void-record.entity");
const certificate_entity_1 = require("../certificate/entities/certificate.entity");
const void_service_1 = require("./services/void.service");
const void_controller_1 = require("./controllers/void.controller");
const certificate_module_1 = require("../certificate/certificate.module");
let VoidModule = class VoidModule {
};
exports.VoidModule = VoidModule;
exports.VoidModule = VoidModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([void_record_entity_1.VoidRecord, certificate_entity_1.Certificate]),
            (0, common_1.forwardRef)(() => certificate_module_1.CertificateModule),
        ],
        controllers: [void_controller_1.VoidController],
        providers: [void_service_1.VoidService],
        exports: [void_service_1.VoidService],
    })
], VoidModule);
//# sourceMappingURL=void.module.js.map