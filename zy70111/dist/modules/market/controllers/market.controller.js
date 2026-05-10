"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const market_service_1 = require("../services/market.service");
const market_dto_1 = require("../dto/market.dto");
const decorators_1 = require("../../../common/decorators");
let MarketController = class MarketController {
    constructor(marketService) {
        this.marketService = marketService;
    }
    async inspect(dto, user) {
        return this.marketService.inspect(dto, user);
    }
    async getById(id) {
        return this.marketService.findById(id);
    }
    async query(query) {
        return this.marketService.query(query);
    }
};
exports.MarketController = MarketController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '市场验收（检疫证最终落地核验）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [market_dto_1.MarketInspectionDto, Object]),
    __metadata("design:returntype", Promise)
], MarketController.prototype, "inspect", null);
__decorate([
    (0, common_1.Get)('id/:id'),
    (0, swagger_1.ApiOperation)({ summary: '查询验收记录详情' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '验收记录ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MarketController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('query'),
    (0, swagger_1.ApiOperation)({ summary: '分页查询验收记录' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [market_dto_1.MarketQueryDto]),
    __metadata("design:returntype", Promise)
], MarketController.prototype, "query", null);
exports.MarketController = MarketController = __decorate([
    (0, swagger_1.ApiTags)('市场验收'),
    (0, common_1.Controller)('market-inspections'),
    __metadata("design:paramtypes", [market_service_1.MarketService])
], MarketController);
//# sourceMappingURL=market.controller.js.map