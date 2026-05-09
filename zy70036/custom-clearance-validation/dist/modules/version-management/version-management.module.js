"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionManagementModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const invoice_entity_1 = require("../../entities/invoice.entity");
const packing_list_entity_1 = require("../../entities/packing-list.entity");
const hs_code_version_entity_1 = require("../../entities/hs-code-version.entity");
const clearance_batch_module_1 = require("../clearance-batch/clearance-batch.module");
const invoice_controller_1 = require("./invoice.controller");
const packing_list_controller_1 = require("./packing-list.controller");
const hs_code_version_controller_1 = require("./hs-code-version.controller");
const version_management_controller_1 = require("./version-management.controller");
const invoice_service_1 = require("./invoice.service");
const packing_list_service_1 = require("./packing-list.service");
const hs_code_version_service_1 = require("./hs-code-version.service");
const version_management_service_1 = require("./version-management.service");
let VersionManagementModule = class VersionManagementModule {
};
exports.VersionManagementModule = VersionManagementModule;
exports.VersionManagementModule = VersionManagementModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([invoice_entity_1.Invoice, packing_list_entity_1.PackingList, hs_code_version_entity_1.HsCodeVersion]),
            clearance_batch_module_1.ClearanceBatchModule,
        ],
        controllers: [
            invoice_controller_1.InvoiceController,
            packing_list_controller_1.PackingListController,
            hs_code_version_controller_1.HsCodeVersionController,
            version_management_controller_1.VersionManagementController,
        ],
        providers: [
            invoice_service_1.InvoiceService,
            packing_list_service_1.PackingListService,
            hs_code_version_service_1.HsCodeVersionService,
            version_management_service_1.VersionManagementService,
        ],
        exports: [
            invoice_service_1.InvoiceService,
            packing_list_service_1.PackingListService,
            hs_code_version_service_1.HsCodeVersionService,
            version_management_service_1.VersionManagementService,
        ],
    })
], VersionManagementModule);
//# sourceMappingURL=version-management.module.js.map