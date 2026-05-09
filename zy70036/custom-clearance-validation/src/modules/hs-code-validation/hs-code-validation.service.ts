import { Injectable } from '@nestjs/common';
import { HsCodeVersionService } from '../version-management/hs-code-version.service';
import { HsCodeSource, HsCodeVerificationStatus } from '../../entities/hs-code-version.entity';

export interface HsCodeRuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    formatValid: boolean;
    lengthValid: boolean;
    checkDigitValid: boolean | null;
    numericValid: boolean;
  };
}

export interface HsCodeBatchValidationResult {
  batchId: string;
  totalCodes: number;
  validCodes: number;
  invalidCodes: number;
  mismatchedCodes: number;
  pendingCodes: number;
  sourceComparison: {
    source: string;
    total: number;
    valid: number;
    invalid: number;
  }[];
  crossSourceMismatches: {
    hsCode: string;
    invoiceQuantity: number;
    packingListQuantity: number;
    difference: number;
    productNameInvoice: string;
    productNamePackingList: string;
  }[];
  details: {
    hsCode: string;
    productName: string;
    source: string;
    status: string;
    messages: string[];
  }[];
}

@Injectable()
export class HsCodeValidationService {
  constructor(private readonly hsCodeVersionService: HsCodeVersionService) {}

  validateHsCodeFormat(hsCode: string): HsCodeRuleValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details = {
      formatValid: true,
      lengthValid: true,
      checkDigitValid: null as boolean | null,
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
    } else if (length === 6) {
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

  private calculateCheckDigit(digits: string): number {
    let sum = 0;
    const weights = [1, 3, 1, 3, 1, 3, 1];
    
    for (let i = 0; i < 7; i++) {
      sum += parseInt(digits[i], 10) * weights[i];
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit;
  }

  async validateHsCodeVersion(id: string): Promise<{
    hsCode: string;
    productName: string;
    validation: HsCodeRuleValidationResult;
  }> {
    const codes = await this.hsCodeVersionService.findAll({});
    const code = codes.find(c => c.id === id);
    if (!code) {
      throw new Error(`HS编码记录 ${id} 不存在`);
    }

    const validation = this.validateHsCodeFormat(code.hsCode);
    const status = validation.isValid
      ? HsCodeVerificationStatus.VALID
      : HsCodeVerificationStatus.INVALID;

    await this.hsCodeVersionService.updateVerificationStatus(
      id,
      status,
      [...validation.errors, ...validation.warnings].join('; '),
    );

    return {
      hsCode: code.hsCode,
      productName: code.productName,
      validation,
    };
  }

  async validateBatchHsCodes(batchId: string): Promise<HsCodeBatchValidationResult> {
    const activeCodes = await this.hsCodeVersionService.findActiveByBatch(batchId);

    const invoiceCodes = activeCodes.filter(c => c.source === HsCodeSource.INVOICE);
    const packingListCodes = activeCodes.filter(c => c.source === HsCodeSource.PACKING_LIST);

    let validCodes = 0;
    let invalidCodes = 0;
    let pendingCodes = 0;
    const details: HsCodeBatchValidationResult['details'] = [];

    for (const code of activeCodes) {
      const validation = this.validateHsCodeFormat(code.hsCode);
      const messages = [...validation.errors, ...validation.warnings];

      let status: HsCodeVerificationStatus;
      if (validation.isValid && validation.errors.length === 0) {
        status = HsCodeVerificationStatus.VALID;
        validCodes++;
      } else if (validation.errors.length > 0) {
        status = HsCodeVerificationStatus.INVALID;
        invalidCodes++;
      } else {
        status = HsCodeVerificationStatus.PENDING;
        pendingCodes++;
      }

      await this.hsCodeVersionService.updateVerificationStatus(
        code.id,
        status,
        messages.join('; '),
      );

      details.push({
        hsCode: code.hsCode,
        productName: code.productName,
        source: code.source,
        status,
        messages,
      });
    }

    const crossSourceMismatches: HsCodeBatchValidationResult['crossSourceMismatches'] = [];
    const invoiceMap = new Map<string, typeof invoiceCodes[0]>();
    const packingMap = new Map<string, typeof packingListCodes[0]>();

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
        valid: invoiceCodes.filter(c => c.verificationStatus === HsCodeVerificationStatus.VALID).length,
        invalid: invoiceCodes.filter(c => c.verificationStatus === HsCodeVerificationStatus.INVALID).length,
      },
      {
        source: 'PACKING_LIST',
        total: packingListCodes.length,
        valid: packingListCodes.filter(c => c.verificationStatus === HsCodeVerificationStatus.VALID).length,
        invalid: packingListCodes.filter(c => c.verificationStatus === HsCodeVerificationStatus.INVALID).length,
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
}
