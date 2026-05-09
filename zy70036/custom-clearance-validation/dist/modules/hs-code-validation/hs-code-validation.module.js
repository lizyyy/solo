"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HsCodeValidationModule = void 0;
const common_1 = require("@nestjs/common");
const hs_code_validation_controller_1 = require("./hs-code-validation.controller");
const hs_code_validation_service_1 = require("./hs-code-validation.service");
const version_management_module_1 = require("../version-management/version-management.module");
let HsCodeValidationModule = class HsCodeValidationModule {
};
exports.HsCodeValidationModule = HsCodeValidationModule;
exports.HsCodeValidationModule = HsCodeValidationModule = __decorate([
    (0, common_1.Module)({
        imports: [version_management_module_1.VersionManagementModule],
        controllers: [hs_code_validation_controller_1.HsCodeValidationController],
        providers: [hs_code_validation_service_1.HsCodeValidationService],
        exports: [hs_code_validation_service_1.HsCodeValidationService],
    })
], HsCodeValidationModule);
//# sourceMappingURL=hs-code-validation.module.js.map