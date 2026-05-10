import { storageService } from './storage';
import type {
  ExchangeRequest,
  ValidationResult,
  ValidationCheck,
  ValidationHistory,
  ValidationStatus,
} from '../types';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export interface ValidationContext {
  operator: string;
}

export const validationService = {
  validateSizeActive(request: ExchangeRequest): ValidationCheck {
    const student = storageService.getStudentById(request.studentId);
    
    if (!student) {
      return {
        name: '尺码是否生效',
        passed: false,
        message: '未找到学生信息',
        details: { studentId: request.studentId },
      };
    }

    if (!student.isSizeActive) {
      return {
        name: '尺码是否生效',
        passed: false,
        message: '学生尺码信息未生效，请先激活尺码',
        details: { 
          studentName: student.name,
          isSizeActive: student.isSizeActive,
        },
      };
    }

    return {
      name: '尺码是否生效',
      passed: true,
      message: '学生尺码信息已生效',
      details: { 
        studentName: student.name,
        isSizeActive: student.isSizeActive,
        registeredSize: student.registeredSize,
      },
    };
  },

  validateDistributionRecord(request: ExchangeRequest): ValidationCheck {
    const distribution = storageService.getDistributionById(request.relatedDistributionId);
    const student = storageService.getStudentById(request.studentId);

    if (!distribution) {
      return {
        name: '发放记录核对',
        passed: false,
        message: '未找到关联的发放记录',
        details: { distributionId: request.relatedDistributionId },
      };
    }

    if (!distribution.recipientSignature) {
      return {
        name: '发放记录核对',
        passed: false,
        message: '发放记录缺少接收人签字，请补签后重试',
        details: { 
          studentName: student?.name,
          recipientSignature: distribution.recipientSignature,
        },
      };
    }

    if (distribution.distributedSize !== request.originalSize) {
      return {
        name: '发放记录核对',
        passed: false,
        message: `发放记录中的尺码(${distribution.distributedSize})与申请中的原尺码(${request.originalSize})不一致`,
        details: { 
          distributedSize: distribution.distributedSize,
          requestOriginalSize: request.originalSize,
        },
      };
    }

    if (distribution.uniformType !== request.uniformType) {
      return {
        name: '发放记录核对',
        passed: false,
        message: `发放记录中的服装类型(${distribution.uniformType})与申请中的类型(${request.uniformType})不一致`,
        details: { 
          distributedType: distribution.uniformType,
          requestType: request.uniformType,
        },
      };
    }

    return {
      name: '发放记录核对',
      passed: true,
      message: '发放记录与申请一致，且已签字确认',
      details: { 
        distributionDate: distribution.distributionDate,
        distributor: distribution.distributor,
        recipientSignature: distribution.recipientSignature,
      },
    };
  },

  validateExchangeMatch(request: ExchangeRequest): ValidationCheck {
    const distribution = storageService.getDistributionById(request.relatedDistributionId);
    const student = storageService.getStudentById(request.studentId);

    if (!distribution || !student) {
      return {
        name: '换领申请匹配',
        passed: false,
        message: '缺少必要的关联数据',
      };
    }

    if (distribution.studentId !== request.studentId) {
      return {
        name: '换领申请匹配',
        passed: false,
        message: '发放记录与学生不匹配',
        details: { 
          distributionStudentId: distribution.studentId,
          requestStudentId: request.studentId,
        },
      };
    }

    if (request.originalSize === request.requestedSize) {
      return {
        name: '换领申请匹配',
        passed: false,
        message: '原尺码与申请尺码相同，无需换领',
        details: { 
          originalSize: request.originalSize,
          requestedSize: request.requestedSize,
        },
      };
    }

    return {
      name: '换领申请匹配',
      passed: true,
      message: '换领申请与原始发放数据对应',
      details: { 
        studentName: student.name,
        originalSize: request.originalSize,
        requestedSize: request.requestedSize,
      },
    };
  },

  validateRequest(request: ExchangeRequest, context: ValidationContext): ValidationResult {
    const checks: ValidationCheck[] = [
      this.validateSizeActive(request),
      this.validateDistributionRecord(request),
      this.validateExchangeMatch(request),
    ];

    const allPassed = checks.every((c) => c.passed);
    const failedChecks = checks.filter((c) => !c.passed);

    let overallStatus: ValidationStatus;
    let needsManualReview = false;
    let manualReviewReason: string | undefined;

    if (allPassed) {
      overallStatus = 'passed';
    } else {
      const canRetryChecks = failedChecks.filter((c) => {
        const msg = c.message;
        return (
          msg.includes('未生效') ||
          msg.includes('补签') ||
          msg.includes('不一致') ||
          msg.includes('不匹配')
        );
      });

      if (canRetryChecks.length === failedChecks.length && request.retryCount < 3) {
        overallStatus = 'retry';
      } else if (failedChecks.some((c) => c.message.includes('未找到'))) {
        overallStatus = 'failed';
        needsManualReview = true;
        manualReviewReason = '存在数据缺失问题，需要人工核查';
      } else {
        overallStatus = 'failed';
      }
    }

    return {
      overallStatus,
      checks,
      needsManualReview,
      manualReviewReason,
      canRetry: overallStatus !== 'passed',
      retryInstructions: overallStatus === 'retry' 
        ? '请修正以下问题后重新验证：' + failedChecks.map(c => c.message).join('；')
        : undefined,
    };
  },

  createValidationHistory(
    result: ValidationResult,
    context: ValidationContext
  ): ValidationHistory {
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      operator: context.operator,
      result: result.overallStatus,
      checks: result.checks,
    };
  },
};
