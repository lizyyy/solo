"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiresReview = exports.REQUIRES_REVIEW = exports.SkipDuplicateCheck = exports.SKIP_DUPLICATE_CHECK = exports.AuditAction = exports.AUDIT_ACTION = exports.CurrentUser = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentUser = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || {
        userId: 'system',
        userName: 'System',
        role: 'admin',
        source: 'slaughterhouse',
    };
});
exports.AUDIT_ACTION = 'audit_action';
const AuditAction = (action) => (0, common_1.SetMetadata)(exports.AUDIT_ACTION, action);
exports.AuditAction = AuditAction;
exports.SKIP_DUPLICATE_CHECK = 'skip_duplicate_check';
const SkipDuplicateCheck = () => (0, common_1.SetMetadata)(exports.SKIP_DUPLICATE_CHECK, true);
exports.SkipDuplicateCheck = SkipDuplicateCheck;
exports.REQUIRES_REVIEW = 'requires_review';
const RequiresReview = (reason) => (0, common_1.SetMetadata)(exports.REQUIRES_REVIEW, reason);
exports.RequiresReview = RequiresReview;
//# sourceMappingURL=index.js.map