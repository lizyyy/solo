export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
export declare const AUDIT_ACTION = "audit_action";
export declare const AuditAction: (action: string) => import("@nestjs/common").CustomDecorator<string>;
export declare const SKIP_DUPLICATE_CHECK = "skip_duplicate_check";
export declare const SkipDuplicateCheck: () => import("@nestjs/common").CustomDecorator<string>;
export declare const REQUIRES_REVIEW = "requires_review";
export declare const RequiresReview: (reason: string) => import("@nestjs/common").CustomDecorator<string>;
