import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || {
      userId: 'system',
      userName: 'System',
      role: 'admin',
      source: 'slaughterhouse',
    };
  },
);

export const AUDIT_ACTION = 'audit_action';
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION, action);

export const SKIP_DUPLICATE_CHECK = 'skip_duplicate_check';
export const SkipDuplicateCheck = () => SetMetadata(SKIP_DUPLICATE_CHECK, true);

export const REQUIRES_REVIEW = 'requires_review';
export const RequiresReview = (reason: string) => SetMetadata(REQUIRES_REVIEW, reason);
