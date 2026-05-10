import { BadRequestException, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';

export class CertificateNotFoundException extends NotFoundException {
  constructor(certificateNumber: string) {
    super(`检疫证号 [${certificateNumber}] 不存在`);
  }
}

export class DuplicateCertificateException extends ConflictException {
  constructor(certificateNumber: string, existingCount: number) {
    super({
      message: `检测到证号 [${certificateNumber}] 重复，当前已有 ${existingCount} 条记录`,
      certificateNumber,
      existingCount,
      needsReview: true,
      reviewReason: 'DUPLICATE_CERTIFICATE_NUMBER',
    });
  }
}

export class InvalidStatusTransitionException extends BadRequestException {
  constructor(from: string, to: string, reason?: string) {
    super({
      message: `不允许的状态转换: ${from} -> ${to}`,
      from,
      to,
      reason: reason || '状态转换不符合业务规则',
      needsReview: false,
    });
  }
}

export class BatchAlreadyBoundException extends ConflictException {
  constructor(certificateNumber: string, batchId: string) {
    super({
      message: `检疫证 [${certificateNumber}] 已绑定到批次 [${batchId}]`,
      certificateNumber,
      batchId,
      needsReview: false,
    });
  }
}

export class BatchNotFoundException extends NotFoundException {
  constructor(batchId: string) {
    super(`批次 [${batchId}] 不存在`);
  }
}

export class TransportNotFoundException extends NotFoundException {
  constructor(transportId: string) {
    super(`运输记录 [${transportId}] 不存在`);
  }
}

export class CertificateAlreadyVoidedException extends BadRequestException {
  constructor(certificateNumber: string) {
    super({
      message: `检疫证 [${certificateNumber}] 已作废，无法进行该操作`,
      certificateNumber,
      needsReview: false,
    });
  }
}

export class ManualCorrectionConflictException extends ConflictException {
  constructor(certificateNumber: string) {
    super({
      message: `检疫证 [${certificateNumber}] 已被人工修正，操作需要确认`,
      certificateNumber,
      needsReview: true,
      reviewReason: 'MANUAL_CORRECTION_CONFLICT',
      reviewPriority: 'high',
    });
  }
}

export class ProcessingException extends InternalServerErrorException {
  constructor(message: string, context?: any) {
    super({
      message,
      context,
      needsReview: true,
      reviewReason: 'PROCESSING_ERROR',
      reviewPriority: 'medium',
    });
  }
}
