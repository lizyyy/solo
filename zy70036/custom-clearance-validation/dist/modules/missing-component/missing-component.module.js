"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingComponentModule = void 0;
const common_1 = require("@nestjs/common");
const missing_component_controller_1 = require("./missing-component.controller");
const missing_component_service_1 = require("./missing-component.service");
const version_management_module_1 = require("../version-management/version-management.module");
let MissingComponentModule = class MissingComponentModule {
};
exports.MissingComponentModule = MissingComponentModule;
exports.MissingComponentModule = MissingComponentModule = __decorate([
    (0, common_1.Module)({
        imports: [version_management_module_1.VersionManagementModule],
        controllers: [missing_component_controller_1.MissingComponentController],
        providers: [missing_component_service_1.MissingComponentService],
        exports: [missing_component_service_1.MissingComponentService],
    })
], MissingComponentModule);
//# sourceMappingURL=missing-component.module.js.map