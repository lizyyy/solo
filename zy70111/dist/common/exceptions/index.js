"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessingException = exports.ManualCorrectionConflictException = exports.CertificateAlreadyVoidedException = exports.TransportNotFoundException = exports.BatchNotFoundException = exports.BatchAlreadyBoundException = exports.InvalidStatusTransitionException = exports.DuplicateCertificateException = exports.CertificateNotFoundException = void 0;
const common_1 = require("@nestjs/common");
class CertificateNotFoundException extends common_1.NotFoundException {
    constructor(certificateNumber) {
        super(`检疫证号 [${certificateNumber}] 不存在`);
    }
}
exports.CertificateNotFoundException = CertificateNotFoundException;
class DuplicateCertificateException extends common_1.ConflictException {
    constructor(certificateNumber, existingCount) {
        super({
            message: `检测到证号 [${certificateNumber}] 重复，当前已有 ${existingCount} 条记录`,
            certificateNumber,
            existingCount,
            needsReview: true,
            reviewReason: 'DUPLICATE_CERTIFICATE_NUMBER',
        });
    }
}
exports.DuplicateCertificateException = DuplicateCertificateException;
class InvalidStatusTransitionException extends common_1.BadRequestException {
    constructor(from, to, reason) {
        super({
            message: `不允许的状态转换: ${from} -> ${to}`,
            from,
            to,
            reason: reason || '状态转换不符合业务规则',
            needsReview: false,
        });
    }
}
exports.InvalidStatusTransitionException = InvalidStatusTransitionException;
class BatchAlreadyBoundException extends common_1.ConflictException {
    constructor(certificateNumber, batchId) {
        super({
            message: `检疫证 [${certificateNumber}] 已绑定到批次 [${batchId}]`,
            certificateNumber,
            batchId,
            needsReview: false,
        });
    }
}
exports.BatchAlreadyBoundException = BatchAlreadyBoundException;
class BatchNotFoundException extends common_1.NotFoundException {
    constructor(batchId) {
        super(`批次 [${batchId}] 不存在`);
    }
}
exports.BatchNotFoundException = BatchNotFoundException;
class TransportNotFoundException extends common_1.NotFoundException {
    constructor(transportId) {
        super(`运输记录 [${transportId}] 不存在`);
    }
}
exports.TransportNotFoundException = TransportNotFoundException;
class CertificateAlreadyVoidedException extends common_1.BadRequestException {
    constructor(certificateNumber) {
        super({
            message: `检疫证 [${certificateNumber}] 已作废，无法进行该操作`,
            certificateNumber,
            needsReview: false,
        });
    }
}
exports.CertificateAlreadyVoidedException = CertificateAlreadyVoidedException;
class ManualCorrectionConflictException extends common_1.ConflictException {
    constructor(certificateNumber) {
        super({
            message: `检疫证 [${certificateNumber}] 已被人工修正，操作需要确认`,
            certificateNumber,
            needsReview: true,
            reviewReason: 'MANUAL_CORRECTION_CONFLICT',
            reviewPriority: 'high',
        });
    }
}
exports.ManualCorrectionConflictException = ManualCorrectionConflictException;
class ProcessingException extends common_1.InternalServerErrorException {
    constructor(message, context) {
        super({
            message,
            context,
            needsReview: true,
            reviewReason: 'PROCESSING_ERROR',
            reviewPriority: 'medium',
        });
    }
}
exports.ProcessingException = ProcessingException;
//# sourceMappingURL=index.js.map