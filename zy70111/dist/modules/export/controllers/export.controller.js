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
exports.ExportController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const export_service_1 = require("../services/export.service");
const export_dto_1 = require("../dto/export.dto");
const decorators_1 = require("../../../common/decorators");
let ExportController = class ExportController {
    constructor(exportService) {
        this.exportService = exportService;
    }
    async createTask(dto, user) {
        return this.exportService.createTask(dto, user);
    }
    async getById(id) {
        return this.exportService.findById(id);
    }
    async query(query) {
        return this.exportService.query(query);
    }
};
exports.ExportController = ExportController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: '创建导出任务（业务复核专用导出）' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [export_dto_1.CreateExportTaskDto, Object]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "createTask", null);
__decorate([
    (0, common_1.Get)('id/:id'),
    (0, swagger_1.ApiOperation)({ summary: '查询导出任务详情' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: '导出任务ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('query'),
    (0, swagger_1.ApiOperation)({ summary: '分页查询导出任务列表' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [export_dto_1.ExportQueryDto]),
    __metadata("design:returntype", Promise)
], ExportController.prototype, "query", null);
exports.ExportController = ExportController = __decorate([
    (0, swagger_1.ApiTags)('监管导出'),
    (0, common_1.Controller)('exports'),
    __metadata("design:paramtypes", [export_service_1.ExportService])
], ExportController);
//# sourceMappingURL=export.controller.js.map