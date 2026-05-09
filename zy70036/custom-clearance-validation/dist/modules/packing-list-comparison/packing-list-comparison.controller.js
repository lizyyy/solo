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
exports.PackingListComparisonController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const packing_list_comparison_service_1 = require("./packing-list-comparison.service");
let PackingListComparisonController = class PackingListComparisonController {
    comparisonService;
    constructor(comparisonService) {
        this.comparisonService = comparisonService;
    }
    compareBatch(batchId) {
        return this.comparisonService.compareBatch(batchId);
    }
};
exports.PackingListComparisonController = PackingListComparisonController;
__decorate([
    (0, common_1.Get)('batch/:batchId'),
    (0, swagger_1.ApiOperation)({ summary: '比对批次发票与箱单' }),
    __param(0, (0, common_1.Param)('batchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PackingListComparisonController.prototype, "compareBatch", null);
exports.PackingListComparisonController = PackingListComparisonController = __decorate([
    (0, swagger_1.ApiTags)('箱单比对校验'),
    (0, common_1.Controller)('packing-list-comparison'),
    __metadata("design:paramtypes", [packing_list_comparison_service_1.PackingListComparisonService])
], PackingListComparisonController);
//# sourceMappingURL=packing-list-comparison.controller.js.map