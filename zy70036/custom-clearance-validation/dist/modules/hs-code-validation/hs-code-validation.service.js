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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HsCodeValidationService = void 0;
const common_1 = require("@nestjs/common");
const hs_code_version_service_1 = require("../version-management/hs-code-version.service");
const hs_code_version_entity_1 = require("../../entities/hs-code-version.entity");
let HsCodeValidationService = class HsCodeValidationService {
    hsCodeVersionService;
    constructor(hsCodeVersionService) {
        this.hsCodeVersionService = hsCodeVersionService;
    }
    validateHsCodeFormat(hsCode) {
        const errors = [];
        const warnings = [];
        const details = {
            formatValid: true,
            lengthValid: true,
            checkDigitValid: null,
            numericValid: true,
        };
        const cleanCode = hsCode.replace(/[\s\.\-]/g, '');
        if (!/^\d+$/.test(cleanCode)) {
            details.numericValid = false;
            details.formatValid = false;
            errors.push('HS编码只能包含数字');
        }
        const length = cleanCode.length;
        if (length < 6 || length > 10) {
            details.lengthValid = false;
            details.formatValid = false;
            errors.push(`HS编码长度应为6-10位，当前为${length}位`);
        }
        else if (length === 6) {
            warnings.push('HS编码为6位国际编码，建议补充到8-10位国家编码');
        }
        if (length >= 8 && details.numericValid) {
            const checkDigit = this.calculateCheckDigit(cleanCode.substring(0, 7));
            const actualDigit = parseInt(cleanCode[7], 10);
            details.checkDigitValid = checkDigit === actualDigit;
            if (!details.checkDigitValid) {
                warnings.push(`HS编码第8位校验位可能不正确，期望${checkDigit}，实际${actualDigit}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            details,
        };
    }
    calculateCheckDigit(digits) {
        let sum = 0;
        const weights = [1, 3, 1, 3, 1, 3, 1];
        for (let i = 0; i < 7; i++) {
            sum += parseInt(digits[i], 10) * weights[i];
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit;
    }
    async validateHsCodeVersion(id) {
        const codes = await this.hsCodeVersionService.findAll({});
        const code = codes.find(c => c.id === id);
        if (!code) {
            throw new Error(`HS编码记录 ${id} 不存在`);
        }
        const validation = this.validateHsCodeFormat(code.hsCode);
        const status = validation.isValid
            ? hs_code_version_entity_1.HsCodeVerificationStatus.VALID
            : hs_code_version_entity_1.HsCodeVerificationStatus.INVALID;
        await this.hsCodeVersionService.updateVerificationStatus(id, status, [...validation.errors, ...validation.warnings].join('; '));
        return {
            hsCode: code.hsCode,
            productName: code.productName,
            validation,
        };
    }
    async validateBatchHsCodes(batchId) {
        const activeCodes = await this.hsCodeVersionService.findActiveByBatch(batchId);
        const invoiceCodes = activeCodes.filter(c => c.source === hs_code_version_entity_1.HsCodeSource.INVOICE);
        const packingListCodes = activeCodes.filter(c => c.source === hs_code_version_entity_1.HsCodeSource.PACKING_LIST);
        let validCodes = 0;
        let invalidCodes = 0;
        let pendingCodes = 0;
        const details = [];
        for (const code of activeCodes) {
            const validation = this.validateHsCodeFormat(code.hsCode);
            const messages = [...validation.errors, ...validation.warnings];
            let status;
            if (validation.isValid && validation.errors.length === 0) {
                status = hs_code_version_entity_1.HsCodeVerificationStatus.VALID;
                validCodes++;
            }
            else if (validation.errors.length > 0) {
                status = hs_code_version_entity_1.HsCodeVerificationStatus.INVALID;
                invalidCodes++;
            }
            else {
                status = hs_code_version_entity_1.HsCodeVerificationStatus.PENDING;
                pendingCodes++;
            }
            await this.hsCodeVersionService.updateVerificationStatus(code.id, status, messages.join('; '));
            details.push({
                hsCode: code.hsCode,
                productName: code.productName,
                source: code.source,
                status,
                messages,
            });
        }
        const crossSourceMismatches = [];
        const invoiceMap = new Map();
        const packingMap = new Map();
        invoiceCodes.forEach(c => invoiceMap.set(c.hsCode, c));
        packingListCodes.forEach(c => packingMap.set(c.hsCode, c));
        for (const [hsCode, invoiceCode] of invoiceMap.entries()) {
            const packingCode = packingMap.get(hsCode);
            if (packingCode) {
                const difference = Math.abs(invoiceCode.quantity - packingCode.quantity);
                if (difference > 0) {
                    crossSourceMismatches.push({
                        hsCode,
                        invoiceQuantity: invoiceCode.quantity,
                        packingListQuantity: packingCode.quantity,
                        difference,
                        productNameInvoice: invoiceCode.productName,
                        productNamePackingList: packingCode.productName,
                    });
                }
            }
        }
        const sourceComparison = [
            {
                source: 'INVOICE',
                total: invoiceCodes.length,
                valid: invoiceCodes.filter(c => c.verificationStatus === hs_code_version_entity_1.HsCodeVerificationStatus.VALID).length,
                invalid: invoiceCodes.filter(c => c.verificationStatus === hs_code_version_entity_1.HsCodeVerificationStatus.INVALID).length,
            },
            {
                source: 'PACKING_LIST',
                total: packingListCodes.length,
                valid: packingListCodes.filter(c => c.verificationStatus === hs_code_version_entity_1.HsCodeVerificationStatus.VALID).length,
                invalid: packingListCodes.filter(c => c.verificationStatus === hs_code_version_entity_1.HsCodeVerificationStatus.INVALID).length,
            },
        ];
        return {
            batchId,
            totalCodes: activeCodes.length,
            validCodes,
            invalidCodes,
            mismatchedCodes: crossSourceMismatches.length,
            pendingCodes,
            sourceComparison,
            crossSourceMismatches,
            details,
        };
    }
};
exports.HsCodeValidationService = HsCodeValidationService;
exports.HsCodeValidationService = HsCodeValidationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [hs_code_version_service_1.HsCodeVersionService])
], HsCodeValidationService);
//# sourceMappingURL=hs-code-validation.service.js.map