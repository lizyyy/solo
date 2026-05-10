"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransportModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const transport_record_entity_1 = require("./entities/transport-record.entity");
const certificate_entity_1 = require("../certificate/entities/certificate.entity");
const transport_service_1 = require("./services/transport.service");
const transport_controller_1 = require("./controllers/transport.controller");
const batch_module_1 = require("../batch/batch.module");
const certificate_module_1 = require("../certificate/certificate.module");
let TransportModule = class TransportModule {
};
exports.TransportModule = TransportModule;
exports.TransportModule = TransportModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([transport_record_entity_1.TransportRecord, certificate_entity_1.Certificate]),
            (0, common_1.forwardRef)(() => batch_module_1.BatchModule),
            (0, common_1.forwardRef)(() => certificate_module_1.CertificateModule),
        ],
        controllers: [transport_controller_1.TransportController],
        providers: [transport_service_1.TransportService],
        exports: [transport_service_1.TransportService],
    })
], TransportModule);
//# sourceMappingURL=transport.module.js.map