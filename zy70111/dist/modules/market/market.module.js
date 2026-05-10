"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const market_inspection_entity_1 = require("./entities/market-inspection.entity");
const certificate_entity_1 = require("../certificate/entities/certificate.entity");
const market_service_1 = require("./services/market.service");
const market_controller_1 = require("./controllers/market.controller");
const certificate_module_1 = require("../certificate/certificate.module");
let MarketModule = class MarketModule {
};
exports.MarketModule = MarketModule;
exports.MarketModule = MarketModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([market_inspection_entity_1.MarketInspection, certificate_entity_1.Certificate]),
            (0, common_1.forwardRef)(() => certificate_module_1.CertificateModule),
        ],
        controllers: [market_controller_1.MarketController],
        providers: [market_service_1.MarketService],
        exports: [market_service_1.MarketService],
    })
], MarketModule);
//# sourceMappingURL=market.module.js.map