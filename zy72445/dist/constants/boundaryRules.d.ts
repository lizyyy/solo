export declare const BOUNDARY_RULES: {
    readonly reworkReason: {
        readonly keywords: readonly ["返工", "重录", "修改", "调整", "需复核", "待确认", "不对", "错误"];
        readonly autoDetect: true;
        readonly requireManualReview: true;
        readonly preventAutoNormal: true;
    };
    readonly importDeduplication: {
        readonly checkBatchIdentifier: true;
        readonly checkTrackIdAndAliases: true;
        readonly skipDuplicates: true;
        readonly updateIfExists: false;
    };
    readonly statusTransition: {
        readonly allowedPaths: {
            readonly pending: readonly ["reviewing", "rework_required"];
            readonly reviewing: readonly ["approved", "rejected", "rework_required"];
            readonly rework_required: readonly ["reviewing", "approved"];
            readonly approved: readonly ["normal"];
            readonly rejected: readonly ["reviewing"];
            readonly normal: readonly [];
        };
        readonly requireReviewBeforeNormal: true;
        readonly allowRollbackFrom: readonly ["reviewing", "rework_required", "approved"];
    };
    readonly workflow: {
        readonly steps: readonly ["alias_import", "photo_review", "rehearsal_update"];
        readonly requirePhotoReview: true;
        readonly requireRehearsalUpdate: true;
        readonly skipReworkTracks: false;
    };
    readonly displayMode: {
        readonly chart: {
            readonly requireServiceReview: true;
            readonly allowNavigationBack: true;
        };
        readonly three_d: {
            readonly requireServiceReview: true;
            readonly allowNavigationBack: true;
        };
    };
};
export type BoundaryRules = typeof BOUNDARY_RULES;
