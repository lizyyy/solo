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
exports.TransportController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const transport_service_1 = require("../services/transport.service");
const transport_dto_1 = require("../dto/transport.dto");
const decorators_1 = require("../../../common/decorators");
let TransportController = class TransportController {
    constructor(transportService) {
        this.transportService = transportService;
    }
    async create(dto, user) {
        return this.transportService.create(dto, user);
    }
    async verify(dto, user) {
        return this.transportService.verifyTransport(dto, user);
    }
    async getDetail(transportId) {
        return this.transportService.getTransportDetail(transportId);
    }
    async getById(id) {
        return this.transportService.findById(id);
    }
    async query(query) {
        return this.transportService.query(query);
    }
};
exports.TransportController = TransportController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '创建运输记录（开始运输）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [transport_dto_1.CreateTransportDto, Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('verify'),
    (0, swagger_1.ApiOperation)({ summary: '运输核销（到达目的地确认）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [transport_dto_1.VerifyTransportDto, Object]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "verify", null);
__decorate([
    (0, common_1.Get)('detail/:transportId'),
    (0, swagger_1.ApiOperation)({ summary: '查询运输详情（含批次内检疫证）' }),
    (0, swagger_1.ApiParam)({ name: 'transportId', description: '运输记录ID' }),
    __param(0, (0, common_1.Param)('transportId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Get)('id/:id'),
    (0, swagger_1.ApiOperation)({ summary: '通过ID查询运输记录' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '运输记录ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('query'),
    (0, swagger_1.ApiOperation)({ summary: '分页查询运输记录' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [transport_dto_1.TransportQueryDto]),
    __metadata("design:returntype", Promise)
], TransportController.prototype, "query", null);
exports.TransportController = TransportController = __decorate([
    (0, swagger_1.ApiTags)('运输核销'),
    (0, common_1.Controller)('transports'),
    __metadata("design:paramtypes", [transport_service_1.TransportService])
], TransportController);
//# sourceMappingURL=transport.controller.js.map