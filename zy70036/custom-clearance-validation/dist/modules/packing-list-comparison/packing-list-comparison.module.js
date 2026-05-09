"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackingListComparisonModule = void 0;
const common_1 = require("@nestjs/common");
const packing_list_comparison_controller_1 = require("./packing-list-comparison.controller");
const packing_list_comparison_service_1 = require("./packing-list-comparison.service");
const version_management_module_1 = require("../version-management/version-management.module");
let PackingListComparisonModule = class PackingListComparisonModule {
};
exports.PackingListComparisonModule = PackingListComparisonModule;
exports.PackingListComparisonModule = PackingListComparisonModule = __decorate([
    (0, common_1.Module)({
        imports: [version_management_module_1.VersionManagementModule],
        controllers: [packing_list_comparison_controller_1.PackingListComparisonController],
        providers: [packing_list_comparison_service_1.PackingListComparisonService],
        exports: [packing_list_comparison_service_1.PackingListComparisonService],
    })
], PackingListComparisonModule);
//# sourceMappingURL=packing-list-comparison.module.js.map